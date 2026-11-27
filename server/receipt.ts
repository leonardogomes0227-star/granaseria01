// Leitura de cupom fiscal, nota, recibo ou comprovante de pix/transferência com a IA (Claude).
// Diferente da fatura (muitos lançamentos), aqui é UM pagamento: vira um gasto (ou uma entrada, se o pix foi recebido).
// O arquivo não é guardado: vai pra API do Claude, a resposta volta e pronto.

import Anthropic from '@anthropic-ai/sdk';
import { conteudoConfere } from './arquivo.js';
import { CATEGORIES, OTHER_CATEGORY } from './whatsapp/parse.js';
import type { MediaType } from './fatura.js';

const CATEGORY_NAMES = [...CATEGORIES.map((c) => c.name), OTHER_CATEGORY.name];
const METHOD_NAMES = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Boleto', 'Vale', 'Cartão'];

export interface Receipt {
  tipo: 'pagamento' | 'recebimento' | 'fatura_extrato' | 'outro';
  valor: number;
  descricao: string;
  categoria: string;
  forma_pagamento: string; // '' se não der pra saber
  data: string; // AAAA-MM-DD, '' se não aparece
}

export type ReceiptOutcome = { ok: true; receipt: Receipt } | { ok: false; error: string };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo', 'valor', 'descricao', 'categoria', 'forma_pagamento', 'data'],
  properties: {
    tipo: {
      type: 'string',
      enum: ['pagamento', 'recebimento', 'fatura_extrato', 'outro'],
      description:
        'pagamento = cupom, nota, recibo ou comprovante de algo que a pessoa pagou; recebimento = comprovante de pix/transferência que a pessoa RECEBEU; fatura_extrato = fatura de cartão ou extrato com vários lançamentos; outro = não é documento de pagamento',
    },
    valor: { type: 'number', description: 'valor total pago ou recebido, em reais; 0 se não der pra ler' },
    descricao: { type: 'string', description: 'curto: o estabelecimento ou o que foi, ex.: "Padaria Pão Quente", "pix para Maria"' },
    categoria: { type: 'string', enum: CATEGORY_NAMES },
    forma_pagamento: { type: 'string', enum: [...METHOD_NAMES, ''], description: 'como foi pago; vazio se o documento não diz' },
    data: { type: 'string', description: 'data do pagamento no formato AAAA-MM-DD; vazio se não aparece' },
  },
} as const;

const SYSTEM = `Você lê fotos e PDFs de cupons fiscais, notas, recibos e comprovantes de pix, TED ou boleto brasileiros para a Grana Séria, um assistente de gastos.
Preencha o JSON com o pagamento do documento:
- valor: o TOTAL pago (no cupom, o "TOTAL" ou "VALOR A PAGAR", não um item). Em reais, número sem "R$".
- descricao: o nome do estabelecimento ou para quem foi o pix, curto.
- categoria: a que melhor descreve o gasto (mercado e restaurante = Alimentação; posto e app de corrida = Transporte; aluguel, luz, água, internet = Moradia; farmácia = Saúde).
- forma_pagamento: Pix, Débito, Crédito, Dinheiro, Boleto, Vale ou Cartão (cartão sem dizer qual), se estiver escrito.
- tipo "recebimento" só quando o comprovante mostra que a pessoa recebeu o dinheiro.
Não invente: o que não aparece fica vazio (ou 0). Se for fatura de cartão ou extrato com vários lançamentos, use tipo fatura_extrato e deixe o resto vazio.`;

/** Lê o documento e devolve o pagamento, ou um erro já em português. */
export async function analyzeReceipt(mediaType: MediaType, base64: string): Promise<ReceiptOutcome> {
  if (!conteudoConfere(mediaType, base64)) return { ok: false, error: 'Esse arquivo não parece uma foto ou um PDF.' };
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
      messages: [{ role: 'user', content: [file, { type: 'text', text: 'Leia este documento.' }] }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: 'Muita gente usando agora. Tenta de novo em um minuto.' };
    if (err instanceof Anthropic.BadRequestError) return { ok: false, error: 'Não consegui abrir esse arquivo. Tenta uma foto mais nítida.' };
    console.error('Cupom: erro na API', err);
    return { ok: false, error: 'Tive um problema pra ler agora. Tenta de novo em alguns minutos.' };
  }

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return { ok: false, error: 'Não consegui ler esse documento.' };
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
  try {
    return { ok: true, receipt: sanitizeReceipt(JSON.parse(text ?? '')) };
  } catch {
    return { ok: false, error: 'Não consegui organizar a leitura. Tenta de novo.' };
  }
}

/** Nunca confia no formato nem nos valores que vêm da IA. */
export function sanitizeReceipt(raw: unknown): Receipt {
  const r = (raw ?? {}) as Partial<Record<keyof Receipt, unknown>>;
  const tipo = (['pagamento', 'recebimento', 'fatura_extrato', 'outro'] as const).find((t) => t === r.tipo) ?? 'outro';
  const valor = typeof r.valor === 'number' && Number.isFinite(r.valor) && r.valor > 0 && r.valor <= 1_000_000 ? Math.round(r.valor * 100) / 100 : 0;
  return {
    tipo,
    valor,
    descricao: (typeof r.descricao === 'string' && r.descricao.trim().slice(0, 80)) || 'Sem descrição',
    categoria: typeof r.categoria === 'string' && CATEGORY_NAMES.includes(r.categoria) ? r.categoria : OTHER_CATEGORY.name,
    forma_pagamento: typeof r.forma_pagamento === 'string' && METHOD_NAMES.includes(r.forma_pagamento) ? r.forma_pagamento : '',
    data: typeof r.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.data) ? r.data : '',
  };
}
