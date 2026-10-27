import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Check, Hourglass, MessageCircle, PiggyBank, ShieldCheck, Target, Wallet } from 'lucide-react';
import { CampoDinheiro } from './ui';
import { Anel } from './graficos';
import { horasDeTrabalho } from './ferramentas';
import { Moeda } from '../components/ui/Moeda';

/* ---------- Capa do site: pra quem nunca mexeu com finanças. Palavras simples, um passo de cada vez. ---------- */

const PRA_VOCE: string[] = [
  'O dinheiro acaba antes do fim do mês',
  'Você tem dívida e não sabe por onde começar',
  'Você parcela no cartão e perde a conta',
  'Nunca conseguiu guardar nada',
  'Finanças parecem complicadas demais',
];

const FERRAMENTAS: { Icone: typeof Wallet; titulo: string; texto: string; ex: string }[] = [
  { Icone: Target, titulo: 'Sair do aperto', texto: 'Cadastre o que você deve e veja o dia em que fica livre das dívidas.', ex: 'Você fica livre em 247 dias' },
  { Icone: Wallet, titulo: 'Controlar o mês', texto: 'Saiba quanto você pode gastar hoje e o que está pra vencer.', ex: 'Você pode gastar R$ 82 hoje' },
  { Icone: PiggyBank, titulo: 'Guardar dinheiro', texto: 'Monte uma reserva que segura a sua vida se a renda parar.', ex: 'Você aguenta 2,3 meses' },
  { Icone: CalendarClock, titulo: 'Comprar bem', texto: 'Veja o preço em horas de trabalho e o juro escondido do parcelado.', ex: 'Esse tênis custa 18 horas' },
];

const PALAVRAS: [string, string][] = [
  ['Juros', 'O preço de usar o dinheiro de outra pessoa. Se você deve, paga juros. Se você guarda, recebe.'],
  ['Rotativo do cartão', 'O que acontece quando você paga só uma parte da fatura. O resto vira uma dívida com juros muito altos.'],
  ['Reserva de emergência', 'Dinheiro guardado só pra imprevistos, como perder o emprego ou um conserto grande. Não é pra gastar à toa.'],
  ['Parcelado sem juros', 'Quando a parcela somada dá o mesmo preço do à vista. Se der mais, tem juro escondido.'],
  ['Orçamento', 'Um combinado com você mesmo sobre quanto gastar em cada coisa por mês.'],
  ['Viver de renda', 'Quando o dinheiro que você guardou rende o bastante pra pagar as suas contas.'],
];

const FAQ: [string, string][] = [
  ['Preciso entender de finanças?', 'Não. O app usa palavras simples e explica cada coisa na hora. Se aparecer um termo novo, tem uma explicação junto.'],
  ['É de graça?', 'Sim. Todas as ferramentas são gratuitas. Você entra com o seu WhatsApp, sem senha.'],
  ['O app pede a senha do meu banco?', 'Nunca. Você digita os valores à mão. Nada de ligar conta bancária.'],
  ['Meus dados ficam onde?', 'No seu aparelho, ligados ao seu número. Só você vê. Pra apagar tudo, é só um botão em Meus dados.'],
  ['Quanto tempo leva pra começar?', 'Uns 2 minutos: você diz quanto ganha por mês e já vê quanto pode gastar por dia.'],
  ['Funciona no celular?', 'Sim, foi feito pro celular. Dá pra instalar na tela inicial, como um aplicativo.'],
  ['É consultoria financeira?', 'Não. É educação financeira, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre. As contas são estimativas pra te ajudar a decidir.'],
];

