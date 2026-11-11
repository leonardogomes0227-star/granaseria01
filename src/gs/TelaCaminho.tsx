import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff, Sparkles, X } from 'lucide-react';
import { getName } from '../painel';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, mesDe, nomeMes } from './datas';
import { detalheDisponivel } from './selectores';
import { situacaoFinanceira } from './coachRegras';
import { calcularCaminho, destino, fraseDoMarco, marcosAComemorar, marcosVisiveis, type Marco as TMarco } from './caminho';
import { passoAtual, passosDoMes, resumoDosPassos } from './passos';
import { passosDoPlano, resumoDoPlano } from './planoPessoal';
import { resumoDaVolta, semanaNoCaminho } from './voltou';
import { comemorarMarcos, dispensarVolta, recomecarPassos, registrarVisita, informarSaldo } from './acoes';
import { CampoDinheiro, Folha } from './ui';
import { FormRenda } from './Onboarding';
import { ComoCalculei } from './ComoCalculei';
import { Checklist } from './Checklist';
import { CaixaResolver } from './Resolver';
import { AtalhosDasAreas } from './Areas';
import { ListaDePassos, useExecutarPasso } from './PassosUI';
import { CartaoDestino, Citacao, citacaoDoDia, Eyebrow, LinhaDoTempo, Marco, Moeda, useContagem } from './base';
import { definirOculto, mascarar, useOculto } from './privacidade';
import { imagemQuitou } from './imagemQuitou';
import { toast } from '../components/ui/Toast';

/* ---------- Seu caminho: onde você está, onde quer chegar, em quanto tempo, e o próximo passo. ---------- */

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};
const qtdMeses = (n: number) => (n <= 0 ? 'neste mês' : n === 1 ? '1 mês' : n < 24 ? `${n} meses` : `${Math.round(n / 12)} anos`);

