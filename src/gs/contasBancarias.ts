// Saldo e evolução de cada conta (banco, carteira) a partir dos lançamentos, receitas e transferências que a pessoa ligou a ela.
import { somaDias } from './datas';
import type { Estado } from './tipos';

export interface ResumoConta { id: string; nome: string; saldo: number; serie: number[]; movimentos: number }

/** Marca conhecida pelo nome: cor do cartão e do ícone, como nos apps de banco. */
export function marcaDaConta(nome: string): { cor: string; corTexto: string; sigla: string } {
  const n = nome.toLowerCase();
  const tabela: [RegExp, string, string, string][] = [
    [/nubank|nu\b/, '#7A1FD0', '#F3E8FF', 'nu'], [/inter/, '#F26B14', '#FFF1E6', 'inter'], [/c6/, '#171717', '#EDEDED', 'C6'],
    [/ita[uú]/, '#EC6E00', '#FFF4E8', 'itaú'], [/bradesco/, '#CC092F', '#FFE9ED', 'bra'], [/santander/, '#D0021B', '#FFE9EC', 'san'],
    [/caixa/, '#005CA9', '#E6F1FB', 'cx'], [/banco do brasil|\bbb\b/, '#F6D200', '#2A2400', 'bb'], [/picpay/, '#11C76F', '#052E1B', 'pic'],
    [/mercado ?pago/, '#009EE3', '#E6F7FF', 'mp'], [/neon/, '#00C9E5', '#032B31', 'neon'], [/xp/, '#222222', '#F1F1F1', 'xp'],
    [/carteira|dinheiro|esp[eé]cie/, '#6B4A1F', '#F8EBD4', '$'], [/poupan/, '#1C6B4F', '#E3F8EF', 'pp'],
  ];
  for (const [re, cor, corTexto, sigla] of tabela) if (re.test(n)) return { cor, corTexto, sigla };
  const paleta = ['#0F4A37', '#6A1B31', '#2B2723', '#8A6A2A'];
  let h = 0; for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { cor: paleta[h % paleta.length], corTexto: '#F6EBCB', sigla: nome.trim().slice(0, 2).toUpperCase() };
}

export function resumoDasContas(e: Estado, hoje: string): ResumoConta[] {
  const dias = 28;
  return e.contas.map((c) => {
    const eventos: { data: string; v: number }[] = [];
    for (const r of e.receitas) if (r.contaId === c.id) eventos.push({ data: r.data, v: r.valor });
    for (const l of e.lancamentos) if (l.contaId === c.id) eventos.push({ data: l.data, v: -l.valor });
    for (const t of e.transferencias) { if (t.de === c.id) eventos.push({ data: t.data, v: -t.valor }); if (t.para === c.id) eventos.push({ data: t.data, v: t.valor }); }
    const saldo = eventos.reduce((s, x) => s + (x.data <= hoje ? x.v : 0), 0);
    const serie: number[] = [];
    for (let i = dias; i >= 0; i -= 2) { const d = somaDias(hoje, -i); serie.push(eventos.reduce((s, x) => s + (x.data <= d ? x.v : 0), 0)); }
    return { id: c.id, nome: c.nome, saldo: Math.round(saldo * 100) / 100, serie, movimentos: eventos.length };
  });
}
