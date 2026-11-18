import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { brl0, diaCurto, mesCurto } from './datas';
import { painelVidro, type Delta, type DiaCalor, type Kpi } from './painelVidro';
import { mascarar, useOculto } from './privacidade';
import { useEstado } from './store';
import { tocar } from './sons';
import { useHoje } from './useHoje';
import { useContagem } from './base';
import './vidro.css';

const SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function rotuloSegue(pct: number | null | undefined, daReceita: boolean): string {
  if (pct === null || pct === undefined) return '—';
  return `${Math.round(pct)}% ${daReceita ? 'da receita' : 'segue'}`;
}

function movimentoReduzido(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function Numero({ valor }: { valor: number }) {
  const n = useContagem(valor, 720);
  return <>{brl0(n)}</>;
}

function Seta({ delta, bom, rotulo }: { delta: Delta | null; bom: 'sobe' | 'desce'; rotulo: string | null }) {
  if (!delta) return <small className="vd-delta sem">sem mês anterior</small>;
  const bomAgora = delta.sentido === 'igual' || delta.sentido === bom;
  const cls = delta.sentido === 'igual' ? 'igual' : bomAgora ? 'bom' : 'ruim';
  const seta = delta.sentido === 'sobe' ? '↑' : delta.sentido === 'desce' ? '↓' : '→';
  const pct = delta.pct === null ? '' : ` ${Math.abs(Math.round(delta.pct))}%`;
  return <span className="vd-delta-linha"><small className={`vd-delta ${cls}`}>{seta}{pct}</small>{rotulo && <em>{rotulo}</em>}</span>;
}

function Faisca({ pontos, bom }: { pontos: number[]; bom: 'sobe' | 'desce' }) {
  if (pontos.length < 2) return <span className="vd-faisca vazia" aria-hidden="true" />;
  const max = Math.max(...pontos);
  const min = Math.min(...pontos);
  const h = 28;
  const w = 84;
  const y = (v: number) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const d = pontos.map((v, i) => `${i ? 'L' : 'M'}${((i / (pontos.length - 1)) * w).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const sobe = pontos[pontos.length - 1] >= pontos[0];
  const tom = sobe === (bom === 'sobe') ? 'bom' : 'ruim';
  return (
    <svg className={`vd-faisca ${tom}`} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Vista({ chave, children }: { chave: string; children: ReactNode }) {
  const reduz = movimentoReduzido();
  const chaveRef = useRef(chave);
  const nodeRef = useRef(children);
  const atualRef = useRef(children);
  const timer = useRef(0);
  const [sai, setSai] = useState<ReactNode>(null);
  atualRef.current = children;
  if (chaveRef.current === chave) nodeRef.current = children;
  useEffect(() => {
    if (chaveRef.current === chave) return;
    const antigo = nodeRef.current;
    chaveRef.current = chave;
    nodeRef.current = atualRef.current;
    if (reduz) return;
    setSai(antigo);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSai(null), 320);
  }, [chave, reduz]);
  return (
    <div className="vd-vista">
      {sai && <div className="vd-sai" aria-hidden="true">{sai}</div>}
      <div key={chave} className={reduz ? undefined : 'vd-entra'}>{children}</div>
    </div>
  );
}

function Grafico({ dias, modo }: { dias: { dia: number; data: string; despesa: number; receita: number; futuro: boolean }[]; modo: 'despesa' | 'receita' }) {
  const [i, setI] = useState<number | null>(null);
  const valores = dias.map((d) => (modo === 'despesa' ? d.despesa : d.receita));
  const max = Math.max(1, ...dias.filter((d) => !d.futuro).map((d) => (modo === 'despesa' ? d.despesa : d.receita)));
  const escolher = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const idx = Math.min(dias.length - 1, Math.max(0, Math.floor(((ev.clientX - r.left) / Math.max(1, r.width)) * dias.length)));
    setI(idx);
  };
  const ultimoPassado = dias.reduce((acc, d, idx) => (d.futuro ? acc : idx), -1);
  const ativo = i ?? ultimoPassado;
  const dia = ativo >= 0 ? dias[ativo] : null;
  const valor = dia ? (modo === 'despesa' ? dia.despesa : dia.receita) : 0;
  return (
    <div
      className="vd-scroll"
      tabIndex={0}
      role="img"
      aria-label={modo === 'despesa' ? 'Gasto de cada dia do mês' : 'Receita de cada dia do mês'}
      onPointerDown={escolher}
      onPointerMove={(ev) => { if (ev.buttons === 1 || ev.pointerType === 'touch') escolher(ev); }}
      onKeyDown={(ev) => {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        ev.preventDefault();
        setI((atual) => {
          const base = atual ?? Math.max(0, ativo);
          return Math.min(dias.length - 1, Math.max(0, base + (ev.key === 'ArrowRight' ? 1 : -1)));
        });
      }}
    >
      <div className="vd-barras" style={{ minWidth: Math.max(dias.length * 16, 280) }}>
        {valores.map((v, n) => {
          const futuro = dias[n].futuro;
          const h = futuro ? 6 : Math.max(4, (v / max) * 100);
          return <i key={dias[n].data} className={`${n === ativo ? 'on' : ''} ${futuro ? 'futuro' : ''}`} style={{ height: `${h}%`, animationDelay: `${Math.min(n, 18) * 0.045}s` }} />;
        })}
      </div>
      {dia && <em className="vd-tip">{dia.futuro ? `Dia ${dia.dia} ainda não chegou` : `Dia ${dia.dia} · ${brl0(valor)}`}</em>}
    </div>
  );
}

export function PainelVidro({ onSaldo, onRenda, onPagar }: { onSaldo: () => void; onRenda: () => void; onPagar: (id: string) => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const oculto = useOculto();
  const m = (texto: string) => mascarar(texto, oculto);
  const p = useMemo(() => painelVidro(e, hoje), [e, hoje]);
  const [modo, setModo] = useState<'despesa' | 'receita'>('despesa');
  const [dia, setDia] = useState<string | null>(null);
  const [ondas, setOndas] = useState<{ id: number; x: number; y: number }[]>([]);
  const seq = useRef(0);
  const raiz = useRef<HTMLDivElement>(null);
  const escolhido: DiaCalor | null = p.calor.find((d) => d.data === dia) ?? null;
  const maxCalor = Math.max(1, ...p.calor.map((d) => d.valor));

  const onda = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (movimentoReduzido() || !raiz.current) return;
    const r = raiz.current.getBoundingClientRect();
    const id = ++seq.current;
    setOndas((lista) => [...lista.slice(-5), { id, x: ev.clientX - r.left, y: ev.clientY - r.top }]);
    window.setTimeout(() => setOndas((lista) => lista.filter((o) => o.id !== id)), 640);
  };
  const trocarModo = (proximo: 'despesa' | 'receita') => {
    if (proximo === modo) return;
    setModo(proximo);
    tocar('pop');
  };
  const abrirDia = (data: string, futuro: boolean) => {
    if (futuro) return;
    setDia((atual) => (atual === data ? null : data));
    tocar('pop');
  };

  const kpiLink = (k: Kpi, n: number, miolo: ReactNode) => {
    const estilo = { animationDelay: `${n * 0.07}s` };
    if (k.id === 'saldo') {
      return <button type="button" className="vd-card vd-kpi" style={estilo} onClick={k.valor === null ? onRenda : onSaldo}>{miolo}</button>;
    }
    const rota = k.id === 'divida' ? '/plano/dividas' : k.id === 'guardado' || k.id === 'patrimonio' ? '/guardar' : '/lancamentos';
    return <Link to={rota} className="vd-card vd-kpi" style={estilo}>{miolo}</Link>;
  };

  return (
    <div className="vd" ref={raiz} onPointerDown={onda}>
      <div className="vd-ondas" aria-hidden="true">{ondas.map((o) => <i key={o.id} className="vd-onda" style={{ left: o.x, top: o.y }} />)}</div>

      <div className="vd-kpis">
        {p.kpis.map((k, n) => kpiLink(k, n, (
          <span>
            <small>{k.rotulo}</small>
            <b>{k.valor === null ? '—' : <span className="vd-num">{oculto ? m(brl0(k.valor)) : <Numero valor={k.valor} />}</span>}</b>
            {k.valor !== null && <Seta delta={k.delta} bom={k.bomQuando} rotulo={k.deltaRotulo} />}
            {k.extra && <em>{k.extra}</em>}
            {k.valor !== null && k.nota && <em>{k.nota}</em>}
            {k.valor === null && k.vazio && <em className="vd-vazio-txt">{k.vazio}</em>}
            <Faisca pontos={k.serie.map((s) => s.valor)} bom={k.bomQuando} />
          </span>
        )))}
      </div>

      <div className="vd-meio">
        <section className="vd-card vd-grafico" aria-label="Série do mês">
          <header>
            <h2>O mês</h2>
            <div role="group" aria-label="O que o gráfico mostra">
              <button type="button" className={modo === 'despesa' ? 'on' : ''} aria-pressed={modo === 'despesa'} onClick={() => trocarModo('despesa')}>Despesa</button>
              <button type="button" className={modo === 'receita' ? 'on' : ''} aria-pressed={modo === 'receita'} onClick={() => trocarModo('receita')}>Receita</button>
            </div>
          </header>
          {p.dias.every((d) => d.despesa === 0 && d.receita === 0) ? <p className="vd-vazio">Quando entrar receita ou gasto, cada dia vira uma barra.</p> : (
            <Vista chave={modo}><Grafico dias={p.dias} modo={modo} /></Vista>
          )}
        </section>

        <section className="vd-card" aria-label="Funil do mês">
          <header><h2>Para onde foi</h2></header>
          {p.funil ? (
            <div className="vd-passos">
              {p.funil.passos.map((passo, n) => (
                <div key={passo.id} className="vd-passo-wrap">
                  {n > 0 && <span className="vd-segue">{rotuloSegue(p.funil!.segue[n - 1], n === p.funil!.passos.length - 1)}</span>}
                  <article className={`vd-passo ${passo.valor < 0 ? 'falta' : ''}`} style={{ animationDelay: `${n * 0.08}s` }}>
                    <small>{passo.rotulo}</small>
                    <b>{m(brl0(passo.valor))}</b>
                    {passo.nota && <em>{passo.nota}</em>}
                  </article>
                </div>
              ))}
            </div>
          ) : <p className="vd-vazio">O funil abre quando houver renda ou gasto neste mês.</p>}
        </section>
      </div>

      <div className="vd-baixo">
        <section className="vd-card" aria-label="Categorias">
          <header><h2>Categorias</h2><Link to="/plano/orcamento">Limites</Link></header>
          {p.categorias.length === 0 ? <p className="vd-vazio">Nenhuma categoria com gasto ou limite neste mês.</p> : (
            <div className="vd-cats">
              {p.categorias.map((c, n) => (
                <article key={c.categoria} className={`vd-cat ${c.tom}`} style={{ animationDelay: `${n * 0.06}s` }}>
                  <header>
                    <b>{c.categoria}</b>
                    <span className={`vd-pilula ${c.tom}`}>{c.pilula}</span>
                  </header>
                  <p><strong>{m(brl0(c.gasto))}</strong>{c.limite ? <em> de {m(brl0(c.limite))}</em> : <em> sem limite</em>}</p>
                  <span className="vd-trilha" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.pct === null ? 0 : Math.min(100, Math.round(c.pct))} aria-label={`${c.categoria}, ${c.pilula}`}><i style={{ width: `${c.pct === null ? 0 : Math.min(100, c.pct)}%` }} /></span>
                  <small>{c.lancamentos} {c.lancamentos === 1 ? 'lançamento' : 'lançamentos'}{c.topo ? ` · ${c.topo}` : ''}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="vd-card" aria-label="Calendário de gastos">
          <header><h2>Calendário</h2></header>
          <div className="vd-semana" aria-hidden="true">{SEMANA.map((d, n) => <span key={n}>{d}</span>)}</div>
          <div className="vd-calor">
            {Array.from({ length: p.calor[0]?.semana ?? 0 }, (_, n) => <span key={`v${n}`} />)}
            {p.calor.map((d, n) => (
              <button
                key={d.data}
                type="button"
                className={`${dia === d.data ? 'on' : ''} ${d.futuro ? 'futuro' : ''}`}
                style={{ animationDelay: `${Math.min(n, 24) * 0.02}s`, ['--forca' as string]: String(d.valor / maxCalor) }}
                disabled={d.futuro}
                aria-pressed={dia === d.data}
                aria-label={d.futuro ? `Dia ${d.dia}, ainda não chegou` : `Dia ${d.dia}, ${brl0(d.valor)}`}
                onClick={() => abrirDia(d.data, d.futuro)}
              >{d.dia}</button>
            ))}
          </div>
          <Vista chave={escolhido?.data ?? 'nenhum'}>
            {escolhido ? (
              escolhido.itens.length === 0 ? <p className="vd-vazio">Nada anotado em {diaCurto(escolhido.data)}.</p> : (
                <ul className="vd-dia">
                  {escolhido.itens.map((item) => <li key={item.id}><span><b>{item.descricao}</b><small>{item.categoria}</small></span><b>{m(brl0(item.valor))}</b></li>)}
                </ul>
              )
            ) : <p className="vd-vazio">Toque um dia para ver os gastos.</p>}
          </Vista>
        </section>
      </div>

      <div className="vd-listas">
        <section className="vd-card" aria-label="Próximas contas">
          <header><h2>Próximas contas</h2><Link to="/pagar">Ver</Link></header>
          {p.contas.length === 0 ? <p className="vd-vazio">Nada em aberto neste mês.</p> : (
            <ul>
              {p.contas.map((c) => (
                <li key={c.id}>
                  <span><b>{c.nome}</b><small className={`vd-pilula ${c.tom}`}>{c.pilula}</small></span>
                  <button type="button" onClick={() => onPagar(c.id)}>{m(brl0(c.valor))}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="vd-card" aria-label="Últimos lançamentos">
          <header><h2>Últimos lançamentos</h2><Link to="/lancamentos">Ver</Link></header>
          {p.ultimos.length === 0 ? <p className="vd-vazio">O último gasto anotado fica aqui.</p> : (
            <ul>
              {p.ultimos.map((l) => <li key={l.id}><span><b>{l.descricao}</b><small>{diaCurto(l.data)} · {l.categoria}</small></span><b>{m(brl0(l.valor))}</b></li>)}
            </ul>
          )}
        </section>

        <section className="vd-card" aria-label="Maiores gastos do mês">
          <header><h2>Maiores do mês</h2></header>
          {p.maiores.length === 0 ? <p className="vd-vazio">Os maiores gastos do mês aparecem aqui.</p> : (
            <ul>
              {p.maiores.map((l) => <li key={l.id}><span><b>{l.descricao}</b><small>{l.categoria}</small></span><b>{m(brl0(l.valor))}</b></li>)}
            </ul>
          )}
        </section>

        <section className="vd-card" aria-label="Metas e dívidas">
          <header><h2>Metas e dívidas</h2><Link to="/guardar">Guardar</Link></header>
          {p.metas.length === 0 && p.dividas.length === 0 ? <p className="vd-vazio">Uma meta ou uma dívida mostra o progresso aqui.</p> : (
            <ul className="vd-prog">
              {p.metas.map((meta) => (
                <li key={meta.id}>
                  <span><b>{meta.nome}</b><small>{m(brl0(meta.guardado))} de {m(brl0(meta.alvo))}</small></span>
                  <span className="vd-trilha" role="progressbar" aria-valuenow={meta.pct} aria-valuemin={0} aria-valuemax={100} aria-label={meta.nome}><i style={{ width: `${meta.pct}%` }} /></span>
                </li>
              ))}
              {p.dividas.map((d) => (
                <li key={d.id}>
                  <span><b>{d.nome}</b><small>{m(brl0(d.saldo))} em aberto · {Math.round(d.pctPago)}% pago</small></span>
                  <span className="vd-trilha divida" role="progressbar" aria-valuenow={Math.round(d.pctPago)} aria-valuemin={0} aria-valuemax={100} aria-label={d.nome}><i style={{ width: `${d.pctPago}%` }} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="vd-nota">Barras de {mesCurto(hoje.slice(0, 7))}. Nada aqui é estimado sem estar escrito no cartão.</p>
    </div>
  );
}