export function TelaCaminho() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const [params, setParams] = useSearchParams();
  const [calc, setCalc] = useState(false);
  const [todo, setTodo] = useState(false);
  const [premissas, setPremissas] = useState(false);
  const [renda, setRenda] = useState(false);
  const [saldo, setSaldo] = useState(false);
  const [verOcultos, setVerOcultos] = useState(false);
  const [brilhar, setBrilhar] = useState<string | null>(null);
  const m = (t: string) => mascarar(t, oculto);

  const marcos = useMemo(() => calcularCaminho(e, hoje), [e, hoje]);
  const alvo = destino(marcos);
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const todosPassos = useMemo(() => passosDoMes(e, hoje, { comOcultos: verOcultos }), [e, hoje, verOcultos]);
  const [verResto, setVerResto] = useState(false);
  const recorte = useMemo(() => passosDoPlano(todosPassos, e, hoje), [todosPassos, e, hoje]);
  const passos = verResto ? todosPassos : recorte.visiveis;
  const atual = passoAtual(passos);
  const resumo = resumoDosPassos(passos);
  const sit = useMemo(() => situacaoFinanceira(e, hoje), [e, hoje]);
  const semana = useMemo(() => semanaNoCaminho(e, hoje), [e, hoje]);
  const volta = useMemo(() => (e.caminho.voltaDispensada ? null : resumoDaVolta(e, new Date())), [e]);
  const festa = useMemo(() => marcosAComemorar(e, marcos), [e, marcos]);
  const { executar, folhas } = useExecutarPasso(hoje);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const porDia = useContagem(disp.porDia);
  const temOcultos = Object.values(e.caminho.ocultos).some((v) => v === mes);

  // "?calculo=1" (vindo da busca) abre o "Como calculei"
  useEffect(() => {
    if (params.get('calculo') && disp.modo !== 'incompleto') { setCalc(true); setParams({}, { replace: true }); }
  }, [params, setParams, disp.modo]);

  // guarda a visita e o passo em que a pessoa está; se o "bem-vindo de volta" está na tela, espera ela fechar
  useEffect(() => {
    if (volta || !e.config.onboardingFeito) return;
    const ultima = e.caminho.ultimaVisita ? Date.parse(e.caminho.ultimaVisita) : 0;
    if (Date.now() - ultima > 10 * 60_000 || (atual && e.caminho.ultimoPasso !== atual.id)) registrarVisita(atual?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir a tela e quando o passo atual muda
  }, [atual?.id, Boolean(volta)]);

  const continuar = () => {
    const id = atual?.id ?? e.caminho.ultimoPasso;
    dispensarVolta();
    if (!id) return;
    window.setTimeout(() => {
      document.getElementById(`passo-${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      setBrilhar(id);
      window.setTimeout(() => setBrilhar(null), 1200);
    }, 60);
  };
  const parou = passos.find((p) => p.id === e.caminho.ultimoPasso && p.status !== 'feito') ?? atual;

  const frase = alvo ? fraseDoMarco(alvo) : null;
  const blocoDestino = alvo && frase ? (
    <CartaoDestino
      rotulo={`Seu destino agora · marco ${alvo.n} de ${marcosVisiveis(marcos).length}`}
      antes={frase.antes}
      data={frase.data}
      texto={alvo.dataPrevista ? undefined : alvo.pendencia}
      progresso={alvo.dataPrevista ? alvo.progresso : undefined}
      pe={
        <>
          <span>{alvo.dataPrevista ? `${alvo.faltaValor > 0 ? `faltam ${m(brl0(alvo.faltaValor))} · ` : ''}${qtdMeses(alvo.faltaMeses ?? 0)}` : 'sem data ainda'}</span>
          <button type="button" className="cm-link" onClick={() => setTodo(true)}>Ver o caminho todo <ChevronRight size={16} aria-hidden="true" /></button>
        </>
      }
    >
      {alvo.dataPrevista ? (
        <>
          <button type="button" className="cm-link" style={{ position: 'relative', zIndex: 1 }} aria-expanded={premissas} onClick={() => setPremissas(!premissas)}>Como cheguei nessa data</button>
          {premissas && <div className="cm-premissas">Essa data vale:<ul>{alvo.premissas.map((p) => <li key={p}>{p}</li>)}</ul>Se algo mudar, eu recalculo sem drama.</div>}
        </>
      ) : (
        <div className="gs-acoes" style={{ position: 'relative', zIndex: 1, marginTop: 12 }}>
          {disp.modo === 'incompleto' ? <button type="button" className="gs-btn" onClick={() => setRenda(true)}>Informar minha renda</button> : <Link to={alvo.ferramentaRota} className="gs-btn">Resolver isso agora</Link>}
        </div>
      )}
    </CartaoDestino>
  ) : (
    <CartaoDestino rotulo="Seu caminho" antes="Você chegou ao fim do caminho." texto="Todos os marcos estão prontos. Agora é manter, e escolher um novo objetivo quando quiser." pe={<button type="button" className="cm-link" onClick={() => setTodo(true)}>Ver o caminho todo <ChevronRight size={16} aria-hidden="true" /></button>} />
  );

  const blocoGastar = disp.modo === 'incompleto' ? null : (
    <button type="button" className="cm-card cm-gastar" onClick={() => setCalc(true)} aria-label="Quanto você pode gastar hoje. Toque para ver como foi calculado.">
      <Eyebrow>Hoje você pode gastar</Eyebrow>
      <span className="cm-num cm-ouro-folha">{oculto ? 'R$ ••••' : brl(porDia)}</span>
      <p>{disp.livre < 0 ? `Seus compromissos passam ${m(brl0(-disp.livre))} do que entra neste mês.` : `${m(brl0(disp.livre))} de sobra prevista até o fim de ${nomeMes(mes).split(' ')[0]} · ${disp.temEstimativa ? 'estimado' : 'confirmado'}`}</p>
      <span className="cm-link">Como calculei <ChevronRight size={16} aria-hidden="true" /></span>
    </button>
  );

  const blocoPassos = (
    <>
      <h2 className="cm-h2">{verResto ? 'Todos os passos do mês' : 'Seus próximos passos'}<small>{resumo.total > 0 ? `${resumo.feitos} de ${resumo.total} feitos` : ''}</small></h2>
      {!e.caminho.plano && (
        <Link to="/coach?plano=1" className="cm-acao-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 14 }}>
          <span className="cm-eyebrow">1 minuto com o Coach</span>
          <b style={{ marginTop: 4 }}>Monte o seu plano</b>
          <small>3 perguntas e eu deixo na sua tela só o que você vai usar. Agora estou mostrando o que os seus números pedem.</small>
        </Link>
      )}
      {e.caminho.plano && !verResto && <p className="cm-mudo" style={{ margin: '-4px 0 12px' }}>{resumoDoPlano(e.caminho.plano)}</p>}
      {passos.length === 0 ? <p className="cm-mudo">Nada pendente no seu plano agora. Bom sinal.</p> : <ListaDePassos passos={passos} executar={executar} brilhar={brilhar} hoje={hoje} />}
      {recorte.outros > 0 && <button type="button" className="cm-link" onClick={() => setVerResto(!verResto)}>{verResto ? 'Ver só o meu plano' : `Ver o resto do mês (${recorte.outros} ${recorte.outros === 1 ? 'passo' : 'passos'})`}</button>}
      {(temOcultos || verOcultos) && (
        <div className="gs-acoes">
          <button type="button" className="cm-link" onClick={() => setVerOcultos(!verOcultos)}>{verOcultos ? 'Esconder os que eu tirei' : 'Ver os passos que escondi'}</button>
          <button type="button" className="cm-link" onClick={() => { recomecarPassos(); setVerOcultos(false); toast('Plano do mês recomeçado.'); }}>Recomeçar o plano</button>
        </div>
      )}
    </>
  );

  // estados adaptativos: sem dados, a configuração vem primeiro; com dívida ou atraso, os passos sobem; em ordem, o dia a dia sobe
  const ordem = sit === 'sem-dados' ? ['destino', 'checklist', 'busca', 'passos'] : sit === 'endividado' || sit === 'atencao' ? ['destino', 'passos', 'gastar', 'busca', 'checklist'] : ['destino', 'gastar', 'busca', 'passos', 'checklist'];
  const blocos: Record<string, React.ReactNode> = { destino: blocoDestino, gastar: blocoGastar, busca: <CaixaResolver />, passos: blocoPassos, checklist: <Checklist onRenda={() => setRenda(true)} /> };

  return (
    <>
      <div className="gs-cab">
        <div><h1 className="gs-titulo">Seu caminho</h1><p className="gs-sub" style={{ margin: 0 }}>{nome ? `${nome}, um passo de cada vez.` : 'Um passo de cada vez.'}</p></div>
        <button type="button" className="gs-icone-btn" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
      </div>

      {volta && (
        <section className="cm-volta" aria-label="Bem-vindo de volta">
          <button type="button" className="cm-fechar" aria-label="Fechar" onClick={() => dispensarVolta()}><X size={20} aria-hidden="true" /></button>
          <Eyebrow>Bem-vindo de volta</Eyebrow>
          <p>Desde {volta.desde}: {volta.mudancas.join(' · ')}.</p>
          {parou && <p>Você parou em: <b>{parou.titulo}</b></p>}
          <button type="button" className="gs-btn" onClick={continuar}>Continuar de onde parei</button>
        </section>
      )}

      {ordem.map((id) => <div key={id}>{blocos[id]}</div>)}

      {semana && (
        <section className="cm-card suave" aria-label="Sua semana no caminho">
          <Eyebrow>Sua semana no caminho</Eyebrow>
          <p style={{ margin: '6px 0 0', fontSize: 15.5, lineHeight: 1.5 }}>{oculto ? 'Valores ocultos.' : semana.frase}</p>
        </section>
      )}

      <AtalhosDasAreas />

      <Link to="/coach" className="cm-card" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit', marginTop: 24 }}>
        <Sparkles size={26} aria-hidden="true" style={{ color: 'var(--cm-ouro)', flex: 'none' }} />
        <span style={{ flex: 1 }}><b style={{ display: 'block', font: '600 22px var(--cm-serif)' }}>Travou em alguma coisa?</b><span className="cm-mudo">O Coach resolve com você, com os seus números.</span></span>
        <ChevronRight size={20} aria-hidden="true" className="cm-mudo" />
      </Link>
      <Citacao texto={citacaoDoDia(hoje)} />

      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <Folha aberta={todo} onFechar={() => setTodo(false)} titulo="O caminho todo"><CaminhoTodo marcos={marcos} oculto={oculto} onIr={() => setTodo(false)} /></Folha>
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês">
        <FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} />
        <button type="button" className="cm-link" onClick={() => { setRenda(false); setSaldo(true); }}>Prefiro informar meu saldo de hoje</button>
      </Folha>
      <SaldoSheet key={String(saldo)} aberta={saldo} onFechar={() => setSaldo(false)} atual={e.config.saldoInformado?.valor} />
      {folhas}
      <FestaMarco marcos={festa} proximo={alvo} />
    </>
  );
}

/** A linha do tempo dos marcos: selo dourado no que já foi, círculo preto no atual. O que não se aplica não aparece. */
export function CaminhoTodo({ marcos, oculto, onIr }: { marcos: TMarco[]; oculto: boolean; onIr?: () => void }) {
  return (
    <LinhaDoTempo rotulo="Os marcos do seu caminho">
      {marcosVisiveis(marcos).map((mc) => {
        const f = fraseDoMarco(mc);
        return (
          <Marco key={mc.id} n={mc.n} estado={mc.status as 'feito' | 'atual' | 'futuro'} titulo={mc.titulo} data={mc.status === 'feito' ? null : f.data ?? null} selo={mc.selo}>
            {mc.status !== 'feito' && (
              <small>
                {mc.dataPrevista ? `${mc.faltaValor > 0 ? `Faltam ${mascarar(brl0(mc.faltaValor), oculto)}. ` : ''}${mc.premissas[0] ? `Vale ${mc.premissas[0]}.` : ''}` : mc.pendencia}
              </small>
            )}
            {mc.status === 'atual' && <div className="gs-acoes"><Link to={mc.ferramentaRota} className="gs-btn pequeno" onClick={onIr}>Abrir</Link></div>}
          </Marco>
        );
      })}
    </LinhaDoTempo>
  );
}

function SaldoSheet({ aberta, onFechar, atual }: { aberta: boolean; onFechar: () => void; atual?: number }) {
  const [v, setV] = useState(atual ?? 0);
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Quanto você tem na conta hoje?">
      <form onSubmit={(ev) => { ev.preventDefault(); informarSaldo(v); toast(`Saldo atualizado: ${brl(v)}`); onFechar(); }}>
        <CampoDinheiro rotulo="Saldo de hoje (some as contas que você usa)" valor={v} onChange={setV} grande autoFocus />
        <p className="gs-nota">É o número que aparece no app do banco. Daqui para frente eu somo o que você anotar.</p>
        <div className="gs-acoes">
          <button type="submit" className="gs-btn cheio">Salvar saldo</button>
          {atual !== undefined && <button type="button" className="gs-btn link" onClick={() => { informarSaldo(undefined); toast('Saldo removido: volto a usar a renda'); onFechar(); }}>Usar só a renda</button>}
        </div>
      </form>
    </Folha>
  );
}

/** Festa de marco: acontece uma vez por marco, com o selo e uma imagem para compartilhar. */
function FestaMarco({ marcos, proximo }: { marcos: TMarco[]; proximo: TMarco | null }) {
  const mc = marcos[marcos.length - 1];
  const fechar = () => comemorarMarcos(marcos.map((x) => x.id));
  useEffect(() => {
    if (!mc || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void import('canvas-confetti').then((c) => c.default({ particleCount: 90, spread: 75, origin: { y: 0.35 }, colors: ['#D9B45E', '#A9822E', '#F3E8CF', '#3C7253'] })).catch(() => undefined);
  }, [mc?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- uma vez por marco
  if (!mc) return null;
  const prox = proximo ? fraseDoMarco(proximo) : null;
  return (
    <Folha aberta onFechar={fechar} titulo="Marco conquistado">
      <div className="cm-festa">
        <Moeda tamanho={104} />
        <h2>{mc.titulo}</h2>
        <p className="cm-mudo" style={{ margin: 0 }}>{mc.selo} conquistado. Isso foi você, um passo de cada vez.</p>
        {proximo && prox && <p style={{ marginTop: 14 }}>Agora acende o próximo: <b>{proximo.titulo}</b>{prox.data ? `, previsto para ${prox.data}` : ''}.</p>}
        <div className="gs-acoes" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button type="button" className="gs-btn" onClick={fechar}>Continuar meu caminho</button>
          <button type="button" className="gs-btn sec" onClick={() => void imagemQuitou({ nome: mc.titulo, valor: mc.selo, faltam: 0, siteUrl: window.location.origin.replace(/^https?:\/\//, '') }).catch(() => toast('Não consegui gerar a imagem.'))}>Compartilhar</button>
        </div>
      </div>
    </Folha>
  );
}
