// O painel do Início refeito a partir do vídeo de referência, página por página (em areia e dourado):
//  Funil  = "Funnels": lista de funis à esquerda, colunas grandes, chips, comparação com o mês passado e dois cartões embaixo.
//  Contas = "Campaigns": quadro em colunas (Atrasadas, Vencem logo, Mais pra frente, Pagas) e a aba Resultados.
//  Mapa   = "Cohorts": quatro cartões e a tabela de calor com a linha destacada.
// A pílula das abas estica e desliza como no vídeo; o título embaralha; o conteúdo entra com desfoque, cartão por cartão.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PE } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, CalendarDays, CalendarRange, Filter, Flame, Grid3x3, MoreHorizontal, PiggyBank, Plus, Receipt, Share2, TrendingUp, type LucideIcon } from 'lucide-react';
import { brl0, mesDe, nomeMes } from './datas';
import { useContagem } from './base';
import { painelVidro } from './painelVidro';
import { mascarar, useOculto } from './privacidade';
import { contasDoMes, detalheDisponivel, patrimonioGuardado, reservaMeta } from './selectores';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { tocar } from './sons';
import { abrirAdicionar } from './AdicionarMov';
import './painelVideo.css';
import './painelRv.css';

type Vista = 'funil' | 'contas' | 'mapa';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_SEM_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dataCurta = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const cap = (t: string) => t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);

function N({ v, oculto }: { v: number; oculto: boolean }) {
  const n = useContagem(v, 900);
  return <>{oculto ? mascarar(brl0(v), true) : brl0(n)}</>;
}

/** Título que embaralha as letras e se resolve da esquerda para a direita, como no vídeo. */
function useEmbaralhar(texto: string): string {
  const [t, setT] = useState(texto);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setT(texto); return; }
    const letras = 'abcdefghijklmnopqrstuvwxyz';
    let q = 0;
    const id = window.setInterval(() => {
      q += 1;
      const fixo = Math.floor((q / 12) * texto.length);
      setT(texto.split('').map((c, i) => (i < fixo || c === ' ' ? c : letras[Math.floor(Math.random() * letras.length)])).join(''));
      if (q >= 12) { window.clearInterval(id); setT(texto); }
    }, 34);
    return () => window.clearInterval(id);
  }, [texto]);
  return t;
}

/** Abas com a pílula que estica: a borda da frente corre rápido e a de trás vem depois (o slidePill do vídeo). */
function Abas<T extends string>({ itens, valor, onMudar, pequeno }: { itens: { id: T; rotulo: string; Icone?: LucideIcon; n?: number }[]; valor: T; onMudar: (v: T) => void; pequeno?: boolean }) {
  const caixa = useRef<HTMLDivElement>(null);
  const antes = useRef(0);
  const [p, setP] = useState<{ l: number; r: number; fwd: boolean } | null>(null);
  useLayoutEffect(() => {
    const box = caixa.current;
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !el) return;
    const l = el.offsetLeft;
    const r = box.offsetWidth - (l + el.offsetWidth);
    setP({ l, r, fwd: l >= antes.current });
    antes.current = l;
  }, [valor, itens.length]);
  const lider = '.36s cubic-bezier(.215, .61, .355, 1)';
  const seguidor = '.55s cubic-bezier(.65, 0, .35, 1)';
  return (
    <div className={`rv-abas${pequeno ? ' peq' : ''}`} ref={caixa} role="tablist">
      {p && <i className="rv-pilula" aria-hidden="true" style={{ left: p.l, right: p.r, transition: p.fwd ? `left ${seguidor}, right ${lider}` : `left ${lider}, right ${seguidor}` }} />}
      {itens.map(({ id, rotulo, Icone, n }) => (
        <button key={id} type="button" role="tab" aria-selected={id === valor} className={id === valor ? 'on' : ''} onClick={() => { if (id !== valor) { tocar('deslizar'); onMudar(id); } }}>
          {Icone && <Icone size={15} aria-hidden="true" />}{rotulo}{n ? <em>{n}</em> : null}
        </button>
      ))}
    </div>
  );
}

