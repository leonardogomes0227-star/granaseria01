import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, diaRelativo, mesCurto, mesDe, nomeMes, somaMes } from './datas';
import { contasDoMes, faltaPagar, fixosPagos, lancamentosDoMes, limiteDiario, livreParaGastar, quantoCortar, sequenciaDeDias, totalFixos, totalVariaveis, type ContaDoMes } from './selectores';
import { CATEGORIAS_DIA, CATEGORIAS_FIXAS, type GastoFixo, type Lancamento } from './tipos';
import { desfazerBaixa, removerGastoFixo, removerLancamento, restaurarGastoFixo, restaurarLancamento, salvarGastoFixo, salvarLancamento } from './acoes';
import { BaixaSheet } from './BaixaSheet';
import { Campo, CampoDinheiro, CampoNumero, Confirmar, Folha, Titulo, Vazio } from './ui';
import { apagarComDesfazer, toast } from '../components/ui/Toast';

/* ---------- Meu mês: Contas fixas e Dia a dia, separados ---------- */

function SeletorMes({ mes, onMudar, maximo }: { mes: string; onMudar: (m: string) => void; maximo: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 14px' }}>
      <button type="button" className="gs-btn sec pequeno" aria-label="Mês anterior" onClick={() => onMudar(somaMes(mes, -1))}><ChevronLeft size={18} /></button>
      <b className="gs-medio" style={{ fontSize: 20 }}>{nomeMes(mes)}</b>
      <button type="button" className="gs-btn sec pequeno" aria-label="Próximo mês" disabled={mes >= somaMes(maximo, 1)} onClick={() => onMudar(somaMes(mes, 1))}><ChevronRight size={18} /></button>
    </div>
  );
}

export function MeuMes() {
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'dia' ? 'dia' : 'contas';
  const hoje = useHoje();
  const [mes, setMes] = useState(mesDe(hoje));
  return (
    <>
      <Titulo titulo="Meu mês" />
      <div className="gs-seg" role="tablist" aria-label="Meu mês">
        <button type="button" role="tab" aria-selected={aba === 'contas'} className={aba === 'contas' ? 'on' : ''} onClick={() => setParams({})}>Contas fixas</button>
        <button type="button" role="tab" aria-selected={aba === 'dia'} className={aba === 'dia' ? 'on' : ''} onClick={() => setParams({ aba: 'dia' })}>Dia a dia</button>
      </div>
      <SeletorMes mes={mes} onMudar={setMes} maximo={mesDe(hoje)} />
      {aba === 'contas' ? <ContasFixas mes={mes} hoje={hoje} /> : <DiaADia mes={mes} hoje={hoje} />}
    </>
  );
}

/* ============================ Contas fixas ============================ */

const ROTULO_ESTADO: Record<ContaDoMes['estado'], [string, string]> = { paga: ['Paga', 'ok'], atrasada: ['Atrasada', 'perigo'], 'vence-logo': ['Vence logo', 'aviso'], 'em-dia': ['Em dia', ''] };

