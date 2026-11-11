// Quanto dado de verdade um estado salvo tem. Serve para a sincronização NUNCA trocar um estado com dados por um vazio:
// um aparelho novo cria um estado em branco antes de buscar o do servidor, e esse branco não pode apagar nada.
// Puro e sem dependências (usado no navegador e no servidor).

const lista = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** Número de registros que a pessoa criou (gastos, contas, dívidas, metas…). 0 = estado em branco ou ilegível. */
export function pesoDoEstado(bruto: string | null | undefined): number {
  if (!bruto) return 0;
  let e: Record<string, unknown>;
  try {
    e = JSON.parse(bruto) as Record<string, unknown>;
  } catch {
    return 0;
  }
  if (!e || typeof e !== 'object') return 0;
  const cfg = (e.config ?? {}) as Record<string, unknown>;
  const caminho = (e.caminho ?? {}) as Record<string, unknown>;
  return (
    lista(e.lancamentos) + lista(e.receitas) + lista(e.gastosFixos) + lista(e.dividas) + lista(e.metas) + lista(e.aportes) +
    lista(e.assinaturas) + lista(e.desejos) + lista(e.contas) + lista(e.transferencias) + lista(e.agentesCustom) + lista(e.outrosCartoes) + lista(caminho.passos) +
    lista((e.atrasos as Record<string, unknown> | undefined)?.manuais) +
    (e.cartao ? 1 : 0) + (typeof cfg.renda === 'number' && cfg.renda > 0 ? 1 : 0) + (cfg.saldoInformado ? 1 : 0) + (cfg.onboardingFeito ? 1 : 0)
  );
}
