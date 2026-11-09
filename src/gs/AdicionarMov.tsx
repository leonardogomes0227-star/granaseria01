import { useEffect, useMemo, useState } from 'react';
import { useEstado } from './store';
import { atalhosFrequentes, sugerirCategoria, sugerirForma } from './sugestoes';
import { removerLancamento, removerReceita, restaurarLancamento, restaurarReceita, salvarLancamento, salvarReceita } from './acoes';
import { CATEGORIAS_MOV, type Lancamento, type Receita } from './tipos';
import { brl, hoje as hojeSP } from './datas';
import { Campo, CampoDinheiro, Folha } from './ui';
import { apagarComDesfazer, toast } from '../components/ui/Toast';

/* ---------- "+ Adicionar movimentação": um só lugar pra anotar gasto ou receita, de qualquer tela ---------- */

export const EVENTO_ADICIONAR = 'gs-adicionar';
export interface PedidoAdicionar {
  tipo?: 'despesa' | 'receita';
  receitaTipo?: 'salario' | 'extra';
  editarGasto?: Lancamento;
  editarReceita?: Receita;
}
export const abrirAdicionar = (p: PedidoAdicionar = {}) => window.dispatchEvent(new CustomEvent<PedidoAdicionar>(EVENTO_ADICIONAR, { detail: p }));

const FORMAS = ['Pix', 'Débito', 'Crédito', 'Dinheiro'];