function ContasFixas({ mes, hoje }: { mes: string; hoje: string }) {
  const e = useEstado();
  const [baixa, setBaixa] = useState<string | null>(null);
  const [editando, setEditando] = useState<GastoFixo | 'novo' | null>(null);
  const [apagar, setApagar] = useState<GastoFixo | null>(null);
  const [params, setParams] = useSearchParams();
  const contas = useMemo(() => contasDoMes(e, mes, hoje), [e, mes, hoje]);
  const futuro = mes > mesDe(hoje);
  const pedido = params.get('baixa');
  useEffect(() => {
    if (pedido) {
      setBaixa(pedido);
      setParams({}, { replace: true });
    }
  }, [pedido, setParams]);
  const total = totalFixos(e, mes);
  const gasto = e.gastosFixos.find((g) => g.id === baixa) ?? null;
  return (
    <>
      <div className="gs-card destaque">
        <div className="gs-tres">
          <div><span className="gs-mudo">Total</span><b className="gs-tab">{brl0(total)}</b></div>
          <div><span className="gs-mudo">Já pago</span><b className="gs-tab">{brl0(fixosPagos(e, mes))}</b></div>
          <div><span className="gs-mudo">Falta pagar</span><b className="gs-tab">{brl0(faltaPagar(e, mes))}</b></div>
        </div>
      </div>
      {contas.length === 0 ? (
        <Vazio titulo="Nenhuma conta fixa ainda" texto="Cadastre aluguel, luz, internet… Eu te aviso antes de cada uma vencer." acao="Cadastrar conta" onAcao={() => setEditando('novo')} avatar="contas" />
      ) : (
        <div className="gs-card">
          {contas.map((c) => {
            const [rotulo, tom] = ROTULO_ESTADO[c.estado];
            return (
              <div className="gs-linha" key={c.gasto.id}>
                {c.estado === 'paga' ? <span className="gs-check" aria-hidden="true"><Check size={16} /></span> : <span style={{ width: 28 }} />}
                <div className="gs-corpo">
                  <b>{c.gasto.nome}</b>
                  <small>
                    Vence {diaCurto(c.vencimento)} · {c.gasto.categoria}
                    {c.estado === 'paga' && ` · paga em ${diaCurto(c.gasto.pagamentos[mes].pagoEm)}`}
                  </small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="gs-valor">{brl(c.valor)}</div>
                  <span className={`gs-etiqueta ${tom}`}>{rotulo}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {c.estado === 'paga' ? (
                    <button type="button" className="gs-btn link" onClick={() => { const id = c.gasto.id; desfazerBaixa(id, mes); toast('Pagamento desfeito'); }}>Desfazer</button>
                  ) : (
                    <button type="button" className="gs-btn pequeno" disabled={futuro} title={futuro ? 'Só dá pra dar baixa no mês atual ou em meses passados' : undefined} onClick={() => setBaixa(c.gasto.id)}>Dar baixa</button>
                  )}
                </div>
                <button type="button" className="gs-menu-pontos" aria-label={`Editar ${c.gasto.nome}`} onClick={() => setEditando(c.gasto)}><Pencil size={17} /></button>
                <button type="button" className="gs-menu-pontos" aria-label={`Excluir ${c.gasto.nome}`} onClick={() => setApagar(c.gasto)}><Trash2 size={17} /></button>
              </div>
            );
          })}
        </div>
      )}
      {contas.length > 0 && <button type="button" className="gs-btn sec cheio" onClick={() => setEditando('novo')}>+ Nova conta fixa</button>}
      <BaixaSheet gasto={gasto} mes={mes} onFechar={() => setBaixa(null)} />
      <FormConta valor={editando} onFechar={() => setEditando(null)} />
      <Confirmar
        aberta={Boolean(apagar)}
        titulo={`Excluir ${apagar?.nome ?? ''}?`}
        texto="O histórico de pagamentos dessa conta também sai."
        rotulo="Excluir"
        onCancelar={() => setApagar(null)}
        onConfirmar={() => {
          const g = apagar!;
          removerGastoFixo(g.id);
          setApagar(null);
          apagarComDesfazer(`${g.nome} excluída`, () => restaurarGastoFixo(g));
        }}
      />
    </>
  );
}

function FormConta({ valor, onFechar }: { valor: GastoFixo | 'novo' | null; onFechar: () => void }) {
  const edit = valor && valor !== 'novo' ? valor : null;
  const [nome, setNome] = useState('');
  const [v, setV] = useState(0);
  const [dia, setDia] = useState<number | ''>('');
  const [cat, setCat] = useState<string>('Outros');
  const [tentou, setTentou] = useState(false);
  useEffect(() => {
    if (!valor) return;
    setNome(edit?.nome ?? '');
    setV(edit?.valor ?? 0);
    setDia(edit?.diaVencimento ?? '');
    setCat(edit?.categoria ?? 'Outros');
    setTentou(false);
  }, [valor, edit]);
  const erroNome = tentou && !nome.trim() ? 'Dê um nome.' : undefined;
  return (
    <Folha aberta={Boolean(valor)} onFechar={onFechar} titulo={edit ? 'Editar conta' : 'Nova conta fixa'}>
      <div className="gs-chips" role="group" aria-label="Atalhos">
        {CATEGORIAS_FIXAS.map((c) => (
          <button key={c} type="button" className={`gs-chip ${cat === c ? 'on' : ''}`} onClick={() => { setCat(c); if (!nome.trim() && c !== 'Outros') setNome(c); }}>{c}</button>
        ))}
      </div>
      <Campo rotulo="Nome" valor={nome} onChange={setNome} placeholder="Ex.: Aluguel" maxLength={60} erro={erroNome} />
      <div className="gs-dois">
        <CampoDinheiro rotulo="Valor" valor={v} onChange={setV} erro={tentou && !(v > 0) ? 'Digite o valor.' : undefined} />
        <CampoNumero rotulo="Dia do vencimento" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 5" erro={tentou && !(typeof dia === 'number' && dia >= 1) ? 'De 1 a 31.' : undefined} />
      </div>
      <p className="gs-nota">Dia 29, 30 ou 31 em mês curto vira o último dia do mês.</p>
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button
          type="button"
          className="gs-btn"
          onClick={() => {
            setTentou(true);
            if (salvarGastoFixo({ id: edit?.id, nome, valor: v, diaVencimento: typeof dia === 'number' ? dia : 0, categoria: cat })) onFechar();
          }}
        >
          Salvar
        </button>
      </div>
    </Folha>
  );
}

/* ============================ Dia a dia ============================ */

