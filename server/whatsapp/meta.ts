// Integração com a API oficial do WhatsApp (Cloud API da Meta).

const GRAPH_VERSION = 'v21.0';

export interface IncomingText {
  id: string; // id da mensagem (usado pra não gravar duas vezes)
  from: string; // número de quem mandou, como a Meta informa (ex.: 5511987654321)
  text: string;
}

/** Extrai as mensagens de texto do payload do webhook. Ignora status de entrega, áudio, figurinha etc. */
export function extractTextMessages(payload: unknown): { texts: IncomingText[]; others: { id: string; from: string }[] } {
  const texts: IncomingText[] = [];
  const others: { id: string; from: string }[] = [];
  const p = payload as {
    entry?: { changes?: { value?: { messages?: { id: string; from: string; type: string; text?: { body?: string } }[] } }[] }[];
  };
  for (const entry of p?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (msg.type === 'text' && msg.text?.body) texts.push({ id: msg.id, from: msg.from, text: msg.text.body });
        else others.push({ id: msg.id, from: msg.from });
      }
    }
  }
  return { texts, others };
}

/**
 * Celulares brasileiros às vezes chegam da Meta sem o 9 extra (55 + DDD + 8 dígitos).
 * Normaliza pra sempre comparar e gravar no formato com 13 dígitos.
 */
export function normalizeBrPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('55') && /^[6-9]/.test(d.slice(4))) return d.slice(0, 4) + '9' + d.slice(4);
  return d;
}

export function isAllowed(phone: string, allowedCsv: string | undefined): boolean {
  if (!allowedCsv) return false;
  const allowed = allowedCsv.split(',').map((n) => normalizeBrPhone(n.trim())).filter(Boolean);
  return allowed.includes(normalizeBrPhone(phone));
}

/** Confere a assinatura X-Hub-Signature-256 — garante que a chamada veio mesmo da Meta. */
export async function verifySignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)));
  const expected = Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
  const got = header.slice('sha256='.length);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function sendText(to: string, body: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) throw new Error('WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TOKEN ausentes');
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false } }),
  });
  if (!res.ok) throw new Error(`WhatsApp send ${res.status}: ${await res.text()}`);
}

/**
 * Mensagem iniciada pela Grana Séria (ex.: lembrete do plano). Fora da janela de 24h desde a última
 * mensagem da pessoa, a Meta só entrega modelos aprovados — ver docs/whatsapp-assistente.md.
 * Parâmetros do corpo não podem ter quebra de linha.
 */
export async function sendTemplate(to: string, name: string, language: string, bodyParams: string[]): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) throw new Error('WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TOKEN ausentes');
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name,
        language: { code: language },
        components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text: text.replace(/\s+/g, ' ').trim() })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp template ${res.status}: ${await res.text()}`);
}
