// O painel do Início no estilo do vídeo de referência (nas cores da Grana Séria): abas, metas à esquerda, funil "da renda ao que sobrou",
// gasto por dia e agenda. Tudo vem do que o app já calcula, e tudo se mexe: barras crescem, números contam, cada toque faz um tique.
import { useEffect, useMemo, useState, type PointerEvent as PE } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, PiggyBank, Receipt, Share2, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { brl0, mesDe, nomeMes } from './datas';
import { useContagem } from './base';
import { painelVidro } from './painelVidro';
import { mascarar, useOculto } from './privacidade';
import { detalheDisponivel, patrimonioGuardado, reservaMeta } from './selectores';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { tocar } from './sons';
import './painelVideo.css';

const ICONE_KPI: Record<string, LucideIcon> = { saldo: Wallet, receitas: TrendingUp, despesas: Receipt, divida: Receipt, guardado: PiggyBank };

function N({ v, oculto }: { v: number; oculto: boolean }) {
  const n = useContagem(v, 900);
  return <>{oculto ? mascarar(brl0(v), true) : brl0(n)}</>;
}

function Linha({ pts, cor }: { pts: number[]; cor: string }) {
  if (pts.length < 2) return <svg className="pv-spk" viewBox="0 0 100 32" aria-hidden="true" />;
  const mn = Math.min(...pts), mx = Math.max(...pts), sp = mx - mn || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * 100, 28 - ((v - mn) / sp) * 24] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const id = `g${cor.replace(/\W/g, '')}`;
  return (
    <svg className="pv-spk" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity=".35" /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L100 32 L0 32 Z`} fill={`url(#${id})`} />
      <path className="lin" d={d} fill="none" stroke={cor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength={1} />
    </svg>
  );
}

export function PainelVideo({ onCompartilhar, onSaldo }: { onCompartilhar: () => void; onSaldo: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const oculto = useOculto();
  const mes = mesDe(hoje);
  const p = useMemo(() => painelVidro(e, hoje), [e, hoje]);
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const [sel, setSel] = useState(0);
  const [dia, setDia] = useState<number | null>(null);
  const saldo = p.kpis.find((k) => k.id === 'saldo')?.valor ?? null;
  const guardado = Math.max(0, patrimonioGuardado(e));
  const meta = reservaMeta(e, mes);
  const reservaPct = meta > 0 ? Math.min(100, Math.round((guardado / meta) * 100)) : 0;
  const f = p.funil;
  const base = Math.max(1, f?.passos[0].valor ?? 1);
  const metas = [
    { id: 'reserva', nome: 'Reserva', pct: reservaPct, sub: meta > 0 ? `${brl0(guardado)} de ${brl0(meta)}` : 'defina quanto você gasta', rota: '/plano/reserva' },
    ...p.metas.map((m) => ({ id: m.id, nome: m.nome, pct: m.pct, sub: `${brl0(m.guardado)} de ${brl0(m.alvo)}`, rota: '/guardar#metas' })),
    ...p.dividas.map((d) => ({ id: d.id, nome: d.nome, pct: Math.round(d.pctPago), sub: `${brl0(d.saldo)} em aberto · já pago`, rota: '/plano/dividas' })),
  ].slice(0, 5);
  const m = (t: string) => (oculto ? mascarar(t, oculto) : t);
  const [cel, setCel] = useState<[number, number] | null>(null);
  // o painel abre com um sopro que sobe e um brilho; só toca depois do primeiro gesto da pessoa
  useEffect(() => { const t = setTimeout(() => tocar('subir'), 120); const t2 = setTimeout(() => tocar('brilho'), 1000); return () => { clearTimeout(t); clearTimeout(t2); }; }, []);
  // o foco de luz dourado segue o cursor dentro de cada cartão
  const seguir = (ev: PE<HTMLDivElement>) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('.pv-p, .pv-kpi');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
    el.style.setProperty('--my', `${ev.clientY - r.top}px`);
  };
  // mapa do mês: semanas nas linhas, dias da semana nas colunas
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
  const maxDia = Math.max(1, ...p.dias.map((d) => d.despesa));
  const media = (() => { const v = p.dias.filter((d) => !d.futuro); return v.length ? Math.round(v.reduce((t, d) => t + d.despesa, 0) / v.length) : 0; })();
  const aba = (rotulo: string, rota: string | null, n?: number) => (rota
    ? <Link key={rotulo} to={rota} onClick={() => tocar('tique2')}>{rotulo}{n ? <em>{n}</em> : null}</Link>
    : <span key={rotulo} className="on" aria-current="page">{rotulo}</span>);
  const abertas = p.contas.length;
  const serieDe = (k: (typeof p.kpis)[number]) => {
    const h = k.serie.map((x) => x.valor);
    if (h.length >= 3) return h;
    const dd = p.dias.filter((d) => !d.futuro);
    let a = 0;
    const acum = (f: (d: (typeof dd)[number]) => number) => dd.map((d) => (a += f(d)));
    a = 0;
    if (k.id === 'despesas') return acum((d) => d.despesa);
    if (k.id === 'receitas') return acum((d) => d.receita);
    if (k.id === 'saldo') return acum((d) => d.receita - d.despesa);
    return [];
  };

  return (
    <div className="pv" onPointerMove={seguir}>
      <i className="pv-halo" aria-hidden="true" /><i className="pv-halo b" aria-hidden="true" />
      <div className="pv-ph">
        <div>
          <h1>Seu mês</h1>
          <p>{nomeMes(mes).split(' ')[0]} · {saldo === null ? 'conte quanto você ganha para ver o saldo' : <>sobrou <b><N v={saldo} oculto={oculto} /></b> até agora</>}{disp.modo !== 'incompleto' && <> · hoje dá para gastar <b>{m(brl0(Math.max(0, disp.porDia)))}</b></>}</p>
        </div>
        <div className="pv-acoes">
          <button type="button" className="pv-b2" onClick={() => { tocar('tique'); onCompartilhar(); }}><Share2 size={15} aria-hidden="true" />Compartilhar</button>
        </div>
      </div>
      <nav className="pv-abas" aria-label="Áreas">
        {aba('Visão geral', null)}{aba('Contas', '/pagar', abertas)}{aba('Gastos', '/gastos')}{aba('Dívidas', '/plano/dividas', p.dividas.length)}{aba('Guardar', '/guardar')}
      </nav>

      <div className="pv-kpis">
        {p.kpis.filter((k) => k.id !== 'patrimonio').slice(0, 4).map((k, i) => {
          const bom = k.delta ? (k.bomQuando === 'sobe' ? k.delta.sentido === 'sobe' : k.delta.sentido === 'desce') : true;
          return (
            <div key={k.id} className={`pv-kpi${i === 0 ? ' ouro' : ''}`} style={{ animationDelay: `${i * 0.08}s` }}>
              <span className="pv-lab">{(() => { const I = ICONE_KPI[k.id] ?? Wallet; return <I size={14} aria-hidden="true" />; })()}{k.rotulo}</span>
              <b>{k.valor === null ? '—' : <N v={k.valor} oculto={oculto} />}</b>
              {k.delta && k.delta.sentido !== 'igual' ? <em className={bom ? 'bom' : 'ruim'}>{k.delta.sentido === 'sobe' ? <ArrowUpRight size={12} aria-hidden="true" /> : <ArrowDownRight size={12} aria-hidden="true" />}{k.delta.pct === null ? '' : `${Math.abs(Math.round(k.delta.pct))}%`} <small>{k.deltaRotulo}</small></em> : <em><small>{k.nota ?? ' '}</small></em>}
              <Linha pts={serieDe(k)} cor={i === 0 ? '#B98A2D' : k.id === 'despesas' ? '#C2493A' : k.id === 'divida' ? '#9A6A1F' : '#1F8A5B'} />
            </div>
          );
        })}
      </div>

      <div className="pv-grade">
        <section className="pv-p pv-metas" aria-label="Suas metas">
          <span className="pv-lab">Suas metas</span>
          {metas.map((x, i) => (
            <Link key={x.id} to={x.rota} className={i === 0 ? 'on' : ''} style={{ animationDelay: `${0.1 + i * 0.07}s` }} onClick={() => tocar('tique')}>
              <span className="r"><b>{x.nome}</b><em>{x.pct}%</em></span>
              <small>{m(x.sub)}</small>
              <span className="mb" aria-hidden="true">{Array.from({ length: 6 }, (_, k) => <i key={k} className={k < Math.round((x.pct / 100) * 6) ? '' : 'z'} style={{ animationDelay: `${0.2 + k * 0.05}s` }} />)}</span>
            </Link>
          ))}
        </section>

        <section className="pv-p pv-funil" aria-label="Da renda ao que sobrou">
          <header><div><h2>Da renda ao que sobrou</h2><p>Para onde foi cada real que entrou em {nomeMes(mes).split(' ')[0].toLowerCase()}</p></div><button type="button" className="pv-chip" onClick={onSaldo}>Como calculei</button></header>
          {f ? (
            <>
              <div className="pv-cols">
                {f.passos.map((ps, i) => {
                  const h = Math.max(ps.valor > 0 ? 4 : 2, Math.min(100, (Math.abs(ps.valor) / base) * 100));
                  const segue = i > 0 ? f.segue[i - 1] : null;
                  return (
                    <button key={ps.id} type="button" className={`pv-col${i === sel ? ' on' : ''}${i === f.passos.length - 1 ? ' fim' : ''}${ps.valor < 0 ? ' neg' : ''}`} onClick={() => { setSel(i); tocar('tique'); }} onPointerEnter={() => { if (i !== sel) tocar('tique2'); }} aria-pressed={i === sel}>
                      <small>{i + 1}. {ps.rotulo}</small>
                      <b>{m(brl0(ps.valor))}</b>
                      <em>{Math.round((ps.valor / base) * 100)}% da renda</em>
                      <span className="box"><i style={{ height: `${h}%`, animationDelay: `${0.15 + i * 0.12}s` }} />{segue !== null && <u>{Math.round(segue)}%</u>}</span>
                    </button>
                  );
                })}
              </div>
              <div className="pv-pe"><span>Toque numa etapa para destacar</span><span><b>{f.passos[sel].rotulo}</b> · {m(brl0(f.passos[sel].valor))}{f.passos[sel].nota ? ` · ${f.passos[sel].nota}` : ''}</span></div>
            </>
          ) : <p className="pv-vazio">O funil abre quando houver renda ou gasto neste mês.</p>}
        </section>
      </div>

      <div className="pv-grade b">
        <section className="pv-p" aria-label="Gasto por dia">
          <h2>Gasto por dia</h2><p className="s">Dia a dia de {nomeMes(mes).split(' ')[0].toLowerCase()} · média {m(brl0(media))}</p>
          {p.dias.every((d) => d.despesa === 0) ? <p className="pv-vazio">Quando você anotar gastos, o mês desenha aqui.</p> : (
            <div className="pv-dias" onPointerLeave={() => setDia(null)}>
              {p.dias.map((d, i) => (
                <button key={d.data} type="button" tabIndex={-1} className={`${d.futuro ? 'f' : ''}${dia === i ? ' on' : ''}`} onPointerEnter={() => !d.futuro && setDia(i)} onClick={() => { setDia(i); tocar('tique2'); }} aria-label={`Dia ${d.dia}: ${brl0(d.despesa)}`}>
                  <i style={{ height: `${d.futuro ? 4 : Math.max(5, (d.despesa / maxDia) * 100)}%`, animationDelay: `${Math.min(i, 24) * 0.025}s` }} />
                  {dia === i && <span className="tip"><b>Dia {d.dia}</b>{m(brl0(d.despesa))}</span>}
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="pv-p" aria-label="Agenda">
          <h2>Agenda</h2><p className="s">O que vence neste mês</p>
          <div className="pv-ag">
            {p.contas.length === 0 ? <p className="pv-vazio">Nada em aberto neste mês.</p> : p.contas.slice(0, 4).map((c, i) => (
              <Link key={c.id} to="/pagar" style={{ animationDelay: `${0.1 + i * 0.07}s` }} onClick={() => tocar('tique')}>
                <span className={`dt ${c.tom}`}><b>{c.dias < 0 ? '!' : c.dias === 0 ? 'hoje' : `+${c.dias}`}</b><small>{c.dias < 0 ? 'ATRASO' : 'DIAS'}</small></span>
                <span><b>{c.nome}</b><small className={c.tom}>{c.pilula}</small></span>
                <span className="vl">{m(brl0(c.valor))}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      {!p.dias.every((d) => d.despesa === 0) && (
        <section className="pv-p pv-cat" aria-label="Mapa do mês">
          <h2>Mapa do mês</h2><p className="s">Cada quadradinho é um dia. Quanto mais dourado, mais você gastou. Toque para ver.</p>
          <div className="pv-mapa" role="table" aria-label="Gasto por dia da semana">
            <span />{['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => <span key={d} role="columnheader">{d}</span>)}
            {mapa.map((sem, a) => (
              <div key={a} style={{ display: 'contents' }} role="row">
                <span className="sem" role="rowheader">Semana {a + 1}</span>
                {sem.map((c, b) => (
                  <button key={b} type="button" role="cell" tabIndex={-1} className={`${c.dia === 0 || c.v === 0 ? 'vz' : ''}${c.fut ? ' fu' : ''}${cel && cel[0] === a && cel[1] === b ? ' on' : ''}`} style={{ ['--k' as string]: (c.v / maxCel).toFixed(3), animationDelay: `${(a * 7 + b) * 0.018}s` }} onPointerEnter={() => { if (c.v > 0) { setCel([a, b]); tocar('celula'); } }} onClick={() => { if (c.v > 0) { setCel([a, b]); tocar('tique2'); } }} aria-label={c.dia ? `Dia ${c.dia}: ${brl0(c.v)}` : ''}>
                    {c.v > 0 ? (c.v >= 1000 ? `${(c.v / 1000).toFixed(1).replace('.', ',')}k` : Math.round(c.v)) : ''}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="pv-mapa-pe">
            <span>{cel ? <><b>Dia {mapa[cel[0]][cel[1]].dia}</b> · {m(brl0(mapa[cel[0]][cel[1]].v))}</> : 'Passe o dedo ou o mouse sobre um dia.'}</span>
            <span className="pv-mapa-esc">menos <i /> mais</span>
          </div>
        </section>
      )}
      {p.categorias.length > 0 && (
        <section className="pv-p pv-cat" aria-label="Para onde vai">
          <h2>Para onde vai o dinheiro</h2><p className="s">Categorias do mês, com o limite de cada uma</p>
          <div className="pv-catl">
            {p.categorias.slice(0, 6).map((c, i) => {
              const tot = Math.max(1, ...p.categorias.map((x) => x.gasto));
              return (
                <Link key={c.categoria} to="/gastos" onClick={() => tocar('tique')} style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
                  <span className="n"><b>{c.categoria}</b><small className={c.tom}>{c.pilula}</small></span>
                  <span className="tr"><i className={c.tom} style={{ width: `${Math.max(3, (c.gasto / tot) * 100)}%`, animationDelay: `${0.2 + i * 0.07}s` }} /></span>
                  <span className="v">{m(brl0(c.gasto))}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
