// Componentes base do visual "O Caminho" (estilos em caminho.css). Só mostram: nenhum deles calcula dinheiro.

import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award, Banknote, BookOpen, CalendarClock, CalendarDays, ChartColumn, ChartLine, ChartPie, Check, CheckCheck, ChevronRight, Compass, CreditCard, Crown, Delete, FileText, Flag, Gift, Info, Landmark, LifeBuoy, Map, MessageCircle, PiggyBank, Plus, Quote, Receipt, ArrowRightLeft, Scale, Scissors, Search, Shield, Smartphone, Sparkles, Sprout, Sun, Target, Timer, UserRound, Bell, Swords, Wallet, type LucideIcon } from 'lucide-react';
import { Moeda } from '../components/ui/Moeda';
import { Folha } from './ui';
import type { TomStatus } from './registroFerramentas';

export { Moeda };
/** A folha que sobe de baixo (com mola e foco preso): a mesma do resto do app. */
export const BottomSheet = Folha;

export const Card = ({ children, suave, className = '', ...r }: { children: ReactNode; suave?: boolean; className?: string } & React.HTMLAttributes<HTMLElement>) => (
  <section className={`cm-card${suave ? ' suave' : ''} ${className}`} {...r}>{children}</section>
);

/** Ponto + texto: o estado nunca depende só da cor. */
export const StatusDot = ({ tom = '', children }: { tom?: TomStatus; children: ReactNode }) => <span className={`cm-status ${tom}`}>{children}</span>;

export const Eyebrow = ({ children }: { children: ReactNode }) => <span className="cm-eyebrow">{children}</span>;

export { useContagem } from './contagem';

