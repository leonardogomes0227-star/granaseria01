import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { FERRAMENTAS, type Ferramenta, type StatusFerramenta } from './registroFerramentas';
import { ICONES } from './base';
import { abrirResolver } from './Resolver';
import { getName } from '../painel';
import { brl0 } from './datas';

/* ---------- Mais: todas as ferramentas do app, agrupadas por o que a pessoa quer fazer ---------- */
// Nada sai do app: cada ferramenta do registro cai em um dos três grupos. O que não estiver na lista de
// "Planejar" ou "Acompanhar" cai em "Configurar", então uma ferramenta nova nunca fica sem lugar.
// Dentro do grupo, o assunto (f.grupo) vira um título. O nome, a pergunta e o estado ficam sempre visíveis.

export type GrupoMais = 'planejar' | 'acompanhar' | 'configurar';

const PLANEJAR = ['metas', 'reserva', 'investir', 'renda', 'extras', 'orcamento', 'cortar', 'assinaturas', 'comprar', 'parcelado', 'emprestimos', 'longo-prazo', 'placar', 'recuperacao', 'atrasos', 'anotar-atraso', 'dividas', 'direitos', 'cartao', 'caminho', 'meu-plano', 'coach'];
const ACOMPANHAR = ['relatorios', 'checkin', 'saude', 'lancamentos', 'carteiras', 'contas', 'calendario', 'fatura', 'selos'];

export const grupoDaFerramenta = (id: string): GrupoMais => (PLANEJAR.includes(id) ? 'planejar' : ACOMPANHAR.includes(id) ? 'acompanhar' : 'configurar');

const GRUPOS_MAIS: { id: GrupoMais; titulo: string; sub: string }[] = [
  { id: 'planejar', titulo: 'Planejar', sub: 'Metas, reserva, investimentos e como sair do aperto' },
  { id: 'acompanhar', titulo: 'Acompanhar', sub: 'Veja como você está indo e como fechou o mês' },
  { id: 'configurar', titulo: 'Configurar', sub: 'Seus dados, lembretes, WhatsApp, planos e ajuda' },
];

/** A ordem de cada grupo é a da lista acima (o que mais se usa primeiro); o que não está nela vem depois, na ordem do registro. */
function ordenar(g: GrupoMais, fs: Ferramenta[]): Ferramenta[] {
  const lista = g === 'planejar' ? PLANEJAR : g === 'acompanhar' ? ACOMPANHAR : [];
  const pos = (id: string) => { const i = lista.indexOf(id); return i < 0 ? 999 : i; };
  return [...fs].sort((a, b) => pos(a.id) - pos(b.id));
}

type ItemMais = { f: Ferramenta; st: StatusFerramenta; cont: { passo: number; total: number; o: string } | null };

function subgrupos(itens: ItemMais[]): { grupo: string; itens: ItemMais[] }[] {
  const ordem: string[] = [];
  const map = new Map<string, ItemMais[]>();
  for (const item of itens) {
    if (!map.has(item.f.grupo)) { map.set(item.f.grupo, []); ordem.push(item.f.grupo); }
    map.get(item.f.grupo)!.push(item);
  }
  return ordem.map((grupo) => ({ grupo, itens: map.get(grupo)! }));
}

