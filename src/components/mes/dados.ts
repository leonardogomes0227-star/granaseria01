// Os dados do Meu mês: os lançamentos de um mês (api/lancamentos.ts) e a conta do "quanto posso gastar hoje", montada
// igual à da Início. Recarrega quando algo é anotado, editado ou apagado (evento 'gs-lancamentos').

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENTO_LANCAMENTOS, type Lancamento } from '../../lib/anotar';
import { quantoPossoGastarHoje } from '../../lib/financas';
import { useArmazem } from '../../lib/armazem';
import { lerEu } from '../../eu';
import { lerMissoes } from '../../missoes';
import { todayBRT } from '../../coach';
import { useBills, useSaved } from '../FixedBills';
import { listarMes } from './api';
import { montarConta } from './possoComprar';

/** Os lançamentos de um mês. itens = null enquanto carrega (ou se der erro sem nada pra mostrar). */
export function useLancamentosDoMes(mes: string, ligado: boolean) {
  const [estado, setEstado] = useState<{ mes: string; itens: Lancamento[] | null; erro: string | null }>({ mes, itens: null, erro: null });
  const vez = useRef(0);
  const carregar = useCallback(() => {
    if (!ligado) return;
    const n = ++vez.current;
    listarMes(mes)
      .then((itens) => {
        if (n === vez.current) setEstado({ mes, itens, erro: null });
      })
      .catch((err: unknown) => {
        // recarga que falhou mantém o que já estava na tela
        if (n === vez.current) setEstado((e) => ({ mes, itens: e.mes === mes ? e.itens : null, erro: err instanceof Error ? err.message : 'Não consegui carregar agora.' }));
      });
  }, [mes, ligado]);
  useEffect(() => {
    carregar();
    window.addEventListener(EVENTO_LANCAMENTOS, carregar);
    return () => window.removeEventListener(EVENTO_LANCAMENTOS, carregar);
  }, [carregar]);
  const doMes = estado.mes === mes;
  return { itens: doMes ? estado.itens : null, erro: doMes ? estado.erro : null, recarregar: carregar };
}

/** A conta do mês atual, a mesma do card da Início (HomePage, useContaDoMes). */
export function useContaDoMes(itens: Lancamento[] | null) {
  const bills = useBills();
  const saved = useSaved();
  const eu = useArmazem(lerEu);
  const missoes = useArmazem(lerMissoes);
  const hoje = todayBRT();
  return useMemo(() => {
    const lista = itens ?? [];
    const entradas = lista.filter((l) => l.kind === 'in').reduce((t, l) => t + l.amount, 0);
    const entrada = montarConta({ hoje, renda: eu.renda ?? 0, entradas, saidas: lista.filter((l) => l.kind === 'out'), bills, saved, missoes });
    const conta = quantoPossoGastarHoje(entrada);
    return { conta, entrada, hoje, semDados: conta.modo === 'real' && entradas === 0 };
  }, [itens, bills, saved, eu, missoes, hoje]);
}