function Calculadora() {
  const [renda, setRenda] = useState(0);
  const [preco, setPreco] = useState(0);
  const horas = renda > 0 && preco > 0 ? horasDeTrabalho(preco, renda, 220) : 0;
  const h = Math.round(horas);
  const dias = Math.round((horas / 8) * 10) / 10;
  return (
    <section className="gs-card destaque" aria-label="Teste: quanto isso custa em horas de trabalho">
      <span className="gs-rotulo">Teste em 10 segundos</span>
      <h2 className="gs-medio" style={{ margin: '4px 0 12px' }}>Quanto custa, em horas do seu trabalho, aquilo que você quer comprar?</h2>
      <CampoDinheiro rotulo="Quanto você ganha por mês?" valor={renda} onChange={setRenda} />
      <CampoDinheiro rotulo="Quanto custa o que você quer?" valor={preco} onChange={setPreco} />
      {horas > 0 ? (
        <div className="gs-card ivory" style={{ marginBottom: 12 }} aria-live="polite">
          <p className="gs-grande" style={{ margin: 0 }}>{h} {h === 1 ? 'hora' : 'horas'}</p>
          <p className="gs-sub" style={{ margin: '4px 0 8px' }}>do seu trabalho{dias >= 1 ? `, quase ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'} inteiros` : ''}. Ainda vale a pena?</p>
          <p className="gs-banner" style={{ margin: 0 }}><Hourglass size={16} style={{ verticalAlign: '-3px' }} /> Dica: espere 3 dias. Se ainda quiser, compre sem culpa.</p>
        </div>
      ) : (
        <p className="gs-nota" style={{ margin: '0 0 14px' }}>Digite os dois valores. Eu considero 220 horas de trabalho por mês.</p>
      )}
      <Link to="/entrar" className="gs-btn cheio">Quero usar de graça <ArrowRight size={16} /></Link>
    </section>
  );
}

