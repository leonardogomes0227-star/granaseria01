import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Conta da pessoa (login por link no e-mail). Só liga quando as variáveis públicas existem na Vercel:
//   VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (a chave pública — "anon" ou "sb_publishable_…"; essa pode
//   ir pro navegador, quem protege os dados são as regras de acesso do supabase/conta.sql).
// trim(): espaço ou quebra de linha colados junto com o valor na Vercel não podem derrubar o site.
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

function connect(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey);
  } catch (err) {
    // URL inválida: o site segue funcionando sem conta, em vez de ficar em branco
    console.error('Supabase: configuração inválida', err);
    return null;
  }
}

export const supabase: SupabaseClient | null = connect();
export const accountsEnabled = supabase !== null;

// Número do WhatsApp da Grana Séria, só dígitos com 55 + DDD (pros links wa.me). Sem a variável, vale o número oficial.
export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER || '5567996085267').replace(/\D/g, '');
