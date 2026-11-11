import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid, Search, UserRound } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { FERRAMENTAS, type Ferramenta } from './registroFerramentas';
import { ICONES } from './base';
import { abrirResolver } from './Resolver';
import { getName } from '../painel';
import { brl0 } from './datas';

/* ---------- Mais: todas as ferramentas do app, agrupadas por o que a pessoa quer fazer ---------- */
// Nada sai do app: cada ferramenta do registro cai em um dos três grupos. O que não estiver na lista de
// "Planejar" ou "Acompanhar" cai em "Configurar e outros", então uma ferramenta nova nunca fica sem lugar.

export type GrupoMais = 'planejar' | 'acompanhar' | 'configurar';

const PLANEJAR = ['metas', 'reserva', 'investir', 'renda', 'extras', 'orcamento', 'cortar', 'assinaturas', 'comprar', 'parcelado', 'emprestimos', 'longo-prazo', 'placar', 'recuperacao', 'atrasos', 'anotar-atraso', 'dividas', 'cartao', 'caminho', 'meu-plano', 'coach'];
const ACOMPANHAR = ['relatorios', 'checkin', 'saude', 'lancamentos', 'carteiras', 'contas', 'calendario', 'fatura', 'selos'];

export const grupoDaFerramenta = (id: string): GrupoMais => (PLANEJAR.includes(id) ? 'planejar' : ACOMPANHAR.includes(id) ? 'acompanhar' : 'configurar');

const GRUPOS_MAIS: { id: GrupoMais; titulo: string; sub: string }[] = [
  { id: 'planejar', titulo: 'Planejar', sub: 'Metas, reserva, investimentos e como sair do aperto' },
  { id: 'acompanhar', titulo: 'Acompanhar', sub: 'Veja como você está indo e como fechou o mês' },
  { id: 'configurar', titulo: 'Configurar e outros', sub: 'Seus dados, lembretes, WhatsApp, planos e ajuda' },
];

/** A ordem de cada grupo é a da lista acima (o que mais se usa primeiro); o que não está nela vem depois, na ordem do registro. */
function ordenar(g: GrupoMais, fs: Ferramenta[]): Ferramenta[] {
  const lista = g === 'planejar' ? PLANEJAR : g === 'acompanhar' ? ACOMPANHAR : [];
  const pos = (id: string) => { const i = lista.indexOf(id); return i < 0 ? 999 : i; };
  return [...fs].sort((a, b) => pos(a.id) - pos(b.id));
}

export function Mais() {
  const e = useEstado();
  const hoje = useHoje();
  const nome = e.config.nome || getName() || '';
  const grupos = useMemo(
    () => GRUPOS_MAIS.map((g) => ({ ...g, itens: ordenar(g.id, FERRAMENTAS.filter((f) => grupoDaFerramenta(f.id) === g.id)).map((f) => ({ f, st: f.status(e, hoje) })) })),
    [e, hoje],
  );
  return (
    <>
      <h1 className="gs-titulo">Mais</h1>
      <p className="gs-sub">Tudo o que o Grana Séria faz, em três grupos.</p>

      <Link to="/dados" className="ms-perfil">
        <i aria-hidden="true"><UserRound size={22} strokeWidth={1.9} /></i>
        <span><b>{nome || 'Meus dados'}</b><small>{e.config.renda > 0 ? `Renda de ${brl0(e.config.renda)} por mês` : 'Informe sua renda para eu calcular tudo'}</small></span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>

      <button type="button" className="cm-busca" onClick={abrirResolver}><Search size={20} aria-hidden="true" />O que você quer resolver?</button>

      {grupos.map((g) => (
        <section key={g.id} className="ms-grupo" aria-labelledby={`ms-${g.id}`}>
          <h2 id={`ms-${g.id}`}>{g.titulo}</h2>
          <p>{g.sub}</p>
          <div className="ms-lista" role="list">
            {g.itens.map(({ f, st }) => {
              const I = ICONES[f.icone] ?? ChevronRight;
              return (
                <Link key={f.id} to={f.rota} role="listitem" className="ms-linha">
                  <i aria-hidden="true"><I size={20} strokeWidth={1.9} /></i>
                  <span>
                    <b>{f.titulo}</b>
                    <small className={st.tom}>{st.tom ? st.texto : f.resolve}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              );
            })}
            {g.id === 'configurar' && (
              <>
                <Link to="/perfil" role="listitem" className="ms-linha">
                  <i aria-hidden="true"><UserRound size={20} strokeWidth={1.9} /></i>
                  <span><b>Aparência, instalar e conta</b><small>Tema claro ou escuro, ícone na tela e login</small></span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
                <Link to="/ferramentas" role="listitem" className="ms-linha">
                  <i aria-hidden="true"><LayoutGrid size={20} strokeWidth={1.9} /></i>
                  <span><b>Ver todas por área</b><small>A lista completa, do jeito antigo</small></span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </section>
      ))}
    </>
  );
}

export default Mais;
