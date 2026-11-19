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
          </>
        );
        const cls = `pu-kpi ${k.tom ?? ''}`;
        const estilo = { animationDelay: `${0.05 + n * 0.07}s` };
        return k.rota ? <Link key={k.rotulo} to={k.rota} className={cls} style={estilo}>{corpo}</Link> : <div key={k.rotulo} className={cls} style={estilo}>{corpo}</div>;
      })}
    </div>
  );
}

export interface BarraDado { rotulo: string; valor: number; tom?: 'ok' | 'aviso' | 'perigo' | ''; legenda?: string }

/** Barras que crescem, com a legenda do dia tocado. */
export function GraficoBarras({ titulo, sub, dados, mascara, vazio, formato = 'brl' }: { titulo: string; sub?: string; dados: BarraDado[]; mascara?: (t: string) => string; vazio?: string; formato?: 'brl' | 'pontos' | 'pct' }) {
  const [i, setI] = useState<number | null>(null);
  const max = Math.max(formato === 'pct' ? 0.1 : 1, ...dados.map((d) => Math.abs(d.valor)));
  const ativo = i === null ? null : dados[i];
  const dinheiro = (n: number) => (formato === 'pct' ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}%` : formato === 'pontos' ? `${Math.round(n)} pontos` : mascara ? mascara(brl0(n)) : brl0(n));
  return (
    <section className="pu-vidro" aria-label={titulo}>
      <header><h2>{titulo}</h2>{sub && <small>{sub}</small>}</header>
      {dados.every((d) => d.valor === 0) ? <p className="pu-vazio">{vazio ?? 'Quando houver movimento, o gráfico desenha aqui.'}</p> : (
        <>
          <div className={`pu-barras${dados.length <= 8 ? " poucas" : ""}`} role="img" aria-label={titulo} onPointerLeave={() => setI(null)}>
            {dados.map((d, n) => (
              <button key={n} type="button" tabIndex={-1} className={`${d.tom ?? ''}${n === i ? ' on' : ''}`} onPointerEnter={() => setI(n)} onClick={() => { setI(n); tocar('pop'); }} aria-label={`${d.rotulo}: ${dinheiro(d.valor)}`}>
                <i style={{ height: `${Math.max(d.valor !== 0 ? 6 : 2, (Math.abs(d.valor) / max) * 100)}%`, animationDelay: `${Math.min(n, 24) * 0.03}s` }} />
              </button>
            ))}
          </div>
          <div className={`pu-eixo${dados.length <= 8 ? ' cada' : ''}`} aria-hidden="true">
            {dados.length <= 8 ? dados.map((d, n) => <span key={n}>{d.rotulo}</span>) : <><span>{dados[0]?.rotulo}</span><span>{dados[Math.floor(dados.length / 2)]?.rotulo}</span><span>{dados[dados.length - 1]?.rotulo}</span></>}
          </div>
          <p className="pu-tip">{ativo ? `${ativo.legenda ?? ativo.rotulo} · ${dinheiro(ativo.valor)}` : 'Toque numa barra para ver o valor.'}</p>
        </>
      )}
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
