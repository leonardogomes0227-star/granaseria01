import { WHATSAPP_NUMBER } from './supabase';
import { snapshot } from './sync';
import { track } from './analytics';

// Ponte site → WhatsApp, sem cadastro. Com diagnóstico no navegador, o site guarda tudo por 24h com um código curto
// (api/continuar.ts) e abre o WhatsApp com a mensagem pronta; o bot importa. Sem diagnóstico, abre com um "oi".

export const waLink = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export async function openWhatsApp(origin: string): Promise<void> {
  track('whatsapp_continuar', { origem: origin });
  const state = snapshot();
  if (!state['selos-wizard-progress']) {
    window.location.href = waLink('Oi! Quero anotar meus gastos por aqui.');
    return;
  }
  const res = await fetch('/api/continuar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
  if (!res.ok) throw new Error(String(res.status));
  const { code } = (await res.json()) as { code: string };
  window.location.href = waLink(`Oi! Fiz meu diagnóstico no site e quero continuar por aqui. Código: GS-${code}`);
}

