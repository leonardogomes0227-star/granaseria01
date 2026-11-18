// Site → WhatsApp sem cadastro. O botão "Continuar no WhatsApp" do resultado do diagnóstico manda aqui o que está
// no navegador (diagnóstico, plano, vazamentos); a rota guarda por 24h e devolve um código curto. A pessoa abre o
// WhatsApp com "Código: GS-XXXXXX" já escrito e o bot importa tudo pro número dela (ver api/whatsapp.ts).

import { randomInt } from 'node:crypto';
import { HANDOFF_KEYS, saveHandoff } from '../server/whatsapp/hubdb.js';
import { contarLimite, excedeuLimite, ipDoCliente } from '../server/rede.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I: fácil de ler e digitar
const MAX_BYTES = 40_000;

export async function POST(request: Request): Promise<Response> {
  const ip = ipDoCliente(request);
  if (excedeuLimite(`continuar:${ip}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: 'Muitas tentativas. Espere um pouco.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }
  contarLimite(`continuar:${ip}`, 60 * 60 * 1000);
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: 'Isso ficou grande demais.' }, { status: 413 });
  let body: { state?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Não entendi o pedido. Tente de novo.' }, { status: 400 });
  }
  // só as chaves que o bot entende, e só texto
  const state: Record<string, string> = {};
  for (const k of HANDOFF_KEYS) {
    const v = body.state?.[k];
    if (typeof v === 'string') state[k] = v;
  }
  if (!state['selos-wizard-progress']) return Response.json({ error: 'Ainda não há um diagnóstico para continuar.' }, { status: 400 });

  const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  try {
    await saveHandoff(code, state);
  } catch (err) {
    console.error('Continuar no WhatsApp: não salvou', err);
    return Response.json({ error: 'Não consegui guardar agora. Tente de novo.' }, { status: 503 });
  }
  return Response.json({ code });
}
