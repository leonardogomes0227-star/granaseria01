import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, diaRelativo, mesCurto, mesDe, nomeMes, somaMes } from './datas';
import { contasDoMes, faltaPagar, fixosPagos, lancamentosDoMes, limiteDiario, livreParaGastar, quantoCortar, sequenciaDeDias, totalFixos, totalVariaveis, type ContaDoMes } from './selectores';
import { CATEGORIAS_DIA, CATEGORIAS_FIXAS, type GastoFixo, type Lancamento } from './tipos';
import { desfazerBaixa, removerGastoFixo, removerLancamento, restaurarGastoFixo, restaurarLancamento, salvarGastoFixo, salvarLancamento } from './acoes';
import { BaixaSheet } from './BaixaSheet';
import { Historico } from './Historico';
import { abrirAdicionar } from './AdicionarMov';
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

export function MeuMes({ padrao = 'contas' }: { padrao?: 'contas' | 'historico' }) {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('aba');
  const aba = pedida === 'dia' ? 'dia' : pedida === 'historico' ? 'historico' : pedida === 'contas' ? 'contas' : padrao;
  const hoje = useHoje();
  const [mes, setMes] = useState(mesDe(hoje));
  return (
    <>
      <Titulo titulo={padrao === 'historico' ? 'Lançamentos' : 'Meu dinheiro'} />
      <button type="button" className="gs-btn cheio" style={{ width: '100%', marginBottom: 12 }} onClick={() => abrirAdicionar()}>+ Adicionar movimentação</button>
      <div className="gs-chips" aria-label="Atalhos" style={{ margin: "4px 0 12px" }}>
        <Link to="/plano/orcamento" className="gs-chip">Orçamento</Link>
        <Link to="/plano/calendario" className="gs-chip">Calendário de contas</Link>
      </div>
      <div className="gs-seg" role="tablist" aria-label="Meu mês">
        <button type="button" role="tab" aria-selected={aba === 'contas'} className={aba === 'contas' ? 'on' : ''} onClick={() => setParams({ aba: 'contas' })}>Contas fixas</button>
        <button type="button" role="tab" aria-selected={aba === 'dia'} className={aba === 'dia' ? 'on' : ''} onClick={() => setParams({ aba: 'dia' })}>Dia a dia</button>
        <button type="button" role="tab" aria-selected={aba === 'historico'} className={aba === 'historico' ? 'on' : ''} onClick={() => setParams({ aba: 'historico' })}>Histórico</button>
      </div>
      <SeletorMes mes={mes} onMudar={setMes} maximo={mesDe(hoje)} />
      {aba === 'contas' ? <ContasFixas mes={mes} hoje={hoje} /> : aba === 'dia' ? <DiaADia mes={mes} hoje={hoje} /> : <Historico mes={mes} hoje={hoje} />}
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
      setParams({ aba: 'contas' }, { replace: true });
    }
  }, [pedido, setParams]);
  const total = totalFixos(e, mes);
  const gasto = e.gastosFixos.find((g) => g.id === baixa) ?? null;
  return (
    <>
      <div className="gs-card destaque">
        <span className="gs-rotulo">Falta pagar</span>
        <p className="gs-grande" style={{ margin: '4px 0' }}>{brl0(faltaPagar(e, mes))}</p>
        <span className="gs-mudo">de {brl0(total)} neste mês{fixosPagos(e, mes) > 0 ? ` · já pagou ${brl0(fixosPagos(e, mes))}` : ''}</span>
      </div>
      {contas.length === 0 ? (
        <Vazio titulo="Nenhuma conta fixa ainda" texto="Cadastre aluguel, luz, internet… Eu te aviso antes de cada uma vencer." acao="Cadastrar conta" onAcao={() => setEditando('novo')} avatar="contas" />
      ) : (
        <div className="gs-card">
          {contas.map((c) => {
            const [rotulo, tom] = ROTULO_ESTADO[c.estado];
            return (
              <div className="gs-conta" key={c.gasto.id}>
                <div className="gs-conta-topo">
                  {c.estado === 'paga' ? <span className="gs-check" aria-hidden="true"><Check size={16} /></span> : <span className="gs-bolinha" aria-hidden="true" />}
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
                </div>
                <div className="gs-conta-acoes">
                  {c.estado === 'paga' ? (
                    <button type="button" className="gs-btn link" onClick={() => { const id = c.gasto.id; desfazerBaixa(id, mes); toast('Pagamento desfeito'); }}>Desfazer pagamento</button>
                  ) : (
                    <button type="button" className={`gs-btn pequeno ${c.estado === 'atrasada' || c.estado === 'vence-logo' ? '' : 'sec'}`} disabled={futuro} title={futuro ? 'Só dá pra dar baixa no mês atual ou em meses passados' : undefined} onClick={() => setBaixa(c.gasto.id)}><Check size={16} /> Dar baixa</button>
                  )}
                  <button type="button" className="gs-btn link" onClick={() => setEditando(c.gasto)}>Editar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {contas.length > 0 && <button type="button" className="gs-btn sec cheio" onClick={() => setEditando('novo')}>+ Nova conta fixa</button>}
      {contas.length > 0 && !futuro && (
        <p className="gs-mudo" style={{ textAlign: 'center', margin: '10px 0 0', fontSize: 14 }}>
          Ficou parcela de mês passado sem pagar? <Link to="/plano/atrasos?anotar=1" className="gs-btn link">Anotar atraso</Link>
        </p>
      )}
      <BaixaSheet gasto={gasto} mes={mes} onFechar={() => setBaixa(null)} />
      <FormConta valor={editando} onFechar={() => setEditando(null)} onExcluir={(g) => { setEditando(null); setApagar(g); }} />
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

function FormConta({ valor, onFechar, onExcluir }: { valor: GastoFixo | 'novo' | null; onFechar: () => void; onExcluir: (g: GastoFixo) => void }) {
  const edit = valor && valor !== 'novo' ? valor : null;
  const [nome, setNome] = useState('');
  const [v, setV] = useState(0);
  const [dia, setDia] = useState<number | ''>('');
  const [cat, setCat] = useState<string>('Outros');
  const [tentou, setTentou] = useState(false);
  const nomeAuto = useRef('');
  useEffect(() => {
    if (!valor) return;
    nomeAuto.current = '';
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
          <button key={c} type="button" className={`gs-chip ${cat === c ? 'on' : ''}`} onClick={() => { setCat(c); /* trocar de tipo troca o nome sugerido, mas nunca um nome que a pessoa digitou */ if (!nome.trim() || nome === nomeAuto.current) { const novo = c === 'Outros' ? '' : c; setNome(novo); nomeAuto.current = novo; } }}>{c}</button>
        ))}
      </div>
      {(cat === 'Financiamento' || cat === 'Carro') && !edit && (
        <p className="gs-banner" role="note">Tem número de parcelas (casa, carro, loja)? Cadastre como <b>dívida parcelada</b>: assim eu mostro quantas faltam e quando acaba. <Link to={`/plano/dividas?nova=${cat === 'Carro' ? 'Parcela do carro ou moto' : 'Financiamento da casa'}`} className="gs-btn link">Cadastrar parcela</Link></p>
      )}
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
      {edit && <button type="button" className="gs-btn link" onClick={() => onExcluir(edit)}>Excluir esta conta</button>}
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
        <details style={{ marginBottom: 8 }}>
          <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>{data === hoje ? 'Foi em outro dia?' : `Data: ${data.split('-').reverse().join('/')}`}</summary>
          <Campo rotulo="Data" valor={data} onChange={setData} tipo="date" />
        </details>
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
        <div className="gs-card">
          {grupos.map(([dia, itens]) => (
            <div key={dia}>
              <p className="gs-rotulo" style={{ margin: '10px 0 2px' }}>{diaRelativo(dia, hoje)} · {brl(itens.reduce((t, l) => t + l.valor, 0))}</p>
              {itens.map((l) => (
                <button type="button" className="gs-linha" key={l.id} onClick={() => setEditando(l)} style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }} aria-label={`Editar ${l.descricao}`}>
                  <div className="gs-corpo"><b>{l.descricao}</b><small>{l.categoria}</small></div>
                  <span className="gs-valor">{brl(l.valor)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
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
      {valor && <button type="button" className="gs-btn link" onClick={() => { removerLancamento(valor.id); apagarComDesfazer(`${valor.descricao} apagado`, () => restaurarLancamento(valor)); onFechar(); }}>Excluir este gasto</button>}
    </Folha>
  );
}
