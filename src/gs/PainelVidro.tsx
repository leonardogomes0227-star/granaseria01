import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { brl0, diaCurto } from './datas';
import { painelVidro, type Delta, type DiaCalor, type Kpi } from './painelVidro';
import { mascarar, useOculto } from './privacidade';
import { useEstado } from './store';
import { tocar } from './sons';
import { useHoje } from './useHoje';
import { useContagem } from './base';
import './vidro.css';

const SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const FAIXA: Kpi['id'][] = ['receitas', 'despesas', 'guardado', 'divida'];
const ABAS = [
  { id: 'categorias', nome: 'Categorias' },
  { id: 'funil', nome: 'Funil' },
  { id: 'calendario', nome: 'Calendário' },
  { id: 'movimento', nome: 'Movimento' },
] as const;
type Aba = (typeof ABAS)[number]['id'];

function movimentoReduzido(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}


const GLIFOS = 'abcdefghijklmnopqrstuvwxyz0123456789#%&';

/** Título que "se decifra": letras trocam até virar o texto. Sem movimento, mostra direto. */
function Titulo({ texto }: { texto: string }) {
  const [vis, setVis] = useState(texto);
  useEffect(() => {
    if (movimentoReduzido()) { setVis(texto); return; }
    tocar('digitar');
    const t0 = performance.now();
    const dur = 520;
    let raf = 0;
    const passo = (agora: number) => {
      const f = Math.min(1, (agora - t0) / dur);
      const fixas = Math.floor(f * texto.length);
      setVis(texto.split('').map((c, i) => (i < fixas || c === ' ' ? c : GLIFOS[Math.floor(Math.random() * GLIFOS.length)])).join(''));
      if (f < 1) raf = requestAnimationFrame(passo); else setVis(texto);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [texto]);
  return <h2 aria-label={texto}><span aria-hidden="true">{vis}</span></h2>;
}

/** Pílula que desliza até o botão ativo: a ponta da frente corre, a de trás vem depois. */
function usePilula(grupo: React.RefObject<HTMLElement>, ativo: string) {
  const pilula = useRef<HTMLElement>(null);
  const ant = useRef<number | null>(null);
  useLayoutEffect(() => {
    const g = grupo.current; const pl = pilula.current;
    const btn = g?.querySelector<HTMLElement>('[data-ativo="true"]');
    if (!g || !pl || !btn) return;
    const esq = btn.offsetLeft; const larg = btn.offsetWidth;
    const indo = ant.current === null || esq >= ant.current;
    pl.style.setProperty('--pl-esq', `${esq}px`);
    pl.style.setProperty('--pl-larg', `${larg}px`);
    pl.style.setProperty('--pl-t-esq', ant.current === null ? '0s' : indo ? '.5s' : '.3s');
    pl.style.setProperty('--pl-t-larg', ant.current === null ? '0s' : indo ? '.3s' : '.5s');
    pl.classList.add('pronta');
    ant.current = esq;
  }, [grupo, ativo]);
  return pilula;
}

function Numero({ valor, ms = 900 }: { valor: number; ms?: number }) {
  const n = useContagem(valor, ms);
  return <>{brl0(n)}</>;
}

function Seta({ delta, bom }: { delta: Delta | null; bom: 'sobe' | 'desce' }) {
  if (!delta || delta.sentido === 'igual') return null;
  const bomAgora = delta.sentido === bom;
  const seta = delta.sentido === 'sobe' ? '↑' : '↓';
  const pct = delta.pct === null ? '' : ` ${Math.abs(Math.round(delta.pct))}%`;
  return <small className={`vd-delta ${bomAgora ? 'bom' : 'ruim'}`}>{seta}{pct}</small>;
}

function inclinar(ev: ReactPointerEvent<HTMLElement>) {
  if (movimentoReduzido()) return;
  const el = ev.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (ev.clientX - r.left) / Math.max(1, r.width);
  const py = (ev.clientY - r.top) / Math.max(1, r.height);
  el.style.setProperty('--rx', `${((0.5 - py) * 7).toFixed(2)}deg`);
  el.style.setProperty('--ry', `${((px - 0.5) * 9).toFixed(2)}deg`);
  el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
  el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
}

function soltar(ev: ReactPointerEvent<HTMLElement>) {
  ev.currentTarget.style.setProperty('--rx', '0deg');
  ev.currentTarget.style.setProperty('--ry', '0deg');
}

function rotuloSegue(pct: number | null | undefined, daReceita: boolean): string {
  if (pct === null || pct === undefined) return '—';
  return `${Math.round(pct)}% ${daReceita ? 'da receita' : 'segue'}`;
}

function Grafico({ dias, modo }: { dias: { dia: number; data: string; despesa: number; receita: number; futuro: boolean }[]; modo: 'despesa' | 'receita' }) {
  const [i, setI] = useState<number | null>(null);
  const valores = dias.map((d) => (modo === 'despesa' ? d.despesa : d.receita));
  const max = Math.max(1, ...valores.filter((_, idx) => !dias[idx].futuro));
  const W = 320;
  const H = 132;
  const n = Math.max(1, valores.length);
  const pts = valores.flatMap((v, idx) => (dias[idx].futuro ? [] : [[(idx / Math.max(1, n - 1)) * W, H - 18 - (v / max) * (H - 36)]] as [number, number][]));
  const linha = pts.map(([x, y], idx) => `${idx ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const ultimo = pts[pts.length - 1];
  const area = pts.length > 1 && ultimo ? `${linha} L${ultimo[0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z` : '';
  const escolher = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const idx = Math.min(dias.length - 1, Math.max(0, Math.floor(((ev.clientX - r.left) / Math.max(1, r.width)) * dias.length)));
    setI(idx);
  };
  const ultimoPassado = dias.reduce((acc, d, idx) => (d.futuro ? acc : idx), -1);
  const ativo = i ?? ultimoPassado;
  const dia = ativo >= 0 ? dias[ativo] : null;
  const valor = dia ? valores[ativo] : 0;
  return (
    <div
      className="vd-scroll"
      tabIndex={0}
      role="img"
      aria-label={modo === 'despesa' ? 'Gasto de cada dia do mês' : 'Receita de cada dia do mês'}
      onPointerDown={escolher}
      onPointerMove={(ev) => { if (ev.buttons === 1 || ev.pointerType === 'touch') escolher(ev); }}
    >
      <div className="vd-palco-graf">
        <div className="vd-barras">
          {valores.map((v, idx) => {
            const futuro = dias[idx].futuro;
            const h = futuro ? 4 : Math.max(6, (v / max) * 100);
            return <i key={dias[idx].data} className={`${idx === ativo ? 'on' : ''} ${futuro ? 'futuro' : ''}`} style={{ height: `${h}%`, animationDelay: `${Math.min(idx, 22) * 0.028}s` }} />;
          })}
        </div>
        {linha && (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="vd-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E7D7A4" stopOpacity="0.35" />
                <stop offset="1" stopColor="#E7D7A4" stopOpacity="0" />
              </linearGradient>
            </defs>
            {area && <path d={area} className="vd-area" />}
            <path d={linha} pathLength={1} className="vd-linha" />
          </svg>
        )}
      </div>
      {dia && <em className="vd-tip">{dia.futuro ? `Dia ${dia.dia} ainda não chegou` : `Dia ${dia.dia} · ${brl0(valor)}`}</em>}
    </div>
  );
}

function PainelAba({ aba, dir, children }: { aba: string; dir: 'dir' | 'esq'; children: ReactNode }) {
  return <div key={aba} className={`vd-painel ${dir}`} role="tabpanel">{children}</div>;
}

export function PainelVidro({ onSaldo, onRenda, onPagar }: { onSaldo: () => void; onRenda: () => void; onPagar: (id: string) => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const oculto = useOculto();
  const m = (texto: string) => mascarar(texto, oculto);
  const p = useMemo(() => painelVidro(e, hoje), [e, hoje]);
  const [modo, setModo] = useState<'despesa' | 'receita'>('despesa');
  const [aba, setAba] = useState<Aba>('categorias');
  const [dir, setDir] = useState<'dir' | 'esq'>('dir');
  const [dia, setDia] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const gAbas = useRef<HTMLDivElement>(null);
  const gModo = useRef<HTMLDivElement>(null);
  const plAbas = usePilula(gAbas, aba);
  const plModo = usePilula(gModo, modo);
  const saldo = p.kpis.find((k) => k.id === 'saldo')!;
  const faixa = FAIXA.map((id) => p.kpis.find((k) => k.id === id)!);
  const patrimonio = p.kpis.find((k) => k.id === 'patrimonio')!;
  const escolhido: DiaCalor | null = p.calor.find((d) => d.data === dia) ?? null;
  const maxCalor = Math.max(1, ...p.calor.map((d) => d.valor));
  const semSerie = p.dias.every((d) => d.despesa === 0 && d.receita === 0);

  const onda = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (movimentoReduzido() || !raiz.current) return;
    const r = raiz.current.getBoundingClientRect();
    const el = document.createElement('i');
    el.className = 'vd-onda';
    el.style.left = `${ev.clientX - r.left}px`;
    el.style.top = `${ev.clientY - r.top}px`;
    raiz.current.querySelector('.vd-ondas')?.appendChild(el);
    window.setTimeout(() => el.remove(), 700);
  };
  const trocarModo = (proximo: 'despesa' | 'receita') => {
    if (proximo === modo) return;
    setModo(proximo);
    tocar('deslizar');
  };
  const trocarAba = (id: Aba) => {
    if (id === aba) return;
    const ordem = ABAS.map((a) => a.id);
    setDir(ordem.indexOf(id) > ordem.indexOf(aba) ? 'dir' : 'esq');
    setAba(id);
    tocar('deslizar');
  };
  const abrirDia = (data: string, futuro: boolean) => {
    if (futuro) return;
    setDia((atual) => (atual === data ? null : data));
    tocar('pop');
  };

  const kpi = (k: Kpi, n: number) => {
    const miolo = (
      <span>
        <small>{k.rotulo}</small>
        <b>{k.valor === null ? '—' : oculto ? m(brl0(k.valor)) : <Numero valor={k.valor} ms={760} />}</b>
        {k.valor !== null ? <Seta delta={k.delta} bom={k.bomQuando} /> : <em>{k.vazio}</em>}
      </span>
    );
    const estilo = { animationDelay: `${0.18 + n * 0.08}s` };
    if (k.id === 'patrimonio') return null;
    const rota = k.id === 'divida' ? '/plano/dividas' : k.id === 'guardado' ? '/guardar' : '/lancamentos';
    return (
      <Link key={k.id} to={rota} className="vd-vidro vd-kpi" style={estilo} onPointerMove={inclinar} onPointerLeave={soltar}>
        {miolo}
      </Link>
    );
  };

  return (
    <div className="vd" ref={raiz} onPointerDown={onda}>
      <div className="vd-fundo" aria-hidden="true"><i className="vd-blob ouro" /><i className="vd-blob ambar" /><i className="vd-blob violeta" /></div>
      <div className="vd-ondas" aria-hidden="true" />

      <section
        className="vd-vidro vd-hero"
        aria-label="Saldo do mês"
        style={{ animationDelay: '.04s' }}
        onPointerMove={inclinar}
        onPointerLeave={soltar}
      >
        <header>
          <div>
            <small>Saldo do mês</small>
            <b>{saldo.valor === null ? '—' : oculto ? m(brl0(saldo.valor)) : <Numero valor={saldo.valor} ms={1100} />}</b>
            <em>{saldo.valor === null ? saldo.vazio : saldo.extra ?? saldo.nota}</em>
            {saldo.valor !== null && <Seta delta={saldo.delta} bom={saldo.bomQuando} />}
          </div>
          <div className="vd-modo" role="group" aria-label="O que o gráfico mostra" ref={gModo}>
            <i className="vd-pilula-mov" ref={plModo as React.RefObject<HTMLElement>} aria-hidden="true" />
            <button type="button" data-ativo={modo === 'despesa'} className={modo === 'despesa' ? 'on' : ''} aria-pressed={modo === 'despesa'} onClick={() => trocarModo('despesa')}>Despesa</button>
            <button type="button" data-ativo={modo === 'receita'} className={modo === 'receita' ? 'on' : ''} aria-pressed={modo === 'receita'} onClick={() => trocarModo('receita')}>Receita</button>
          </div>
        </header>
        <button type="button" className="vd-hero-acao" onClick={saldo.valor === null ? onRenda : onSaldo}>
          {saldo.valor === null ? 'Informar renda' : 'Ver a conta'}
        </button>
        {semSerie ? <p className="vd-vazio">Quando entrar receita ou gasto, o mês desenha aqui.</p> : <Grafico key={modo} dias={p.dias} modo={modo} />}
      </section>

      <div className="vd-kpis" aria-label="Números do mês">
        {faixa.map((k, n) => kpi(k, n))}
      </div>

      <div className="vd-abas" role="tablist" aria-label="Detalhes do mês" ref={gAbas}>
        <i className="vd-pilula-mov" ref={plAbas as React.RefObject<HTMLElement>} aria-hidden="true" />
        {ABAS.map((item) => (
          <button key={item.id} type="button" role="tab" data-ativo={aba === item.id} aria-selected={aba === item.id} className={aba === item.id ? 'on' : ''} onClick={() => trocarAba(item.id)}>{item.nome}</button>
        ))}
      </div>

      <PainelAba aba={aba} dir={dir}>
        {aba === 'categorias' && (
          <section className="vd-vidro" aria-label="Categorias">
            <header><Titulo texto="Categorias" /><Link to="/plano/orcamento">Limites</Link></header>
            {p.categorias.length === 0 ? <p className="vd-vazio">Nenhuma categoria com gasto ou limite neste mês.</p> : (
              <div className="vd-cats">
                {p.categorias.map((c) => (
                  <article key={c.categoria} className={`vd-cat ${c.tom}`}>
                    <header><b>{c.categoria}</b><span className={`vd-pilula ${c.tom}`}>{c.pilula}</span></header>
                    <p><strong>{m(brl0(c.gasto))}</strong>{c.limite ? <em> de {m(brl0(c.limite))}</em> : <em> sem limite</em>}</p>
                    <span className="vd-trilha" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.pct === null ? 0 : Math.min(100, Math.round(c.pct))} aria-label={`${c.categoria}, ${c.pilula}`}><i style={{ width: `${c.pct === null ? 0 : Math.min(100, c.pct)}%` }} /></span>
                    <small>{c.lancamentos} {c.lancamentos === 1 ? 'lançamento' : 'lançamentos'}{c.topo ? ` · ${c.topo}` : ''}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {aba === 'funil' && (
          <section className="vd-vidro" aria-label="Funil do mês">
            <header><Titulo texto="Para onde foi" /></header>
            {p.funil ? (
              <div className="vd-passos">
                {p.funil.passos.map((passo, n) => (
                  <div key={passo.id} className="vd-passo-wrap" style={{ animationDelay: `${n * 0.07}s` }}>
                    {n > 0 && <span className="vd-segue">{rotuloSegue(p.funil!.segue[n - 1], n === p.funil!.passos.length - 1)}</span>}
                    <article className={`vd-passo ${passo.valor < 0 ? 'falta' : ''}`}>
                      <small>{passo.rotulo}</small>
                      <b>{m(brl0(passo.valor))}</b>
                      {passo.nota && <em>{passo.nota}</em>}
                    </article>
                  </div>
                ))}
              </div>
            ) : <p className="vd-vazio">O funil abre quando houver renda ou gasto neste mês.</p>}
          </section>
        )}

        {aba === 'calendario' && (
          <section className="vd-vidro" aria-label="Calendário de gastos">
            <header><Titulo texto="Calendário" /></header>
            <div className="vd-semana" aria-hidden="true">{SEMANA.map((d, n) => <span key={n}>{d}</span>)}</div>
            <div className="vd-calor">
              {Array.from({ length: p.calor[0]?.semana ?? 0 }, (_, n) => <span key={`v${n}`} />)}
              {p.calor.map((d) => (
                <button
                  key={d.data}
                  type="button"
                  className={`${dia === d.data ? 'on' : ''} ${d.futuro ? 'futuro' : ''}`}
                  style={{ ['--forca' as string]: String(d.valor / maxCalor) }}
                  disabled={d.futuro}
                  aria-pressed={dia === d.data}
                  aria-label={d.futuro ? `Dia ${d.dia}, ainda não chegou` : `Dia ${d.dia}, ${brl0(d.valor)}`}
                  onClick={() => abrirDia(d.data, d.futuro)}
                >{d.dia}</button>
              ))}
            </div>
            {escolhido ? (
              escolhido.itens.length === 0 ? <p className="vd-vazio">Nada anotado em {diaCurto(escolhido.data)}.</p> : (
                <ul className="vd-lista">
                  {escolhido.itens.map((item) => <li key={item.id}><span><b>{item.descricao}</b><small>{item.categoria}</small></span><b>{m(brl0(item.valor))}</b></li>)}
                </ul>
              )
            ) : <p className="vd-vazio">Toque um dia para ver os gastos.</p>}
          </section>
        )}

        {aba === 'movimento' && (
          <div className="vd-movimento">
            <section className="vd-vidro" aria-label="Próximas contas">
              <header><Titulo texto="Próximas contas" /><Link to="/pagar">Ver</Link></header>
              {p.contas.length === 0 ? <p className="vd-vazio">Nada em aberto neste mês.</p> : (
                <ul className="vd-lista">
                  {p.contas.map((c) => (
                    <li key={c.id}>
                      <span><b>{c.nome}</b><small className={`vd-pilula ${c.tom}`}>{c.pilula}</small></span>
                      <button type="button" onClick={() => onPagar(c.id)}>{m(brl0(c.valor))}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="vd-vidro" aria-label="Maiores gastos do mês">
              <header><Titulo texto="Maiores do mês" /></header>
              {p.maiores.length === 0 ? <p className="vd-vazio">Os maiores gastos do mês aparecem aqui.</p> : (
                <ul className="vd-lista">
                  {p.maiores.map((l) => <li key={l.id}><span><b>{l.descricao}</b><small>{l.categoria}</small></span><b>{m(brl0(l.valor))}</b></li>)}
                </ul>
              )}
            </section>
            <section className="vd-vidro" aria-label="Últimos lançamentos">
              <header><Titulo texto="Últimos" /><Link to="/lancamentos">Ver</Link></header>
              {p.ultimos.length === 0 ? <p className="vd-vazio">O último gasto anotado fica aqui.</p> : (
                <ul className="vd-lista">
                  {p.ultimos.slice(0, 4).map((l) => <li key={l.id}><span><b>{l.descricao}</b><small>{diaCurto(l.data)}</small></span><b>{m(brl0(l.valor))}</b></li>)}
                </ul>
              )}
            </section>
            <section className="vd-vidro" aria-label="Metas e patrimônio">
              <header><Titulo texto="Guardado" /><Link to="/guardar">Abrir</Link></header>
              <p className="vd-patrimonio"><b>{patrimonio.valor === null ? '—' : m(brl0(patrimonio.valor))}</b><em>{patrimonio.valor === null ? patrimonio.vazio : patrimonio.nota}</em></p>
              {p.metas.length === 0 && p.dividas.length === 0 ? null : (
                <ul className="vd-lista vd-prog">
                  {p.metas.map((meta) => (
                    <li key={meta.id}>
                      <span><b>{meta.nome}</b><small>{m(brl0(meta.guardado))} de {m(brl0(meta.alvo))}</small></span>
                      <span className="vd-trilha" role="progressbar" aria-valuenow={meta.pct} aria-valuemin={0} aria-valuemax={100} aria-label={meta.nome}><i style={{ width: `${meta.pct}%` }} /></span>
                    </li>
                  ))}
                  {p.dividas.map((d) => (
                    <li key={d.id}>
                      <span><b>{d.nome}</b><small>{m(brl0(d.saldo))} em aberto</small></span>
                      <span className="vd-trilha divida" role="progressbar" aria-valuenow={Math.round(d.pctPago)} aria-valuemin={0} aria-valuemax={100} aria-label={d.nome}><i style={{ width: `${d.pctPago}%` }} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </PainelAba>
    </div>
  );
}