export function AdicionarMov() {
  const e = useEstado();
  const [aberta, setAberta] = useState(false);
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  const [valor, setValor] = useState(0);
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Comida');
  const [catManual, setCatManual] = useState(false);
  const [forma, setForma] = useState('');
  const [data, setData] = useState(hojeSP());
  const [rTipo, setRTipo] = useState<'salario' | 'extra'>('extra');
  const [erro, setErro] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [original, setOriginal] = useState<Lancamento | Receita | null>(null);
  const [apagar, setApagar] = useState(false);
  const hoje = hojeSP();
  const atalhos = useMemo(() => atalhosFrequentes(e, hoje), [e, hoje]);

  useEffect(() => {
    const abrir = (ev: Event) => {
      const p = (ev as CustomEvent<PedidoAdicionar>).detail ?? {};
      const g = p.editarGasto;
      const r = p.editarReceita;
      setErro('');
      setApagar(false);
      setCatManual(Boolean(g));
      setOriginal(g ?? r ?? null);
      setEditId(g?.id ?? r?.id ?? null);
      setTipo(r ? 'receita' : g ? 'despesa' : (p.tipo ?? 'despesa'));
      setValor(g?.valor ?? r?.valor ?? 0);
      setDesc(g ? g.descricao : r ? r.descricao : '');
      setCat(g?.categoria ?? 'Comida');
      setForma(g?.forma ?? '');
      setData(g?.data ?? r?.data ?? hojeSP());
      setRTipo(r?.tipo ?? p.receitaTipo ?? 'extra');
      setAberta(true);
    };
    window.addEventListener(EVENTO_ADICIONAR, abrir);
    return () => window.removeEventListener(EVENTO_ADICIONAR, abrir);
  }, []);

  const mudarDesc = (t: string) => {
    setDesc(t);
    if (tipo === 'despesa' && !catManual) {
      const s = sugerirCategoria(t, CATEGORIAS_MOV);
      if (s) setCat(s);
    }
    if (tipo === 'despesa' && !forma) {
      const f = sugerirForma(t);
      if (f) setForma(f);
    }
  };
  const fechar = () => setAberta(false);

  const salvar = (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (!(valor > 0)) return setErro('Digite o valor.');
    if (data > hojeSP()) return setErro('A data não pode ser no futuro.');
    if (tipo === 'despesa') {
      if (!salvarLancamento({ id: editId ?? undefined, descricao: desc, valor, data, categoria: cat, forma: forma || undefined, serverId: (original as Lancamento | null)?.serverId })) return setErro('Confira os dados e tente de novo.');
      toast(`${editId ? 'Gasto atualizado' : 'Gasto anotado'}: ${brl(valor)} em ${cat}`);
    } else {
      if (!salvarReceita({ id: editId ?? undefined, descricao: desc, valor, data, tipo: rTipo, serverId: (original as Receita | null)?.serverId })) return setErro('Confira os dados e tente de novo.');
      toast(`${editId ? 'Receita atualizada' : 'Receita registrada'}: ${brl(valor)}`);
    }
    fechar();
  };

  const excluir = () => {
    if (!original || !editId) return;
    if (tipo === 'despesa') {
      const l = original as Lancamento;
      removerLancamento(l.id);
      apagarComDesfazer(`${l.descricao} apagado`, () => restaurarLancamento(l));
    } else {
      const r = original as Receita;
      removerReceita(r.id);
      apagarComDesfazer(`${r.descricao} apagada`, () => restaurarReceita(r));
    }
    fechar();
  };

  return (
    <Folha aberta={aberta} onFechar={fechar} titulo={editId ? 'Editar movimentação' : 'Adicionar movimentação'}>
      <form onSubmit={salvar}>
        {!editId && (
          <div className="gs-seg" role="group" aria-label="Tipo">
            <button type="button" className={tipo === 'despesa' ? 'on' : ''} onClick={() => setTipo('despesa')}>Despesa</button>
            <button type="button" className={tipo === 'receita' ? 'on' : ''} onClick={() => setTipo('receita')}>Receita</button>
          </div>
        )}
        {tipo === 'despesa' && !editId && atalhos.length > 0 && (
          <div className="gs-chips" role="group" aria-label="Atalhos">
            {atalhos.map((a) => (
              <button key={a.descricao} type="button" className="gs-chip" onClick={() => { setDesc(a.descricao); setCat(a.categoria); setCatManual(true); setValor(a.valor); }}>
                {a.descricao} · {brl(a.valor)}
              </button>
            ))}
          </div>
        )}
        <CampoDinheiro rotulo={tipo === 'despesa' ? 'Quanto gastou?' : 'Quanto recebeu?'} valor={valor} onChange={setValor} grande autoFocus erro={erro && !(valor > 0) ? erro : undefined} />
        <Campo rotulo={tipo === 'despesa' ? 'O que foi?' : 'De onde veio?'} valor={desc} onChange={mudarDesc} placeholder={tipo === 'despesa' ? 'Ex.: mercado, uber, netflix' : 'Ex.: salário, freela'} maxLength={80} />
        {tipo === 'despesa' ? (
          <>
            <div className="gs-chips" role="group" aria-label="Categoria">
              {CATEGORIAS_MOV.map((c) => (
                <button key={c} type="button" className={`gs-chip ${cat === c ? 'on' : ''}`} onClick={() => { setCat(c); setCatManual(true); }}>{c}</button>
              ))}
            </div>
            <div className="gs-chips" role="group" aria-label="Forma de pagamento">
              {FORMAS.map((f) => (
                <button key={f} type="button" className={`gs-chip ${forma === f ? 'on' : ''}`} onClick={() => setForma(forma === f ? '' : f)}>{f}</button>
              ))}
            </div>
          </>
        ) : (
          <div className="gs-chips" role="group" aria-label="Tipo de receita">
            <button type="button" className={`gs-chip ${rTipo === 'salario' ? 'on' : ''}`} onClick={() => setRTipo('salario')}>Salário / renda do mês</button>
            <button type="button" className={`gs-chip ${rTipo === 'extra' ? 'on' : ''}`} onClick={() => setRTipo('extra')}>Outra receita</button>
          </div>
        )}
        <details style={{ marginBottom: 8 }}>
          <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>{data === hoje ? 'Foi em outro dia?' : `Data: ${data.split('-').reverse().join('/')}`}</summary>
          <Campo rotulo="Data" valor={data} onChange={setData} tipo="date" />
        </details>
        {erro && valor > 0 && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
        <div className="gs-acoes">
          <button type="submit" className="gs-btn cheio">Salvar</button>
          {editId && !apagar && <button type="button" className="gs-btn link" onClick={() => setApagar(true)}>Excluir</button>}
          {editId && apagar && <button type="button" className="gs-btn perigo" onClick={excluir}>Confirmar exclusão</button>}
        </div>
      </form>
    </Folha>
  );
}
