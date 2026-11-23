// Seções do Início logo abaixo da carteira, como na referência: Contas Bancárias (com mini-gráfico), Meta de Gastos e Últimas Transações.
// Cada uma leva para a tela completa: o Início resume tudo, as outras telas completam.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Compass, Landmark, PiggyBank, Target } from 'lucide-react';
import { brl, brl0, diaCurto, mesDe } from './datas';
import { iconeDe } from './categorias';
import { objetivosDaPessoa } from './objetivos';
import { movimentosDoMes } from './movimentos';
import { mascarar, useOculto } from './privacidade';
import { detalheDisponivel, totalVariaveis } from './selectores';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { useContagem } from './base';
import { ReservaOuro } from './ReservaOuro';

function Linha({ serie, bom }: { serie: number[]; bom: boolean }) {
  if (serie.length < 2) return null;
  const W = 120; const H = 44;
  const min = Math.min(...serie); const max = Math.max(...serie); const span = max - min || 1;
  const pts = serie.map((v, i) => [(i / (serie.length - 1)) * W, H - 6 - ((v - min) / span) * (H - 12)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const cor = bom ? '#3DDC97' : '#F27B6B';
  return (
    <svg className="si-linha" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs><linearGradient id={`si-${bom ? 'b' : 'r'}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity=".3" /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={`url(#si-${bom ? 'b' : 'r'})`} />
      <path d={d} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="si-traco" />
    </svg>
  );
}

function Saldo({ v, oculto }: { v: number; oculto: boolean }) {
  const n = useContagem(v, 800);
  return <>{oculto ? mascarar(brl0(v), true) : brl0(n)}</>;
}
function Pct({ v }: { v: number }) {
  const n = useContagem(v, 800);
  return <>{Math.round(n)}%</>;
}

export function SecoesInicio() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const objetivos = useMemo(() => objetivosDaPessoa(e, hoje), [e, hoje]);
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const gasto = totalVariaveis(e, mes);
  const limites = Object.values(e.limites).reduce((t, v) => t + (v > 0 ? v : 0), 0);
  const teto = limites > 0 ? limites : Math.max(0, gasto + Math.max(0, disp.livre));
  const pct = teto > 0 ? Math.min(100, (gasto / teto) * 100) : 0;
  const ultimos = useMemo(() => movimentosDoMes(e, mes).filter((m) => !m.neutro).slice(0, 5), [e, mes]);
  const m = (t: string) => (oculto ? mascarar(t, true) : t);

  return (
    <div className="si">
      <section aria-label="Meus objetivos">
        <header className="si-cab"><h2>Meus objetivos</h2><Link to="/guardar">Ver todos<ChevronRight size={16} aria-hidden="true" /></Link></header>
        <div className="si-faixa">
          {objetivos.map((o, i) => {
            const Icone = o.tipo === 'reserva' ? PiggyBank : o.tipo === 'meta' ? Target : o.tipo === 'divida' ? Landmark : Compass;
            const sobe = o.serie.length < 2 || o.serie[o.serie.length - 1] >= o.serie[0];
            return (
              <Link key={o.id} to={o.rota} className={`si-obj ${o.tipo}`} style={{ animationDelay: `${i * 0.07}s` }}>
                <div className="si-obj-topo"><i aria-hidden="true"><Icone size={18} /></i><span>{o.nome}</span></div>
                <div className="si-obj-meio">
                  <b>{o.formato === 'pct' ? <Pct v={o.valor} /> : <Saldo v={o.valor} oculto={oculto} />}</b>
                  <Linha serie={o.serie} bom={o.tipo === 'divida' ? true : sobe} />
                </div>
                <div className="si-obj-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(o.pct)} aria-label={`${o.nome}: ${Math.round(o.pct)}%`}><i style={{ width: `${Math.max(3, o.pct)}%` }} /></div>
                <small>{Math.round(o.pct)}% {o.tipo === 'divida' ? 'já pago' : o.tipo === 'liberdade' ? 'do caminho' : 'do caminho'} · {o.nota}</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="si-meta" aria-label="Meta de gastos">
        <header className="si-cab"><h2>Meta de gastos</h2><Link to="/plano/orcamento">Ajustar<ChevronRight size={16} aria-hidden="true" /></Link></header>
        <div className="si-cartao">
          <div className="si-trilho" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Quanto da meta de gastos já foi usado">
            <i style={{ width: `${Math.max(3, pct)}%` }} className={pct > 100 ? 'estourou' : pct >= 80 ? 'alerta' : ''} />
            <b style={{ left: `${Math.max(3, Math.min(97, pct))}%` }} aria-hidden="true" />
          </div>
          <div className="si-valores"><span>Meta de gastos</span><b>{m(brl0(gasto))}<em> / {m(brl0(teto))}</em></b></div>
        </div>
      </section>

      <ReservaOuro />

      <section aria-label="Últimas transações">
        <header className="si-cab"><h2>Últimas transações</h2><Link to="/lancamentos">Ver todas<ChevronRight size={16} aria-hidden="true" /></Link></header>
        {ultimos.length === 0 ? <p className="si-sem">Nada anotado neste mês ainda. Toque em <b>+ Gasto</b> e leva 5 segundos.</p> : (
          <ul className="si-lista">
            {ultimos.map((t, i) => {
              const Icone = iconeDe(t.categoria);
              return (
                <li key={t.chave} style={{ animationDelay: `${i * 0.06}s` }}>
                  <i aria-hidden="true"><Icone size={18} /></i>
                  <span><b>{t.descricao || t.categoria}</b><small>{t.categoria} · {diaCurto(t.data)}</small></span>
                  <strong className={t.entrada ? 'bom' : ''}>{t.entrada ? '+' : '−'} {m(brl(t.valor))}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
