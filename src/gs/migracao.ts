// Leva qualquer versão (ou os dados do app antigo) pro formato atual, sem perder nada que a pessoa salvou.

import { ESTADO_INICIAL, SCHEMA_VERSION, type Estado, type GastoFixo, type Aporte, type Divida } from './tipos.js';

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const num = (v: unknown, pad = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : pad);
const json = (s: string | null | undefined): unknown => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

// os ids dos assistentes do app antigo viram os nomes funcionais
export const ID_ANTIGO: Record<string, string> = {
  arkad: 'reserva',
  dabasir: 'dividas',
  nomasir: 'gastos',
  bansir: 'contas',
  mathon: 'emprestimos',
  rodan: 'extras',
  sharru: 'investimentos',
};
const IDS_ANTIGOS = Object.keys(ID_ANTIGO);

function deLegado(leg: Record<string, string | null>): Estado {
  const e = ESTADO_INICIAL();
  const eu = obj(json(leg['gs-eu']));
  e.config.renda = Math.max(0, num(eu.renda));
  if (num(eu.diaSalario) >= 1 && num(eu.diaSalario) <= 31) e.config.diaSalario = num(eu.diaSalario);
  e.config.onboardingFeito = e.config.renda > 0;
  const nome = json(leg['gs-nome']);
  if (typeof nome === 'string' && nome.trim()) e.config.nome = nome.trim();
  else if (leg['gs-nome'] && !leg['gs-nome'].startsWith('"')) e.config.nome = leg['gs-nome'].trim() || undefined;

  e.gastosFixos = arr<Record<string, unknown>>(json(leg['gs-contas']))
    .filter((b) => b && typeof b.id === 'string' && !b.installments)
    .map<GastoFixo>((b) => ({
      id: String(b.id),
      nome: String(b.name ?? 'Conta'),
      valor: Math.max(0, num(b.amount)),
      diaVencimento: Math.min(31, Math.max(1, num(b.dueDay, 1))),
      categoria: 'Outros',
      pagamentos: Object.fromEntries(arr<Record<string, unknown>>(b.payments).filter((p) => typeof p.month === 'string').map((p) => [String(p.month), { valorPago: num(p.amount), pagoEm: String(p.paidOn ?? `${p.month}-01`) }])),
    }));

  e.aportes = arr<Record<string, unknown>>(json(leg['gs-guardado']))
    .filter((g) => typeof g.on === 'string' && num(g.amount) > 0)
    .map<Aporte>((g, i) => ({ id: `ap-leg-${i}`, data: String(g.on), valor: num(g.amount), origem: 'manual' }));

  // dívidas da missão de dívidas (o que ainda falta, abatendo o que foi pago na ordem)
  const missoes = arr<Record<string, unknown>>(json(leg['gs-missoes']));
  const md = missoes.find((m) => m && m.tipo === 'divida' && !m.deletedAt && Array.isArray(m.dividas));
  if (md) {
    let pago = arr<Record<string, unknown>>(md.registros).reduce((t, r) => t + num(r.valor), 0);
    e.dividas = arr<Record<string, unknown>>(md.dividas).flatMap<Divida>((d, i) => {
      const saldo = Math.max(0, num(d.saldo));
      const abate = Math.min(saldo, pago);
      pago -= abate;
      return saldo - abate > 0.009
        ? [{ id: `dv-leg-${i}`, nome: String(d.nome ?? 'Dívida'), saldo: saldo - abate, jurosMensal: Math.max(0, num(d.jurosMes)), parcelaMinima: Math.max(0, num(d.parcela)), pagamentos: [] }]
        : [];
    });
  }

  const ativos = arr<string>(json(leg['gs-agentes'])).map((id) => ID_ANTIGO[id] ?? id);
  for (const id of ativos) e.agentes[id] = { ativo: true, config: {} };
  return e;
}

