import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { getName } from '../painel';
import { useEstado } from './store';
import { brl, brl0, mesDe, nomeMes } from './datas';
import { detalheDisponivel, fixosPagos, receitasRecebidas, totalVariaveis } from './selectores';
import { recomendacoes, situacaoFinanceira, type Recomendacao } from './coachRegras';
import { gastosPorCategoria } from './evolucaoLogica';
import { prioridades } from './prioridades';
import { informarSaldo } from './acoes';
import { CampoDinheiro, Folha, Titulo } from './ui';
import { FormRenda } from './Onboarding';
import { useHoje } from './useHoje';
import { ComoCalculei } from './ComoCalculei';
import { Checklist } from './Checklist';
import { abrirAdicionar } from './AdicionarMov';
import { BaixaSheet } from './BaixaSheet';
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
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const [renda, setRenda] = useState(false);
  const [saldo, setSaldo] = useState(false);
  const [calc, setCalc] = useState(false);
  const [baixa, setBaixa] = useState<string | null>(null);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const sit = useMemo(() => situacaoFinanceira(e, hoje), [e, hoje]);
  const recs = useMemo(() => recomendacoes(e, hoje), [e, hoje]);
  const cats = useMemo(() => gastosPorCategoria(e, mes).slice(0, 3), [e, mes]);
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
  const insights = recs.filter((r) => r.id !== 'comecar');

  return (
    <>
      <div className="gs-cab">
        <Titulo titulo={`${saudacao()}${nome ? `, ${nome}` : ''}!`} sub={semDados ? 'Vamos começar pela sua renda.' : undefined} />
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
          <section className="gs-kpis" aria-label={`Resumo de ${nomeMes(mes)}`}>
            <Kpi rotulo="Receitas" valor={m(brl0(receitas))} nota={receitaEstimada ? 'estimada' : extras > 0 ? `inclui ${m(brl0(extras))} extra` : 'recebidas'} dica="Receitas registradas. Sem registro, uso a renda informada (estimada)." />
            <Kpi rotulo="Despesas" valor={m(brl0(despesas))} nota="gastos e contas pagas" dica="Gastos anotados mais contas fixas já pagas neste mês." />
            <Kpi rotulo="Economia" valor={m(brl0(economia))} nota={receitas > 0 ? `${Math.round((economia / receitas) * 100)}% da receita` : 'sem receita'} dica="Receitas menos despesas do mês." tom={economia < 0 ? 'erro' : economia > 0 ? 'ok' : undefined} />
          </section>

          {insights[0] && <Insight r={insights[0]} />}

          <h2 className="gs-h2">Contas próximas</h2>
          {proximas.length === 0 ? (
            <p className="gs-mudo">{e.gastosFixos.length === 0 && !e.cartao && e.dividas.length === 0 ? <>Cadastre suas contas fixas. <Link to="/lancamentos?aba=contas">Cadastrar</Link></> : 'Nada vencendo ou atrasado.'}</p>
          ) : (
            <div className="gs-card">
              {proximas.map((p) => (
                <div className="gs-linha" key={p.chave}>
                  <span className="gs-semaforo" style={{ background: COR[p.semaforo] }} role="img" aria-label={NOME[p.semaforo]} />
                  <div className="gs-corpo"><b>{p.titulo}</b><small>{p.detalhe} · {m(brl(p.valor))}</small></div>
                  {p.chave.startsWith('c-') ? <button type="button" className="gs-btn sec pequeno" onClick={() => setBaixa(p.chave.slice(2))}>Pagar</button> : <Link to={p.rota} className="gs-btn sec pequeno">Abrir</Link>}
                </div>
              ))}
            </div>
          )}

          {cats.length > 0 && (
            <>
              <h2 className="gs-h2">Maiores gastos</h2>
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
              <Link to="/relatorios" className="gs-btn link">Ver relatórios</Link>
            </>
          )}
          <Checklist onRenda={() => setRenda(true)} />
        </>
      )}

      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês">
        <FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} />
      </Folha>
      <SaldoSheet key={String(saldo)} aberta={saldo} onFechar={() => setSaldo(false)} atual={e.config.saldoInformado?.valor} />
    </>
  );
}

function Kpi({ rotulo, valor, nota, dica, tom }: { rotulo: string; valor: string; nota: string; dica: string; tom?: 'ok' | 'erro' }) {
  return (
    <div className={`gs-kpi ${tom ?? ''}`} title={dica}>
      <span className="gs-rotulo">{rotulo}</span>
      <b className="gs-tab">{valor}</b>
      <small>{nota}</small>
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
