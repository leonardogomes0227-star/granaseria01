import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Eye, EyeOff, Landmark, MessageCircle, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { abrirAdicionar } from './AdicionarMov';
import { getName } from '../painel';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { mesDe, nomeMes } from './datas';
import { contasDoMes, detalheDisponivel, sequenciaDeDias, type ContaDoMes } from './selectores';
import { saudeFinanceira } from './saude';
import { FormRenda } from './Onboarding';
import { ComoCalculei } from './ComoCalculei';
import { BaixaSheet } from './BaixaSheet';
import { Folha } from './ui';
import { definirOculto, useOculto } from './privacidade';
import { AvisoCopiaMaior } from './RecuperarDados';
import { BarraPerguntar, Orbe, abrirAssistente } from './Assistente';
import { NOME_ASSISTENTE } from './assistenteLocal';
import { waLink } from '../whatsapp';
import { FERRAMENTAS } from './registroFerramentas';
import { ICONES } from './base';
import { PainelVidro } from './PainelVidro';
import { CarteiraLuxo } from './CarteiraLuxo';

/* ---------- Início: o painel ---------- */
// Saudação, o número do dia, o mês e as ferramentas que a pessoa mais usa — cada uma com a pergunta que responde.
// O resto continua em Mais. Nada daqui some: contas, dívidas, nota, assistente, vencimentos e WhatsApp.

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};
const quando = (c: ContaDoMes) => (c.dias < 0 ? `atrasada há ${-c.dias} ${-c.dias === 1 ? 'dia' : 'dias'}` : c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence em ${c.dias} dias`);

/** As ferramentas do dia a dia, na ordem em que a pessoa pensa: pagar, gastar, guardar. */
const GRUPOS_PAINEL: { titulo: string; ids: string[] }[] = [
  { titulo: 'Pagar', ids: ['contas', 'calendario', 'atrasos', 'dividas', 'cartao'] },
  { titulo: 'Gastar', ids: ['lancamentos', 'orcamento', 'cortar', 'comprar', 'assinaturas'] },
  { titulo: 'Guardar', ids: ['reserva', 'metas', 'investir', 'extras'] },
];

function Secao({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="pn-secao" aria-label={titulo}>
      <header className="pn-secao-cab">
        <div>
          <h2>{titulo}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {extra}
      </header>
      {children}
    </section>
  );
}

function FerramentasDoPainel() {
  const e = useEstado();
  const hoje = useHoje();
  const grupos = useMemo(() => GRUPOS_PAINEL.map((g) => ({
    titulo: g.titulo,
    itens: g.ids.flatMap((id) => {
      const f = FERRAMENTAS.find((x) => x.id === id);
      return f ? [{ f, st: f.status(e, hoje) }] : [];
    }),
  })), [e, hoje]);
  return (
    <Secao titulo="Ferramentas" sub="A pergunta embaixo do nome diz para que ela serve. Um toque abre." extra={<Link to="/mais">Ver todas</Link>}>
      <div className="pn-ferramentas">
        {grupos.map((g) => (
          <div key={g.titulo} data-midas={g.titulo.toLowerCase()}>
            <h3 className="pn-grupo-titulo">{g.titulo}</h3>
            <div className="pn-ftiles">
              {g.itens.map(({ f, st }) => {
                const I = ICONES[f.icone] ?? ChevronRight;
                return (
                  <Link key={f.id} to={f.rota} className={`pn-ftile${st.tom ? ` ${st.tom}` : ''}`}>
                    <i aria-hidden="true"><I size={18} strokeWidth={1.9} /></i>
                    <span><b>{f.titulo}</b><em>{f.resolve}</em></span>
                    <strong className={`pn-fst${st.tom ? ` ${st.tom}` : ''}`}>{st.texto}</strong>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Secao>
  );
}

export function Caderno() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const [calc, setCalc] = useState(false);
  const [renda, setRenda] = useState(false);
  const [baixa, setBaixa] = useState<string | null>(null);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const contas = useMemo(() => contasDoMes(e, mes, hoje), [e, mes, hoje]);
  const abertas = contas.filter((c) => c.estado !== 'paga');
  const proximas = abertas.filter((c) => c.dias <= 7).sort((a, b) => a.dias - b.dias);
  const paraPagar = proximas[0];
  const pagarPrimeiro = Boolean(paraPagar && paraPagar.estado === 'atrasada');
  const saude = useMemo(() => (e.config.renda > 0 ? saudeFinanceira(e, mes, hoje) : null), [e, mes, hoje]);
  const sequencia = useMemo(() => sequenciaDeDias(e, hoje), [e, hoje]);
  const semContas = e.gastosFixos.length === 0;
  const mesNome = nomeMes(mes);

  // primeiros passos: somem sozinhos quando renda e contas estão cadastradas
  const passos = [
    { feito: e.config.renda > 0, titulo: 'Conte quanto você ganha', ganho: 'Assim eu calculo quanto você pode gastar por dia.', acao: () => setRenda(true), rota: undefined as string | undefined },
    { feito: !semContas, titulo: 'Cadastre suas contas fixas', ganho: 'Assim eu te mostro o que pagar primeiro e te aviso antes de vencer.', acao: undefined, rota: '/pagar?nova=1' },
    { feito: e.dividas.length > 0, titulo: 'Tem dívidas? Cadastre', ganho: 'Assim eu mostro o dia em que você fica livre delas.', acao: undefined, rota: '/plano/dividas?nova=1' },
  ];
  const configurando = !(passos[0].feito && passos[1].feito);
  const proximoPasso = passos.findIndex((p) => !p.feito);

  const nota = (
    <>
      <span className="pn-avatar" aria-hidden="true">{(nome || 'V').charAt(0)}</span>
      <b>{nome || 'Você'}</b>
      <small>{saude ? (saude.nota >= 75 ? 'Finanças saudáveis' : saude.nota >= 40 ? 'No caminho' : 'Hora de cuidar') : 'Informe sua renda para ver sua nota'}</small>
      {saude && saude.nota < 100 && <p className="pn-dica">O que mais pesa agora: <b>{saude.pior.nome.toLowerCase()}</b>. {saude.pior.dica}</p>}
      <div className="pn-duo">
        <span><small>Saúde</small><b>{saude ? saude.nota : '–'}</b></span>
        <span><small>Dias anotando</small><b>{sequencia}</b></span>
      </div>
      {!saude && <span className="gs-btn pequeno">Informar renda</span>}
    </>
  );

  return (
    <div className="pn pn-v2">
      <AvisoCopiaMaior />

      {configurando && proximoPasso >= 0 && (
        <section className="ini-config" aria-label="Primeiros passos">
          <span className="cm-eyebrow">Primeiros passos · {passos.filter((p) => p.feito).length} de {passos.length}</span>
          <ol>
            {passos.map((p, i) => (
              <li key={p.titulo} className={p.feito ? 'feito' : i === proximoPasso ? 'atual' : ''}>
                <span className="no" aria-hidden="true">{p.feito ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                <span className="txt"><b>{p.titulo}</b>{!p.feito && <small>{p.ganho}</small>}</span>
                {!p.feito && i === proximoPasso && (p.rota ? <Link to={p.rota} className="gs-btn pequeno">Começar</Link> : <button type="button" className="gs-btn pequeno" onClick={p.acao}>Começar</button>)}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="pn-palco">
      <header className="pn-cab">
        <div className="pn-ola">
          <h1>{nome ? `Olá, ${nome}!` : 'Olá!'}</h1>
          <p>{mesNome.charAt(0).toLocaleUpperCase('pt-BR') + mesNome.slice(1)}</p>
        </div>
        <BarraPerguntar />
        <button type="button" className="pn-redondo" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>
      </header>
      <CarteiraLuxo />
      <PainelVidro carteira onSaldo={() => setCalc(true)} onRenda={() => setRenda(true)} onPagar={(id) => setBaixa(id)} />
      </div>

      <nav className="pn-acoes" aria-label="Ações rápidas">
        {paraPagar && (
          <button type="button" className={`pn-acao${pagarPrimeiro ? ' forte' : ''}`} onClick={() => setBaixa(paraPagar.gasto.id)}>
            <i aria-hidden="true"><Check size={18} strokeWidth={2.4} /></i>
            <span><b>Pagar {paraPagar.gasto.nome}</b><small>{quando(paraPagar)}</small></span>
          </button>
        )}
        <button type="button" className={`pn-acao${pagarPrimeiro ? '' : ' forte'}`} onClick={() => abrirAdicionar()}>
          <i aria-hidden="true"><Wallet size={18} /></i>
          <span><b>Anotar gasto</b><small>Leva 5 segundos</small></span>
        </button>
        <Link to="/pagar?nova=1" className="pn-acao">
          <i aria-hidden="true"><Receipt size={18} /></i>
          <span><b>Nova conta</b><small>Eu aviso antes de vencer</small></span>
        </Link>
        <Link to="/plano/dividas?nova=1" className="pn-acao">
          <i aria-hidden="true"><Landmark size={18} /></i>
          <span><b>Nova dívida</b><small>Veja quando fica livre</small></span>
        </Link>
      </nav>

      {saude ? (
        <Link to="/perfil#saude" className="pn-card pn-voce">{nota}</Link>
      ) : (
        <button type="button" className="pn-card pn-voce" onClick={() => setRenda(true)}>{nota}</button>
      )}

      <FerramentasDoPainel />

      <Secao titulo="Ajuda" sub="Pergunte ao Midas ou anote pelo WhatsApp. As contas do mês estão no painel.">
        <div className="pn-bloco dois">
          <section className="pn-card pn-midas" aria-label={`Pergunte ao ${NOME_ASSISTENTE}`}>
            <div>
              <h2>Pergunte ao {NOME_ASSISTENTE}</h2>
              <p className="pn-sub">Ele olha os seus números e responde na hora, com o atalho para a tela certa.</p>
              <div className="pn-perguntas">
                {['Quanto posso gastar hoje?', 'Para onde foi meu dinheiro?', 'Quando fico livre das dívidas?'].map((q) => <button key={q} type="button" onClick={() => abrirAssistente(q)}>{q}</button>)}
              </div>
            </div>
            <button type="button" className="pn-orbe" onClick={() => abrirAssistente()} aria-label={`Abrir o ${NOME_ASSISTENTE}`}><Orbe tamanho={92} /></button>
          </section>

          <section className="pn-card pn-zap" aria-label="Anote pelo WhatsApp">
            <i aria-hidden="true"><MessageCircle size={22} /></i>
            <h2>Anote pelo WhatsApp</h2>
            <p className="pn-sub">Mande "gastei 35 no mercado". Eu anoto aqui.</p>
            <a className="gs-btn" href={waLink('Oi! Quero anotar meus gastos por aqui.')} target="_blank" rel="noreferrer"><ShieldCheck size={16} aria-hidden="true" /> Abrir o WhatsApp</a>
          </section>
        </div>
      </Secao>

      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </div>
  );
}
