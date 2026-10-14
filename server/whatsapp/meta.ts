// Integração com a API oficial do WhatsApp (Cloud API da Meta).

const GRAPH_VERSION = 'v21.0';

export interface IncomingText {
  id: string; // id da mensagem (usado pra não gravar duas vezes)
  from: string; // número de quem mandou, como a Meta informa (ex.: 5511987654321)
  text: string; // texto digitado, ou o id do botão/linha da lista que a pessoa tocou (ex.: "menu:13o")
  profileName?: string; // nome que a pessoa colocou no WhatsApp (pode ser apelido)
}

export interface IncomingMedia {
  id: string;
  from: string;
  mediaId: string;
  mime: string;
  filename?: string;
  caption?: string;
}

type RawMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  interactive?: { type?: string; button_reply?: { id?: string }; list_reply?: { id?: string } };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
};

type WithName = RawMessage & { profileName?: string };

function rawMessages(payload: unknown): WithName[] {
  const p = payload as { entry?: { changes?: { value?: { messages?: RawMessage[]; contacts?: { wa_id?: string; profile?: { name?: string } }[] } }[] }[] };
  const out: WithName[] = [];
  for (const entry of p?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const names = new Map((change.value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of change.value?.messages ?? []) out.push({ ...m, profileName: names.get(m.from) });
    }
  }
  return out;
}

/**
 * Extrai as mensagens do payload do webhook: texto, toque em botão/lista (vira o id do botão) e arquivos
 * (PDF/foto). Ignora status de entrega, áudio, figurinha etc. — esses vão pra "others".
 */
export function extractMessages(payload: unknown): {
  texts: IncomingText[];
  media: IncomingMedia[];
  others: { id: string; from: string }[];
} {
  const texts: IncomingText[] = [];
  const media: IncomingMedia[] = [];
  const others: { id: string; from: string }[] = [];
  for (const msg of rawMessages(payload)) {
    const picked = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id;
    if (msg.type === 'text' && msg.text?.body) texts.push({ id: msg.id, from: msg.from, text: msg.text.body, profileName: msg.profileName });
    else if (msg.type === 'interactive' && picked) texts.push({ id: msg.id, from: msg.from, text: picked, profileName: msg.profileName });
    else if (msg.type === 'document' && msg.document?.id)
      media.push({ id: msg.id, from: msg.from, mediaId: msg.document.id, mime: msg.document.mime_type ?? '', filename: msg.document.filename, caption: msg.document.caption });
    else if (msg.type === 'image' && msg.image?.id) media.push({ id: msg.id, from: msg.from, mediaId: msg.image.id, mime: msg.image.mime_type ?? '', caption: msg.image.caption });
    else others.push({ id: msg.id, from: msg.from });
  }
  return { texts, media, others };
}

/** Compatibilidade: só texto e toques em botão, mais o que não foi entendido. */
export function extractTextMessages(payload: unknown): { texts: IncomingText[]; others: { id: string; from: string }[] } {
  const { texts, media, others } = extractMessages(payload);
  return { texts, others: [...others, ...media.map((m) => ({ id: m.id, from: m.from }))] };
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

/** Modo aberto: com WHATSAPP_OPEN=true qualquer número é atendido (os limites diários de IA e fatura continuam valendo). */
export function isOpen(flag: string | undefined = process.env.WHATSAPP_OPEN): boolean {
  return flag?.trim().toLowerCase() === 'true';
}

export function isAllowed(phone: string, allowedCsv: string | undefined): boolean {
  if (isOpen()) return true;
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

/** O que o bot manda: texto simples, até 3 botões ou uma lista de até 10 opções. */
export type Outgoing =
  | { kind: 'text'; text: string }
  | { kind: 'buttons'; text: string; buttons: { id: string; title: string }[] }
  | { kind: 'list'; text: string; button: string; rows: { id: string; title: string; description?: string }[] };

const cut = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…');

/** Corpo da chamada à API pra cada tipo de mensagem. Limites do WhatsApp: botão 20, título da linha 24, descrição 72. */
export function outgoingPayload(to: string, out: Outgoing): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', to };
  switch (out.kind) {
    case 'text':
      return { ...base, type: 'text', text: { body: cut(out.text, 4000), preview_url: false } };
    case 'buttons':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: cut(out.text, 1000) },
          action: { buttons: out.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: cut(b.title, 20) } })) },
        },
      };
    case 'list':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: cut(out.text, 1000) },
          action: {
            button: cut(out.button, 20),
            sections: [
              {
                title: 'Opções',
                rows: out.rows.slice(0, 10).map((r) => ({ id: r.id, title: cut(r.title, 24), ...(r.description ? { description: cut(r.description, 72) } : {}) })),
              },
            ],
          },
        },
      };
  }
}

export async function sendOutgoing(to: string, out: Outgoing): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) throw new Error('WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TOKEN ausentes');
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(outgoingPayload(to, out)),
  });
  if (!res.ok) throw new Error(`WhatsApp send ${res.status}: ${await res.text()}`);
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

export class MediaTooBigError extends Error {}

/** Baixa o PDF/foto que a pessoa mandou (a Meta só dá um id; o arquivo vem por uma URL que exige o token). */
export async function downloadMedia(mediaId: string, maxBytes: number): Promise<{ mime: string; base64: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error('WHATSAPP_TOKEN ausente');
  const auth = { Authorization: `Bearer ${token}` };
  const info = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, { headers: auth });
  if (!info.ok) throw new Error(`WhatsApp media ${info.status}: ${await info.text()}`);
  const { url, mime_type: mime, file_size: size } = (await info.json()) as { url: string; mime_type: string; file_size?: number };
  if (size && size > maxBytes) throw new MediaTooBigError();
  const file = await fetch(url, { headers: auth });
  if (!file.ok) throw new Error(`WhatsApp download ${file.status}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > maxBytes) throw new MediaTooBigError();
  return { mime, base64: bytes.toString('base64') };
}
