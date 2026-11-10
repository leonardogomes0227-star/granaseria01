import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightLeft, ChartColumn, ChevronRight, Eye, EyeOff, Info, Minus, Plus, Sparkles, Target } from 'lucide-react';
import { getName } from '../painel';
import { useEstado } from './store';
import { brl, brl0, mesDe, nomeMes } from './datas';
import { detalheDisponivel, fixosPagos, receitasRecebidas, totalVariaveis } from './selectores';
import { missaoDoDia, recomendacoes, situacaoFinanceira, type Recomendacao } from './coachRegras';
import { gastosPorCategoria } from './evolucaoLogica';
import { prioridades } from './prioridades';
import { informarSaldo } from './acoes';
import { CampoDinheiro, Folha, Titulo } from './ui';
import { FormRenda } from './Onboarding';
import { useHoje } from './useHoje';
import { ComoCalculei } from './ComoCalculei';
import { NovaMeta } from './Metas';
import { Checklist } from './Checklist';
import { BaixaSheet } from './BaixaSheet';
import { GraficoPeriodo } from './GraficoPeriodo';
import { abrirAdicionar } from './AdicionarMov';
import { corDe, iconeDe } from './categorias';
import { definirOculto, mascarar, useOculto } from './privacidade';
import { toast } from '../components/ui/Toast';

/* ---------- Início: o centro de controle. Em poucos segundos: quanto posso gastar, como está o mês, o que resolver. ---------- */

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};
const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
const COR = { vermelho: 'var(--danger)', amarelo: '#C98A00', verde: 'var(--success)' } as const;
const NOME = { vermelho: 'atrasado', amarelo: 'atenção', verde: 'em ordem' } as const;

