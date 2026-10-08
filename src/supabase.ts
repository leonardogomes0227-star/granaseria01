import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Conta da pessoa (login por link no e-mail). Só liga quando as variáveis públicas existem na Vercel:
//   VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (a chave "anon public" — essa pode ir pro navegador;
//   quem protege os dados são as regras de acesso do supabase/conta.sql).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const accountsEnabled = supabase !== null;

// Número do WhatsApp da Grana Séria, só dígitos com 55 + DDD (pro link wa.me de vincular)
export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