export function Landing({ resume, onStart, onResume }: { resume: number | null; onStart: () => void; onResume: () => void }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [palavra, setPalavra] = useState<number | null>(null);
  const irParaComoFunciona = () => document.getElementById('como-funciona')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return (
    <div className="gs-landing">
      <section style={{ textAlign: 'center', padding: '12px 0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Moeda tamanho={56} /></div>
        <span className="gs-etiqueta ouro" style={{ margin: '12px auto 0', display: 'flex', width: 'fit-content' }}>Grátis · sem senha de banco</span>
        <h1 className="gs-titulo" style={{ fontSize: 34, lineHeight: '40px', margin: '14px 0 10px' }}>Pare de se perguntar pra onde foi o seu dinheiro</h1>
        <p className="gs-sub" style={{ maxWidth: 480, margin: '0 auto 18px' }}>O Grana Séria mostra, com palavras simples, quanto você pode gastar, o que está te custando caro e o caminho pra sair do aperto. Você não precisa entender de finanças.</p>
        <div className="gs-acoes" style={{ justifyContent: 'center' }}>
          <Link to="/entrar" className="gs-btn"><MessageCircle size={18} /> Começar agora, é grátis</Link>
          <button type="button" className="gs-btn sec" onClick={irParaComoFunciona}>Ver como funciona</button>
        </div>
      </section>

      <section className="gs-card ivory" aria-label="Isso é pra você se">
        <span className="gs-rotulo">Isso é pra você se…</span>
        {PRA_VOCE.map((t) => (
          <div key={t} style={{ display: 'flex', gap: 12, padding: '8px 0', alignItems: 'flex-start' }}>
            <span className="gs-check" style={{ flex: 'none' }}><Check size={14} aria-hidden="true" /></span>
            <span>{t}</span>
          </div>
        ))}
        <p className="gs-sub" style={{ margin: '10px 0 0' }}><b>Calma, isso é mais comum do que parece.</b> O app foi feito justamente pra quem está começando.</p>
      </section>

      <Calculadora />

      <h2 id="como-funciona" className="gs-h2" style={{ textAlign: 'center' }}>Como funciona</h2>
      <ol className="gs-card" style={{ listStyle: 'none', margin: '0 0 16px', display: 'grid', gap: 14 }}>
        {[
          ['Diga quanto você ganha', 'É só um número. Leva 1 minuto.'],
          ['Anote o que entra e o que sai', 'No app ou pelo WhatsApp, do seu jeito: “mercado 80 no pix”. Pode ser por texto, áudio ou foto do cupom.'],
          ['Siga o que o app mostra', 'Ele diz quanto está livre, o que vence e qual o próximo passo. Uma coisa de cada vez.'],
        ].map(([t, x], i) => (
          <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="gs-check" style={{ flex: 'none', fontWeight: 700 }}>{i + 1}</span>
            <span><b>{t}</b><br /><span className="gs-mudo">{x}</span></span>
          </li>
        ))}
      </ol>

      <h2 className="gs-h2" style={{ textAlign: 'center' }}>O que tem dentro</h2>
      <div className="gs-grade">
        {FERRAMENTAS.map(({ Icone, titulo, texto, ex }) => (
          <div className="gs-card" key={titulo} style={{ margin: 0, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span className="gs-avatar" style={{ flex: 'none', background: 'var(--bg-2)' }}><Icone size={20} aria-hidden="true" /></span>
            <div>
              <b style={{ display: 'block', fontSize: 16 }}>{titulo}</b>
              <span className="gs-mudo">{texto}</span>
              <span className="gs-etiqueta ouro" style={{ marginTop: 8, display: 'flex', width: 'fit-content' }}>Ex.: {ex}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="gs-card destaque" style={{ marginTop: 16, display: 'flex', gap: 14, alignItems: 'center' }} aria-label="Exemplo de como o app mostra suas dívidas">
        <div style={{ flex: 'none', width: 104 }}><Anel pct={42} grande="42%" sub="já pago" tamanho={104} cor="var(--success)" /></div>
        <div>
          <span className="gs-rotulo">Exemplo · você fica livre em</span>
          <p className="gs-grande" style={{ margin: '2px 0' }}>247 dias</p>
          <p className="gs-sub" style={{ margin: 0 }}>É assim que o app mostra o seu caminho. Os números aqui são só de exemplo.</p>
        </div>
      </section>

      <h2 className="gs-h2" style={{ textAlign: 'center' }}>Palavras que você vai ver</h2>
      <p className="gs-sub" style={{ textAlign: 'center', margin: '-8px 0 12px' }}>Sem mistério. Se aparecer no app, vem explicado.</p>
      <div className="gs-card" style={{ padding: '4px 20px' }}>
        {PALAVRAS.map(([p, d], i) => (
          <div key={p} style={{ borderBottom: i < PALAVRAS.length - 1 ? '1px solid var(--line)' : 0 }}>
            <button type="button" aria-expanded={palavra === i} onClick={() => setPalavra(palavra === i ? null : i)} style={{ width: '100%', minHeight: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'none', border: 0, font: 'inherit', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
              {p}
              <span aria-hidden="true">{palavra === i ? '−' : '+'}</span>
            </button>
            {palavra === i && <p className="gs-sub" style={{ margin: '0 0 14px' }}>{d}</p>}
          </div>
        ))}
      </div>

      <section className="gs-card ivory" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 16 }}>
        <ShieldCheck size={26} color="var(--gold-strong)" style={{ flex: 'none' }} aria-hidden="true" />
        <div>
          <b style={{ display: 'block' }}>Seu dinheiro e seus dados, seguros</b>
          <span className="gs-mudo">Sem senha de banco, nunca. Você digita os valores à mão. Seus dados ficam no seu aparelho, ligados ao seu número, e você apaga tudo quando quiser.</span>
        </div>
      </section>

      <h2 className="gs-h2">Dúvidas</h2>
      <div className="gs-card" style={{ padding: '4px 20px' }}>
        {FAQ.map(([q, a], i) => (
          <div key={q} style={{ borderBottom: i < FAQ.length - 1 ? '1px solid var(--line)' : 0 }}>
            <button type="button" aria-expanded={aberto === i} onClick={() => setAberto(aberto === i ? null : i)} style={{ width: '100%', minHeight: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'none', border: 0, font: 'inherit', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
              {q}
              <span aria-hidden="true">{aberto === i ? '−' : '+'}</span>
            </button>
            {aberto === i && <p className="gs-sub" style={{ margin: '0 0 14px' }}>{a}</p>}
          </div>
        ))}
      </div>

      <section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        <h2 className="gs-medio" style={{ marginBottom: 6 }}>Comece hoje, no seu ritmo</h2>
        <p className="gs-sub" style={{ margin: '0 0 14px' }}>Em 2 minutos você já sabe quanto pode gastar por dia.</p>
        <div className="gs-acoes" style={{ justifyContent: 'center' }}>
          <Link to="/entrar" className="gs-btn"><MessageCircle size={18} /> Entrar com o WhatsApp</Link>
          {resume !== null ? (
            <button type="button" className="gs-btn sec" onClick={onResume}>Continuar meu diagnóstico (etapa {resume} de 7)</button>
          ) : (
            <button type="button" className="gs-btn sec" onClick={onStart}>Fazer o diagnóstico (10 min)</button>
          )}
        </div>
      </section>
    </div>
  );
}
