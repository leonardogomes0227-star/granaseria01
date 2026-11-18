import { useEffect, useMemo, useRef, useState } from 'react';
import { RespostaFerramenta } from './RespostaFerramenta';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesDe, nomeMes, somaMes } from './datas';
import { contasDoMes, faltaPagar, fixosPagos, totalFixos, type ContaDoMes } from './selectores';
import { CATEGORIAS_FIXAS, type GastoFixo } from './tipos';
import { desfazerBaixa, removerGastoFixo, restaurarGastoFixo, salvarGastoFixo } from './acoes';
import { BaixaSheet } from './BaixaSheet';
import { Historico } from './Historico';
import { Campo, CampoDinheiro, CampoNumero, Confirmar, Folha, Titulo, Vazio } from './ui';
import { NumeroVidro } from './vidroComum';
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
  // "dia" era a aba antiga de gastos: hoje o histórico e o botão "+" cobrem tudo isso
  const aba = pedida === 'contas' ? 'contas' : pedida === 'historico' || pedida === 'dia' ? 'historico' : padrao;
  const hoje = useHoje();
  const [mes, setMes] = useState(mesDe(hoje));
  return (
    <>
      <Titulo titulo={padrao === 'historico' ? 'Lançamentos' : 'Contas fixas'} />
      <RespostaFerramenta id={aba === 'contas' ? 'contas' : 'lancamentos'} />
      <div className="gs-seg" role="tablist" aria-label="Lançamentos">
        <button type="button" role="tab" aria-selected={aba === 'historico'} className={aba === 'historico' ? 'on' : ''} onClick={() => setParams({ aba: 'historico' })}>Histórico</button>
        <button type="button" role="tab" aria-selected={aba === 'contas'} className={aba === 'contas' ? 'on' : ''} onClick={() => setParams({ aba: 'contas' })}>Contas fixas</button>
      </div>
      <SeletorMes mes={mes} onMudar={setMes} maximo={mesDe(hoje)} />
      {aba === 'contas' ? <ContasFixas mes={mes} hoje={hoje} /> : <Historico mes={mes} hoje={hoje} />}
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
        <p className="gs-grande" style={{ margin: '4px 0' }}><NumeroVidro valor={faltaPagar(e, mes)} formato={brl0} /></p>
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

export function FormConta({ valor, onFechar, onExcluir }: { valor: GastoFixo | 'novo' | null; onFechar: () => void; onExcluir: (g: GastoFixo) => void }) {
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
      {!edit && <p className="gs-sub" style={{ marginTop: 0 }}>Cadastre suas contas para eu te mostrar o que pagar primeiro e te avisar antes de vencer. Comece pela maior.</p>}
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
