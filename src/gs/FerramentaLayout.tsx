// Toda ferramenta no jeito do Funil: a lista das ferramentas da mesma área à esquerda (cada uma com o seu estado)
// e o painel grande à direita com a ferramenta de verdade. Não mexe em nada do que a ferramenta faz.
import { useMemo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FERRAMENTAS, NOME_AREA, type Ferramenta } from './registroFerramentas';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { tocar } from './sons';

const semAncora = (r: string) => r.split(/[?#]/)[0];
const AREAS_COM_LISTA = new Set(['/plano/', '/investir']);

export function FerramentaLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const e = useEstado();
  const hoje = useHoje();
  const atual = useMemo<Ferramenta | undefined>(() => (
    [...AREAS_COM_LISTA].some((p) => pathname.startsWith(p)) ? FERRAMENTAS.find((f) => semAncora(f.rota) === pathname) : undefined
  ), [pathname]);
  const irmas = useMemo(() => {
    if (!atual) return [];
    const vistas = new Set<string>();
    return FERRAMENTAS.filter((f) => f.area === atual.area && semAncora(f.rota).startsWith('/') && (semAncora(f.rota).startsWith('/plano/') || semAncora(f.rota) === '/investir') && !vistas.has(semAncora(f.rota)) && vistas.add(semAncora(f.rota)));
  }, [atual]);
  if (!atual || irmas.length < 2) return <>{children}</>;
  return (
    <div className="rv-ferr">
      <aside className="pv-p pv-metas rv-ferr-lista rv-card" style={{ ['--i' as string]: 0 }} aria-label={`Ferramentas de ${NOME_AREA[atual.area]}`}>
        <span className="pv-lab">{NOME_AREA[atual.area]} · ferramentas</span>
        {irmas.map((f, i) => {
          const st = f.status(e, hoje);
          const on = semAncora(f.rota) === pathname;
          return (
            <Link key={f.id} to={f.rota} className={`rv-funil${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} style={{ ['--i' as string]: i + 1 }} onClick={() => tocar('tique')} onPointerEnter={() => { if (!on) tocar('tique2'); }}>
              <span className="r"><b>{f.titulo}</b></span>
              <span className="r s"><small className={`rv-st ${st.tom}`}>{st.texto}</small></span>
            </Link>
          );
        })}
      </aside>
      <section className="pv-p rv-ferr-painel rv-card" style={{ ['--i' as string]: 1 }}>
        <nav className="gs-migalhas" aria-label="Você está em">
          <Link to="/">Início</Link>
          <span aria-hidden="true"> / </span>
          <Link to="/ferramentas">{NOME_AREA[atual.area]}</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{atual.titulo}</span>
        </nav>
        {children}
      </section>
    </div>
  );
}
