import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChartPie, CreditCard, Gift, Hourglass, Landmark, PiggyBank, Plus, Receipt, Search, ShieldCheck, Sprout, Target, Timer, type LucideIcon } from 'lucide-react';
import { CampoDinheiro } from './ui';
import { horasDeTrabalho } from './ferramentas';
import { Moeda } from '../components/ui/Moeda';

/* ---------- Capa do site: forte, preto e dourado, pra quem nunca mexeu com finanças ---------- */

const PRA_VOCE: string[] = [
  'O dinheiro acaba antes do fim do mês',
  'Você tem dívida e não sabe por onde começar',
  'Você parcela no cartão e perde a conta',
  'Nunca conseguiu guardar nada',
  'Finanças parecem complicadas demais',
];

const FERRAMENTAS: [LucideIcon, string, string][] = [
  [Target, 'Quitar dívidas', 'O dia em que você fica livre e o que pagar este mês.'],
  [Timer, 'Posso comprar?', 'O preço em horas do seu trabalho, antes de comprar.'],
  [ChartPie, 'Orçamento', 'Um limite pra cada coisa. Avisa antes de estourar.'],
  [CalendarDays, 'Calendário', 'Contas, parcelas e fatura: tudo que vence, num lugar.'],
  [Search, 'Gastos escondidos', 'As assinaturas que você paga e nem usa.'],
  [PiggyBank, 'Reserva', 'Quantos meses você aguenta se a renda parar.'],
  [CreditCard, 'Cartão', 'A fatura de hoje e as parcelas que ainda vêm.'],
  [Receipt, 'À vista ou parcelado?', 'O juro escondido na parcela.'],
  [Landmark, 'Empréstimos', 'Qual oferta é mais barata de verdade.'],
  [Gift, 'Dinheiro extra', '13º e bônus com destino certo.'],
  [Sprout, 'Viver de renda', 'Quando o seu dinheiro paga a sua vida.'],
];

const PALAVRAS: [string, string][] = [
  ['Juros', 'O preço de usar o dinheiro de outra pessoa. Se você deve, paga juros. Se você guarda, recebe.'],
  ['Rotativo do cartão', 'O que acontece quando você paga só uma parte da fatura. O resto vira uma dívida com juros muito altos.'],
  ['Reserva de emergência', 'Dinheiro guardado só pra imprevistos, como perder o emprego ou um conserto grande.'],
  ['Parcelado sem juros', 'Quando a soma das parcelas dá o mesmo preço do à vista. Se der mais, tem juro escondido.'],
  ['Orçamento', 'Um combinado com você mesmo sobre quanto gastar em cada coisa por mês.'],
  ['Viver de renda', 'Quando o dinheiro que você guardou rende o bastante pra pagar as suas contas.'],
];

const FAQ: [string, string][] = [
  ['Preciso entender de finanças?', 'Não. O app usa palavras simples e explica cada coisa na hora.'],
  ['O app pede a senha do meu banco?', 'Nunca. Você digita os valores à mão. Nada de ligar conta bancária.'],
  ['Meus dados ficam onde?', 'No seu aparelho, ligados ao seu número. Só você vê. Pra apagar tudo, é só um botão em Meus dados.'],
  ['Quanto tempo leva pra começar?', 'Uns 2 minutos: você diz quanto ganha por mês e já vê quanto pode gastar por dia.'],
  ['Funciona no celular?', 'Sim, foi feito pro celular. Dá pra instalar na tela inicial, como um aplicativo.'],
  ['É consultoria financeira?', 'Não. É educação financeira, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre. As contas são estimativas pra te ajudar a decidir.'],
];

