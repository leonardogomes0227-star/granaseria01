import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl0, mesDe } from './datas';
import { gastoPorCategoria } from './orcamento';
import { GRUPO } from './categorias';
import { cortarPagando, custoPorDia, valeTrocar, type DividaSim } from './dividas';
import { taxaEfetiva } from './ferramentas';
import { Aprende, CampoDinheiro, CampoNumero, Dica } from './ui';
import type { Estrategia } from './tipos';

/* ---------- Peças extras de "Quitar dívidas": cada uma começa fechada pra tela não pesar ---------- */

export const TIPOS_DIVIDA: { nome: string; juros: number }[] = [
  { nome: 'Cartão (rotativo)', juros: 12 },
  { nome: 'Cheque especial', juros: 8 },
  { nome: 'Empréstimo pessoal', juros: 4 },
  { nome: 'Loja / crediário', juros: 5 },
  { nome: 'Financiamento', juros: 1.5 },
];

/** "Não sei o juro": a pessoa diz quanto pegou, em quantas vezes e quanto é a parcela. */
export function CalculaJuro({ onResultado }: { onResultado: (jurosMensalPct: number) => void }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(0);
  const [n, setN] = useState<number | ''>('');
  const [parcela, setParcela] = useState(0);
  const taxa = typeof n === 'number' && valor > 0 && parcela > 0 ? taxaEfetiva(valor, n, parcela) : null;
  if (!aberto) return <button type="button" className="gs-btn link" onClick={() => setAberto(true)}>Não sei o juro</button>;
  return (
    <div className="gs-card ivory" style={{ marginBottom: 12 }}>
      <p className="gs-sub" style={{ margin: '0 0 8px' }}>Veja no contrato ou no app do banco quanto você pegou, em quantas parcelas e o valor de cada uma.</p>
      <CampoDinheiro rotulo="Quanto você pegou" valor={valor} onChange={setValor} />
      <div className="gs-dois">
        <CampoNumero rotulo="Parcelas" valor={n} onChange={setN} min={1} max={480} />
        <CampoDinheiro rotulo="Valor da parcela" valor={parcela} onChange={setParcela} />
      </div>
      {taxa !== null && (
        <>
          <p style={{ margin: '4px 0 8px' }}>O juro é de cerca de <b>{(taxa * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ao mês</b>.</p>
          <button type="button" className="gs-btn" onClick={() => { onResultado(Math.round(taxa * 10000) / 100); setAberto(false); }}>Usar esse juro</button>
        </>
      )}
    </div>
  );
}

const Sanfona = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <details className="gs-card" style={{ padding: '4px 20px' }}>
    <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>{titulo}</summary>
    <div style={{ paddingBottom: 16 }}>{children}</div>
  </details>
);

export function MaisRapido({ sim, pagamento, estrategia }: { sim: DividaSim[]; pagamento: number; estrategia: Estrategia }) {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [taxa, setTaxa] = useState<number | ''>('');
  const troca = typeof taxa === 'number' && taxa > 0 ? valeTrocar(sim, pagamento, estrategia, taxa) : null;
  // maior gasto "do desejo" do mês: é o mais fácil de cortar
  const alvo = useMemo(() => Object.entries(gastoPorCategoria(e, mes)).filter(([c]) => GRUPO[c] !== 'necessidades').sort((a, b) => b[1] - a[1])[0], [e, mes]);
  const corte = alvo ? Math.floor(alvo[1] / 2 / 10) * 10 : 0;
  const cortar = corte >= 20 ? cortarPagando(sim, pagamento, estrategia, corte) : null;
  return (
    <>
      <p className="gs-banner" style={{ marginTop: 16 }}>As suas dívidas rendem cerca de <b>{brl0(custoPorDia(sim))} de juros por dia</b> pra quem emprestou.</p>
      <Sanfona titulo="Vale trocar por um juro menor?">
        <p className="gs-sub" style={{ marginTop: 0 }}>Apareceu uma oferta de empréstimo mais barata? Digite o juro dela e eu mostro se compensa trocar a dívida mais cara.</p>
        <CampoNumero rotulo="Juro da nova oferta" sufixo="% ao mês" valor={taxa} onChange={setTaxa} min={0.1} max={30} placeholder="Ex.: 3" />
        {troca && (troca.economia > 0
          ? <Dica>Trocando <b>{troca.nome}</b> você economiza <b>{brl0(troca.economia)}</b>{troca.meses > 0 ? ` e termina ${troca.meses} ${troca.meses === 1 ? 'mês' : 'meses'} antes` : ''}. Confira se não tem taxa pra contratar.</Dica>
          : <Dica>Nesse juro não compensa trocar.</Dica>)}
        <p className="gs-nota">Compare sempre pelo custo total, na ferramenta <Link to="/plano/emprestimos">Empréstimos</Link>.</p>
      </Sanfona>
      {cortar && alvo && (
        <Sanfona titulo="Cortar um gasto pra quitar antes">
          <p className="gs-sub" style={{ marginTop: 0 }}>Este mês você gastou {brl0(alvo[1])} em <b>{alvo[0]}</b>. Se cortar a metade ({brl0(corte)}) e jogar na dívida:</p>
          <Dica>você termina <b>{cortar.meses} {cortar.meses === 1 ? 'mês' : 'meses'} antes</b> e economiza <b>{brl0(cortar.economia)}</b> de juros.</Dica>
        </Sanfona>
      )}
      <Sanfona titulo="Direitos e dívidas antigas">
        <p style={{ marginTop: 0 }}>Você pode pedir ao credor o contrato e o cálculo da dívida, por escrito. Só pague depois de conferir.</p>
        <p>Pra saber se seu nome está negativado, consulte o seu CPF nos birôs de crédito (Serasa, Boa Vista, SPC). A negativação precisa ser avisada por escrito.</p>
        <p>Dívida muito antiga pode ter prazo limite de cobrança (em geral cerca de 5 anos), mas depende do caso. Antes de pagar uma dívida antiga, confirme no Procon ou com um advogado.</p>
        <p className="gs-nota" style={{ marginBottom: 0 }}>Informação geral, não é orientação jurídica.</p>
      </Sanfona>
    </>
  );
}

export function Marcos({ progresso, quitadas }: { progresso: number; quitadas: number }) {
  const lista = [
    { ok: quitadas >= 1, t: 'Primeira dívida quitada' },
    { ok: progresso >= 25, t: '25% pago' },
    { ok: progresso >= 50, t: 'Metade paga' },
    { ok: progresso >= 75, t: '75% pago' },
  ];
  if (!lista.some((m) => m.ok)) return null;
  return (
    <div className="gs-chips" aria-label="Marcos conquistados">
      {lista.filter((m) => m.ok).map((m) => <span key={m.t} className="gs-etiqueta ok">★ {m.t}</span>)}
    </div>
  );
}

export function Quitou() {
  const e = useEstado();
  const pago = e.dividas.reduce((t, d) => t + d.pagamentos.reduce((s, p) => s + p.valor, 0), 0);
  const original = e.dividas.reduce((t, d) => t + d.saldo, 0);
  const inicio = e.dividas.map((d) => d.cadastradaEm).filter(Boolean).sort()[0];
  const meses = inicio ? Math.max(1, Math.round((Date.now() - Date.parse(inicio)) / (30 * 86400_000))) : null;
  return (
    <>
      <section className="gs-card destaque">
        <span className="gs-rotulo">Você conseguiu</span>
        <p className="gs-grande" style={{ margin: '4px 0 6px' }}>Livre das dívidas</p>
        <p className="gs-sub" style={{ margin: 0 }}>Você quitou {brl0(original)}{meses ? ` em cerca de ${meses} ${meses === 1 ? 'mês' : 'meses'}` : ''}. Pagou ao todo {brl0(pago)}.</p>
      </section>
      <section className="gs-card">
        <span className="gs-rotulo">E agora?</span>
        {[
          <>Guarde o mesmo valor que ia pra dívida. Comece pela <Link to="/plano/reserva">reserva de emergência</Link>.</>,
          <>Com a reserva pronta, veja onde investir na aba <Link to="/investir">Investir</Link>.</>,
          <>Pra não voltar a dever: defina um limite por categoria no <Link to="/plano/orcamento">Orçamento</Link> e não use o rotativo do cartão.</>,
        ].map((t, i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0' }}><span className="gs-check" style={{ flex: 'none', fontWeight: 700 }}>{i + 1}</span><span>{t}</span></div>)}
      </section>
      <Aprende titulo="O dinheiro que sobrou" texto="Você já se acostumou a viver sem esse valor todo mês. Mandar o mesmo valor pra reserva e pros investimentos faz o dinheiro trabalhar a seu favor, e não pro banco." />
    </>
  );
}
