// Cartão sob controle (lógica pura): ler a fatura em CSV, achar parcelas, simular o impacto de uma compra e ver onde cortar.
// O arquivo nunca sai do aparelho: é lido aqui, mostrado para conferência e só então aplicado.

import { arred } from './datas';
import { aplicarCompra, proximasFaturas } from './cartaoLogica';
import { sugerirCategoria } from './sugestoes';
import { CATEGORIAS_MOV, type Cartao, type ParceladoCartao } from './tipos';

export interface CompraFatura {
  data: string;
  descricao: string;
  valor: number;
  parcelaAtual?: number;
  parcelasTotal?: number;
  categoria: string; // do app (Comida, Mercado, Assinaturas…)
}
export interface LeituraFatura {
  compras: CompraFatura[];
  ignoradas: number; // linhas que não eram compra (pagamento, estorno, vazias, sem data)
  erro?: string;
}

const sem = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Divide uma linha de CSV respeitando aspas. */
function campos(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (ch === sep && !aspas) { out.push(atual); atual = ''; } else atual += ch;
  }
  out.push(atual);
  return out.map((c) => c.trim());
}

/** "1.234,56", "1234.56", "R$ 45,90", "-12,00". NaN se não for número. */
export function lerValor(txt: string): number {
  let t = txt.replace(/R\$|\s/g, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** "2026-11-03" ou "03/11/2026". null se não tiver ano ou for inválida. */
export function lerData(txt: string): string | null {
  const t = txt.trim().slice(0, 10);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) { const b = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t); if (b) m = [b[0], b[3], b[2], b[1]] as unknown as RegExpExecArray; }
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}` ? null : `${m[1]}-${m[2]}-${m[3]}`;
}

const RE_PARCELA = /(?:parcela|parc\.?)\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i;
/** "Loja X - Parcela 2/6" → { descricao: 'Loja X', atual: 2, total: 6 }. */
export function lerParcela(titulo: string): { descricao: string; atual?: number; total?: number } {
  const m = RE_PARCELA.exec(titulo);
  if (!m) return { descricao: titulo.trim() };
  const atual = Number(m[1]);
  const total = Number(m[2]);
  const descricao = titulo.replace(RE_PARCELA, '').replace(/[\s\-–—(),]+$/g, '').replace(/^[\s\-–—(),]+/, '').trim() || titulo.trim();
  return atual >= 1 && total >= atual && total <= 120 ? { descricao, atual, total } : { descricao: titulo.trim() };
}

const NAO_E_COMPRA = /pagamento (recebido|efetuado|da fatura|em)|fatura anterior|saldo (anterior|restante)|estorno|cr[eé]dito (de|em)|desconto (de )?pontualidade/i;

export function lerFaturaCsv(texto: string): LeituraFatura {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return { compras: [], ignoradas: 0, erro: 'O arquivo está vazio ou só tem o cabeçalho.' };
  const sep = (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const cab = campos(linhas[0], sep).map(sem);
  const idx = (nomes: string[]) => cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));
  const iData = idx(['date', 'data']);
  const iTitulo = idx(['title', 'descricao', 'estabelecimento', 'lancamento', 'historico', 'description']);
  const iValor = idx(['amount', 'valor', 'value']);
  if (iData < 0 || iTitulo < 0 || iValor < 0) return { compras: [], ignoradas: 0, erro: 'Não reconheci as colunas. Preciso de data, descrição e valor.' };
  const compras: CompraFatura[] = [];
  let ignoradas = 0;
  for (const linha of linhas.slice(1)) {
    const c = campos(linha, sep);
    const data = lerData(c[iData] ?? '');
    const valor = lerValor(c[iValor] ?? '');
    const titulo = (c[iTitulo] ?? '').trim();
    if (!data || !Number.isFinite(valor) || !titulo || valor <= 0 || NAO_E_COMPRA.test(titulo)) { ignoradas++; continue; }
    const { descricao, atual, total } = lerParcela(titulo);
    compras.push({ data, descricao: descricao.slice(0, 60), valor: arred(valor), parcelaAtual: atual, parcelasTotal: total, categoria: sugerirCategoria(descricao, CATEGORIAS_MOV) ?? 'Outros' });
  }
  if (compras.length === 0) return { compras, ignoradas, erro: 'Não achei compras nesse arquivo.' };
  return { compras, ignoradas };
}

export const totalFatura = (cs: CompraFatura[]) => arred(cs.reduce((t, c) => t + c.valor, 0));

/** Parcelas que ainda vão cair nas próximas faturas (a deste mês já está no total). */
export const parceladasDaFatura = (cs: CompraFatura[]) => cs.filter((c) => c.parcelasTotal && c.parcelaAtual && c.parcelaAtual < c.parcelasTotal);

/** Aplica a fatura no cartão: a fatura atual vira o total lido e as parcelas futuras entram (ou atualizam) em "parcelados". */
export function aplicarFatura(c: Cartao, cs: CompraFatura[], novoId: () => string): { cartao: Cartao; adicionados: number; atualizados: number } {
  const lista: ParceladoCartao[] = [...(c.parcelados ?? [])];
  let adicionados = 0;
  let atualizados = 0;
  for (const p of parceladasDaFatura(cs)) {
    const restantes = (p.parcelasTotal as number) - (p.parcelaAtual as number);
    const i = lista.findIndex((x) => sem(x.descricao) === sem(p.descricao).slice(0, 40) && Math.abs(x.parcela - p.valor) < 0.02);
    if (i >= 0) { lista[i] = { ...lista[i], restantes }; atualizados++; } else { lista.push({ id: novoId(), descricao: p.descricao.slice(0, 40), parcela: p.valor, restantes }); adicionados++; }
  }
  return { cartao: { ...c, usado: totalFatura(cs), parcelados: lista }, adicionados, atualizados };
}

/* ---------- onde cortar ---------- */
export const CORTAVEIS = ['Comida', 'Lazer', 'Compras', 'Assinaturas', 'Outros'];
export interface AnaliseFatura {
  total: number;
  porCategoria: { categoria: string; valor: number; pct: number }[];
  assinaturas: CompraFatura[];
  parcelasDoMes: number; // quanto desta fatura já é parcela de compra antiga
  cortavel: number; // soma do que dá para reduzir (comida fora, lazer, compras, assinaturas, outros)
  maiores: CompraFatura[]; // as 5 maiores compras cortáveis, à vista
}
export function analiseFatura(cs: CompraFatura[]): AnaliseFatura {
  const total = totalFatura(cs);
  const m = new Map<string, number>();
  for (const c of cs) m.set(c.categoria, (m.get(c.categoria) ?? 0) + c.valor);
  const porCategoria = [...m.entries()].map(([categoria, valor]) => ({ categoria, valor: arred(valor), pct: total > 0 ? (valor / total) * 100 : 0 })).sort((a, b) => b.valor - a.valor);
  const parcelasDoMes = arred(cs.filter((c) => (c.parcelasTotal ?? 0) > 1).reduce((t, c) => t + c.valor, 0));
  const aVista = cs.filter((c) => !(c.parcelasTotal && c.parcelasTotal > 1) && CORTAVEIS.includes(c.categoria));
  return { total, porCategoria, assinaturas: cs.filter((c) => c.categoria === 'Assinaturas'), parcelasDoMes, cortavel: arred(aVista.reduce((t, c) => t + c.valor, 0)), maiores: [...aVista].sort((a, b) => b.valor - a.valor).slice(0, 5) };
}

/* ---------- impacto de uma compra nova ---------- */
export type VereditoCompra = 'cabe' | 'aperta' | 'nao-cabe';
export interface ImpactoCompra {
  antes: number[]; // parcelas já combinadas nas próximas faturas
  depois: number[];
  parcela: number; // quanto a compra pesa por mês
  faturaDepois: number;
  usoDepois: number; // % do limite do banco
  passaLimitePessoal: boolean;
  veredito: VereditoCompra;
  motivo: string;
}
/** `folga` = quanto sobra por mês (renda − gastos − parcelas); `renda` serve para o % comprometido. */
export function impactoCompra(c: Cartao, compra: { valor: number; parcelas: number }, folga: number): ImpactoCompra {
  const n = Math.max(1, Math.round(compra.parcelas));
  const depoisC = aplicarCompra(c, { descricao: 'Compra', valor: compra.valor, parcelas: n }, 'sim');
  const parcela = arred(compra.valor / n);
  const faturaDepois = depoisC.usado;
  const usoDepois = c.limite > 0 ? (faturaDepois / c.limite) * 100 : 0;
  const passaLimitePessoal = Boolean(c.limitePessoal && faturaDepois > c.limitePessoal);
  let veredito: VereditoCompra;
  let motivo: string;
  if (passaLimitePessoal) { veredito = 'nao-cabe'; motivo = 'Passa do limite que você definiu para o cartão.'; }
  else if (folga <= 0) { veredito = 'nao-cabe'; motivo = 'Hoje não sobra dinheiro no mês para mais uma parcela.'; }
  else if (parcela <= folga * 0.5) { veredito = 'cabe'; motivo = 'A parcela usa menos da metade do que sobra por mês.'; }
  else if (parcela <= folga) { veredito = 'aperta'; motivo = 'A parcela consome quase tudo o que sobra por mês.'; }
  else { veredito = 'nao-cabe'; motivo = 'A parcela é maior do que o que sobra por mês.'; }
  return { antes: proximasFaturas(c, 6), depois: proximasFaturas(depoisC, 6), parcela, faturaDepois, usoDepois, passaLimitePessoal, veredito, motivo };
}