function Linha({ item, classe = 'ms-linha' }: { item: ItemMais; classe?: string }) {
  const { f, st, cont } = item;
  const I = ICONES[f.icone] ?? ChevronRight;
  return (
    <Link to={f.rota} role="listitem" className={`${classe}${st.tom ? ` ${st.tom}` : ''}`}>
      <i aria-hidden="true"><I size={20} strokeWidth={1.9} /></i>
      <span>
        <b>{f.titulo}</b>
        <small>{classe === 'ms-agora' ? st.texto : f.resolve}</small>
        {classe !== 'ms-agora' && st.texto && <em className={`ms-estado${st.tom ? ` ${st.tom}` : ''}`}>{st.texto}</em>}
        {cont && <em className="ms-continua">Continuar · passo {cont.passo} de {cont.total}</em>}
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function Mais() {
  const e = useEstado();
  const hoje = useHoje();
  const nome = e.config.nome || getName() || '';
  const [filtro, setFiltro] = useState<GrupoMais | 'tudo'>('tudo');
  const grupos = useMemo(
    () => GRUPOS_MAIS.map((g) => ({
      ...g,
      itens: ordenar(g.id, FERRAMENTAS.filter((f) => grupoDaFerramenta(f.id) === g.id)).map((f) => ({ f, st: f.status(e, hoje), cont: f.continuar?.(e, hoje) ?? null })),
    })),
    [e, hoje],
  );
  const urgentes = grupos.flatMap((g) => g.itens).filter((i) => i.st.tom === 'perigo' || i.st.tom === 'aviso').slice(0, 3);
  const visiveis = filtro === 'tudo' ? grupos : grupos.filter((g) => g.id === filtro);
  // só no aparelho em que o dono já entrou no painel (a senha continua sendo pedida lá)
  const dono = (() => { try { return localStorage.getItem('gs-dono') === '1'; } catch { return false; } })();
  return (
    <div className="ms-luxo">
      <h1 className="gs-titulo">Mais</h1>
      <p className="gs-sub">O nome é a ferramenta. Embaixo, a pergunta que ela responde e como você está agora.</p>

      <Link to="/dados" className="ms-perfil">
        <i aria-hidden="true"><UserRound size={22} strokeWidth={1.9} /></i>
        <span><b>{nome || 'Meus dados'}</b><small>{e.config.renda > 0 ? `Renda de ${brl0(e.config.renda)} por mês` : 'Informe sua renda para eu calcular tudo'}</small></span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>

      <button type="button" className="cm-busca" onClick={abrirResolver}><Search size={20} aria-hidden="true" />O que você quer resolver?</button>

      <div className="ms-filtros" role="group" aria-label="Filtrar ferramentas">
        <button type="button" className={filtro === 'tudo' ? 'on' : ''} aria-pressed={filtro === 'tudo'} onClick={() => setFiltro('tudo')}>Tudo</button>
        {GRUPOS_MAIS.map((g) => (
          <button key={g.id} type="button" className={filtro === g.id ? 'on' : ''} aria-pressed={filtro === g.id} onClick={() => setFiltro(g.id)}>{g.titulo}</button>
        ))}
      </div>

      <div key={filtro} className="ms-troca">
      {filtro === 'tudo' && urgentes.length > 0 && (
        <section className="ms-grupo ms-urgente" aria-label="Precisa de você">
          <h2>Precisa de você</h2>
          <p>Um toque abre o que está pedindo atenção.</p>
          <div className="ms-urgentes">
            {urgentes.map((item) => <Linha key={item.f.id} item={item} classe="ms-agora" />)}
          </div>
        </section>
      )}

      {visiveis.map((g) => (
        <section key={g.id} className="ms-grupo" aria-labelledby={`ms-${g.id}`}>
          <h2 id={`ms-${g.id}`}>{g.titulo}</h2>
          <p>{g.sub}</p>
          <div className="ms-subs">
            {subgrupos(g.itens).map((s) => (
              <div key={s.grupo} className="ms-sub-bloco">
                <h3 className="ms-sub">{s.grupo}</h3>
                <div className="ms-lista" role="list">
                  {s.itens.map((item) => <Linha key={item.f.id} item={item} />)}
                </div>
              </div>
            ))}
            {g.id === 'configurar' && (
              <div className="ms-sub-bloco">
                <h3 className="ms-sub">Ajustes</h3>
                <div className="ms-lista" role="list">
                  {dono && (
                    <a href="/admin" role="listitem" className="ms-linha">
                      <i aria-hidden="true"><ShieldCheck size={20} strokeWidth={1.9} /></i>
                      <span><b>Painel do dono</b><small>Uso do app e dados das pessoas</small></span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </a>
                  )}
                  <Link to="/perfil" role="listitem" className="ms-linha">
                    <i aria-hidden="true"><UserRound size={20} strokeWidth={1.9} /></i>
                    <span><b>Aparência, instalar e conta</b><small>Tema claro ou escuro, ícone na tela e login</small></span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                  <Link to="/ferramentas" role="listitem" className="ms-linha">
                    <i aria-hidden="true"><LayoutGrid size={20} strokeWidth={1.9} /></i>
                    <span><b>Ver todas por área</b><small>A lista completa, separada por assunto</small></span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}

export default Mais;