function DiaADia({ mes, hoje }: { mes: string; hoje: string }) {
  const e = useEstado();
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [desc, setDesc] = useState('');
  const [v, setV] = useState(0);
  const [cat, setCat] = useState('Comida');
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState('');
  const ls = useMemo(() => lancamentosDoMes(e, mes).sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id)), [e, mes]);
  const grupos = useMemo(() => {
    const m = new Map<string, Lancamento[]>();
    for (const l of ls) m.set(l.data, [...(m.get(l.data) ?? []), l]);
    return [...m.entries()];
  }, [ls]);
  const atual = mes === mesDe(hoje);
  const livre = livreParaGastar(e, mes);
  const seq = sequenciaDeDias(e, hoje);

  const salvar = () => {
    if (!(v > 0)) return setErro('Digite o valor.');
    if (!salvarLancamento({ descricao: desc, valor: v, data, categoria: cat })) return setErro('Data não pode ser no futuro.');
    setErro('');
    setDesc('');
    setV(0);
    toast(`Anotado: ${brl(v)} em ${cat}`);
  };

  return (
    <>
      {e.config.renda > 0 && atual && (
        <div className={`gs-card ${livre < 0 ? 'perigo' : 'destaque'}`}>
          {livre < 0 ? (
            <p className="gs-medio" style={{ fontSize: 20 }}>Sem folga este mês. Corte {brl0(quantoCortar(e, mes))} para fechar no zero.</p>
          ) : (
            <>
              <span className="gs-rotulo">Você pode gastar por dia</span>
              <p className="gs-grande" style={{ margin: '4px 0' }}>{brl(limiteDiario(e, mes, hoje))}</p>
              <span className="gs-mudo">até o fim do mês</span>
            </>
          )}
        </div>
      )}
      <section className="gs-card" aria-label="Anotar gasto">
        <CampoDinheiro rotulo="Quanto gastou?" valor={v} onChange={setV} grande erro={erro && !(v > 0) ? erro : undefined} />
        <Campo rotulo="O que foi? (opcional)" valor={desc} onChange={setDesc} placeholder="Ex.: mercado" maxLength={80} />
        <div className="gs-chips" role="group" aria-label="Categoria">
          {CATEGORIAS_DIA.map((c) => (
            <button key={c} type="button" className={`gs-chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <Campo rotulo="Data" valor={data} onChange={setData} tipo="date" />
        {erro && v > 0 && <p className="gs-erro" role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
        <button type="button" className="gs-btn cheio" onClick={salvar}>Salvar gasto</button>
      </section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 4px 10px' }}>
        <span className="gs-rotulo">{mesCurto(mes)} · total</span>
        <b className="gs-medio gs-tab">{brl(totalVariaveis(e, mes))}</b>
      </div>
      {seq >= 2 && <p className="gs-mudo" style={{ margin: '0 4px 10px' }}>{seq} dias seguidos anotando.</p>}
      {grupos.length === 0 ? (
        <Vazio titulo="Nada anotado neste mês" texto="Anote o primeiro gasto acima. Leva dois toques." avatar="gastos" />
      ) : (
        grupos.map(([dia, itens]) => (
          <div className="gs-card" key={dia}>
            <p className="gs-rotulo" style={{ marginBottom: 4 }}>{diaRelativo(dia, hoje)} · {brl(itens.reduce((t, l) => t + l.valor, 0))}</p>
            {itens.map((l) => (
              <div className="gs-linha" key={l.id}>
                <div className="gs-corpo"><b>{l.descricao}</b><small>{l.categoria}</small></div>
                <span className="gs-valor">{brl(l.valor)}</span>
                <button type="button" className="gs-menu-pontos" aria-label={`Editar ${l.descricao}`} onClick={() => setEditando(l)}><Pencil size={17} /></button>
                <button type="button" className="gs-menu-pontos" aria-label={`Excluir ${l.descricao}`} onClick={() => { removerLancamento(l.id); apagarComDesfazer(`${l.descricao} apagado`, () => restaurarLancamento(l)); }}><Trash2 size={17} /></button>
              </div>
            ))}
          </div>
        ))
      )}
      <FormLancamento valor={editando} hoje={hoje} onFechar={() => setEditando(null)} />
    </>
  );
}

function FormLancamento({ valor, hoje, onFechar }: { valor: Lancamento | null; hoje: string; onFechar: () => void }) {
  const [desc, setDesc] = useState('');
  const [v, setV] = useState(0);
  const [cat, setCat] = useState('Outros');
  const [data, setData] = useState(hoje);
  useEffect(() => {
    if (!valor) return;
    setDesc(valor.descricao);
    setV(valor.valor);
    setCat(valor.categoria);
    setData(valor.data);
  }, [valor]);
  return (
    <Folha aberta={Boolean(valor)} onFechar={onFechar} titulo="Editar gasto">
      <CampoDinheiro rotulo="Valor" valor={v} onChange={setV} grande />
      <Campo rotulo="Descrição" valor={desc} onChange={setDesc} maxLength={80} />
      <div className="gs-chips">
        {[...new Set([...CATEGORIAS_DIA, cat])].map((c) => (
          <button key={c} type="button" className={`gs-chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <Campo rotulo="Data" valor={data} onChange={setData} tipo="date" />
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button type="button" className="gs-btn" disabled={!(v > 0)} onClick={() => { if (valor && salvarLancamento({ id: valor.id, descricao: desc, valor: v, data, categoria: cat, serverId: valor.serverId })) onFechar(); }}>Salvar</button>
      </div>
    </Folha>
  );
}