/** O cartão mais importante do app: o próximo marco, em letras grandes, com a data. */
export function CartaoDestino({ rotulo, antes, data, texto, progresso, pe, children }: { rotulo: string; antes: string; data?: string | null; texto?: string; progresso?: number; pe?: ReactNode; children?: ReactNode }) {
  return (
    <section className="cm-destino" aria-label="Seu destino">
      <div className="cm-destino-topo"><Moeda tamanho={46} /><Eyebrow>{rotulo}</Eyebrow></div>
      <h2>{antes}{data && <b className="cm-ouro-folha">{data}</b>}</h2>
      {texto && <p>{texto}</p>}
      {progresso !== undefined && <div className="cm-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progresso)} aria-label="Progresso até o destino"><i style={{ width: `${Math.max(0, Math.min(100, progresso))}%` }} /></div>}
      {pe && <div className="cm-destino-pe">{pe}</div>}
      {children}
    </section>
  );
}

export type EstadoNo = 'feito' | 'atual' | 'pendente' | 'futuro' | 'segurado' | 'continuo';
/** Linha do tempo com fio dourado: serve para os passos do mês e para os marcos do caminho. */
export const LinhaDoTempo = ({ children, rotulo }: { children: ReactNode; rotulo: string }) => <ol className="cm-linha-tempo" aria-label={rotulo}>{children}</ol>;
export function Passo({ n, estado, titulo, detalhe, children, destaque, id }: { n: number | string; estado: EstadoNo; titulo: ReactNode; detalhe?: ReactNode; children?: ReactNode; destaque?: boolean; id?: string }) {
  const nome = estado === 'feito' ? 'feito' : estado === 'atual' ? 'é o próximo' : estado === 'segurado' ? 'em espera' : estado === 'continuo' ? 'vale o mês todo' : 'depois';
  return (
    <li id={id}>
      <span className={`cm-no ${estado}`} aria-hidden="true">{estado === 'feito' ? <Check size={18} strokeWidth={3} /> : estado === 'continuo' ? '∞' : n}</span>
      <div className={`cm-passo ${estado}${destaque ? ' cm-passo-atual' : ''}`}>
        <b>{titulo}<span className="sr-only"> ({nome})</span></b>
        {detalhe && <small>{detalhe}</small>}
        {children}
      </div>
    </li>
  );
}
/** O selo do marco: aparece como texto discreto e "vira moeda" quando o marco é conquistado. */
export const Selo = ({ nome, feito }: { nome: string; feito?: boolean }) => <span className="cm-selo">{feito ? `${nome} conquistado` : nome}</span>;
export function Marco({ n, estado, titulo, data, selo, children }: { n: number; estado: 'feito' | 'atual' | 'futuro'; titulo: string; data?: string | null; selo: string; children?: ReactNode }) {
  return (
    <Passo n={n} estado={estado} titulo={titulo} destaque={estado === 'atual'}>
      {data && <span className="cm-marco-data">{data}</span>}
      <Selo nome={selo} feito={estado === 'feito'} />
      {children}
    </Passo>
  );
}

export const ICONES: Record<string, LucideIcon> = {
  alvo: Target, arquivo: FileText, aspas: Quote, balanca: Scale, banco: Landmark, bandeira: Flag, boia: LifeBuoy, brilho: Sparkles, broto: Sprout, bussola: Compass,
  calendario: CalendarDays, cartao: CreditCard, carteira: Wallet, celular: Smartphone, check: CheckCheck, cofre: PiggyBank, conversa: MessageCircle, coroa: Crown,
  cronometro: Timer, duelo: Swords, escudo: Shield, grafico: ChartColumn, info: Info, linha: ChartLine, livro: BookOpen, lupa: Search, mais: Plus, mapa: Map,
  medalha: Award, pessoa: UserRound, pizza: ChartPie, presente: Gift, recibo: Receipt, relogio: CalendarClock, sino: Bell, sol: Sun, tesoura: Scissors, troca: ArrowRightLeft, dinheiro: Banknote,
};

/** Uma ferramenta: cartão clicável com ícone, nome, a pergunta que ela resolve e o seu número de agora. */
export function ToolTile({ titulo, resolve, status, tom = '', rota, continuar, icone }: { titulo: string; resolve: string; status: string; tom?: TomStatus; rota: string; continuar?: string; icone?: string }) {
  const I = (icone && ICONES[icone]) || ChevronRight;
  return (
    <Link to={rota} className={`cm-tile ${tom}`}>
      <span className="ic" aria-hidden="true"><I size={22} strokeWidth={1.9} /></span>
      <span className="cm-tile-corpo">
        <b>{titulo}</b>
        <em>{resolve}</em>
        <StatusDot tom={tom}>{status}</StatusDot>
        {continuar && <span className="cm-continuar">{continuar}</span>}
      </span>
      <ChevronRight size={20} aria-hidden="true" className="cm-tile-seta" />
    </Link>
  );
}
export const ToolGrid = ({ children }: { children: ReactNode }) => <div className="cm-grade">{children}</div>;

/** Cabeçalho de ferramenta: voltar para a área de onde ela faz parte. */
export const ToolHeader = ({ para, rotulo }: { para: string; rotulo: string }) => (
  <div className="cm-cab-ferr"><Link to={para} className="cm-voltar"><ArrowLeft size={18} aria-hidden="true" />{rotulo}</Link></div>
);

export function Segmented<T extends string>({ opcoes, valor, onChange, rotulo }: { opcoes: { id: T; nome: string }[]; valor: T; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div className="cm-seg" role="group" aria-label={rotulo}>
      {opcoes.map((o) => <button key={o.id} type="button" aria-pressed={valor === o.id} onClick={() => onChange(o.id)}>{o.nome}</button>)}
    </div>
  );
}

export const Lista = ({ children, rotulo }: { children: ReactNode; rotulo?: string }) => <div className="cm-lista" role="list" aria-label={rotulo}>{children}</div>;
export function ListItem({ faixa, tomFaixa = '', titulo, sub, valor, acao, rota }: { faixa?: string; tomFaixa?: TomStatus; titulo: ReactNode; sub?: ReactNode; valor?: string; acao?: ReactNode; rota?: string }) {
  const corpo = (
    <>
      {faixa && <span className={`cm-faixa ${tomFaixa}`}>{faixa}</span>}
      <span className="corpo"><b>{titulo}</b>{sub && <small className="cm-mudo">{sub}</small>}</span>
      {valor && <span className="valor">{valor}</span>}
      {acao}
      {rota && !acao && <ChevronRight size={18} aria-hidden="true" className="cm-mudo" />}
    </>
  );
  return rota && !acao ? <Link to={rota} className="cm-item-lista" role="listitem">{corpo}</Link> : <div className="cm-item-lista" role="listitem">{corpo}</div>;
}

export function ProgressRing({ pct, tamanho = 132, espessura = 12, rotulo, children }: { pct: number; tamanho?: number; espessura?: number; rotulo: string; children?: ReactNode }) {
  const id = useId().replace(/:/g, '');
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="cm-anel" style={{ width: tamanho, height: tamanho }} role="img" aria-label={`${rotulo}: ${Math.round(p)}%`}>
      <svg width={tamanho} height={tamanho} aria-hidden="true">
        <defs><linearGradient id={`${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#D9B45E" /><stop offset="1" stopColor="#9C7524" /></linearGradient></defs>
        <circle className="trilha" cx={tamanho / 2} cy={tamanho / 2} r={r} strokeWidth={espessura} />
        <circle className="valor" cx={tamanho / 2} cy={tamanho / 2} r={r} strokeWidth={espessura} stroke={`url(#${id})`} strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ stroke: `url(#${id})` }} />
      </svg>
      <div>{children}</div>
    </div>
  );
}

/** Teclado grande para valores: quem tem dificuldade com o teclado do celular digita aqui. */
export function NumPad({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const centavos = Math.round(valor * 100);
  const tecla = (d: string) => onChange(Math.min(99999999, Number(`${centavos}${d}`)) / 100);
  return (
    <div>
      <div className="cm-visor" aria-live="polite">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
      <div className="cm-teclado">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((d) => <button key={d} type="button" onClick={() => tecla(d)}>{d}</button>)}
        <button type="button" aria-label="Apagar o último número" onClick={() => onChange(Math.floor(centavos / 10) / 100)}><Delete size={24} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

export function EmptyState({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return <div className="cm-vazio"><Moeda tamanho={40} girar={false} /><b>{titulo}</b><p>{texto}</p>{acao}</div>;
}
export const Skeleton = ({ altura = 18, largura = '100%' }: { altura?: number; largura?: string | number }) => <div className="cm-esq" style={{ height: altura, width: largura, marginBottom: 10 }} aria-hidden="true" />;

/** Texto nosso, inspirado no livro. Nunca um trecho copiado de tradução. */
export const Citacao = ({ texto }: { texto: string }) => <blockquote className="cm-citacao"><p>{texto}</p><footer>Do nosso jeito, inspirado em O Homem Mais Rico da Babilônia</footer></blockquote>;

export const CITACOES = [
  'Uma parte de tudo o que você ganha é sua para guardar.',
  'O ouro vem devagar para quem guarda um pouco de cada vez, e depressa foge de quem quer tudo de uma vez.',
  'Quem sabe para onde vai cada moeda manda no próprio dinheiro.',
  'Dívida paga é corda solta: o passo seguinte fica leve.',
  'Primeiro o teto e o pão, depois o resto. A ordem certa já é metade do caminho.',
  'Não é o tamanho do salário que enche a bolsa, é o que fica nela.',
  'Um passo por dia, todo dia, chega mais longe que uma corrida de vez em quando.',
];
export const citacaoDoDia = (hojeISO: string) => CITACOES[(Number(hojeISO.slice(8, 10)) + Number(hojeISO.slice(5, 7))) % CITACOES.length];
