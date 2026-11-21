import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Blocks, Flag, HeartPulse, NotebookPen, CalendarCheck, CalendarClock, CalendarDays, ChevronRight, FileText, Flame, Landmark, LifeBuoy, PiggyBank, Plus, Receipt, Search, Target, TriangleAlert, Wallet, Gauge, TrendingDown } from 'lucide-react';
import { FaixaKpis, FunilVidro, GraficoBarras, Heatmap, Rosca } from './PainelUI';
import { painelVidro } from './painelVidro';
import { mesCurto } from './datas';
import { atrasosAbertos } from './atrasosBase';
import { FormConta } from './MeuMes';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, diasNoMes, mesDe, nomeMes } from './datas';
import { contasDoMes, detalheDisponivel, guardadoNoMes, patrimonioGuardado, reservaMeta, sequenciaDeDias, totalVariaveis } from './selectores';
import { saldoAtual } from './dividas';
import { prioridades } from './prioridades';
import { gastosPorCategoria, matrizCategorias, patrimonioPorMes, serieMensal } from './evolucaoLogica';
import { passosDoMes, type OrigemPasso, type Passo } from './passos';
import { calcularCaminho, fraseDoMarco } from './caminho';
import { FERRAMENTAS, GRUPOS, NOME_AREA, gradeDaArea, urgentesDaArea, type Area } from './registroFerramentas';
import { BotaoDoPasso, useExecutarPasso } from './PassosUI';
import { ferramentasLiberadas, indicacoes, resumoDoPlano } from './planoPessoal';
import { liberarFerramenta } from './acoes';
import { toast } from '../components/ui/Toast';
import { BaixaSheet } from './BaixaSheet';
import { Metas } from './Metas';
import { ComoCalculei } from './ComoCalculei';
import { InstalarApp } from './InstalarApp';
import { abrirAdicionar } from './AdicionarMov';
import { abrirResolver } from './Resolver';
import { Card, Eyebrow, Lista, ListItem, Moeda, ProgressRing, Segmented, ToolGrid, ToolTile } from './base';
import { corDe } from './categorias';
import { saudeFinanceira } from './saude';
import { definirTema, useTema } from './tema';
import { definirSons, tocar, useSonsLigados } from './sons';
import { mascarar, useOculto } from './privacidade';
import { getName } from '../painel';
import { waLink } from '../whatsapp';

/** A grade de ferramentas de uma área: só as que o plano liberou; as outras ficam recolhidas, com "Liberar". */
export function GradeFerramentas({ area, todas = false }: { area: Area; todas?: boolean }) {
  const e = useEstado();
  const hoje = useHoje();
  const grade = useMemo(() => gradeDaArea(area, e, hoje), [area, e, hoje]);
  const lib = useMemo(() => ferramentasLiberadas(e, hoje), [e, hoje]);
  const [ver, setVer] = useState(false);
  const tile = (f: (typeof grade)[number]['itens'][number]) => {
    const c = f.continuar?.(e, hoje);
    return <ToolTile key={f.id} icone={f.icone} titulo={f.titulo} resolve={f.resolve} status={f.st.texto} tom={f.st.tom} rota={f.rota} continuar={c ? `Continuar (passo ${c.passo} de ${c.total}): ${c.o}` : undefined} />;
  };
  // nenhuma ferramenta fica escondida: o dono achou que tinham sumido (ex.: cartão). O plano só muda a ordem, dentro de cada grupo.
  const grupos = grade.map((g) => ({ grupo: g.grupo, itens: [...g.itens].sort((a, b) => Number(lib.has(b.id)) - Number(lib.has(a.id))) })).filter((g) => g.itens.length > 0);
  const minhas = grupos.flatMap((g) => g.itens);
  const outras: typeof minhas = [];
  return (
    <div id="ferramentas" style={{ scrollMarginTop: 80 }}>
      {area !== 'perfil' && <h2 className="cm-h2">{todas ? TITULO_AREA[area] : `Ferramentas de ${TITULO_AREA[area]}`}</h2>}
      {minhas.length ? grupos.map((g) => (
        <div key={g.grupo} className="pn-bloco-grupo">
          <h3 className="pn-grupo-titulo">{g.grupo}</h3>
          <ToolGrid>{g.itens.map(tile)}</ToolGrid>
        </div>
      )) : (
        <div className="cm-card suave">
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>{e.caminho.plano ? `${resumoDoPlano(e.caminho.plano)} ${NOME_AREA[area]} entra depois: quando chegar a hora, o Coach libera as ferramentas daqui.` : `Ainda não há ferramentas de ${NOME_AREA[area]} no seu plano.`}</p>
          <div className="gs-acoes"><Link to="/coach?plano=1" className="gs-btn sec pequeno">Mudar meu plano</Link></div>
        </div>
      )}
      {outras.length > 0 && (
        <>
          <button type="button" className="cm-link" aria-expanded={ver} onClick={() => setVer(!ver)}>{ver ? 'Esconder as outras' : `Outras ${outras.length} ferramentas de ${NOME_AREA[area]} (fora do seu plano)`}</button>
          {ver && <ToolGrid>{outras.map((f) => <div key={f.id} style={{ display: 'grid', gap: 6 }}>{tile(f)}<button type="button" className="gs-btn sec pequeno" onClick={() => { liberarFerramenta(f.id); toast(`${f.titulo} entrou no seu plano.`); }}>Colocar no meu plano</button></div>)}</ToolGrid>}
        </>
      )}
    </div>
  );
}