/** `bruto` = o que estava guardado em 'grana-seria:v1'; `legado` = as chaves do app antigo (só quando não há o novo). */
export function migrar(bruto: unknown, legado?: Record<string, string | null>): Estado {
  if (!bruto) return legado ? deLegado(legado) : ESTADO_INICIAL();
  const b = obj(bruto);
  const cfg = obj(b.config);
  const av = obj(cfg.avisos);
  const inv = obj(b.investir);
  const sim = obj(inv.simulacao);
  const agentes: Estado['agentes'] = {};
  for (const [k, v] of Object.entries(obj(b.agentes))) {
    const o = obj(v);
    agentes[ID_ANTIGO[k] ?? k] = { ativo: Boolean(o.ativo), config: obj(o.config) as Estado['agentes'][string]['config'] };
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    config: {
      nome: typeof cfg.nome === 'string' && cfg.nome ? cfg.nome : undefined,
      renda: Math.max(0, num(cfg.renda)),
      horasMes: num(cfg.horasMes, 220) > 0 ? num(cfg.horasMes, 220) : 220,
      diaSalario: num(cfg.diaSalario) >= 1 && num(cfg.diaSalario) <= 31 ? num(cfg.diaSalario) : undefined,
      avisos: { antecedenciaDias: num(av.antecedenciaDias, 2), horario: typeof av.horario === 'string' ? av.horario : '09:00' },
      onboardingFeito: Boolean(cfg.onboardingFeito),
      reservaPct: num(cfg.reservaPct, 10),
      reservaMeses: [3, 6, 12].includes(num(cfg.reservaMeses)) ? num(cfg.reservaMeses) : undefined,
      reservaMensal: num(cfg.reservaMensal) > 0 ? num(cfg.reservaMensal) : undefined,
      rendaAlvo: num(cfg.rendaAlvo) > 0 ? num(cfg.rendaAlvo) : undefined,
      saldoInformado: (() => {
        const s = obj(cfg.saldoInformado);
        return typeof s.valor === 'number' && Number.isFinite(s.valor) && /^\d{4}-\d{2}-\d{2}$/.test(String(s.data)) ? { valor: s.valor, data: String(s.data) } : undefined;
      })(),
      objetivo: typeof cfg.objetivo === 'string' && cfg.objetivo ? cfg.objetivo.slice(0, 60) : undefined,
      adiados: Object.fromEntries(Object.entries(obj(cfg.adiados)).filter(([, v]) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)).slice(0, 50)) as Record<string, string>,
      avisosDesligados: arr<string>(cfg.avisosDesligados).filter((x) => typeof x === 'string').slice(0, 20),
      checklistFeito: arr<string>(cfg.checklistFeito).filter((x) => typeof x === 'string').slice(0, 20),
    },
    gastosFixos: arr<GastoFixo>(b.gastosFixos).filter((g) => g && typeof g.id === 'string').map((g) => ({ ...g, pagamentos: obj(g.pagamentos) as GastoFixo['pagamentos'] })),
    lancamentos: arr<Estado['lancamentos'][number]>(b.lancamentos).filter((l) => l && typeof l.id === 'string'),
    receitas: arr<Estado['receitas'][number]>(b.receitas).filter((r) => r && typeof r.id === 'string' && num(r.valor) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(r.data))).map((r) => ({ ...r, tipo: r.tipo === 'salario' ? 'salario' : 'extra' })),
    metas: arr<Estado['metas'][number]>(b.metas).filter((m) => m && typeof m.id === 'string' && num(m.alvo) > 0).map((m) => ({ ...m, guardados: arr<{ data: string; valor: number }>(m.guardados) })).slice(0, 20),
    contas: arr<{ id: string; nome: string }>(b.contas).filter((c) => c && typeof c.id === 'string' && typeof c.nome === 'string' && c.nome.trim()).map((c) => ({ id: c.id, nome: c.nome.trim().slice(0, 30) })).slice(0, 12),
    transferencias: arr<Estado['transferencias'][number]>(b.transferencias).filter((t) => t && typeof t.id === 'string' && num(t.valor) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(t.data)) && typeof t.de === 'string' && typeof t.para === 'string'),
    aportes: arr<Aporte>(b.aportes).filter((a) => a && typeof a.id === 'string'),
    dividas: arr<Divida>(b.dividas).filter((d) => d && typeof d.id === 'string').map((d) => ({ ...d, pagamentos: arr(d.pagamentos) })),
    planoDividas: (b.planoDividas as Estado['planoDividas']) ?? null,
    desejos: arr<Estado['desejos'][number]>(b.desejos),
    assinaturas: arr<Estado['assinaturas'][number]>(b.assinaturas),
    agentes,
    agentesCustom: arr<Estado['agentesCustom'][number]>(b.agentesCustom).slice(0, 10),
    investir: {
      perfilRisco: inv.perfilRisco as Estado['investir']['perfilRisco'],
      respostasQuiz: arr<number>(inv.respostasQuiz),
      aporteMensalPlanejado: typeof inv.aporteMensalPlanejado === 'number' ? inv.aporteMensalPlanejado : undefined,
      simulacao: {
        saldoVirtual: num(sim.saldoVirtual, 10000),
        posicoes: arr<Estado['investir']['simulacao']['posicoes'][number]>(sim.posicoes),
        historico: arr<Estado['investir']['simulacao']['historico'][number]>(sim.historico),
      },
      chat: arr<Estado['investir']['chat'][number]>(inv.chat).slice(-50),
      mensagensHoje: { data: String(obj(inv.mensagensHoje).data ?? ''), qtd: num(obj(inv.mensagensHoje).qtd) },
    },
    semanaVista: typeof b.semanaVista === 'string' ? b.semanaVista : undefined,
    limites: Object.fromEntries(Object.entries(obj(b.limites)).filter(([, v]) => typeof v === 'number' && v > 0)) as Record<string, number>,
    atrasos: (() => {
      const a = obj(b.atrasos);
      if (!b.atrasos) return undefined;
      return {
        porMes: num(a.porMes, -1) >= 0 ? num(a.porMes) : undefined,
        separado: Math.max(0, num(a.separado)),
        saidas: Object.fromEntries(Object.entries(obj(a.saidas)).filter(([k, v]) => /^\d{4}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v !== 0)) as Record<string, number>,
        ignorados: arr<string>(a.ignorados).filter((x) => typeof x === 'string').slice(-200),
        manuais: arr<Record<string, unknown>>(a.manuais)
          .filter((m) => m && typeof m.id === 'string' && typeof m.nome === 'string' && num(m.valor) > 0 && /^\d{4}-\d{2}$/.test(String(m.mes)) && /^\d{4}-\d{2}-\d{2}$/.test(String(m.vencimento)))
          .map((m) => ({ id: String(m.id), nome: String(m.nome), valor: num(m.valor), mes: String(m.mes), vencimento: String(m.vencimento), estimado: m.estimado === true ? true : undefined, categoria: typeof m.categoria === 'string' ? m.categoria : undefined, gastoId: typeof m.gastoId === 'string' ? m.gastoId : undefined }))
          .slice(-100),
      };
    })(),
    outrosCartoes: arr<Record<string, unknown>>(b.outrosCartoes).filter((c) => c && typeof c.id === 'string' && typeof c.nome === 'string' && c.nome.trim()).map((c) => ({ id: String(c.id), nome: String(c.nome).trim().slice(0, 30), limite: Math.max(0, num(c.limite)), usado: Math.max(0, num(c.usado)), venceDia: Math.min(31, Math.max(1, num(c.venceDia, 1))) })).slice(0, 6),
    recuperacao: (() => {
      const r = obj(b.recuperacao);
      return { ativo: Boolean(r.ativo), desde: typeof r.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.desde) ? r.desde : undefined, raioXFeito: Boolean(r.raioXFeito), ofertaDispensada: Boolean(r.ofertaDispensada), marcos: arr<string>(r.marcos).filter((x) => typeof x === 'string').slice(0, 30) };
    })(),
    cartao: (() => {
      const c = obj(b.cartao);
      return num(c.limite) > 0 ? { limite: num(c.limite), usado: Math.max(0, num(c.usado)), fechaDia: Math.min(31, Math.max(1, num(c.fechaDia, 1))), venceDia: Math.min(31, Math.max(1, num(c.venceDia, 1))), parcelados: arr<NonNullable<Estado['cartao']>['parcelados'] extends (infer U)[] | undefined ? U : never>(c.parcelados).filter((p) => p && typeof p.id === 'string' && num(p.parcela) > 0 && num(p.restantes) > 0), pagas: arr<{ data: string; valor: number }>(c.pagas).filter((p) => p && typeof p.data === 'string' && num(p.valor) > 0), limitePessoal: num(c.limitePessoal) > 0 ? num(c.limitePessoal) : undefined } : null;
    })(),
  };
}

export { IDS_ANTIGOS };
