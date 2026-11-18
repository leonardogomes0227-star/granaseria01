// Assistente de Investimentos (chat aberto). A chave fica só aqui (ANTHROPIC_API_KEY); o navegador nunca a vê.
// Sem a chave, responde 503 com { guiado: true } e o app entra no modo guiado.

import { obterMercado } from '../../server/mercado/fontes.js';
import { bumpUsage } from '../../server/whatsapp/hubdb.js';

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const LIMITE_DIA = 20;
const MAX_MSG = 1000;

export const SYSTEM_PROMPT =
  "Você é o Assistente de Investimentos do app Grana Séria. Ensina educação financeira com base nos princípios de 'O Homem Mais Rico da Babilônia': pague-se primeiro guardando ao menos 10% do que ganha; controle seus gastos; faça seu dinheiro render; proteja-o de riscos e de promessas fáceis; busque conselho de quem entende; aumente sua capacidade de ganhar. Fale em português do Brasil, frases curtas, sem jargão (se usar um termo, explique em meia frase). Use os dados do usuário e os números de mercado que estão no contexto; nunca invente números, cotações ou rentabilidades; se o dado não estiver no contexto, diga que não tem. COMO RESPONDER: (1) Se faltar informação essencial (objetivo, prazo, quanto aguenta perder), faça no máximo 2 perguntas curtas e já adiante o que der. (2) Respeite a ordem: dívidas caras primeiro (juros acima do CDI), depois reserva de emergência (6 meses de gastos em liquidez diária), depois investir. (3) Em 'quanto', dê faixas e regras (ex.: começar por 10% da renda, ou o valor que o usuário disse que consegue) com o cálculo em R$ usando os dados dele. (4) Em 'onde', compare CATEGORIAS (poupança, Tesouro Selic, CDB/LCI/LCA, fundos, ações, FIIs, cripto, derivativos), explicando risco, liquidez, prazo e para quem serve, adaptando ao perfil de risco; não recomende ativo ou ticker específico, não diga 'compre agora' e não preveja preço. (5) Se o usuário quiser arriscar, explique o risco com franqueza, sugira limitar a uma pequena parcela do que investe (referência educativa: até 5% a 10%), só com dinheiro que pode perder e nunca com dívida ou reserva de emergência. Sobre day trade e mercado futuro: explique alavancagem e liquidação, diga que a maioria perde dinheiro e sugira treinar antes na Simulação do app. (6) Nunca prometa nem sugira retorno garantido; rentabilidade passada não garante futuro; lembre que o conteúdo é educativo e não é recomendação personalizada de investimento, e que para valores grandes ou decisões complexas vale conversar com um profissional certificado. (7) Recuse golpes, pirâmides, 'dicas quentes' e esquemas de enriquecimento rápido, explicando o motivo sem sermão. (8) Respostas com no máximo cerca de 120 palavras, resultado na primeira frase e um próximo passo claro (ex.: 'Abrir meu plano', 'Simular R$ 300/mês').";

// limite por IP no Supabase (wa_usage, com o IP em hash). Se o banco estiver fora, cai neste contador em memória, que zera quando a função esfria.
const usos = new Map<string, { dia: string; qtd: number }>();

interface Msg {
  role?: string;
  content?: string;
}
interface Corpo {
  messages?: Msg[];
  contexto?: Record<string, unknown>;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined);

function mesmaOrigem(request: Request): boolean {
  const origem = request.headers.get('origin');
  if (origem) {
    try {
      return new URL(origem).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}

/** Só números e valores de uma lista: nada de texto livre do usuário entra no contexto. */
export function contextoSeguro(c: Record<string, unknown> | undefined): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const k of ['renda', 'livreParaGastar', 'patrimonioGuardado', 'reservaMeta', 'totalDividas', 'maiorJuroMensal', 'aporteMensalPlanejado']) {
    const n = numero(c?.[k]);
    if (n !== undefined) out[k] = n;
  }
  const p = c?.perfilRisco;
  if (p === 'conservador' || p === 'moderado' || p === 'arrojado') out.perfilRisco = p;
  return out;
}

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Conta um uso do dia; true se o IP já passou do limite. */
async function limiteAtingido(ip: string, hoje: string): Promise<boolean> {
  try {
    return !(await bumpUsage(`ip:${await hashIp(ip)}`, `chat:${hoje}`, LIMITE_DIA));
  } catch {
    const u = usos.get(ip);
    const atual = u && u.dia === hoje ? u : { dia: hoje, qtd: 0 };
    if (atual.qtd >= LIMITE_DIA) return true;
    usos.set(ip, { dia: hoje, qtd: atual.qtd + 1 });
    if (usos.size > 5000) usos.clear();
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!mesmaOrigem(request)) return json({ error: 'Não consegui responder a partir desta página.' }, 403);
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return json({ guiado: true, error: 'A conversa livre ainda não está ligada. As respostas guiadas continuam funcionando.' }, 503);

  let b: Corpo;
  try {
    b = (await request.json()) as Corpo;
  } catch {
    return json({ error: 'Não entendi a pergunta. Escreva de novo.' }, 400);
  }
  const mensagens = (Array.isArray(b.messages) ? b.messages : [])
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG) }));
  if (mensagens.length === 0 || mensagens[mensagens.length - 1].role !== 'user') return json({ error: 'Não entendi a pergunta. Escreva de novo.' }, 400);
  // a conversa tem que começar com a pessoa
  while (mensagens.length && mensagens[0].role !== 'user') mensagens.shift();

  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const hoje = new Date().toISOString().slice(0, 10);
  const bateuLimite = await limiteAtingido(ip, hoje);
  if (bateuLimite) return json({ error: 'Você chegou ao limite de 20 mensagens por hoje. Volte amanhã.' }, 429);

  const mercado = await obterMercado().catch(() => null);
  const snap = mercado
    ? JSON.stringify({ selicAnualPct: mercado.selic?.valor, cdiAnualPct: mercado.cdi?.valor, ipca12mPct: mercado.ipca12m?.valor, poupancaAnualPct: mercado.poupanca?.valor, dolar: mercado.dolar?.valor, bitcoinBRL: mercado.bitcoin?.valor, jurosRealPct: mercado.jurosReal?.valor })
    : 'sem dados de mercado agora';
  const system = `${SYSTEM_PROMPT}\n\nCONTEXTO DO USUÁRIO (dados do app): ${JSON.stringify(contextoSeguro(b.contexto))}\nMERCADO AGORA: ${snap}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELO, max_tokens: 700, system, messages: mensagens }),
    });
    if (r.status === 429) return json({ error: 'O assistente está muito ocupado agora. Tente de novo em instantes.' }, 429);
    if (!r.ok) return json({ error: 'Não consegui responder agora. Tente de novo em instantes.' }, 502);
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    const texto = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim();
    if (!texto) return json({ error: 'Não consegui responder agora. Tente de novo em instantes.' }, 502);
    return json({ texto });
  } catch {
    return json({ error: 'Não consegui responder agora. Tente de novo em instantes.' }, 502);
  }
}
