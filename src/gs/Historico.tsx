import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, ListOrdered, Scale, Search } from 'lucide-react';
import { FaixaKpis, GraficoBarras } from './PainelUI';
import { useEstado } from './store';
import { filtrarMovimentos, intervalo, movimentosNoPeriodo, totaisMov, type FiltroMov, type Movimento, type Ordem, type Periodo } from './movimentos';
import { ContasSheet } from './Contas';
import { abrirAdicionar } from './AdicionarMov';
import { brl, diaRelativo, diasNoMes } from './datas';
import { iconeDe } from './categorias';
import { Vazio } from './ui';

const TIPOS: [FiltroMov['tipo'], string][] = [['todos', 'Tudo'], ['despesa', 'Despesas'], ['receita', 'Receitas'], ['transferencia', 'Transferências'], ['conta', 'Contas pagas'], ['guardado', 'Guardado']];
const PERIODOS: [Periodo, string][] = [['mes', 'Mês'], ['7d', '7 dias'], ['30d', '30 dias'], ['ano', 'Ano']];

/** Histórico do mês: tudo que entrou e saiu, com busca e filtros. Contas pagas vêm das contas fixas (não duplicam). */
export function Historico({ mes, hoje }: { mes: string; hoje: string }) {
  const e = useEstado();
  const [f, setF] = useState<FiltroMov>({ tipo: 'todos', busca: '', categoria: '', contaId: '', ordem: 'recentes' });
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [contas, setContas] = useState(false);
  const todos = useMemo(() => { const { de, ate } = intervalo(periodo, mes, hoje); return movimentosNoPeriodo(e, de, ate).filter((m) => periodo !== 'mes' || m.data.slice(0, 7) === mes); }, [e, mes, hoje, periodo]);
  const lista = useMemo(() => filtrarMovimentos(todos, f), [todos, f]);
  const t = totaisMov(lista);
  const categorias = useMemo(() => [...new Set(todos.map((x) => x.categoria))].sort(), [todos]);
  const abrir = (m: Movimento) => {
    if (m.tipo === 'despesa') {
      const l = e.lancamentos.find((x) => x.id === m.refId);
      if (l) abrirAdicionar({ editarGasto: l });
    } else if (m.tipo === 'transferencia') {
      const t = e.transferencias.find((x) => x.id === m.refId);
      if (t) abrirAdicionar({ editarTransferencia: t });
    } else if (m.tipo === 'receita') {
      const r = e.receitas.find((x) => x.id === m.refId);
      if (r) abrirAdicionar({ editarReceita: r });
    }
  };
  return (
    <>
      <FaixaKpis itens={[
        { rotulo: 'Entrou', valor: t.entrou, icone: ArrowUpRight, tom: 'ok', nota: 'receitas no período' },
        { rotulo: 'Saiu', valor: t.saiu, icone: ArrowDownRight, nota: 'gastos no período' },
        { rotulo: 'Diferença', valor: t.saldo, icone: Scale, tom: t.saldo < 0 ? 'perigo' : 'ok', nota: t.saldo < 0 ? 'saiu mais do que entrou' : 'sobrou no período' },
        { rotulo: 'Movimentos', valor: lista.length, formato: 'int', icone: ListOrdered, nota: 'na lista abaixo' },
      ]} />
      {periodo === 'mes' && (
        <GraficoBarras titulo="Saídas por dia" sub={mes.slice(5, 7) + '/' + mes.slice(0, 4)}
          dados={Array.from({ length: diasNoMes(mes) }, (_, i) => { const d = i + 1; const v = lista.filter((x) => x.tipo === 'despesa' && Number(x.data.slice(8, 10)) === d).reduce((a, x) => a + x.valor, 0); return { rotulo: String(d), valor: v, legenda: `Dia ${d}` }; })}
          vazio="Nenhum gasto neste mês." />
      )}
      <label className="gs-busca">
        <Search size={18} aria-hidden="true" />
        <input type="search" value={f.busca} onChange={(ev) => setF({ ...f, busca: ev.target.value })} placeholder="Buscar por descrição ou categoria" aria-label="Buscar movimentações" />
      </label>
      <div className="gs-chips" role="group" aria-label="Período">
        {PERIODOS.map(([k, r]) => <button key={k} type="button" className={`gs-chip ${periodo === k ? 'on' : ''}`} aria-pressed={periodo === k} onClick={() => setPeriodo(k)}>{r}</button>)}
      </div>
      <details className="gs-aprende">
        <summary>Mais filtros{f.tipo !== 'todos' || f.categoria || f.contaId ? ' (ativos)' : ''}</summary>
      <div className="gs-chips" role="group" aria-label="Filtrar por tipo">
        {TIPOS.map(([k, r]) => <button key={k} type="button" className={`gs-chip ${f.tipo === k ? 'on' : ''}`} onClick={() => setF({ ...f, tipo: k })}>{r}</button>)}
      </div>
      <div className="gs-filtros">
        {e.contas.length > 0 && (
          <select className="gs-select" value={f.contaId ?? ''} onChange={(ev) => setF({ ...f, contaId: ev.target.value })} aria-label="Filtrar por conta">
            <option value="">Todas as contas</option>
            {e.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <select className="gs-select" value={f.ordem ?? 'recentes'} onChange={(ev) => setF({ ...f, ordem: ev.target.value as Ordem })} aria-label="Ordenar">
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="maior">Maior valor</option>
          <option value="menor">Menor valor</option>
        </select>
      </div>
      {categorias.length > 1 && (
        <select className="gs-select" value={f.categoria} onChange={(ev) => setF({ ...f, categoria: ev.target.value })} aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      <button type="button" className="gs-btn link" onClick={() => setContas(true)}>Gerenciar contas</button>
      </details>
      <ContasSheet aberta={contas} onFechar={() => setContas(false)} />
      {lista.length === 0 ? (
        <Vazio titulo={todos.length === 0 ? 'Nada registrado neste mês' : 'Nada encontrado com esse filtro'} texto={todos.length === 0 ? 'Registre uma receita ou uma despesa em poucos segundos.' : 'Tente outra busca ou limpe os filtros.'} acao={todos.length === 0 ? 'Adicionar movimentação' : undefined} onAcao={() => abrirAdicionar()} avatar="gastos" />
      ) : (
        <ListaDoMes lista={lista} hoje={hoje} abrir={abrir} />
      )}
    </>
  );
}

function ListaDoMes({ lista, hoje, abrir }: { lista: Movimento[]; hoje: string; abrir: (m: Movimento) => void }) {
  const [ate, setAte] = useState(40);
  useEffect(() => { setAte(40); }, [lista]);
  const visiveis = lista.slice(0, ate);
  return (
        <div className="gs-card">
          {visiveis.map((m) => {
            const Icone = m.tipo === 'despesa' ? iconeDe(m.categoria) : null;
            const corpo = (
              <>
                {Icone ? <span className="gs-ic-cat" aria-hidden="true"><Icone size={18} /></span> : <span className={`gs-ic-cat ${m.entrada ? 'ok' : ''}`} aria-hidden="true">{m.neutro ? '⇄' : m.entrada ? '↓' : '↑'}</span>}
                <div className="gs-corpo"><b>{m.descricao}</b><small>{diaRelativo(m.data, hoje)} · {m.categoria}{m.tipo === 'conta' ? ' · conta fixa' : ''}</small></div>
                <span className="gs-valor" style={{ color: m.entrada ? 'var(--success)' : undefined }}>{m.neutro ? '' : m.entrada ? '+ ' : '− '}{brl(m.valor)}</span>
              </>
            );
            return m.editavel ? (
              <button type="button" className="gs-linha gs-linha-btn" key={m.chave} onClick={() => abrir(m)}>{corpo}</button>
            ) : (
              <Link className="gs-linha gs-linha-btn" key={m.chave} to={m.tipo === 'conta' ? '/lancamentos?aba=contas' : m.tipo === 'divida' ? '/plano/dividas' : '/plano/reserva'}>{corpo}</Link>
            );
          })}
          {lista.length > ate && (
            <button type="button" className="gs-btn sec cheio" onClick={() => setAte((n) => n + 40)}>
              Mostrar mais {Math.min(40, lista.length - ate)} de {lista.length - ate}
            </button>
          )}
        </div>
  );
}
