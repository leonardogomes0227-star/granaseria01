// Fila de espera e acessos no Supabase, pelo servidor (service role). Mesma abordagem do resto: REST com fetch.

import { randomInt } from 'node:crypto';
import { rest } from '../whatsapp/db.js';
import { DIAS_DO_CONVITE, deveLiberarFila, respostaDaFila, segundosParaLiberar, type RespostaFila } from './filaLibera.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I
/** Cada pessoa que você indica faz você subir tantas posições. */
export const SALTO_POR_INDICACAO = 5;

export type StatusFila = 'espera' | 'convidado' | 'ativo' | 'recusado';
export interface FilaRow { id: number; nome: string; whatsapp: string; codigo: string; indicado_por: string | null; status: StatusFila; convidado_em: string | null; convite_ate: string | null; criado_em: string }
export interface AcessoRow { id: number; whatsapp: string | null; email: string | null; tipo: 'assinante' | 'cortesia'; plano: 'mensal' | 'anual' | null; fundador: boolean; status: 'ativo' | 'cancelado'; valido_ate: string | null; cakto_ref: string | null }

/** Celular brasileiro: DDD + 9 dígitos, com ou sem o 55. Devolve só números com 55, ou null se não parece um celular. */
export function normalizarFone(valor: string): string | null {
  let d = valor.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 10 && '6789'.includes(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`; // celular antigo, sem o nono dígito (fixo começa com 2 a 5)
  if (d.length !== 11 || d[2] !== '9' || d[0] === '0') return null;
  return `55${d}`;
}

async function pegar<T>(path: string): Promise<T[]> {
  const res = await rest(path);
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return (await res.json()) as T[];
}

const novoCodigo = () => Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

/** Coloca a pessoa na fila. Se o número já está, devolve o cadastro que existe (não duplica). */
export async function entrarNaFila(nome: string, whatsapp: string, ref?: string): Promise<{ row: FilaRow; novo: boolean }> {
  const existente = await pegar<FilaRow>(`fila_espera?${new URLSearchParams({ whatsapp: `eq.${whatsapp}`, select: '*', limit: '1' })}`);
  if (existente[0]) return { row: existente[0], novo: false };
  let indicado: string | null = null;
  if (ref && /^[A-Z0-9]{6}$/.test(ref)) {
    const dono = await pegar<FilaRow>(`fila_espera?${new URLSearchParams({ codigo: `eq.${ref}`, select: 'id,codigo', limit: '1' })}`);
    if (dono[0]) indicado = dono[0].codigo;
  }
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const res = await rest('fila_espera', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ nome, whatsapp, codigo: novoCodigo(), indicado_por: indicado }]) });
    if (res.ok) return { row: ((await res.json()) as FilaRow[])[0], novo: true };
    const msg = await res.text();
    if (!/duplicate|unique|23505/i.test(msg)) throw new Error(`Supabase ${res.status}: ${msg}`);
    const de = await pegar<FilaRow>(`fila_espera?${new URLSearchParams({ whatsapp: `eq.${whatsapp}`, select: '*', limit: '1' })}`);
    if (de[0]) return { row: de[0], novo: false };
  }
  throw new Error('Não consegui gerar um código único.');
}

interface Leve { id: number; codigo: string; indicado_por: string | null }
async function naEspera(): Promise<Leve[]> {
  return pegar<Leve>(`fila_espera?${new URLSearchParams({ status: 'eq.espera', select: 'id,codigo,indicado_por', order: 'id.asc', limit: '50000' })}`);
}
function pontuar(fila: Leve[]): Map<string, number> {
  const indicacoes = new Map<string, number>();
  for (const r of fila) if (r.indicado_por) indicacoes.set(r.indicado_por, (indicacoes.get(r.indicado_por) ?? 0) + 1);
  return new Map(fila.map((r) => [r.codigo, r.id - SALTO_POR_INDICACAO * (indicacoes.get(r.codigo) ?? 0)]));
}

/** Marca uma pessoa como convidada. Não mexe na tabela de assinaturas. */
async function marcarConvidado(eu: FilaRow): Promise<FilaRow | null> {
  const ate = new Date(Date.now() + DIAS_DO_CONVITE * 86_400_000).toISOString();
  const res = await rest(`fila_espera?id=eq.${eu.id}&status=eq.espera`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'convidado', convidado_em: new Date().toISOString(), convite_ate: ate }),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as FilaRow[];
  return rows[0] ?? null;
}

async function linhaDaFila(codigo: string): Promise<FilaRow | null> {
  const [eu] = await pegar<FilaRow>(`fila_espera?${new URLSearchParams({ codigo: `eq.${codigo}`, select: '*', limit: '1' })}`);
  return eu ?? null;
}

/** Lê a pessoa e, se o tempo curto já passou, libera o convite. Não cria assinatura. */
export async function situacaoDe(codigo: string, agora = Date.now()): Promise<RespostaFila | null> {
  let eu = await linhaDaFila(codigo);
  if (!eu) return null;
  const segundos = segundosParaLiberar(process.env.FILA_LIBERA_EM_SEGUNDOS);
  if (deveLiberarFila(eu.status, eu.criado_em, agora, segundos)) {
    const atualizado = await marcarConvidado(eu);
    eu = atualizado ?? (await linhaDaFila(codigo)) ?? eu;
  }
  return respostaDaFila(eu, agora, segundos);
}

export async function totalNaFila(): Promise<number> {
  return (await naEspera()).length;
}

/** O convite desse código ainda vale? Se o tempo curto já passou, libera antes de responder. */
export async function conviteValido(codigo: string): Promise<{ valido: boolean; ate: string | null }> {
  const s = await situacaoDe(codigo);
  const valido = Boolean(s && s.status === 'convidado' && s.conviteAte && new Date(s.conviteAte).getTime() > Date.now());
  return { valido, ate: valido ? s!.conviteAte : null };
}

/** Chama os próximos da fila (quem está na frente, já com o salto das indicações) e dá um prazo para aceitar. */
export async function convidarProximos(quantidade: number, dias: number): Promise<FilaRow[]> {
  const fila = await naEspera();
  const pts = pontuar(fila);
  const escolhidos = [...fila].sort((a, b) => pts.get(a.codigo)! - pts.get(b.codigo)! || a.id - b.id).slice(0, quantidade);
  if (escolhidos.length === 0) return [];
  const ate = new Date(Date.now() + dias * 86_400_000).toISOString();
  const ids = escolhidos.map((r) => r.id).join(',');
  const res = await rest(`fila_espera?id=in.(${ids})`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'convidado', convidado_em: new Date().toISOString(), convite_ate: ate }) });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return (await res.json()) as FilaRow[];
}

export async function acessoDe(whatsapp: string | null, email: string | null): Promise<AcessoRow | null> {
  const filtros = [whatsapp ? `whatsapp.eq.${whatsapp}` : '', email ? `email.eq.${email.toLowerCase()}` : ''].filter(Boolean);
  if (filtros.length === 0) return null;
  const linhas = await pegar<AcessoRow>(`acessos?${new URLSearchParams({ or: `(${filtros.join(',')})`, select: '*', limit: '5' })}`);
  // vale o que dura mais
  return linhas.sort((a, b) => new Date(b.valido_ate ?? 0).getTime() - new Date(a.valido_ate ?? 0).getTime())[0] ?? null;
}

export async function gravarAcesso(r: { whatsapp: string | null; email: string | null; plano: 'mensal' | 'anual'; fundador: boolean; status: 'ativo' | 'cancelado'; validoAte: string | null; ref: string | null }): Promise<void> {
  const chave = r.whatsapp ? 'whatsapp' : r.email ? 'email' : null;
  if (!chave) throw new Error('Pagamento sem telefone nem e-mail.');
  const linha: Record<string, unknown> = { whatsapp: r.whatsapp, email: r.email?.toLowerCase() ?? null, tipo: 'assinante', plano: r.plano, fundador: r.fundador, status: r.status, cakto_ref: r.ref, atualizado_em: new Date().toISOString() };
  if (r.validoAte) linha.valido_ate = r.validoAte;
  const res = await rest(`acessos?on_conflict=${chave}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([linha]) });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}
