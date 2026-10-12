// Leitura de fatura/extrato com a IA (Claude). Usado pelo site (api/fatura.ts) e pelo WhatsApp (api/whatsapp.ts).
// O arquivo não é guardado: vai pra API do Claude, a resposta volta e pronto.

import Anthropic from '@anthropic-ai/sdk';

export const MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export const MAX_BASE64 = 4_000_000; // ~3 MB de arquivo; o corpo da requisição na Vercel vai até 4,5 MB

export interface FaturaResult {
  e_documento_financeiro: boolean;
  periodo: string;
  total: number;
  categorias: { nome: string; total: number }[];
  cobrancas: { descricao: string; valor: number; tipo: 'assinatura' | 'seguro' | 'tarifa' | 'anuidade' | 'juros_multa' | 'outro'; dica: string }[];
  parcelados: { descricao: string; parcela: number; parcelas_restantes: number }[];
  alertas: string[];
}

export type FaturaOutcome = { ok: true; result: FaturaResult } | { ok: false; status: number; error: string };

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


/** Manda o arquivo pro Claude e devolve a leitura estruturada, ou um erro já em português com o status HTTP. */
export async function analyzeFatura(mediaType: MediaType, base64: string): Promise<FaturaOutcome> {
  const file: Anthropic.Beta.BetaContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

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
    if (err instanceof Anthropic.RateLimitError) return { ok: false, status: 503, error: 'Muita gente usando agora. Tenta de novo em um minuto.' };
    if (err instanceof Anthropic.BadRequestError) return { ok: false, status: 400, error: 'Não consegui abrir esse arquivo. Tenta um PDF ou uma foto mais nítida.' };
    console.error('Fatura: erro na API', err);
    return { ok: false, status: 502, error: 'Tive um problema pra ler agora. Tenta de novo em alguns minutos.' };
  }

  if (response.stop_reason === 'refusal') return { ok: false, status: 422, error: 'Não consegui analisar esse arquivo.' };
  if (response.stop_reason === 'max_tokens') return { ok: false, status: 422, error: 'O documento é longo demais pra uma leitura. Tenta mandar só as páginas dos lançamentos.' };

  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
  try {
    return { ok: true, result: JSON.parse(text ?? '') as FaturaResult };
  } catch {
    return { ok: false, status: 502, error: 'Não consegui organizar a leitura. Tenta de novo.' };
  }
}