const TITULO_AREA: Record<Area, string> = { pagar: 'Contas, dívidas e cartão', gastos: 'Gastos do dia a dia', guardar: 'Guardar e investir', caminho: 'Ajuda e seu caminho', perfil: 'Sua conta' };

/** "Ver as 10 ferramentas": leva até a grade da área, para ninguém achar que elas sumiram. */
export function AtalhoFerramentas({ area }: { area: Area }) {
  const e = useEstado();
  const hoje = useHoje();
  const lib = ferramentasLiberadas(e, hoje);
  const n = FERRAMENTAS.filter((f) => f.area === area && lib.has(f.id)).length;
  return n ? <a href="#ferramentas" className="cm-link" onClick={(ev) => { ev.preventDefault(); document.getElementById('ferramentas')?.scrollIntoView({ behavior: 'smooth' }); }}>Suas {n} ferramentas de {NOME_AREA[area]} <ChevronRight size={16} aria-hidden="true" /></a> : null;
}

/** Na tela inicial: só as ferramentas do plano da pessoa, e a indicação do Coach quando a vida pede uma nova. */
export function AtalhosDasAreas() {
  const e = useEstado();
  const hoje = useHoje();
  const lib = useMemo(() => ferramentasLiberadas(e, hoje), [e, hoje]);
  const ind = useMemo(() => indicacoes(e, hoje)[0], [e, hoje]);
  const minhas = FERRAMENTAS.filter((f) => lib.has(f.id) && f.area !== 'perfil' && f.id !== 'coach' && f.area !== 'caminho').map((f) => ({ ...f, st: f.status(e, hoje) })).sort((a, b) => (a.st.tom === 'perigo' ? -1 : 0) - (b.st.tom === 'perigo' ? -1 : 0));
  const fi = ind ? FERRAMENTAS.find((f) => f.id === ind.ferramentaId) : null;
  const [todas, setTodas] = useState(false);
  return (
    <section aria-label="Suas ferramentas">
      <h2 className="cm-h2">Suas ferramentas<Link to="/coach?plano=1">Mudar meu plano</Link></h2>
      {fi && ind && (
        <div className="cm-acao-card" style={{ marginBottom: 12 }}>
          <span className="cm-eyebrow">O Coach indica</span>
          <b style={{ marginTop: 4 }}>{fi.titulo}</b>
          <small>{ind.motivo}</small>
          <div className="gs-acoes" style={{ marginTop: 10 }}>
            <button type="button" className="gs-btn pequeno" onClick={() => { liberarFerramenta(fi.id); toast(`${fi.titulo} liberada.`); }}>Liberar</button>
            <Link to={fi.rota} className="gs-btn link">Só dar uma olhada</Link>
          </div>
        </div>
      )}
      <ToolGrid>{(todas ? minhas : minhas.slice(0, 6)).map((f) => <ToolTile key={f.id} icone={f.icone} titulo={f.titulo} resolve={f.resolve} status={f.st.texto} tom={f.st.tom} rota={f.rota} />)}</ToolGrid>
      <div className="gs-acoes">
        {minhas.length > 6 && <button type="button" className="cm-link" onClick={() => setTodas(!todas)}>{todas ? 'Mostrar menos' : `Ver as ${minhas.length} do seu plano`}</button>}
        <Link to="/ferramentas" className="cm-link">Todas as {FERRAMENTAS.length} do app <ChevronRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

/** O próximo passo de uma área: o primeiro passo do mês que pertence a ela. */
function proximoDaArea(passos: Passo[], origens: OrigemPasso[]): Passo | null {
  return passos.find((p) => origens.includes(p.origem) && (p.status === 'atual' || p.status === 'pendente')) ?? null;
}

/* ---------- Contas: o mês em ordem de vencimento ---------- */
type FiltroContas = 'mes' | 'atrasadas' | 'todas';
interface LinhaConta { chave: string; titulo: string; sub: string; valor: number; data: string; estado: 'paga' | 'atrasada' | 'vence-logo' | 'em-dia'; contaId?: string; rota: string }

export function AreaPagar() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const [params, setParams] = useSearchParams();
  const [filtro, setFiltro] = useState<FiltroContas>('mes');
  const [baixa, setBaixa] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  // "?nova=1" (do botão + e do Início) abre o cadastro de conta
  useEffect(() => {
    if (params.get('nova')) { setNova(true); setParams({}, { replace: true }); }
  }, [params, setParams]);
  const contas = useMemo(() => contasDoMes(e, mes, hoje), [e, mes, hoje]);
  const outras = useMemo(() => prioridades(e, hoje).filter((p) => !p.chave.startsWith('c-')), [e, hoje]);
  const antigos = useMemo(() => atrasosAbertos(e, hoje).filter((a) => a.mes < mes), [e, hoje, mes]);
  const linhas = useMemo<LinhaConta[]>(() => {
    const doMes: LinhaConta[] = contas.map((c) => ({ chave: `c-${c.gasto.id}`, titulo: c.gasto.nome, sub: c.estado === 'paga' ? `paga em ${diaCurto(c.gasto.pagamentos[mes].pagoEm)}` : c.estado === 'atrasada' ? `atrasada há ${-c.dias} ${-c.dias === 1 ? 'dia' : 'dias'}` : c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence em ${c.dias} dias`, valor: c.valor, data: c.vencimento, estado: c.estado, contaId: c.gasto.id, rota: '/lancamentos?aba=contas' }));
    const fora: LinhaConta[] = outras.map((p) => ({ chave: p.chave, titulo: p.titulo, sub: p.detalhe, valor: p.valor, data: p.data, estado: p.detalhe === 'paga' ? 'paga' : p.semaforo === 'vermelho' ? 'atrasada' : p.semaforo === 'amarelo' ? 'vence-logo' : 'em-dia', rota: p.rota }));
    return [...doMes, ...fora].sort((a, b) => a.data.localeCompare(b.data));
  }, [contas, outras, mes]);
  const antigas: LinhaConta[] = antigos.map((a) => ({ chave: a.chave, titulo: a.nome, sub: `de ${nomeMes(a.mes).split(' ')[0]}, atrasada há ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}`, valor: a.valor, data: a.vencimento, estado: 'atrasada', rota: '/plano/atrasos' }));
  const atrasadas = [...antigas, ...linhas.filter((l) => l.estado === 'atrasada')].sort((a, b) => a.data.localeCompare(b.data));
  const todas = [...antigas, ...linhas].sort((a, b) => a.data.localeCompare(b.data));
  const mostra = filtro === 'mes' ? linhas : filtro === 'atrasadas' ? atrasadas : todas;
  const abertasMes = linhas.filter((l) => l.estado !== 'paga');
  const falta = abertasMes.reduce((t, l) => t + l.valor, 0);
  const total = linhas.reduce((t, l) => t + l.valor, 0);
  const pagoPct = total > 0 ? ((total - falta) / total) * 100 : 0;
  const vazio = linhas.length === 0 && antigas.length === 0;
  const TOM_LINHA = { paga: 'ok', atrasada: 'perigo', 'vence-logo': 'aviso', 'em-dia': '' } as const;
  return (
    <>
      <h1 className="gs-titulo">Contas</h1>
      <section className="ini-destaque" aria-label="O que falta pagar">
        <span className="cm-eyebrow">Falta pagar em {nomeMes(mes).split(' ')[0]}</span>
        <b className="ini-valor">{m(brl0(falta))}</b>
        <p>{vazio ? 'Cadastre suas contas para eu te mostrar o que pagar primeiro.' : atrasadas.length ? `${atrasadas.length} ${atrasadas.length === 1 ? 'conta atrasada' : 'contas atrasadas'}. Comece por ${atrasadas.length === 1 ? 'ela' : 'elas'}.` : abertasMes.length ? `${abertasMes.length} ${abertasMes.length === 1 ? 'conta em aberto' : 'contas em aberto'} neste mês.` : 'Tudo pago por aqui. Pode respirar.'}</p>
        {total > 0 && <div className="cm-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pagoPct)} aria-label="Quanto já foi pago"><i style={{ width: `${pagoPct}%` }} /></div>}
        <div className="gs-acoes" style={{ marginTop: 14 }}>
          <button type="button" className="gs-btn" onClick={() => setNova(true)}><Plus size={18} aria-hidden="true" /> Nova conta</button>
        </div>
      </section>

      {!vazio && (
        <>
          <FaixaKpis mascara={m} itens={[
            { rotulo: 'Já pago', valor: Math.max(0, total - falta), icone: CalendarCheck, tom: 'ok', nota: total > 0 ? `${Math.round(pagoPct)}% das contas do mês` : undefined },
            { rotulo: 'Em aberto', valor: abertasMes.length, formato: 'int', icone: Receipt, nota: abertasMes.length === 1 ? 'conta para pagar' : 'contas para pagar' },
            { rotulo: 'Atrasadas', valor: atrasadas.length, formato: 'int', icone: TriangleAlert, tom: atrasadas.length ? 'perigo' : 'ok', nota: atrasadas.length ? 'resolva essas primeiro' : 'tudo em dia' },
            { rotulo: 'Próxima a vencer', valor: (() => { const p = abertasMes.find((l) => l.estado !== 'atrasada'); return p ? diaCurto(p.data) : '—'; })(), icone: CalendarClock, nota: abertasMes.find((l) => l.estado !== 'atrasada')?.titulo ?? 'nada pendente' },
          ]} />
          <GraficoBarras
            titulo="Vencimentos do mês" sub={nomeMes(mes).split(' ')[0]} mascara={m}
            dados={Array.from({ length: diasNoMes(mes) }, (_, i) => {
              const dia = i + 1;
              const doDia = linhas.filter((l) => Number(l.data.slice(8, 10)) === dia && l.data.slice(0, 7) === mes);
              const valor = doDia.reduce((t, l) => t + l.valor, 0);
              const tom = doDia.some((l) => l.estado === 'atrasada') ? 'perigo' : doDia.some((l) => l.estado === 'vence-logo') ? 'aviso' : doDia.length && doDia.every((l) => l.estado === 'paga') ? 'ok' : '';
              return { rotulo: String(dia), valor, tom, legenda: `Dia ${dia}${doDia.length ? ` · ${doDia.map((l) => l.titulo).join(', ')}` : ''}` };
            })}
            vazio="Nenhuma conta com vencimento neste mês."
          />
        </>
      )}

      {vazio ? (
        <section className="cm-card" aria-label="Como começar">
          <h2 className="cm-h2" style={{ margin: '0 0 8px' }}>Comece pela conta maior</h2>
          <p className="cm-mudo" style={{ marginTop: 0 }}>Aluguel, luz, internet, escola… Para cada uma eu só preciso de dois dados: quanto custa e que dia vence.</p>
          {['Eu mostro o que pagar primeiro', 'Aviso antes de cada conta vencer', 'Você vê quanto sobra depois delas'].map((t) => <div key={t} style={{ display: 'flex', gap: 10, padding: '4px 0' }}><span className="gs-check" style={{ flex: 'none' }}>✓</span><span>{t}</span></div>)}
          <button type="button" className="gs-btn cheio" style={{ marginTop: 14 }} onClick={() => setNova(true)}>Cadastrar minha primeira conta</button>
        </section>
      ) : (
        <>
          <Segmented rotulo="Quais contas mostrar" valor={filtro} onChange={setFiltro} opcoes={[{ id: 'mes', nome: 'Este mês' }, { id: 'atrasadas', nome: `Atrasadas${atrasadas.length ? ` (${atrasadas.length})` : ''}` }, { id: 'todas', nome: 'Todas' }]} />
          {mostra.length === 0 ? <p className="ini-vazio">{filtro === 'atrasadas' ? 'Nenhuma conta atrasada. Continue assim.' : 'Nada por aqui.'}</p> : (
            <Lista rotulo="Contas por data de vencimento">
              {mostra.map((l) => (
                <ListItem key={l.chave} faixa={diaCurto(l.data)} tomFaixa={TOM_LINHA[l.estado]} titulo={l.titulo} sub={l.sub} valor={m(brl(l.valor))}
                  acao={l.estado === 'paga' ? <span className="gs-check" aria-label="Paga" style={{ flex: 'none' }}>✓</span> : l.contaId ? <button type="button" className={`gs-btn pequeno${l.estado === 'em-dia' ? ' sec' : ''}`} onClick={() => setBaixa(l.contaId!)}>Pagar</button> : <Link to={l.rota} className="gs-btn sec pequeno">Abrir</Link>} />
              ))}
            </Lista>
          )}
          <Link to="/lancamentos?aba=contas" className="cm-link">Editar ou excluir contas <ChevronRight size={16} aria-hidden="true" /></Link>
        </>
      )}

      <h2 className="cm-h2">Atalhos de contas</h2>
      <div className="ini-cards compacto">
        <Link to="/plano/calendario"><i><CalendarDays size={22} aria-hidden="true" /></i><b>Calendário</b><small>O que vence antes do salário</small></Link>
        <Link to="/plano/cartao#importar"><i><FileText size={22} aria-hidden="true" /></i><b>Importar fatura</b><small>PDF, foto ou texto</small></Link>
        <Link to="/plano/atrasos?anotar=1"><i><CalendarClock size={22} aria-hidden="true" /></i><b>Anotar atraso</b><small>Conta de meses passados</small></Link>
        <Link to="/plano/atrasos"><i><LifeBuoy size={22} aria-hidden="true" /></i><b>Sair do atraso</b><small>O que pagar primeiro</small></Link>
      </div>

      <details className="ms-mais">
        <summary>Todas as ferramentas de contas, dívidas e cartão</summary>
        <GradeFerramentas area="pagar" />
      </details>
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <FormConta valor={nova ? 'novo' : null} onFechar={() => setNova(false)} onExcluir={() => setNova(false)} />
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
  const meses6 = useMemo(() => serieMensal(e, hoje).filter((x) => x.temDados || x.mes === mes).slice(-6), [e, hoje, mes]);
  const funil = useMemo(() => painelVidro(e, hoje).funil, [e, hoje]);
  const mapa = useMemo(() => matrizCategorias(e, meses6.map((x) => x.mes)), [e, meses6]);
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
        <AtalhoFerramentas area="gastos" />
      </section>

      <FaixaKpis mascara={m} itens={[
        { rotulo: 'Pode gastar hoje', valor: disp.modo === 'incompleto' ? '—' : Math.max(0, disp.porDia), icone: Wallet, tom: disp.livre < 0 ? 'perigo' : 'ok', nota: disp.modo === 'incompleto' ? 'informe sua renda' : disp.livre < 0 ? 'o mês já passou do limite' : 'sem apertar o mês' },
        { rotulo: 'Gasto no mês', valor: total, icone: TrendingDown, serie: meses6.map((x) => x.variaveis), bom: 'desce', nota: `${ultimos.length ? 'em ' : ''}${e.lancamentos.filter((l) => mesDe(l.data) === mes).length} lançamentos` },
        { rotulo: 'Média por dia', valor: Math.round(total / Math.max(1, Number(hoje.slice(8, 10)))), icone: Gauge, nota: 'desde o dia 1' },
        { rotulo: 'Maior categoria', valor: cats[0] ? cats[0].categoria : '—', icone: Flame, tom: cats[0] ? 'aviso' : '', nota: cats[0] ? m(brl0(cats[0].valor)) : 'ainda sem gastos' },
      ]} />
      {funil && <FunilVidro titulo="Da renda até o que sobrou" sub={nomeMes(mes).split(' ')[0]} mascara={m} passos={funil.passos} segue={funil.segue} />}
      <Rosca titulo="Para onde foi" sub={nomeMes(mes).split(' ')[0]} mascara={m}
        fatias={cats.slice(0, 6).map((c) => ({ nome: c.categoria, valor: c.valor, cor: corDe(c.categoria) }))}
        centro={<>{m(brl0(total))}<small>no mês</small></>} />
      <Heatmap titulo="Mês a mês por categoria" sub="quanto mais forte, mais gasto" mascara={m} linhas={mapa.linhas} colunas={meses6.map((x) => mesCurto(x.mes))} valores={mapa.valores} />
      <h2 className="cm-h2">Detalhe por categoria<Link to="/relatorios">Ver relatórios</Link></h2>
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
  const patri = useMemo(() => patrimonioPorMes(e, hoje)?.slice(-6).map((x) => x.valor), [e, hoje]);
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
          <div><AtalhoFerramentas area="guardar" /></div>
        </div>
      </section>
      <FaixaKpis mascara={m} itens={[
        { rotulo: 'Guardado', valor: guardado, icone: PiggyBank, tom: guardado > 0 ? 'ok' : '', nota: 'tudo que você separou', serie: patri, bom: 'sobe' },
        { rotulo: 'Meta da reserva', valor: meta, icone: Target, nota: meta > 0 ? `${Math.round(Math.min(100, (guardado / meta) * 100))}% completa` : 'defina pelo Coach' },
        { rotulo: 'Guardado no mês', valor: guardadoNoMes(e, mes), icone: Landmark, nota: 'aportes deste mês' },
        { rotulo: 'Metas ativas', valor: e.metas.length, formato: 'int', icone: CalendarCheck, nota: e.metas.length ? 'em andamento' : 'crie a primeira' },
      ]} />
      {e.metas.length > 0 && (
        <GraficoBarras titulo="Metas: quanto falta" sub="% do caminho" mascara={m}
          dados={e.metas.map((mt) => { const g = mt.guardados.reduce((t, x) => t + x.valor, 0); return { rotulo: mt.nome, valor: g, tom: g >= mt.alvo ? 'ok' : '', legenda: `${mt.nome} · ${mt.alvo > 0 ? Math.round((g / mt.alvo) * 100) : 0}% de ${brl0(mt.alvo)}` } as const; })} />
      )}
      <h2 className="cm-h2" id="metas">Suas metas</h2>
      <Metas />
      <GradeFerramentas area="guardar" />
      {folhas}
    </>
  );
}

/* ---------- Todas as ferramentas ---------- */
export function TodasFerramentas() {
  const e = useEstado();
  const hoje = useHoje();
  const lib = useMemo(() => ferramentasLiberadas(e, hoje), [e, hoje]);
  const areas = Object.keys(GRUPOS) as Area[];
  const urgentes = useMemo(() => areas.reduce((t, a) => t + urgentesDaArea(a, e, hoje).length, 0), [areas, e, hoje]);
  return (
    <>
      <h1 className="gs-titulo">Ferramentas</h1>
      <p className="gs-sub">Tudo o que o app faz. Toque na que resolve o que você precisa.</p>
      <FaixaKpis itens={[
        { rotulo: 'Ferramentas', valor: FERRAMENTAS.length, formato: 'int', icone: Blocks, nota: 'no app inteiro' },
        { rotulo: 'Liberadas pra você', valor: FERRAMENTAS.filter((f) => lib.has(f.id)).length, formato: 'int', icone: Flag, tom: 'ok', nota: 'pelo seu plano' },
        { rotulo: 'Pedindo atenção', valor: urgentes, formato: 'int', icone: TriangleAlert, tom: urgentes ? 'aviso' : 'ok', nota: urgentes ? 'tem coisa para resolver' : 'nada urgente' },
        { rotulo: 'Áreas', valor: areas.length, formato: 'int', icone: NotebookPen, nota: 'Contas, Gastos, Guardar…' },
      ]} />
      <button type="button" className="cm-busca" onClick={abrirResolver}><Search size={20} aria-hidden="true" />O que você quer resolver?</button>
      {(Object.keys(GRUPOS) as Area[]).map((a) => (
        <section key={a} aria-label={NOME_AREA[a]}>
          <GradeFerramentas area={a} todas />
        </section>
      ))}
    </>
  );
}

/** A nota de saúde financeira (0 a 100), com o porquê de cada parte e uma ação para a que mais pesa. Fica no Perfil: é um retrato, não um passo. */
function SaudeFinanceira() {
  const e = useEstado();
  const hoje = useHoje();
  const r = useMemo(() => saudeFinanceira(e, mesDe(hoje), hoje), [e, hoje]);
  if (e.config.renda <= 0) return null;
  const frase = r.nota >= 75 ? 'Suas finanças estão saudáveis. Agora é manter.' : r.nota >= 40 ? 'No caminho. Um ponto por vez, e a nota sobe.' : 'Hora de cuidar com carinho, e tem saída.';
  return (
    <section className="cm-card" id="saude" aria-label="Saúde financeira" style={{ scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <ProgressRing pct={r.nota} tamanho={112} rotulo="Saúde financeira"><b className="cm-num" style={{ fontSize: 34 }}>{r.nota}</b></ProgressRing>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Eyebrow>Saúde financeira · de 0 a 100</Eyebrow>
          <b style={{ display: 'block', font: '600 22px/1.25 var(--cm-serif)', margin: '6px 0' }}>{frase}</b>
          <p className="cm-mudo" style={{ margin: 0 }}>O que mais pesa agora: <b>{r.pior.nome.toLowerCase()}</b> ({r.pior.detalhe}). {r.pior.dica}</p>
        </div>
      </div>
      <Lista rotulo="Como a nota é calculada">
        {r.criterios.map((c) => <ListItem key={c.id} faixa={`${Math.round(c.pontos)}`} tomFaixa={c.pontos >= 75 ? 'ok' : c.pontos < 40 ? 'aviso' : ''} titulo={c.nome} sub={c.detalhe} rota={c.rota} />)}
      </Lista>
      <Link to={r.pior.rota} className="gs-btn">Melhorar {r.pior.nome.toLowerCase()}</Link>
    </section>
  );
}

/** Os números do retrato da pessoa e o que pesa em cada ponto da nota. */
function PerfilNumeros() {
  const e = useEstado();
  const hoje = useHoje();
  const r = useMemo(() => saudeFinanceira(e, mesDe(hoje), hoje), [e, hoje]);
  const seq = useMemo(() => sequenciaDeDias(e, hoje), [e, hoje]);
  if (e.config.renda <= 0) return null;
  return (
    <>
      <FaixaKpis itens={[
        { rotulo: 'Saúde financeira', valor: r.nota, formato: 'int', icone: HeartPulse, tom: r.nota >= 75 ? 'ok' : r.nota >= 40 ? 'aviso' : 'perigo', nota: r.nota >= 75 ? 'saudável' : r.nota >= 40 ? 'no caminho' : 'hora de cuidar' },
        { rotulo: 'Dias anotando', valor: seq, formato: 'int', icone: NotebookPen, tom: seq >= 3 ? 'ok' : '', nota: 'seguidos' },
        { rotulo: 'Metas', valor: e.metas.length, formato: 'int', icone: Target, nota: e.metas.length ? 'em andamento' : 'nenhuma ainda' },
        { rotulo: 'Dívidas', valor: e.dividas.filter((d) => saldoAtual(d) > 0).length, formato: 'int', icone: Landmark, nota: 'em aberto' },
      ]} />
      <GraficoBarras titulo="O que forma sua nota" sub="de 0 a 100" formato="pontos"
        dados={r.criterios.map((c) => ({ rotulo: c.nome, valor: c.pontos, tom: c.pontos >= 75 ? 'ok' : c.pontos < 40 ? 'aviso' : '', legenda: `${c.nome} · ${c.detalhe}` }) as const)} />
    </>
  );
}

/* ---------- Perfil: seus dados, avisos, WhatsApp, planos, instalar, guias, sobre ---------- */
export function Perfil() {
  const e = useEstado();
  const tema = useTema();
  const sons = useSonsLigados();
  const nome = e.config.nome || getName() || 'Você';
  return (
    <>
      <h1 className="gs-titulo">{nome}</h1>
      <p className="gs-sub">Seus dados, seus avisos e o que mais você precisar ajustar.</p>

      <section className="cm-card" id="whatsapp" aria-label="WhatsApp">
        <Eyebrow>Anote pelo WhatsApp</Eyebrow>
        <b style={{ display: 'block', font: '600 24px/1.2 var(--cm-serif)', margin: '6px 0' }}>Mande "gastei 35 no mercado".</b>
        <p className="cm-mudo" style={{ margin: '0 0 6px' }}>Eu anoto, categorizo e o gasto aparece aqui com o selo "via WhatsApp". Também funciona:</p>
        <ul className="cm-mudo" style={{ margin: '0 0 14px', paddingLeft: 18, lineHeight: 1.6 }}>
          <li><b>recebi 3000 de salário</b>: registra a entrada</li>
          <li><b>quanto posso gastar hoje?</b>: responde com o seu número</li>
          <li><b>resumo</b>: como está o seu mês</li>
          <li>escreva o valor; a leitura de foto e de áudio ainda não está ligada</li>
        </ul>
        <a className="gs-btn" href={waLink('Oi! Quero anotar meus gastos por aqui.')} target="_blank" rel="noreferrer">Abrir o WhatsApp</a>
      </section>

      <PerfilNumeros />
      <SaudeFinanceira />

      <GradeFerramentas area="perfil" />

      <h2 className="cm-h2">Aparência</h2>
      <Segmented rotulo="Tema" valor={tema} onChange={definirTema} opcoes={[{ id: 'claro', nome: 'Claro' }, { id: 'escuro', nome: 'Escuro' }]} />
      <p className="cm-mudo" style={{ marginTop: -6 }}>O claro (areia e dourado) é o padrão. O escuro fica aqui para quem prefere.</p>

      <h2 className="cm-h2">Sons</h2>
      <Segmented rotulo="Sons da interface" valor={sons ? 'on' : 'off'} onChange={(id) => { const ligar = id === 'on'; definirSons(ligar); if (ligar) tocar('sucesso'); }} opcoes={[{ id: 'on', nome: 'Ligados' }, { id: 'off', nome: 'Silêncio' }]} />
      <p className="cm-mudo" style={{ marginTop: -6 }}>Toque, troca de tela e um aviso baixinho quando você salva. Começa ligado.</p>

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