function Sanfona({ itens }: { itens: [string, string][] }) {
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <div className="gs-card" style={{ padding: '4px 20px' }}>
      {itens.map(([q, a], i) => (
        <div key={q} style={{ borderBottom: i < itens.length - 1 ? '1px solid var(--line)' : 0 }}>
          <button type="button" aria-expanded={aberto === i} onClick={() => setAberto(aberto === i ? null : i)} style={{ width: '100%', minHeight: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'none', border: 0, font: 'inherit', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
            {q}
            <span aria-hidden="true">{aberto === i ? '−' : '+'}</span>
          </button>
          {aberto === i && <p className="gs-sub" style={{ margin: '0 0 14px' }}>{a}</p>}
        </div>
      ))}
    </div>
  );
}

function Calculadora() {
  const [renda, setRenda] = useState(0);
  const [preco, setPreco] = useState(0);
  const horas = renda > 0 && preco > 0 ? horasDeTrabalho(preco, renda, 220) : 0;
  const h = Math.round(horas);
  const dias = Math.round(horas / 8);
  return (
    <section className="gs-card destaque lp-calc" aria-label="Teste: quanto isso custa em horas de trabalho">
      <span className="gs-rotulo">Teste em 10 segundos</span>
      <h3 className="lp-t" style={{ marginTop: 6 }}>Quanto custa, em horas do seu trabalho, o que você quer comprar?</h3>
      <CampoDinheiro rotulo="Quanto você ganha por mês?" valor={renda} onChange={setRenda} />
      <CampoDinheiro rotulo="Quanto custa o que você quer?" valor={preco} onChange={setPreco} />
      {horas > 0 ? (
        <div className="gs-card ivory" style={{ marginBottom: 12 }} aria-live="polite">
          <p className="lp-res">{h} {h === 1 ? 'HORA' : 'HORAS'}</p>
          <p className="gs-sub" style={{ margin: '6px 0 8px' }}>do seu trabalho{dias >= 1 ? `, quase ${dias} ${dias === 1 ? 'dia' : 'dias'} inteiros` : ''}. Ainda vale a pena?</p>
          <p className="gs-banner" style={{ margin: 0 }}><Hourglass size={16} style={{ verticalAlign: '-3px' }} /> Dica: espere 3 dias. Se ainda quiser, compre sem culpa.</p>
        </div>
      ) : (
        <p className="gs-nota" style={{ margin: '0 0 14px' }}>Digite os dois valores. Eu considero 220 horas de trabalho por mês.</p>
      )}
      <Link to="/entrar" className="lp-btn ouro" style={{ width: '100%' }}>Quero começar <ArrowRight size={18} /></Link>
    </section>
  );
}

export function Landing({ resume, onStart, onResume }: { resume: number | null; onStart: () => void; onResume: () => void }) {
  const ir = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return (
    <div className="gs-landing lp">
      <section className="lp-hero lp-full">
        <div className="lp-raios" aria-hidden="true" />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Moeda tamanho={60} /></div>
        <span className="lp-selo"><ShieldCheck size={15} aria-hidden="true" /> Sem senha de banco · no seu celular</span>
        <h1>O mês acabou <span>e o dinheiro sumiu?</span></h1>
        <p>O Grana Séria mostra pra onde ele vai, quanto você pode gastar hoje e o caminho pra sair do aperto. Sem precisar entender de finanças.</p>
        <div className="lp-acoes">
          <Link to="/entrar" className="lp-btn ouro">Começar agora <ArrowRight size={18} /></Link>
          <button type="button" className="lp-btn vazio" onClick={() => ir('ferramentas')}>Ver as ferramentas</button>
        </div>
        <div className="lp-nums" aria-label="Exemplos do que o app mostra">
          <div className="lp-num"><b style={{ color: 'var(--lp-verde)' }}>R$ 82</b><small>pode gastar hoje</small></div>
          <div className="lp-num"><b style={{ color: 'var(--lp-ouro)' }}>247 dias</b><small>pra ficar livre das dívidas</small></div>
          <div className="lp-num"><b style={{ color: 'var(--lp-verm)' }}>18 h</b><small>de trabalho num tênis</small></div>
        </div>
        <p className="lp-nota">Números de exemplo. O app calcula os seus.</p>
      </section>

      <section className="lp-sec" aria-label="Isso é pra você se">
        <h2>Isso é pra você <span>se…</span></h2>
        <p className="lp-sub">Calma, é mais comum do que parece. O app foi feito pra quem está começando.</p>
        <div className="lp-lista">
          {PRA_VOCE.map((t) => <div className="lp-item" key={t}><i aria-hidden="true">✓</i>{t}</div>)}
        </div>
      </section>

      <section className="lp-sec">
        <Calculadora />
      </section>

      <section className="lp-sec" id="ferramentas" style={{ scrollMarginTop: 80 }}>
        <h2>11 ferramentas <span>num app só</span></h2>
        <p className="lp-sub">Cada uma resolve uma parte da sua vida financeira e te diz o que fazer agora.</p>
        <div className="lp-ferr">
          {FERRAMENTAS.map(([Icone, nome, desc]) => (
            <div className="lp-f" key={nome}>
              <div className="ic" aria-hidden="true"><Icone size={24} strokeWidth={2.2} /></div>
              <b>{nome}</b>
              <small>{desc}</small>
            </div>
          ))}
          <div className="lp-f" style={{ background: 'var(--lp-ouro)', borderColor: 'var(--lp-ouro)', color: 'var(--lp-preto)' }}>
            <div className="ic" aria-hidden="true" style={{ background: 'var(--lp-preto)', color: 'var(--lp-ouro)' }}><Plus size={24} strokeWidth={2.6} /></div>
            <b>E ainda</b>
            <small style={{ color: 'var(--lp-preto)' }}>Investimentos com dados do mercado e assistentes que te avisam no dia certo.</small>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="como-funciona">
        <h2>Como <span>funciona</span></h2>
        <div className="lp-passos" style={{ marginTop: 14 }}>
          {[
            ['Diga quanto você ganha', 'É só um número. Leva 1 minuto.'],
            ['Anote o que entra e o que sai', 'No app ou pelo WhatsApp, do seu jeito: “mercado 80 no pix”. Por texto, áudio ou foto do cupom.'],
            ['Siga o que o app mostra', 'Quanto está livre, o que vence e o próximo passo. Uma coisa de cada vez.'],
          ].map(([t, x], i) => <div className="lp-passo" key={t}><em>{i + 1}</em><div><b>{t}</b><span>{x}</span></div></div>)}
        </div>
      </section>

      <section className="lp-sec">
        <h2>Palavras que <span>você vai ver</span></h2>
        <p className="lp-sub">Toda palavra difícil do app vem explicada.</p>
        <Sanfona itens={PALAVRAS} />
      </section>

      <section className="lp-sec">
        <div className="lp-item" style={{ alignItems: 'flex-start', padding: 18 }}>
          <i aria-hidden="true" style={{ background: 'var(--lp-ouro)', color: 'var(--lp-preto)' }}><ShieldCheck size={18} /></i>
          <div><b style={{ display: 'block', fontWeight: 800 }}>Seu dinheiro e seus dados, seguros</b><span className="gs-mudo" style={{ fontWeight: 400 }}>Sem senha de banco, nunca. Você digita os valores à mão. Seus dados ficam no seu aparelho e você apaga tudo quando quiser.</span></div>
        </div>
      </section>

      <section className="lp-sec">
        <h2>Dúvidas</h2>
        <Sanfona itens={FAQ} />
      </section>

      <section className="lp-fim lp-full">
        <h2>Comece hoje</h2>
        <p>Em 2 minutos você já sabe quanto pode gastar por dia.</p>
        <div className="lp-acoes">
          <Link to="/entrar" className="lp-btn ouro">Entrar com o WhatsApp <ArrowRight size={18} /></Link>
          {resume !== null ? (
            <button type="button" className="lp-btn vazio" onClick={onResume}>Continuar meu diagnóstico ({resume} de 7)</button>
          ) : (
            <button type="button" className="lp-btn vazio" onClick={onStart}>Fazer o diagnóstico</button>
          )}
        </div>
      </section>
    </div>
  );
}