interface Passo { id: string; rotulo: string; valor: number; nota?: string | null; ref?: number | null; tom?: 'ouro' | 'verde' | 'vermelho' }
interface Funil { id: string; nome: string; resumo: string; desc: string; pct: number; delta?: { pct: number; bom: boolean } | null; passos: Passo[] }

function Colunas({ passos, sel, onSel, m, comparar, rotuloPct }: { passos: Passo[]; sel: number; onSel: (i: number) => void; m: (t: string) => string; comparar: boolean; rotuloPct: (p: Passo) => string }) {
  const base = Math.max(1, passos[0]?.valor ?? 1);
  return (
    <div className="pv-cols" style={{ gridTemplateColumns: `repeat(${passos.length}, minmax(0, 1fr))` }}>
      {passos.map((ps, i) => {
        const h = Math.max(ps.valor > 0 ? 4 : 2, Math.min(100, (Math.abs(ps.valor) / base) * 100));
        const anterior = i > 0 ? passos[i - 1].valor : 0;
        const conv = i > 0 && anterior > 0 ? (ps.valor / anterior) * 100 : null;
        const segue = conv !== null && conv <= 100 ? conv : null;
        const refH = ps.ref != null ? Math.max(2, Math.min(100, (ps.ref / base) * 100)) : null;
        return (
          <button key={ps.id} type="button" className={`pv-col${i === sel ? ' on' : ''}${ps.tom === 'verde' ? ' fim' : ''}${ps.tom === 'vermelho' || ps.valor < 0 ? ' neg' : ''}`} onClick={() => { onSel(i); tocar('tique'); }} onPointerEnter={() => { if (i !== sel) tocar('tique2'); }} aria-pressed={i === sel} style={{ ['--i' as string]: i }}>
            <small>{i + 1}. {ps.rotulo}</small>
            <b>{m(brl0(ps.valor))}</b>
            <em>{rotuloPct(ps)}</em>
            <span className="box">
              <i style={{ height: `${h}%`, animationDelay: `${0.25 + i * 0.12}s` }} />
              {comparar && refH !== null && <s style={{ bottom: `${refH}%` }} />}
              {segue !== null && <u>{Math.round(segue)}%</u>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PainelVideo({ onCompartilhar, onSaldo, onPagar }: { onCompartilhar: () => void; onSaldo: () => void; onPagar: (id: string) => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const oculto = useOculto();
  const mes = mesDe(hoje);
  const mesNome = nomeMes(mes).split(' ')[0].toLowerCase();
  const p = useMemo(() => painelVidro(e, hoje), [e, hoje]);
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const contas = useMemo(() => contasDoMes(e, mes, hoje), [e, mes, hoje]);
  const m = (t: string) => (oculto ? mascarar(t, oculto) : t);
  const [vista, setVista] = useState<Vista>('funil');
  const [subConta, setSubConta] = useState<'quadro' | 'resultados'>('quadro');
  const [funilId, setFunilId] = useState('mes');
  const [sel, setSel] = useState(0);
  const [comparar, setComparar] = useState(true);
  const [chip, setChip] = useState('todas');
  const [cel, setCel] = useState<[number, number] | null>(null);

  // o painel abre com um sopro que sobe e um brilho; só toca depois do primeiro gesto da pessoa
  useEffect(() => { const t = setTimeout(() => tocar('subir'), 120); const t2 = setTimeout(() => tocar('brilho'), 1000); return () => { clearTimeout(t); clearTimeout(t2); }; }, []);
  useEffect(() => { setSel(0); }, [funilId]);
  // o foco de luz dourado segue o cursor dentro de cada cartão
  const seguir = (ev: PE<HTMLDivElement>) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('.pv-p, .pv-kpi, .rv-card');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
    el.style.setProperty('--my', `${ev.clientY - r.top}px`);
  };

  // ---------- dados ----------
  const kpi = (id: string) => p.kpis.find((k) => k.id === id);
  const guardado = Math.max(0, patrimonioGuardado(e));
  const metaReserva = reservaMeta(e, mes);
  const anteriorDe = (id: string) => { const k = kpi(id); return k && k.valor !== null && k.delta && k.delta.pct !== null && k.delta.pct > -100 ? k.valor / (1 + k.delta.pct / 100) : null; };
  const f = p.funil;

  const funis: Funil[] = useMemo(() => {
    const lista: Funil[] = [];
    if (f) {
      const rec = Math.max(1, f.passos[0].valor);
      const sobrou = f.passos[3].valor;
      const dSaldo = kpi('saldo')?.delta;
      lista.push({
        id: 'mes', nome: 'Este mês', resumo: `4 etapas · ${mesNome}`, desc: `Para onde foi cada real que entrou em ${mesNome}`,
        pct: Math.round((sobrou / rec) * 100),
        delta: dSaldo && dSaldo.pct !== null && dSaldo.sentido !== 'igual' ? { pct: Math.abs(Math.round(dSaldo.pct)), bom: dSaldo.sentido === 'sobe' } : null,
        passos: f.passos.map((ps, i) => ({ id: ps.id, rotulo: ps.rotulo, valor: ps.valor, nota: ps.nota, tom: i === 3 ? 'verde' as const : undefined, ref: ps.id === 'receita' ? anteriorDe('receitas') : ps.id === 'variaveis' ? anteriorDe('despesas') : null })),
      });
    }
    if (contas.length > 0) {
      const prev = contas.reduce((t, c) => t + c.valor, 0);
      const pagas = contas.filter((c) => c.estado === 'paga').reduce((t, c) => t + c.valor, 0);
      const atras = contas.filter((c) => c.estado === 'atrasada').reduce((t, c) => t + c.valor, 0);
      lista.push({
        id: 'fixas', nome: 'Contas fixas', resumo: `${contas.length} ${contas.length === 1 ? 'conta' : 'contas'} · ${mesNome}`, desc: 'Quanto das contas do mês já foi pago e quanto falta',
        pct: prev > 0 ? Math.round((pagas / prev) * 100) : 0,
        passos: [
          { id: 'prev', rotulo: 'Previsto', valor: prev },
          { id: 'pago', rotulo: 'Já pago', valor: pagas, tom: 'verde' },
          { id: 'aberto', rotulo: 'Em aberto', valor: prev - pagas },
          { id: 'atraso', rotulo: 'Atrasado', valor: atras, tom: 'vermelho' },
        ],
      });
    }
    if (p.dividas.length > 0) {
      const orig = p.dividas.reduce((t, d) => t + d.original, 0);
      const falta = p.dividas.reduce((t, d) => t + d.saldo, 0);
      lista.push({
        id: 'dividas', nome: 'Dívidas', resumo: `${p.dividas.length} ${p.dividas.length === 1 ? 'dívida' : 'dívidas'}`, desc: 'Quanto você já pagou das dívidas e quanto falta',
        pct: orig > 0 ? Math.round(((orig - falta) / orig) * 100) : 0,
        passos: [
          { id: 'orig', rotulo: 'Devia no início', valor: orig },
          { id: 'pago', rotulo: 'Já pago', valor: Math.max(0, orig - falta), tom: 'verde' },
          { id: 'falta', rotulo: 'Ainda falta', valor: falta },
        ],
      });
    }
    if (metaReserva > 0) {
      lista.push({
        id: 'reserva', nome: 'Reserva', resumo: 'Reserva de emergência', desc: 'Quanto da reserva de emergência já está guardado',
        pct: Math.min(100, Math.round((guardado / metaReserva) * 100)),
        passos: [
          { id: 'meta', rotulo: 'Meta', valor: metaReserva },
          { id: 'guard', rotulo: 'Guardado', valor: guardado, tom: 'verde' },
          { id: 'falta', rotulo: 'Falta guardar', valor: Math.max(0, metaReserva - guardado) },
        ],
      });
    }
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tudo vem de p, contas, guardado e metaReserva
  }, [p, contas, guardado, metaReserva, mesNome]);

  const atual = funis.find((x) => x.id === funilId) ?? funis[0];
  const abertas = contas.filter((c) => c.estado !== 'paga');
  const totalAberto = abertas.reduce((t, c) => t + c.valor, 0);
  const saldo = kpi('saldo')?.valor ?? null;
  const gastarHoje = disp.modo !== 'incompleto' ? Math.max(0, disp.porDia) : null;

  // ---------- título e subtítulo de cada página ----------
  const tituloBruto = vista === 'funil' ? 'Funil do mês' : vista === 'contas' ? 'Contas' : 'Mapa do mês';
  const titulo = useEmbaralhar(tituloBruto);
  const subtitulo = vista === 'funil'
    ? <>{saldo === null ? 'Conte quanto você ganha para ver quanto sobra' : <>Sobrou <b><N v={saldo} oculto={oculto} /></b> até agora</>}{gastarHoje !== null && <> · hoje dá para gastar <b>{m(brl0(gastarHoje))}</b></>}</>
    : vista === 'contas'
      ? <>{abertas.length} {abertas.length === 1 ? 'conta aberta' : 'contas abertas'} · <b>{m(brl0(totalAberto))}</b> para pagar em {mesNome}</>
      : <>Cada quadradinho é um dia de {mesNome}. Quanto mais dourado, mais você gastou.</>;

  // ---------- Contas: quadro ----------
  const colunasBoard = useMemo(() => {
    const ord = [...contas].sort((a, b) => a.dias - b.dias);
    return [
      { id: 'atraso', rotulo: 'Atrasadas', Icone: Flame, tom: 'perigo', itens: ord.filter((c) => c.estado === 'atrasada') },
      { id: 'logo', rotulo: 'Vencem logo', Icone: CalendarDays, tom: 'aviso', itens: ord.filter((c) => c.estado !== 'paga' && c.estado !== 'atrasada' && c.dias <= 7) },
      { id: 'depois', rotulo: 'Mais pra frente', Icone: CalendarRange, tom: 'ok', itens: ord.filter((c) => c.estado !== 'paga' && c.estado !== 'atrasada' && c.dias > 7) },
      { id: 'pagas', rotulo: 'Pagas', Icone: Receipt, tom: 'pago', itens: ord.filter((c) => c.estado === 'paga') },
    ];
  }, [contas]);

  // ---------- Mapa ----------
  const mapa = useMemo(() => {
    const semanas: { dia: number; v: number; fut: boolean }[][] = [];
    p.dias.forEach((d) => {
      const dow = new Date(`${d.data}T12:00:00`).getDay();
      if (semanas.length === 0 || dow === 0) semanas.push(Array.from({ length: 7 }, () => ({ dia: 0, v: 0, fut: false })));
      semanas[semanas.length - 1][dow] = { dia: d.dia, v: d.despesa, fut: d.futuro };
    });
    return semanas;
  }, [p.dias]);
  const maxCel = Math.max(1, ...mapa.flat().map((c) => c.v));
  const passados = p.dias.filter((d) => !d.futuro);
  const media = passados.length ? passados.reduce((t, d) => t + d.despesa, 0) / passados.length : 0;
  const maior = passados.reduce((a, d) => (d.despesa > a.despesa ? d : a), { data: '', dia: 0, despesa: 0, receita: 0, futuro: false });
  const porSemana = DIAS_SEM.map((_, i) => passados.filter((d) => new Date(`${d.data}T12:00:00`).getDay() === i).reduce((t, d) => t + d.despesa, 0));
  const diaCaro = porSemana.indexOf(Math.max(...porSemana));
  const semGasto = passados.filter((d) => d.despesa === 0).length;
  const temGasto = passados.some((d) => d.despesa > 0);

  const cat = p.categorias;
  const topCat = cat[0];
  const totCat = Math.max(1, ...cat.map((c) => c.gasto));
  const recBase = Math.max(1, f?.passos[0].valor ?? 1);

  return (
    <div className="pv rv" onPointerMove={seguir}>
      <i className="pv-halo" aria-hidden="true" /><i className="pv-halo b" aria-hidden="true" />

      <div className="pv-ph">
        <div>
          <h1 className="rv-titulo">{titulo}</h1>
          <p>{subtitulo}</p>
        </div>
        <div className="pv-acoes">
          {vista === 'funil' && <><button type="button" className="pv-b2" onClick={() => { tocar('tique'); onCompartilhar(); }}><Share2 size={15} aria-hidden="true" />Compartilhar</button><button type="button" className="rv-ouro" onClick={() => { tocar('tique'); onSaldo(); }}>Como calculei</button></>}
          {vista === 'contas' && <Link to="/pagar?nova=1" className="rv-ouro" onClick={() => tocar('tique')}><Plus size={15} aria-hidden="true" />Nova conta</Link>}
          {vista === 'mapa' && <button type="button" className="rv-ouro" onClick={() => { tocar('tique'); abrirAdicionar(); }}><Plus size={15} aria-hidden="true" />Anotar gasto</button>}
        </div>
      </div>

      <Abas<Vista> itens={[{ id: 'funil', rotulo: 'Funil', Icone: Filter }, { id: 'contas', rotulo: 'Contas', Icone: Receipt, n: abertas.length }, { id: 'mapa', rotulo: 'Mapa', Icone: Grid3x3 }]} valor={vista} onMudar={setVista} />

      <div className="rv-pagina" key={vista}>
        {/* =============== FUNIL =============== */}
        {vista === 'funil' && (!atual ? (
          <section className="pv-p rv-card"><p className="pv-vazio">O funil abre quando houver renda ou gasto neste mês.</p></section>
        ) : (
          <>
            <div className="pv-grade">
              <section className="pv-p pv-metas rv-card" style={{ ['--i' as string]: 0 }} aria-label="Funis salvos">
                <span className="pv-lab">Funis salvos</span>
                {funis.map((x, i) => {
                  const base = Math.max(1, x.passos[0].valor);
                  return (
                    <button key={x.id} type="button" className={`rv-funil${x.id === atual.id ? ' on' : ''}`} style={{ ['--i' as string]: i + 1 }} onClick={() => { if (x.id !== atual.id) { setFunilId(x.id); tocar('tique'); } }} onPointerEnter={() => { if (x.id !== atual.id) tocar('tique2'); }}>
                      <span className="r"><b>{x.nome}</b><em>{x.pct}%</em></span>
                      <span className="r s"><small>{x.resumo}</small>{x.delta && <span className={`rv-delta ${x.delta.bom ? 'bom' : 'ruim'}`}>{x.delta.bom ? <ArrowUpRight size={11} aria-hidden="true" /> : <ArrowDownRight size={11} aria-hidden="true" />}{x.delta.pct}%</span>}</span>
                      <span className="rv-mini" aria-hidden="true">{x.passos.map((ps, k) => <i key={ps.id} style={{ height: `${Math.max(8, Math.min(100, (Math.abs(ps.valor) / base) * 100))}%`, animationDelay: `${0.15 + k * 0.07}s` }} />)}</span>
                    </button>
                  );
                })}
              </section>

              <section className="pv-p pv-funil rv-card" style={{ ['--i' as string]: 1 }} aria-label={atual.nome}>
                <header>
                  <div><h2>{atual.nome === 'Este mês' ? 'Da renda ao que sobrou' : atual.nome}</h2><p>{atual.desc}</p></div>
                  {atual.id === 'mes' && (
                    <label className="rv-chave"><span>Mês passado</span><input type="checkbox" checked={comparar} onChange={(ev) => { setComparar(ev.target.checked); tocar('pop'); }} /><i aria-hidden="true" /></label>
                  )}
                </header>
                {atual.id === 'mes' && cat.length > 0 && (
                  <div className="rv-chips" role="group" aria-label="Filtrar por categoria">
                    {[{ id: 'todas', nome: 'Todas' }, ...cat.slice(0, 5).map((c) => ({ id: c.categoria, nome: c.categoria }))].map((c, i) => (
                      <button key={c.id} type="button" className={chip === c.id ? 'on' : ''} onClick={() => { setChip(c.id); tocar('tique2'); }}>{c.id !== 'todas' && <i style={{ background: ['#C99A3E', '#E08A4B', '#5FA487', '#B76E6E', '#8C7BB5'][i - 1] }} />}{c.nome}</button>
                    ))}
                  </div>
                )}
                <Colunas passos={atual.passos} sel={Math.min(sel, atual.passos.length - 1)} onSel={setSel} m={m} comparar={comparar && atual.id === 'mes'} rotuloPct={(ps) => atual.id === 'mes' ? `${Math.round((ps.valor / recBase) * 100)}% da renda` : `${Math.round((ps.valor / Math.max(1, atual.passos[0].valor)) * 100)}% do início`} />
                <div className="pv-pe">
                  <span><b>Geral</b> {atual.pct}% {atual.id === 'mes' ? 'da renda sobrou' : atual.id === 'fixas' ? 'já pago' : atual.id === 'dividas' ? 'já quitado' : 'da meta'}{atual.id === 'mes' && comparar ? ' · Tracejado: mês passado' : ''}</span>
                  <span>{atual.passos[Math.min(sel, atual.passos.length - 1)].rotulo}: <b>{m(brl0(atual.passos[Math.min(sel, atual.passos.length - 1)].valor))}</b>{atual.passos[Math.min(sel, atual.passos.length - 1)].nota ? ` · ${atual.passos[Math.min(sel, atual.passos.length - 1)].nota}` : ''}</span>
                </div>
              </section>
            </div>

            {atual.id === 'mes' && cat.length > 0 && (
              <div className="pv-grade b">
                <section className="pv-p rv-card" style={{ ['--i' as string]: 2 }} aria-label="Gasto por categoria">
                  <h2>Variáveis por categoria</h2><p className="s">{f ? `${m(brl0(f.passos[2].valor))} do dia a dia em ${mesNome}` : ''}</p>
                  <div className="rv-barras">
                    {cat.slice(0, 6).map((c, i) => (
                      <Link key={c.categoria} to="/gastos" className={chip === c.categoria ? 'on' : ''} onClick={() => tocar('tique')} style={{ animationDelay: `${0.2 + i * 0.07}s` }}>
                        <span className="n">{cap(c.categoria)}</span>
                        <span className="tr"><i className={c.tom} style={{ width: `${Math.max(3, (c.gasto / totCat) * 100)}%`, animationDelay: `${0.3 + i * 0.07}s` }} /></span>
                        <span className="v">{m(brl0(c.gasto))}</span>
                      </Link>
                    ))}
                  </div>
                </section>
                <section className="pv-p rv-card rv-vazamento" style={{ ['--i' as string]: 3 }} aria-label="Onde mais saiu">
                  <span className="rv-ic"><Flame size={18} aria-hidden="true" /></span>
                  <span className="pv-lab">Onde mais saiu</span>
                  <b>{cap(topCat.categoria)}</b>
                  <strong>{m(brl0(topCat.gasto))}</strong>
                  <small>{Math.round((topCat.gasto / recBase) * 100)}% da renda do mês{topCat.limite ? ` · limite ${m(brl0(topCat.limite))}` : ' · sem limite definido'}</small>
                  <Link to="/plano/cortar" className="rv-link" onClick={() => tocar('tique')}>Ver onde cortar</Link>
                </section>
              </div>
            )}
          </>
        ))}

        {/* =============== CONTAS =============== */}
        {vista === 'contas' && (
          <>
            <Abas<'quadro' | 'resultados'> pequeno itens={[{ id: 'quadro', rotulo: 'Quadro', n: contas.length }, { id: 'resultados', rotulo: 'Resultados' }]} valor={subConta} onMudar={setSubConta} />
            {contas.length === 0 && <section className="pv-p rv-card"><p className="pv-vazio">Nenhuma conta fixa ainda. Toque em “Nova conta” para o quadro aparecer.</p></section>}
            {contas.length > 0 && subConta === 'quadro' && (
              <div className="rv-quadro" key="quadro">
                {colunasBoard.map((col, ci) => (
                  <section key={col.id} className={`rv-col ${col.tom}`} style={{ ['--i' as string]: ci }} aria-label={col.rotulo}>
                    <header><col.Icone size={15} aria-hidden="true" /><b>{col.rotulo}</b><em>{col.itens.length}</em></header>
                    {col.itens.length === 0 && <p className="vz">Nada por aqui.</p>}
                    {col.itens.map((c, i) => (
                      <article key={c.gasto.id} className={`rv-card rv-conta${c.estado === 'paga' ? ' paga' : ''}`} style={{ ['--i' as string]: ci + i + 1 }}>
                        <div className="t"><span><Receipt size={13} aria-hidden="true" />{cap(c.gasto.categoria || 'conta')}</span><MoreHorizontal size={16} aria-hidden="true" /></div>
                        <h3>{c.gasto.nome}</h3>
                        <p>{m(brl0(c.valor))} · todo dia {c.gasto.diaVencimento}</p>
                        <div className="d"><CalendarDays size={13} aria-hidden="true" />{dataCurta(c.vencimento)} · {c.estado === 'paga' ? 'paga' : c.dias < 0 ? `atrasada há ${-c.dias} ${-c.dias === 1 ? 'dia' : 'dias'}` : c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence em ${c.dias} dias`}</div>
                        <div className="b"><span className="av" aria-hidden="true">{c.gasto.nome.slice(0, 2).toLocaleUpperCase('pt-BR')}</span>{c.estado !== 'paga' ? <button type="button" onClick={() => { tocar('tique'); onPagar(c.gasto.id); }}>Pagar</button> : <small>Paga</small>}</div>
                      </article>
                    ))}
                  </section>
                ))}
              </div>
            )}
            {contas.length > 0 && subConta === 'resultados' && (() => {
              const fx = funis.find((x) => x.id === 'fixas');
              return (
                <div key="res">
                  <div className="pv-grade rv-res">
                    <section className="pv-p pv-funil rv-card" style={{ ['--i' as string]: 0 }}>
                      <header><div><h2>Contas de {mesNome}</h2><p>Do que estava previsto ao que ainda falta</p></div><span className="rv-vivo"><i />No mês</span></header>
                      {fx && <Colunas passos={fx.passos} sel={Math.min(sel, fx.passos.length - 1)} onSel={setSel} m={m} comparar={false} rotuloPct={(ps) => `${Math.round((ps.valor / Math.max(1, fx.passos[0].valor)) * 100)}% do previsto`} />}
                    </section>
                    <section className="pv-p rv-card rv-total" style={{ ['--i' as string]: 1 }}>
                      <small>Falta pagar neste mês</small>
                      <b><N v={totalAberto} oculto={oculto} /></b>
                      <span className="l"><i>Contas abertas</i><u>{abertas.length}</u></span>
                      <span className="l"><i>Atrasadas</i><u>{colunasBoard[0].itens.length}</u></span>
                      <span className="l"><i>Já pagas</i><u>{colunasBoard[3].itens.length}</u></span>
                      <span className="l"><i>Próxima</i><u>{abertas.length ? dataCurta([...abertas].sort((a, b) => a.dias - b.dias)[0].vencimento) : '—'}</u></span>
                    </section>
                  </div>
                  <section className="pv-p rv-card" style={{ ['--i' as string]: 2 }}>
                    <h2>Contas por vencimento</h2><p className="s">Quanto vence em cada dia do mês</p>
                    <div className="rv-eixo">
                      {(() => {
                        const dias = Array.from({ length: 30 }, (_, i) => i + 1);
                        const porDia = dias.map((d) => contas.filter((c) => Number(c.vencimento.slice(8, 10)) === d).reduce((t, c) => t + c.valor, 0));
                        const mx = Math.max(1, ...porDia);
                        return (
                          <>
                            <span className="y"><i>{m(brl0(mx))}</i><i>{m(brl0(mx / 2))}</i><i>0</i></span>
                            <div className="b">{porDia.map((v, i) => <button key={i} type="button" tabIndex={-1} aria-label={`Dia ${i + 1}: ${brl0(v)}`} onPointerEnter={() => v > 0 && tocar('celula')}><i style={{ height: `${Math.max(2, (v / mx) * 100)}%`, animationDelay: `${i * 0.02}s` }} />{v > 0 && <em>{m(brl0(v))}</em>}</button>)}</div>
                          </>
                        );
                      })()}
                    </div>
                  </section>
                </div>
              );
            })()}
          </>
        )}

        {/* =============== MAPA =============== */}
        {vista === 'mapa' && (
          <>
            <div className="pv-kpis">
              {[
                { rotulo: 'Média por dia', valor: brl0(media), nota: `em ${passados.length} ${passados.length === 1 ? 'dia' : 'dias'} de ${mesNome}`, Icone: TrendingUp, ouro: true },
                { rotulo: 'Maior gasto do dia', valor: brl0(maior.despesa), nota: maior.dia ? `dia ${maior.dia}` : 'nenhum ainda', Icone: Flame },
                { rotulo: 'Dia que mais pesa', valor: temGasto ? cap(DIAS_SEM_LONGO[diaCaro]) : '—', nota: temGasto ? `${m(brl0(porSemana[diaCaro]))} no total` : 'anote gastos para ver', Icone: CalendarDays },
                { rotulo: 'Dias sem gastar', valor: String(semGasto), nota: semGasto === 1 ? 'dia em branco' : 'dias em branco', Icone: PiggyBank },
              ].map((k, i) => (
                <div key={k.rotulo} className={`pv-kpi rv-card${k.ouro ? ' ouro' : ''}`} style={{ ['--i' as string]: i }}>
                  <span className="pv-lab"><k.Icone size={14} aria-hidden="true" />{k.rotulo}</span>
                  <b>{k.Icone === TrendingUp || k.rotulo === 'Maior gasto do dia' ? m(k.valor) : k.valor}</b>
                  <em><small>{k.nota}</small></em>
                </div>
              ))}
            </div>
            <section className="pv-p rv-card" style={{ ['--i' as string]: 4 }} aria-label="Mapa do mês">
              <header className="rv-mh"><div><h2>Gastos por dia</h2><p className="s">Linhas são semanas, colunas são os dias da semana. Passe o mouse para seguir uma linha.</p></div><span className="pv-mapa-esc">menos <i /> mais</span></header>
              {!temGasto ? <p className="pv-vazio">Quando você anotar gastos, o mapa se preenche aqui.</p> : (
                <div className="pv-mapa rv-tab" role="table" aria-label="Gasto por dia da semana">
                  <span />{DIAS_SEM.map((d) => <span key={d} role="columnheader">{d}</span>)}
                  {mapa.map((sem, a) => (
                    <div key={a} className={`rv-lin${cel && cel[0] === a ? ' on' : ''}`} style={{ display: 'contents' }} role="row">
                      <span className={`sem${cel && cel[0] === a ? ' on' : ''}`} role="rowheader">Semana {a + 1}</span>
                      {sem.map((c, b) => (
                        <button key={b} type="button" role="cell" tabIndex={-1} className={`${c.dia === 0 || c.v === 0 ? 'vz' : ''}${c.fut ? ' fu' : ''}${cel && cel[0] === a && cel[1] === b ? ' on' : ''}`} style={{ ['--k' as string]: (c.v / maxCel).toFixed(3), animationDelay: `${(a + b) * 0.07}s` }} onPointerEnter={() => { setCel([a, b]); if (c.v > 0) tocar('celula'); }} onClick={() => { if (c.v > 0) { setCel([a, b]); tocar('tique2'); } }} aria-label={c.dia ? `Dia ${c.dia}: ${brl0(c.v)}` : ''}>
                          {c.v > 0 ? (c.v >= 1000 ? `${(c.v / 1000).toFixed(1).replace('.', ',')}k` : Math.round(c.v)) : ''}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="pv-mapa-pe"><span>{cel && mapa[cel[0]][cel[1]].dia ? <><b>Dia {mapa[cel[0]][cel[1]].dia}</b> · {m(brl0(mapa[cel[0]][cel[1]].v))}</> : 'Passe o dedo ou o mouse sobre um dia.'}</span><span /></div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
