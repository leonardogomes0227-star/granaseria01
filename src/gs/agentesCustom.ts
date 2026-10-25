// O estado de cada agente criado pela pessoa: progresso, próximo passo e o valor sugerido pro "Registrar".

import { arred, diaCurto, mesDe, brl0 } from './datas';
import { dividirMetodo, PCT_PADRAO, planoDaMeta, proximaRepeticao, ROTULOS_METODO, semanaDoDesafio, totalDesafio52, valorDaSemana, type Metodo } from './ferramentas';
import type { AgenteCustom } from './tipos';

export interface Situacao {
  pct: number; // 0 a 100
  resumo: string;
  proximoPasso: string;
  sugestao: number; // valor sugerido ao registrar (0 = só "feito")
  rotuloBotao: string;
  concluido: boolean;
}

const num = (v: unknown, pad = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : pad);
const txt = (v: unknown) => (typeof v === 'string' ? v : '');
export const somaProgresso = (a: AgenteCustom) => arred(a.progresso.reduce((t, p) => t + p.valor, 0));

export function situacaoDoAgente(a: AgenteCustom, hoje: string): Situacao {
  const c = a.config;
  switch (a.tipo) {
    case 'juntar': {
      const alvo = num(c.alvo);
      const guardado = num(c.jaGuardado) + somaProgresso(a);
      const p = planoDaMeta({ alvo, jaGuardado: guardado, prazo: txt(c.prazo) || hoje, hoje });
      const pct = alvo > 0 ? Math.min(100, (guardado / alvo) * 100) : 0;
      return {
        pct,
        concluido: p.metaBatida,
        resumo: p.metaBatida ? `Meta batida: ${brl0(alvo)}` : `${brl0(guardado)} de ${brl0(alvo)}`,
        proximoPasso: p.metaBatida ? 'Meta batida. Parabéns!' : p.prazoVencido ? `O prazo passou. Faltam ${brl0(p.falta)}: defina um novo prazo.` : `Guarde ${brl0(p.porSemana)} por semana (${brl0(p.porMes)} por mês) até ${diaCurto(txt(c.prazo))}`,
        sugestao: p.metaBatida ? 0 : Math.ceil(p.porSemana),
        rotuloBotao: 'Guardei',
      };
    }
    case 'lembrar': {
      const data = txt(c.data);
      const prox = proximaRepeticao(data, (txt(c.repete) as 'unica' | 'diaria' | 'semanal' | 'mensal') || 'unica', hoje);
      const feitos = a.progresso.length;
      const unica = (txt(c.repete) || 'unica') === 'unica';
      const feitoUnica = unica && feitos > 0;
      return {
        pct: feitoUnica ? 100 : 0,
        concluido: feitoUnica,
        resumo: feitos > 0 ? `Feito ${feitos} ${feitos === 1 ? 'vez' : 'vezes'}` : 'Ainda não feito',
        proximoPasso: feitoUnica ? 'Feito.' : prox ? `${txt(c.descricao)} · ${prox === hoje ? 'hoje' : diaCurto(prox)}${txt(c.hora) ? ` às ${txt(c.hora)}` : ''}` : `${txt(c.descricao)} · data passou`,
        sugestao: 0,
        rotuloBotao: 'Feito',
      };
    }
    case 'metodo': {
      const metodo = (txt(c.metodo) || 'pague-se-primeiro') as Metodo;
      const renda = num(c.renda);
      if (metodo === '52-semanas') {
        const base = num(c.base, 1) || 1;
        const sem = semanaDoDesafio(txt(c.inicio) || hoje, hoje);
        const total = totalDesafio52(base);
        const guardado = somaProgresso(a);
        return { pct: total > 0 ? Math.min(100, (guardado / total) * 100) : 0, concluido: guardado >= total, resumo: `${brl0(guardado)} de ${brl0(total)}`, proximoPasso: `Semana ${sem}: guarde ${brl0(valorDaSemana(sem, base))}`, sugestao: valorDaSemana(sem, base), rotuloBotao: 'Guardei a semana' };
      }
      const pcts = (Array.isArray(c.pcts) ? (c.pcts as unknown as number[]) : PCT_PADRAO[metodo]) as number[];
      const partes = dividirMetodo(renda, pcts);
      const rot = ROTULOS_METODO[metodo];
      const iGuardar = metodo === '50-30-20' ? 2 : metodo === 'pague-se-primeiro' ? 1 : 4;
      const alvoGuardar = partes[iGuardar] ?? 0;
      const noMes = a.progresso.filter((p) => mesDe(p.data) === mesDe(hoje)).reduce((t, p) => t + p.valor, 0);
      return {
        pct: alvoGuardar > 0 ? Math.min(100, (noMes / alvoGuardar) * 100) : 0,
        concluido: false,
        resumo: partes.map((v, i) => `${rot[i]}: ${brl0(v)}`).join(' · '),
        proximoPasso: alvoGuardar > noMes ? `Separe ${brl0(alvoGuardar - noMes)} em “${rot[iGuardar]}” este mês` : 'Valor do mês separado. Bom trabalho.',
        sugestao: Math.max(0, Math.ceil(alvoGuardar - noMes)),
        rotuloBotao: 'Guardei',
      };
    }
    default: {
      const itens = Array.isArray(c.checklist) ? (c.checklist as string[]) : [];
      const feitos = a.progresso.length;
      const pct = itens.length > 0 ? Math.min(100, (feitos / itens.length) * 100) : feitos > 0 ? 100 : 0;
      return { pct, concluido: itens.length > 0 ? feitos >= itens.length : feitos > 0, resumo: txt(c.objetivo), proximoPasso: itens[feitos] ?? (feitos > 0 ? 'Tudo feito.' : txt(c.objetivo)), sugestao: 0, rotuloBotao: 'Feito' };
    }
  }
}