export function Inicio() {
  const e = useEstado();
  const hoje = useHoje();
  const nav = useNavigate();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const [renda, setRenda] = useState(false);
  const [saldo, setSaldo] = useState(false);
  const [calc, setCalc] = useState(false);
  const [meta, setMeta] = useState(false);
  const [baixa, setBaixa] = useState<string | null>(null);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const sit = useMemo(() => situacaoFinanceira(e, hoje), [e, hoje]);
  const recs = useMemo(() => recomendacoes(e, hoje), [e, hoje]);
  const missao = useMemo(() => missaoDoDia(e, hoje), [e, hoje]);
  const cats = useMemo(() => gastosPorCategoria(e, mes).slice(0, 5), [e, mes]);
  const proximas = useMemo(() => prioridades(e, hoje).filter((p) => p.semaforo !== 'verde').slice(0, 4), [e, hoje]);
  const m = (t: string) => mascarar(t, oculto);

  const registradas = receitasRecebidas(e, mes);
  const receitas = registradas > 0 ? registradas : e.config.renda;
  const receitaEstimada = registradas === 0 && e.config.renda > 0;
  const extras = e.receitas.filter((r) => mesDe(r.data) === mes && r.tipo === 'extra').reduce((t, r) => t + r.valor, 0);
  const despesas = totalVariaveis(e, mes) + fixosPagos(e, mes);
  const economia = receitas - despesas;
  const semDados = sit === 'sem-dados';
  const totalCats = cats.reduce((t, c) => t + c.valor, 0);
  const insights = recs.filter((r) => r.id !== 'comecar').slice(0, 3);
  const mostrarMissao = missao.acao && !insights.some((r) => r.titulo === missao.texto || r.acao?.rota === missao.acao?.rota) && missao.id !== 'ok';

  return (
    <>
      <div className="gs-cab">
        <Titulo titulo={`${saudacao()}${nome ? `, ${nome}` : ''}!`} sub={semDados ? 'Vamos começar? Em poucos passos eu te mostro como está seu mês.' : undefined} />
        <button type="button" className="gs-icone-btn" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'} title={oculto ? 'Mostrar valores' : 'Ocultar valores'}>
          {oculto ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>

      {/* quanto posso gastar hoje */}
      {disp.modo === 'incompleto' ? (
        <section className="gs-cofre" aria-label="Quanto você pode gastar hoje">
          <span>Pode gastar hoje</span>
          <b style={{ fontSize: 26, lineHeight: 1.2 }}>Ainda não sei</b>
          <p>{disp.avisos[0]}</p>
          <div className="gs-acoes" style={{ marginTop: 14 }}>
            <button type="button" className="gs-btn" onClick={() => setRenda(true)}>Informar minha renda</button>
            <button type="button" className="gs-btn sec" onClick={() => setSaldo(true)}>Informar meu saldo</button>
          </div>
        </section>
      ) : (
        <button type="button" className="gs-cofre gs-cofre-btn" onClick={() => setCalc(true)} aria-label="Quanto você pode gastar hoje. Toque para ver como foi calculado.">
          <span>Pode gastar hoje · {disp.temEstimativa ? 'estimado' : 'confirmado'}</span>
          <b>{m(brl(disp.porDia))}</b>
          <p>{disp.livre < 0 ? `Seus compromissos passam ${m(brl0(-disp.livre))} do que você tem neste mês.` : `${m(brl0(disp.livre))} livres no mês · ${disp.diasRestantes} ${disp.diasRestantes === 1 ? 'dia' : 'dias'} até o fim`}</p>
          <p className="gs-cofre-como">Como calculei <ChevronRight size={14} aria-hidden="true" /></p>
        </button>
      )}

      {semDados ? (
        <Checklist onRenda={() => setRenda(true)} />
      ) : (
        <>
          {/* 4 indicadores */}
          <section className="gs-kpis" aria-label={`Resumo de ${nomeMes(mes)}`}>
            <Kpi rotulo="Saldo disponível" valor={disp.modo === 'incompleto' ? '—' : m(brl0(disp.livre))} nota="livre depois dos compromissos" dica="O que sobra no mês depois de contas, parcelas, fatura e reserva. Não é o saldo do banco." tom={disp.livre < 0 ? 'erro' : undefined} acao={e.config.saldoInformado ? undefined : { rotulo: 'Informar saldo', onClick: () => setSaldo(true) }} />
            <Kpi rotulo="Receitas do mês" valor={m(brl0(receitas))} nota={receitaEstimada ? 'estimada (renda informada)' : extras > 0 ? `inclui ${m(brl0(extras))} de renda extra` : 'recebidas'} dica="Receitas que você registrou. Sem registro, uso a renda informada, marcada como estimada." />
            <Kpi rotulo="Despesas do mês" valor={m(brl0(despesas))} nota="dia a dia + contas pagas" dica="Gastos anotados mais contas fixas já pagas neste mês." />
            <Kpi rotulo="Economia do mês" valor={m(brl0(economia))} nota={receitas > 0 ? `${Math.round((economia / receitas) * 100)}% da receita${receitaEstimada ? ' (estimada)' : ''}` : 'sem receita'} dica="Receitas menos despesas do mês." tom={economia < 0 ? 'erro' : economia > 0 ? 'ok' : undefined} />
          </section>

          {/* ações rápidas */}
          <nav className="gs-rapidas" aria-label="Ações rápidas">
            <button type="button" onClick={() => abrirAdicionar({ tipo: 'despesa' })}><Minus size={20} aria-hidden="true" /><span>Despesa</span></button>
            <button type="button" onClick={() => abrirAdicionar({ tipo: 'receita' })}><Plus size={20} aria-hidden="true" /><span>Receita</span></button>
            <button type="button" onClick={() => abrirAdicionar({ tipo: 'transferencia' })}><ArrowRightLeft size={20} aria-hidden="true" /><span>Transferir</span></button>
            <button type="button" onClick={() => setMeta(true)}><Target size={20} aria-hidden="true" /><span>Meta</span></button>
            <button type="button" onClick={() => nav('/relatorios')}><ChartColumn size={20} aria-hidden="true" /><span>Relatórios</span></button>
          </nav>

          <div className="gs-grade2">
            <div>
              <h2 className="gs-h2">Evolução financeira</h2>
              <GraficoPeriodo hoje={hoje} compacto />
              <Link to="/relatorios" className="gs-btn link">Ver relatórios completos</Link>
            </div>
            <div>
              <h2 className="gs-h2">Contas próximas</h2>
              {proximas.length === 0 ? (
                <div className="gs-card"><p className="gs-mudo" style={{ margin: 0 }}>{e.gastosFixos.length === 0 && !e.cartao && e.dividas.length === 0 ? 'Cadastre suas contas fixas e eu aviso antes de cada vencimento.' : 'Nada vencendo ou atrasado agora. Tudo em ordem.'}</p>{e.gastosFixos.length === 0 && <Link to="/lancamentos?aba=contas" className="gs-btn link">Cadastrar contas</Link>}<Link to="/plano/atrasos?anotar=1" className="gs-btn link">Anotar conta atrasada</Link></div>
              ) : (
                <div className="gs-card">
                  {proximas.map((p) => (
                    <div className="gs-linha" key={p.chave}>
                      <span className="gs-semaforo" style={{ background: COR[p.semaforo] }} role="img" aria-label={NOME[p.semaforo]} />
                      <div className="gs-corpo"><b>{p.titulo}</b><small>{p.detalhe}</small></div>
                      <span className="gs-valor">{m(brl(p.valor))}</span>
                      {p.chave.startsWith('c-') ? <button type="button" className="gs-btn sec pequeno" onClick={() => setBaixa(p.chave.slice(2))}>Pagar</button> : <Link to={p.rota} className="gs-btn sec pequeno">Abrir</Link>}
                    </div>
                  ))}
                  <Link to="/plano" className="gs-btn link">Ver todos os compromissos</Link>
                  <Link to="/plano/atrasos?anotar=1" className="gs-btn link">Anotar conta atrasada</Link>
                </div>
              )}
            </div>
          </div>

          <div className="gs-grade2">
            <div>
              <h2 className="gs-h2">Para onde vai o dinheiro</h2>
              {cats.length === 0 ? (
                <div className="gs-card"><p className="gs-mudo" style={{ margin: 0 }}>Anote seus gastos e eu mostro aqui as categorias que mais pesam.</p><button type="button" className="gs-btn link" onClick={() => abrirAdicionar()}>Adicionar gasto</button></div>
              ) : (
                <div className="gs-card">
                  {cats.map((c) => { const I = iconeDe(c.categoria); return (
                    <div key={c.categoria} className="gs-cat-linha">
                      <span className="gs-ic-cat" aria-hidden="true"><I size={18} /></span>
                      <div className="gs-corpo">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{c.categoria}</b><span className="gs-tab">{m(brl0(c.valor))} · {totalCats > 0 ? Math.round((c.valor / totalCats) * 100) : 0}%</span></div>
                        <div className="gs-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, c.pct)}%`, background: corDe(c.categoria) }} /></div>
                      </div>
                    </div>
                  ); })}
                </div>
              )}
            </div>
            <div>
              <h2 className="gs-h2">Insights do coach</h2>
              {insights.length === 0 ? <div className="gs-card"><p className="gs-mudo" style={{ margin: 0 }}>Quando houver dados suficientes, as recomendações aparecem aqui.</p></div> : insights.map((r) => <Insight key={r.id} r={r} />)}
              {mostrarMissao && missao.acao && (
                <div className="gs-card gs-missao"><span className="gs-rotulo">Missão de hoje</span><b>{missao.titulo}</b><p className="gs-mudo" style={{ margin: '2px 0 8px' }}>{missao.texto}</p>{missao.acao.rota ? <Link className="gs-btn sec pequeno" to={missao.acao.rota}>{missao.acao.rotulo}</Link> : <button type="button" className="gs-btn sec pequeno" onClick={() => abrirAdicionar()}>{missao.acao.rotulo}</button>}</div>
              )}
              <Link to="/coach" className="gs-btn link"><Sparkles size={14} aria-hidden="true" /> Falar com o coach</Link>
            </div>
          </div>
          <Checklist onRenda={() => setRenda(true)} />
        </>
      )}

      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <NovaMeta aberta={meta} onFechar={() => setMeta(false)} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês">
        <FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} />
      </Folha>
      <SaldoSheet key={String(saldo)} aberta={saldo} onFechar={() => setSaldo(false)} atual={e.config.saldoInformado?.valor} />
    </>
  );
}

