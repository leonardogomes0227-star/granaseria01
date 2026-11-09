import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useEstado } from './store';
import { filtrarMovimentos, movimentosDoMes, totaisMov, type FiltroMov, type Movimento } from './movimentos';
import { abrirAdicionar } from './AdicionarMov';
import { brl, diaRelativo } from './datas';
import { Vazio } from './ui';

const TIPOS: [FiltroMov['tipo'], string][] = [['todos', 'Tudo'], ['despesa', 'Despesas'], ['receita', 'Receitas'], ['conta', 'Contas pagas'], ['guardado', 'Guardado']];

/** Histórico do mês: tudo que entrou e saiu, com busca e filtros. Contas pagas vêm das contas fixas (não duplicam). */
export function Historico({ mes, hoje }: { mes: string; hoje: string }) {
  const e = useEstado();
  const [f, setF] = useState<FiltroMov>({ tipo: 'todos', busca: '', categoria: '' });
  const todos = useMemo(() => movimentosDoMes(e, mes), [e, mes]);
  const lista = useMemo(() => filtrarMovimentos(todos, f), [todos, f]);
  const t = totaisMov(lista);
  const categorias = useMemo(() => [...new Set(todos.map((x) => x.categoria))].sort(), [todos]);
  const abrir = (m: Movimento) => {
    if (m.tipo === 'despesa') {
      const l = e.lancamentos.find((x) => x.id === m.refId);
      if (l) abrirAdicionar({ editarGasto: l });
    } else if (m.tipo === 'receita') {
      const r = e.receitas.find((x) => x.id === m.refId);
      if (r) abrirAdicionar({ editarReceita: r });
    }
  };
  return (
    <>
      <div className="gs-card">
        <div className="gs-trio">
          <div><span className="gs-rotulo">Entrou</span><b className="gs-tab" style={{ color: 'var(--success)' }}>{brl(t.entrou)}</b></div>
          <div><span className="gs-rotulo">Saiu</span><b className="gs-tab">{brl(t.saiu)}</b></div>
          <div><span className="gs-rotulo">Diferença</span><b className="gs-tab" style={{ color: t.saldo < 0 ? 'var(--danger)' : undefined }}>{brl(t.saldo)}</b></div>
        </div>
      </div>
      <label className="gs-busca">
        <Search size={18} aria-hidden="true" />
        <input type="search" value={f.busca} onChange={(ev) => setF({ ...f, busca: ev.target.value })} placeholder="Buscar por descrição ou categoria" aria-label="Buscar movimentações" />
      </label>
      <div className="gs-chips" role="group" aria-label="Filtrar por tipo">
        {TIPOS.map(([k, r]) => <button key={k} type="button" className={`gs-chip ${f.tipo === k ? 'on' : ''}`} onClick={() => setF({ ...f, tipo: k })}>{r}</button>)}
      </div>
      {categorias.length > 1 && (
        <select className="gs-select" value={f.categoria} onChange={(ev) => setF({ ...f, categoria: ev.target.value })} aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {lista.length === 0 ? (
        <Vazio titulo={todos.length === 0 ? 'Nada registrado neste mês' : 'Nada encontrado com esse filtro'} texto={todos.length === 0 ? 'Registre uma receita ou uma despesa em poucos segundos.' : 'Tente outra busca ou limpe os filtros.'} acao={todos.length === 0 ? 'Adicionar movimentação' : undefined} onAcao={() => abrirAdicionar()} avatar="gastos" />
      ) : (
        <div className="gs-card">
          {lista.map((m) => {
            const corpo = (
              <>
                <div className="gs-corpo"><b>{m.descricao}</b><small>{diaRelativo(m.data, hoje)} · {m.categoria}{m.tipo === 'conta' ? ' · conta fixa' : ''}</small></div>
                <span className="gs-valor" style={{ color: m.entrada ? 'var(--success)' : undefined }}>{m.entrada ? '+' : '−'} {brl(m.valor)}</span>
              </>
            );
            return m.editavel ? (
              <button type="button" className="gs-linha gs-linha-btn" key={m.chave} onClick={() => abrir(m)}>{corpo}</button>
            ) : (
              <Link className="gs-linha gs-linha-btn" key={m.chave} to={m.tipo === 'conta' ? '/mes' : m.tipo === 'divida' ? '/plano/dividas' : '/plano/reserva'}>{corpo}</Link>
            );
          })}
        </div>
      )}
    </>
  );
}
