import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesDe, nomeMes } from './datas';
import { detalheDisponivel, faltaPagar, guardadoNoMes, patrimonioGuardado, reservaMeta, totalVariaveis } from './selectores';
import { prioridades, type Prioridade } from './prioridades';
import { gastosPorCategoria } from './evolucaoLogica';
import { passosDoMes, type OrigemPasso, type Passo } from './passos';
import { calcularCaminho, fraseDoMarco } from './caminho';
import { FERRAMENTAS, GRUPOS, NOME_AREA, gradeDaArea, type Area } from './registroFerramentas';
import { BotaoDoPasso, useExecutarPasso } from './PassosUI';
import { BaixaSheet } from './BaixaSheet';
import { Metas } from './Metas';
import { ComoCalculei } from './ComoCalculei';
import { InstalarApp } from './InstalarApp';
import { abrirAdicionar } from './AdicionarMov';
import { abrirResolver } from './Resolver';
import { Card, Eyebrow, Lista, ListItem, Moeda, ProgressRing, Segmented, ToolGrid, ToolTile } from './base';
import { corDe } from './categorias';
import { definirTema, useTema } from './tema';
import { mascarar, useOculto } from './privacidade';
import { getName } from '../painel';
import { waLink } from '../whatsapp';

/** A grade de ferramentas de uma área: subgrupos com nome de objetivo; o que está em vermelho sobe. */
export function GradeFerramentas({ area }: { area: Area }) {
  const e = useEstado();
  const hoje = useHoje();
  const grade = useMemo(() => gradeDaArea(area, e, hoje), [area, e, hoje]);
  return (
    <>
      {grade.map((g) => (
        <section key={g.grupo} aria-label={g.grupo}>
          <h2 className="cm-h2">{g.grupo}</h2>
          <ToolGrid>
            {g.itens.map((f) => {
              const etapa = f.etapas ? e.caminho.etapas[f.id] : 0;
              return <ToolTile key={f.id} titulo={f.titulo} resolve={f.resolve} status={f.st.texto} tom={f.st.tom} rota={f.rota} continuar={etapa ? `Continuar (passo ${etapa} de ${f.etapas})` : undefined} />;
            })}
          </ToolGrid>
        </section>
      ))}
    </>
  );
}

/** O próximo passo de uma área: o primeiro passo do mês que pertence a ela. */
function proximoDaArea(passos: Passo[], origens: OrigemPasso[]): Passo | null {
  return passos.find((p) => origens.includes(p.origem) && (p.status === 'atual' || p.status === 'pendente')) ?? null;
}