function Kpi({ rotulo, valor, nota, dica, tom, acao }: { rotulo: string; valor: string; nota: string; dica: string; tom?: 'ok' | 'erro'; acao?: { rotulo: string; onClick: () => void } }) {
  return (
    <div className={`gs-kpi ${tom ?? ''}`}>
      <span className="gs-rotulo">{rotulo} <span className="gs-dica-info" role="img" aria-label={dica} title={dica}><Info size={12} aria-hidden="true" /></span></span>
      <b className="gs-tab">{valor}</b>
      <small>{nota}</small>
      {acao && <button type="button" className="gs-btn link" onClick={acao.onClick}>{acao.rotulo}</button>}
    </div>
  );
}

function Insight({ r }: { r: Recomendacao }) {
  const [porque, setPorque] = useState(false);
  return (
    <section className={`gs-card gs-coach ${r.tom}`}>
      <b>{r.titulo}</b>
      <p>{r.texto}</p>
      <div className="gs-acoes">
        {r.acao && (r.acao.rota ? <Link className="gs-btn sec pequeno" to={r.acao.rota}>{r.acao.rotulo}</Link> : <button type="button" className="gs-btn sec pequeno" onClick={() => abrirAdicionar()}>{r.acao.rotulo}</button>)}
        <button type="button" className="gs-btn link" aria-expanded={porque} onClick={() => setPorque(!porque)}>Por quê?</button>
      </div>
      {porque && <p className="gs-nota">{r.porque}</p>}
    </section>
  );
}

function SaldoSheet({ aberta, onFechar, atual }: { aberta: boolean; onFechar: () => void; atual?: number }) {
  const [v, setV] = useState(atual ?? 0);
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Quanto você tem na conta hoje?">
      <form onSubmit={(ev) => { ev.preventDefault(); informarSaldo(v); toast(`Saldo atualizado: ${brl(v)}`); onFechar(); }}>
        <CampoDinheiro rotulo="Saldo atual (soma das contas que você usa)" valor={v} onChange={setV} grande autoFocus />
        <p className="gs-nota">É o número que você vê no app do banco. Daqui para frente eu somo o que você registrar. Seu salário só entra depois de registrado.</p>
        <div className="gs-acoes">
          <button type="submit" className="gs-btn cheio">Salvar saldo</button>
          {atual !== undefined && <button type="button" className="gs-btn link" onClick={() => { informarSaldo(undefined); toast('Saldo removido: volto a usar a renda'); onFechar(); }}>Usar só a renda</button>}
        </div>
      </form>
    </Folha>
  );
}
