// Leitor de fatura/extrato com IA. Recebe o PDF ou a foto, devolve os gastos organizados e os
// "vazamentos" encontrados (assinaturas, seguros, tarifas, anuidade, juros e multas).
// O arquivo não é guardado: vai pra API do Claude, a resposta volta pro navegador e pronto.
//
// Exige login (o limite de uso por mês fica na conta) e ANTHROPIC_API_KEY na Vercel.

import Anthropic from '@anthropic-ai/sdk';
import { accountsConfigured, findUserById, updateUser, userIdFromToken } from '../server/account/db.js';

const MONTHLY_LIMIT = Number(process.env.FATURA_MONTHLY_LIMIT || 5);
const MAX_BASE64 = 4_000_000; // ~3 MB de arquivo; o corpo da requisição na Vercel vai até 4,5 MB
const MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Compras', 'Educação', 'Serviços e contas', 'Outros'];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['e_documento_financeiro', 'periodo', 'total', 'categorias', 'cobrancas', 'parcelados', 'alertas'],
  properties: {
    e_documento_financeiro: { type: 'boolean', description: 'false se o arquivo não for fatura de cartão nem extrato bancário' },
    periodo: { type: 'string', description: 'mês/ano de referência, ex.: "setembro de 2026"; vazio se não der pra saber' },
    total: { type: 'number', description: 'total de gastos/débitos do período, em reais' },
    categorias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nome', 'total'],
        properties: { nome: { type: 'string', enum: CATEGORIES }, total: { type: 'number' } },
      },
    },
    cobrancas: {
      type: 'array',
      description: 'cobranças que se repetem ou que a pessoa pode cortar/contestar',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['descricao', 'valor', 'tipo', 'dica'],
        properties: {
          descricao: { type: 'string', description: 'como aparece no documento, ex.: "NETFLIX.COM"' },
          valor: { type: 'number', description: 'valor mensal em reais' },
          tipo: { type: 'string', enum: ['assinatura', 'seguro', 'tarifa', 'anuidade', 'juros_multa', 'outro'] },
          dica: { type: 'string', description: 'uma frase curta: o que a pessoa pode fazer' },
        },
      },
    },
    parcelados: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['descricao', 'parcela', 'parcelas_restantes'],
        properties: {
          descricao: { type: 'string' },
          parcela: { type: 'number' },
          parcelas_restantes: { type: 'integer', description: '0 se não der pra saber' },
        },
      },
    },
    alertas: {
      type: 'array',
      description: 'até 3 observações importantes, ex.: pagamento mínimo da fatura, rotativo, cobrança duplicada',
      items: { type: 'string' },
    },
  },
} as const;

const SYSTEM = `Você analisa faturas de cartão de crédito e extratos bancários brasileiros para a Grana Séria, um site de educação financeira.
Leia o documento inteiro e preencha o JSON pedido, com valores em reais (número, sem "R$").
- categorias: some os gastos do período por categoria. Pagamentos da própria fatura, estornos e transferências entre contas da pessoa não são gastos.
- cobrancas: liste assinaturas (streaming, apps, academia, "teste grátis"), seguros e "proteções", tarifas e pacotes de serviço, anuidade, e juros/multas/IOF de atraso ou rotativo. Uma linha por cobrança, com o valor mensal.
- parcelados: compras parceladas em andamento ("03/10" = parcela 3 de 10 → 7 restantes).
- alertas: só o que for importante e estiver no documento.
Não invente: se algo não aparece no documento, deixe a lista vazia. Se o arquivo não for fatura nem extrato, marque e_documento_financeiro como false e deixe o resto vazio.`;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY || !accountsConfigured()) return json({ error: 'O leitor de fatura ainda não foi ativado.' }, 503);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const userId = token ? await userIdFromToken(token) : null;
  if (!userId) return json({ error: 'Entre na sua conta pra usar o leitor de fatura.' }, 401);

  let body: { mediaType?: string; data?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Arquivo inválido.' }, 400);
  }
  const mediaType = body.mediaType as MediaType;
  if (!MEDIA_TYPES.includes(mediaType) || typeof body.data !== 'string' || body.data.length === 0) {
    return json({ error: 'Mande um PDF ou uma foto (JPG, PNG).' }, 400);
  }
  if (body.data.length > MAX_BASE64) return json({ error: 'Arquivo grande demais (máximo 3 MB).' }, 413);

  // limite por mês, contado no servidor
  const month = new Date().toISOString().slice(0, 7);
  const user = await findUserById(userId);
  if (!user) return json({ error: 'Abra a página da sua conta uma vez antes de usar o leitor.' }, 409);
  const used = user.fatura_month === month ? user.fatura_count : 0;
  if (used >= MONTHLY_LIMIT) return json({ error: `Você já usou as ${MONTHLY_LIMIT} leituras deste mês. Volta no mês que vem!` }, 429);

  const file: Anthropic.Beta.BetaContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: body.data } };

  const client = new Anthropic();
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: [file, { type: 'text', text: 'Analise este documento.' }] }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Muita gente usando agora. Tenta de novo em um minuto.' }, 503);
    if (err instanceof Anthropic.BadRequestError) return json({ error: 'Não consegui abrir esse arquivo. Tenta um PDF ou uma foto mais nítida.' }, 400);
    console.error('Fatura: erro na API', err);
    return json({ error: 'Tive um problema pra ler agora. Tenta de novo em alguns minutos.' }, 502);
  }

  if (response.stop_reason === 'refusal') return json({ error: 'Não consegui analisar esse arquivo.' }, 422);
  if (response.stop_reason === 'max_tokens') return json({ error: 'O documento é longo demais pra uma leitura. Tenta mandar só as páginas dos lançamentos.' }, 422);

  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
  let result: unknown;
  try {
    result = JSON.parse(text ?? '');
  } catch {
    return json({ error: 'Não consegui organizar a leitura. Tenta de novo.' }, 502);
  }

  await updateUser(userId, { fatura_month: month, fatura_count: used + 1 });
  return json({ result, remaining: MONTHLY_LIMIT - used - 1 });
}
