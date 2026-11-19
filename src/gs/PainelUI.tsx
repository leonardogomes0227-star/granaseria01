// Peças do painel em vidro (faixa de números, barras e rosca) para todas as telas do app. Só mostram: quem usa calcula.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { brl0 } from './datas';
import { useContagem } from './base';
import { tocar } from './sons';

export interface ItemKpi {
  rotulo: string;
  /** Número (conta até ele) ou texto pronto. */
  valor: number | string;
  icone: LucideIcon;
  nota?: string;
  tom?: 'ok' | 'aviso' | 'perigo' | '';
  rota?: string;
  /** Como mostrar um número: dinheiro (padrão), inteiro ou porcentagem. */
  formato?: 'brl' | 'int' | 'pct';
  /** Últimos meses, do mais antigo ao mais novo: vira uma linha pequena no cartão. */
  serie?: number[];
  /** O que sobe é bom ('sobe') ou ruim ('desce')? Pinta a variação contra o mês anterior. */
  bom?: 'sobe' | 'desce';
}

/** Variação do último ponto contra o anterior, em %. Sem base para comparar, não inventa. */
export function variacao(serie?: number[]): number | null {
  if (!serie || serie.length < 2) return null;
  const a = serie[serie.length - 1];
  const b = serie[serie.length - 2];
  if (!(Math.abs(b) > 0.5)) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

function Spark({ serie }: { serie: number[] }) {
  if (serie.length < 2) return null;
  const W = 92;
  const H = 30;
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const span = max - min || 1;
  const pts = serie.map((v, i) => [(i / (serie.length - 1)) * W, H - 4 - ((v - min) / span) * (H - 8)] as const);
  const linha = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const ult = pts[pts.length - 1];
  return (
    <svg className="pu-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={`${linha} L${W} ${H} L0 ${H} Z`} className="pu-spark-area" />
      <path d={linha} className="pu-spark-linha" pathLength={1} />
      <circle cx={ult[0]} cy={ult[1]} r="2.8" className="pu-spark-ponto" />
    </svg>
  );
}

function Valor({ v, formato = 'brl', mascara }: { v: number | string; formato?: ItemKpi['formato']; mascara?: (t: string) => string }) {
  const n = useContagem(typeof v === 'number' ? v : 0, 800);
  if (typeof v === 'string') return <>{v}</>;
  const t = formato === 'pct' ? `${Math.round(n)}%` : formato === 'int' ? String(Math.round(n)) : brl0(n);
  return <>{mascara ? mascara(t) : t}</>;
}

/** Quatro números no alto da tela, cada um num cartão de vidro com ícone. */
export function FaixaKpis({ itens, mascara }: { itens: ItemKpi[]; mascara?: (t: string) => string }) {
  return (
    <div className="pu-kpis" aria-label="Números principais">
      {itens.map((k, n) => {
        const corpo = (
          <>
            <small><i className="pu-ico" aria-hidden="true"><k.icone size={15} strokeWidth={2.2} /></i>{k.rotulo}</small>
            <b><Valor v={k.valor} formato={k.formato} mascara={mascara} /></b>
            {k.nota && <em>{k.nota}</em>}
            {(() => {
              const d = variacao(k.serie);
              if (d === null || Math.abs(d) < 1) return null;
              const bom = k.bom ? (d > 0) === (k.bom === 'sobe') : null;
              return <span className={`pu-delta${bom === null ? '' : bom ? ' bom' : ' ruim'}`}>{d > 0 ? '↑' : '↓'} {Math.abs(Math.round(d))}% <small>vs mês passado</small></span>;
            })()}
            {k.serie && <Spark serie={k.serie} />}
          </>
        );
        const cls = `pu-kpi ${k.tom ?? ''}${k.serie && k.serie.length > 1 ? ' com-spark' : ''}`;
        const estilo = { animationDelay: `${0.05 + n * 0.07}s` };
        return k.rota ? <Link key={k.rotulo} to={k.rota} className={cls} style={estilo}>{corpo}</Link> : <div key={k.rotulo} className={cls} style={estilo}>{corpo}</div>;
      })}
    </div>
  );
}

export interface BarraDado { rotulo: string; valor: number; tom?: 'ok' | 'aviso' | 'perigo' | ''; legenda?: string }

const compacto = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(n) >= 10000 ? 0 : 1 })} mil` : String(Math.round(n)));

/** Barras que crescem, com grade discreta, linha da média, valor no topo (poucas barras) e balão no toque. */
export function GraficoBarras({ titulo, sub, dados, mascara, vazio, formato = 'brl' }: { titulo: string; sub?: string; dados: BarraDado[]; mascara?: (t: string) => string; vazio?: string; formato?: 'brl' | 'pontos' | 'pct' }) {
  const [i, setI] = useState<number | null>(null);
  const max = Math.max(formato === 'pct' ? 0.1 : 1, ...dados.map((d) => Math.abs(d.valor)));
  const fmt = (n: number) => (formato === 'pct' ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}%` : formato === 'pontos' ? `${Math.round(n)} pontos` : mascara ? mascara(brl0(n)) : brl0(n));
  const eixo = (n: number) => (formato === 'brl' ? `R$ ${compacto(n)}` : formato === 'pct' ? `${Math.round(n)}%` : String(Math.round(n)));
  const comValor = dados.filter((d) => d.valor !== 0);
  const media = comValor.length > 2 ? comValor.reduce((t, d) => t + Math.abs(d.valor), 0) / comValor.length : null;
  const poucas = dados.length <= 8;
  return (
    <section className="pu-vidro" aria-label={titulo}>
      <header><h2>{titulo}</h2>{sub && <small>{sub}</small>}</header>
      {dados.every((d) => d.valor === 0) ? <p className="pu-vazio">{vazio ?? 'Quando houver movimento, o gráfico desenha aqui.'}</p> : (
        <>
          <div className="pu-quadro">
            <div className="pu-y" aria-hidden="true"><span>{eixo(max)}</span><span>{eixo(max / 2)}</span><span>0</span></div>
            <div className="pu-plano">
              <div className="pu-grade" aria-hidden="true"><i /><i /><i /></div>
              {media !== null && <div className="pu-media" style={{ bottom: `${(media / max) * 100}%` }} aria-hidden="true"><span>média {fmt(media)}</span></div>}
              <div className={`pu-barras${poucas ? ' poucas' : ''}`} role="img" aria-label={titulo} onPointerLeave={() => setI(null)}>
                {dados.map((d, n) => (
                  <button key={n} type="button" tabIndex={-1} className={`${d.tom ?? ''}${n === i ? ' on' : ''}`} onPointerEnter={() => setI(n)} onClick={() => { setI(n); tocar('pop'); }} aria-label={`${d.rotulo}: ${fmt(d.valor)}`}>
                    {poucas && d.valor !== 0 && <em>{formato === 'brl' ? compacto(d.valor) : fmt(d.valor)}</em>}
                    <i style={{ height: `${Math.max(d.valor !== 0 ? 6 : 2, (Math.abs(d.valor) / max) * 100)}%`, animationDelay: `${Math.min(n, 24) * 0.03}s` }} />
                    {n === i && <span className="pu-balao" style={{ left: n > dados.length * 0.7 ? 'auto' : '50%', right: n > dados.length * 0.7 ? 0 : 'auto' }}><b>{d.legenda ?? d.rotulo}</b>{fmt(d.valor)}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={`pu-eixo${poucas ? ' cada' : ''}`} aria-hidden="true">
            {poucas ? dados.map((d, n) => <span key={n}>{d.rotulo}</span>) : <><span>{dados[0]?.rotulo}</span><span>{dados[Math.floor(dados.length / 2)]?.rotulo}</span><span>{dados[dados.length - 1]?.rotulo}</span></>}
          </div>
        </>
      )}
    </section>
  );
}

export interface SerieLinha { nome: string; valores: number[]; cor: string }

/** Linhas no tempo, com cursor e balão que acompanham o dedo, legenda e valor final em cada linha. */
export function GraficoLinha({ titulo, sub, rotulos, series, mascara }: { titulo: string; sub?: string; rotulos: string[]; series: SerieLinha[]; mascara?: (t: string) => string }) {
  const [i, setI] = useState<number | null>(null);
  const n = rotulos.length;
  if (n < 2) return null;
  const W = 320;
  const H = 150;
  const max = Math.max(1, ...series.flatMap((x) => x.valores));
  const X = (k: number) => (k / (n - 1)) * W;
  const Y = (v: number) => H - 6 - (v / max) * (H - 18);
  const fmt = (v: number) => (mascara ? mascara(brl0(v)) : brl0(v));
  const mover = (ev: React.PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setI(Math.min(n - 1, Math.max(0, Math.round(((ev.clientX - r.left) / Math.max(1, r.width)) * (n - 1)))));
  };
  const ativo = i ?? n - 1;
  return (
    <section className="pu-vidro" aria-label={titulo}>
      <header><h2>{titulo}</h2>{sub && <small>{sub}</small>}</header>
      <ul className="pu-legenda">{series.map((x) => <li key={x.nome}><i style={{ background: x.cor }} aria-hidden="true" />{x.nome}<b>{fmt(x.valores[ativo] ?? 0)}</b></li>)}</ul>
      <div className="pu-quadro">
        <div className="pu-y" aria-hidden="true"><span>{`R$ ${compacto(max)}`}</span><span>{`R$ ${compacto(max / 2)}`}</span><span>0</span></div>
        <div className="pu-plano" onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setI(null)} role="img" aria-label={titulo}>
          <div className="pu-grade" aria-hidden="true"><i /><i /><i /></div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>{series.map((x, k) => <linearGradient key={k} id={`pu-ar-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={x.cor} stopOpacity=".28" /><stop offset="1" stopColor={x.cor} stopOpacity="0" /></linearGradient>)}</defs>
            {series.map((x, k) => {
              const d = x.valores.map((v, j) => `${j ? 'L' : 'M'}${X(j).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
              return <g key={x.nome}><path d={`${d} L${W} ${H} L0 ${H} Z`} fill={`url(#pu-ar-${k})`} /><path d={d} className="pu-traco" stroke={x.cor} pathLength={1} /></g>;
            })}
          </svg>
          {i !== null && <i className="pu-cursor" style={{ left: `${(X(i) / W) * 100}%` }} aria-hidden="true" />}
          {series.map((x) => <i key={x.nome} className="pu-ponto" style={{ left: `${(X(ativo) / W) * 100}%`, top: `${(Y(x.valores[ativo] ?? 0) / H) * 100}%`, background: x.cor }} aria-hidden="true" />)}
        </div>
      </div>
      <div className="pu-eixo cada mes" aria-hidden="true">{rotulos.map((r, k) => <span key={k} className={k === ativo ? 'on' : ''}>{r}</span>)}</div>
    </section>
  );
}

/** Mapa de calor como no vídeo: linhas (categorias) × colunas (meses), quanto mais forte a cor, mais dinheiro. */
export function Heatmap({ titulo, sub, linhas, colunas, valores, mascara }: { titulo: string; sub?: string; linhas: string[]; colunas: string[]; valores: number[][]; mascara?: (t: string) => string }) {
  const [sel, setSel] = useState<[number, number] | null>(null);
  const max = Math.max(1, ...valores.flat());
  const fmt = (v: number) => (mascara ? mascara(brl0(v)) : brl0(v));
  if (linhas.length === 0 || valores.flat().every((v) => v === 0)) return null;
  return (
    <section className="pu-vidro" aria-label={titulo}>
      <header><h2>{titulo}</h2>{sub && <small>{sub}</small>}</header>
      <div className="pu-mapa" style={{ gridTemplateColumns: `minmax(78px, 1.3fr) repeat(${colunas.length}, minmax(34px, 1fr))` }} role="table" aria-label={titulo}>
        <span />
        {colunas.map((c) => <span key={c} className="pu-mapa-col" role="columnheader">{c}</span>)}
        {linhas.map((l, a) => (
          <div key={l} style={{ display: 'contents' }} role="row">
            <span className="pu-mapa-lin" role="rowheader">{l}</span>
            {colunas.map((c, b) => {
              const v = valores[a]?.[b] ?? 0;
              const k = v / max;
              return (
                <button key={c} type="button" role="cell" className={`pu-cel${sel && sel[0] === a && sel[1] === b ? ' on' : ''}${v === 0 ? ' zero' : ''}`} style={{ ['--k' as string]: k.toFixed(3), animationDelay: `${(a * colunas.length + b) * 0.012}s` }} onClick={() => { setSel([a, b]); tocar('pop'); }} onPointerEnter={() => setSel([a, b])} aria-label={`${l}, ${c}: ${fmt(v)}`}>
                  {v > 0 ? compacto(v) : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="pu-tip">{sel ? `${linhas[sel[0]]} · ${colunas[sel[1]]} · ${fmt(valores[sel[0]]?.[sel[1]] ?? 0)}` : 'Toque numa célula para ver o valor.'}</p>
    </section>
  );
}

export interface Fatia { nome: string; valor: number; cor: string }

/** Rosca com o total no meio e a lista ao lado. */
export function Rosca({ titulo, sub, fatias, centro, mascara }: { titulo: string; sub?: string; fatias: Fatia[]; centro: ReactNode; mascara?: (t: string) => string }) {
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let acum = 0;
  const dinheiro = (n: number) => (mascara ? mascara(brl0(n)) : brl0(n));
  return (
    <section className="pu-vidro" aria-label={titulo}>
      <header><h2>{titulo}</h2>{sub && <small>{sub}</small>}</header>
      {total <= 0 ? <p className="pu-vazio">Nenhum gasto anotado neste mês.</p> : (
        <div className="pu-rosca">
          <div className="pu-anel">
            <svg viewBox="0 0 140 140" aria-hidden="true">
              <circle cx="70" cy="70" r={R} className="pu-trilha" />
              {fatias.map((f, n) => {
                const len = (f.valor / total) * C;
                const el = <circle key={f.nome} cx="70" cy="70" r={R} className="pu-fatia" stroke={f.cor} strokeDasharray={`${Math.max(0, len - 3)} ${C}`} strokeDashoffset={-acum} style={{ animationDelay: `${n * 0.08}s` }} />;
                acum += len;
                return el;
              })}
            </svg>
            <div className="pu-centro">{centro}</div>
          </div>
          <ul>
            {fatias.map((f) => (
              <li key={f.nome}><i style={{ background: f.cor }} aria-hidden="true" /><span>{f.nome}</span><b>{dinheiro(f.valor)}</b></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