const faixaDe = (p: Prioridade, hoje: string): string => {
  const d = Math.round((Date.parse(`${p.data}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400000);
  return p.detalhe === 'paga' ? 'paga' : d < 0 ? `há ${-d} ${-d === 1 ? 'dia' : 'dias'}` : d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d <= 7 ? `em ${d} dias` : diaCurto(p.data);
};
const TOM = { vermelho: 'perigo', amarelo: 'aviso', verde: '' } as const;

/* ---------- Pagar: tudo que é conta, atraso, dívida e cartão ---------- */
export function AreaPagar() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const [filtro, setFiltro] = useState<'abertas' | 'pagas'>('abertas');
  const [baixa, setBaixa] = useState<string | null>(null);
  const lista = useMemo(() => prioridades(e, hoje), [e, hoje]);
  const passos = useMemo(() => passosDoMes(e, hoje), [e, hoje]);
  const { executar, folhas } = useExecutarPasso(hoje);
  const prox = proximoDaArea(passos, ['atraso', 'conta', 'fatura', 'divida']);
  const abertas = lista.filter((p) => p.detalhe !== 'paga');
  const pagas = lista.filter((p) => p.detalhe === 'paga');
  const falta = abertas.reduce((t, p) => t + p.valor, 0);
  const mostra = filtro === 'abertas' ? abertas : pagas;
  return (
    <>
      <h1 className="gs-titulo">Pagar</h1>
      <section className="cm-topo-area" aria-label="O que falta pagar">
        <Eyebrow>Falta pagar em {nomeMes(mes).split(' ')[0]}</Eyebrow>
        <span className="cm-num">{m(brl(falta))}</span>
        <p>{lista.length === 0 ? 'Cadastre suas contas e eu digo o que pagar primeiro.' : prox ? `${prox.titulo}. ${prox.detalhe}` : falta > 0 ? `Nada vence nos próximos dias. Contas fixas ainda em aberto: ${m(brl0(faltaPagar(e, mes)))}.` : 'Tudo pago por aqui. Pode respirar.'}</p>
        {lista.length === 0 ? <Link to="/lancamentos?aba=contas" className="gs-btn">Cadastrar contas</Link> : prox && <BotaoDoPasso p={prox} executar={executar} principal />}
      </section>

      {lista.length > 0 && (
        <>
          <Segmented rotulo="Quais contas mostrar" valor={filtro} onChange={setFiltro} opcoes={[{ id: 'abertas', nome: `A pagar (${abertas.length})` }, { id: 'pagas', nome: `Pagas (${pagas.length})` }]} />
          {mostra.length === 0 ? <p className="cm-mudo">{filtro === 'abertas' ? 'Nada em aberto este mês.' : 'Nenhuma conta paga ainda neste mês.'}</p> : (
            <Lista rotulo="Contas por urgência">
              {mostra.map((p) => (
                <ListItem key={p.chave} faixa={faixaDe(p, hoje)} tomFaixa={p.detalhe === 'paga' ? 'ok' : TOM[p.semaforo]} titulo={p.titulo} sub={p.semaforo === 'vermelho' && p.chave.startsWith('c-') ? undefined : p.detalhe} valor={m(brl(p.valor))}
                  acao={p.detalhe === 'paga' ? undefined : p.chave.startsWith('c-') ? <button type="button" className="gs-btn sec pequeno" onClick={() => setBaixa(p.chave.slice(2))}>Pagar</button> : <Link to={p.rota} className="gs-btn sec pequeno">Abrir</Link>} />
              ))}
            </Lista>
          )}
          <Link to="/lancamentos?aba=contas" className="cm-link">Editar ou cadastrar contas <ChevronRight size={16} aria-hidden="true" /></Link>
        </>
      )}
      <GradeFerramentas area="pagar" />
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      {folhas}
    </>
  );
}

/* ---------- Gastos: o dia a dia, o controle e a decisão de compra ---------- */
export function AreaGastos() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const [calc, setCalc] = useState(false);
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const cats = useMemo(() => gastosPorCategoria(e, mes), [e, mes]);
  const total = totalVariaveis(e, mes);
  const ultimos = useMemo(() => [...e.lancamentos].filter((l) => mesDe(l.data) === mes).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5), [e.lancamentos, mes]);
  return (
    <>
      <h1 className="gs-titulo">Gastos</h1>
      <section className="cm-topo-area" aria-label="Quanto dá para gastar">
        <Eyebrow>{disp.modo === 'incompleto' ? 'Gasto anotado no mês' : 'Dá para gastar hoje'}</Eyebrow>
        <span className="cm-num">{disp.modo === 'incompleto' ? m(brl(total)) : m(brl(disp.porDia))}</span>
        <p>{disp.modo === 'incompleto' ? 'Informe sua renda no Caminho para eu calcular o limite do dia.' : disp.livre < 0 ? `O mês passou ${m(brl0(-disp.livre))} do que entra. Veja onde cortar primeiro.` : `Você já anotou ${m(brl0(total))} neste mês e sobram ${m(brl0(disp.livre))} para ${disp.diasRestantes} ${disp.diasRestantes === 1 ? 'dia' : 'dias'}.`}</p>
        <div className="gs-acoes">
          {disp.modo !== 'incompleto' && disp.livre < 0 ? <Link to="/plano/cortar" className="gs-btn">Ver onde cortar</Link> : <button type="button" className="gs-btn" onClick={() => abrirAdicionar()}>Anotar gasto</button>}
          {disp.modo !== 'incompleto' && <button type="button" className="gs-btn link" onClick={() => setCalc(true)}>Como calculei</button>}
        </div>
      </section>

      <h2 className="cm-h2">Para onde foi<Link to="/relatorios">Ver relatórios</Link></h2>
      {cats.length === 0 ? <p className="cm-mudo">Nenhum gasto anotado neste mês. Anote o primeiro: leva 5 segundos.</p> : (
        <Card>
          {cats.slice(0, 6).map((c) => (
            <div key={c.categoria} style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700 }}><span>{c.categoria}</span><span className="gs-tab">{m(brl0(c.valor))} · {total > 0 ? Math.round((c.valor / total) * 100) : 0}%</span></div>
              <div className="cm-prog" style={{ margin: '8px 0 0', height: 8 }} aria-hidden="true"><i style={{ width: `${Math.min(100, c.pct)}%`, background: corDe(c.categoria) }} /></div>
            </div>
          ))}
        </Card>
      )}

      {ultimos.length > 0 && (
        <>
          <h2 className="cm-h2">Últimos lançamentos<Link to="/lancamentos">Ver todos</Link></h2>
          <Lista rotulo="Últimos lançamentos">
            {ultimos.map((l) => <ListItem key={l.id} faixa={diaCurto(l.data)} titulo={<>{l.descricao || l.categoria} {l.serverId !== undefined && <span className="cm-selo-wa">via WhatsApp</span>}</>} sub={l.categoria} valor={m(brl(l.valor))} />)}
          </Lista>
        </>
      )}
      <GradeFerramentas area="gastos" />
      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
    </>
  );
}

/* ---------- Guardar: reserva, metas, extras, investir e renda ---------- */
export function AreaGuardar() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const meta = reservaMeta(e, mes);
  const guardado = Math.max(0, patrimonioGuardado(e));
  const passos = useMemo(() => passosDoMes(e, hoje), [e, hoje]);
  const { executar, folhas } = useExecutarPasso(hoje);
  const prox = proximoDaArea(passos, ['guardar', 'meta']);
  const segurado = passos.find((p) => p.origem === 'guardar' && p.status === 'segurado');
  const marco = useMemo(() => calcularCaminho(e, hoje).find((x) => x.id === 'reserva'), [e, hoje]);
  const f = marco ? fraseDoMarco(marco) : null;
  return (
    <>
      <h1 className="gs-titulo">Guardar</h1>
      <section className="cm-topo-area" aria-label="Sua reserva" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <ProgressRing pct={meta > 0 ? (guardado / meta) * 100 : 0} rotulo="Reserva de emergência"><Moeda tamanho={58} /></ProgressRing>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Eyebrow>Reserva de emergência</Eyebrow>
          <span className="cm-num">{m(brl0(guardado))}</span>
          <p>
            {meta > 0 ? `de ${m(brl0(meta))}. ` : ''}
            {marco?.status === 'feito' ? 'Reserva completa. Agora é manter.' : f?.data ? `No ritmo de hoje, completa em ${f.data}.` : marco?.pendencia}
            {segurado ? ' Guardar está em espera até as contas ficarem em dia.' : guardadoNoMes(e, mes) > 0 ? ` Neste mês você já guardou ${m(brl0(guardadoNoMes(e, mes)))}.` : ''}
          </p>
          {prox ? <BotaoDoPasso p={prox} executar={executar} principal /> : <Link to="/plano/reserva" className="gs-btn">Abrir a reserva</Link>}
        </div>
      </section>
      <h2 className="cm-h2" id="metas">Suas metas</h2>
      <Metas />
      <GradeFerramentas area="guardar" />
      {folhas}
    </>
  );
}

/* ---------- Todas as ferramentas ---------- */
export function TodasFerramentas() {
  return (
    <>
      <h1 className="gs-titulo">Todas as ferramentas</h1>
      <p className="gs-sub">{FERRAMENTAS.length} ferramentas. Cada uma responde uma pergunta.</p>
      <button type="button" className="cm-busca" onClick={abrirResolver}><Search size={20} aria-hidden="true" />O que você quer resolver?</button>
      {(Object.keys(GRUPOS) as Area[]).map((a) => (
        <section key={a} aria-label={NOME_AREA[a]}>
          <h2 className="gs-titulo" style={{ marginTop: 36 }}>{NOME_AREA[a]}</h2>
          <GradeFerramentas area={a} />
        </section>
      ))}
    </>
  );
}

/* ---------- Perfil: seus dados, avisos, WhatsApp, planos, instalar, guias, sobre ---------- */
export function Perfil() {
  const e = useEstado();
  const tema = useTema();
  const nome = e.config.nome || getName() || 'Você';
  return (
    <>
      <h1 className="gs-titulo">{nome}</h1>
      <p className="gs-sub">Seus dados, seus avisos e o que mais você precisar ajustar.</p>

      <section className="cm-card" id="whatsapp" aria-label="WhatsApp">
        <Eyebrow>Anote pelo WhatsApp</Eyebrow>
        <b style={{ display: 'block', font: '600 24px/1.2 var(--cm-serif)', margin: '6px 0' }}>Mande "gastei 35 no mercado" ou a foto do cupom.</b>
        <p className="cm-mudo" style={{ margin: '0 0 6px' }}>Eu anoto, categorizo e o gasto aparece aqui com o selo "via WhatsApp". Também funciona:</p>
        <ul className="cm-mudo" style={{ margin: '0 0 14px', paddingLeft: 18, lineHeight: 1.6 }}>
          <li><b>recebi 3000 de salário</b>: registra a entrada</li>
          <li><b>quanto posso gastar hoje?</b>: responde com o seu número</li>
          <li><b>resumo</b>: como está o seu mês</li>
          <li>foto de comprovante de pix ou áudio contando o gasto</li>
        </ul>
        <a className="gs-btn" href={waLink('Oi! Quero anotar meus gastos por aqui.')} target="_blank" rel="noreferrer">Abrir o WhatsApp</a>
      </section>

      <GradeFerramentas area="perfil" />

      <h2 className="cm-h2">Aparência</h2>
      <Segmented rotulo="Tema" valor={tema} onChange={definirTema} opcoes={[{ id: 'claro', nome: 'Claro' }, { id: 'escuro', nome: 'Escuro' }]} />
      <p className="cm-mudo" style={{ marginTop: -6 }}>O claro é a cara do Grana Séria. O escuro fica aqui para quem prefere.</p>

      <div id="instalar" style={{ marginTop: 24 }}><InstalarApp /></div>

      <h2 className="cm-h2">Mais</h2>
      <Lista>
        <ListItem titulo="Guias" sub="Explicações curtas, sem jargão" rota="/guias" />
        <ListItem titulo="Todas as ferramentas" sub="Tudo o que o app faz, num lugar só" rota="/ferramentas" />
        <ListItem titulo="Minha conta" sub="Entrar com e-mail" rota="/conta" />
        <ListItem titulo="Limpar meus dados" sub="Recomeçar do zero, mantendo a conta" rota="/dados#limpar" />
      </Lista>
    </>
  );
}
