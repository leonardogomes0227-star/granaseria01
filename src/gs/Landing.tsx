import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Hourglass, MessageCircle, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { CampoDinheiro } from './ui';
import { horasDeTrabalho } from './ferramentas';
import { Moeda } from '../components/ui/Moeda';

/* ---------- Página de entrada: uma promessa, uma ferramenta de verdade, um passo ---------- */

const FAQ: [string, string][] = [
  ['É de graça?', 'Sim. As ferramentas e os assistentes são gratuitos. Você entra com o seu WhatsApp, sem senha.'],
  ['O que eu faço no WhatsApp?', 'Anota o que gastou e o que entrou, do seu jeito (ex.: mercado 80 no pix), por texto, áudio ou foto do cupom.'],
  ['O app pede a senha do meu banco?', 'Não. Você anota os valores à mão. Nada de ligar conta bancária.'],
  ['Meus dados ficam onde?', 'No seu aparelho e ligados ao seu número. Só você vê. Pra apagar tudo, é só um botão em Meus dados.'],
  ['É consultoria financeira?', 'Não. É educação financeira, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre.'],
];

function Calculadora() {
  const [renda, setRenda] = useState(0);
  const [preco, setPreco] = useState(0);
  const [horasMes] = useState(220);
  const horas = renda > 0 && preco > 0 ? horasDeTrabalho(preco, renda, horasMes) : 0;
  const h = Math.round(horas);
  const dias = Math.round((horas / 8) * 10) / 10;
  return (
    <section className="gs-card destaque" aria-label="Calculadora: quanto isso custa em horas de trabalho">
      <span className="gs-rotulo">Teste agora</span>
      <h2 className="gs-medio" style={{ margin: '4px 0 12px' }}>Quantas horas de trabalho custa o que você quer comprar?</h2>
      <CampoDinheiro rotulo="Quanto você ganha por mês?" valor={renda} onChange={setRenda} />
      <CampoDinheiro rotulo="Quanto custa o que você quer?" valor={preco} onChange={setPreco} />
      {horas > 0 ? (
        <div className="gs-card ivory" style={{ marginBottom: 12 }} aria-live="polite">
          <p className="gs-grande" style={{ margin: 0 }}>{h} {h === 1 ? 'hora' : 'horas'}</p>
          <p className="gs-sub" style={{ margin: '4px 0 8px' }}>do seu trabalho{dias >= 1 ? `, quase ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'}` : ''}. Ainda vale?</p>
          <p className="gs-banner" style={{ margin: 0 }}><Hourglass size={16} style={{ verticalAlign: '-3px' }} /> Regra das 72 horas: espere três dias. Se ainda quiser, compre sem culpa.</p>
        </div>
      ) : (
        <p className="gs-nota" style={{ margin: '0 0 14px' }}>Digite os dois valores. Considero 220 horas de trabalho por mês.</p>
      )}
      <Link to="/entrar" className="gs-btn cheio">Quero ser lembrado no WhatsApp <ArrowRight size={16} /></Link>
    </section>
  );
}

export function Landing({ resume, onStart, onResume }: { resume: number | null; onStart: () => void; onResume: () => void }) {
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <div className="gs-landing">
      <section style={{ textAlign: 'center', padding: '12px 0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Moeda tamanho={56} /></div>
        <span className="gs-etiqueta ouro" style={{ margin: '12px auto 0', display: 'flex', width: 'fit-content' }}>Grátis · entra com o WhatsApp</span>
        <h1 className="gs-titulo" style={{ fontSize: 34, lineHeight: '40px', margin: '14px 0 10px' }}>O app que te segura antes de gastar, não depois</h1>
        <p className="gs-sub" style={{ maxWidth: 460, margin: '0 auto 18px' }}>Você anota no WhatsApp, o app mostra quanto está livre e um assistente te lembra na hora certa.</p>
      </section>

      <Calculadora />

      <div className="gs-acoes" style={{ justifyContent: 'center', marginTop: 4 }}>
        {resume !== null ? (
          <button type="button" className="gs-btn sec" onClick={onResume}>Continuar meu diagnóstico (etapa {resume} de 7)</button>
        ) : (
          <button type="button" className="gs-btn sec" onClick={onStart}>Fazer meu diagnóstico (10 min)</button>
        )}
        <Link className="gs-btn link" to="/entrar">Já uso, entrar</Link>
      </div>

      <h2 className="gs-h2" style={{ textAlign: 'center' }}>O que você ganha</h2>
      <div className="gs-grade">
        {[
          [Hourglass, 'Segura a compra por impulso', 'Mostra o preço em horas de trabalho e te faz esperar 72 horas.'],
          [Wallet, 'Mostra quanto está livre', 'Depois das contas e do que você guarda, sobra quanto por dia.'],
          [Sparkles, 'Assistentes que lembram', 'Contas a vencer, hora de guardar, assinaturas que você nem usa.'],
        ].map(([Icone, titulo, texto], i) => {
          const I = Icone as typeof Wallet;
          return (
            <div className="gs-card" key={i} style={{ margin: 0, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span className="gs-avatar" style={{ flex: 'none', background: 'var(--bg-2)' }}><I size={20} aria-hidden="true" /></span>
              <div><b style={{ display: 'block', fontSize: 16 }}>{titulo as string}</b><span className="gs-mudo">{texto as string}</span></div>
            </div>
          );
        })}
      </div>

      <h2 className="gs-h2" style={{ textAlign: 'center' }}>Como funciona</h2>
      <ol className="gs-card" style={{ listStyle: 'none', margin: '0 0 16px', display: 'grid', gap: 14 }}>
        {[
          ['Anote', 'mercado 80 no pix, um áudio ou a foto do cupom, no WhatsApp.'],
          ['Veja', 'o app mostra o mês: contas, gastos e o que sobra por dia.'],
          ['Aja', 'o assistente certo te lembra do próximo passo, no dia.'],
        ].map(([t, x], i) => (
          <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="gs-check" style={{ flex: 'none', fontWeight: 700 }}>{i + 1}</span>
            <span><b>{t}</b> · <span className="gs-mudo">{x}</span></span>
          </li>
        ))}
      </ol>

      <section className="gs-card ivory" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <ShieldCheck size={26} color="var(--gold-strong)" style={{ flex: 'none' }} aria-hidden="true" />
        <div>
          <b style={{ display: 'block' }}>Sem senha de banco</b>
          <span className="gs-mudo">Você digita os valores à mão. Seus dados ficam no seu aparelho, ligados ao seu número, e você apaga tudo quando quiser.</span>
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
        <h2 className="gs-medio" style={{ marginBottom: 12 }}>Pronto pra gastar com a cabeça?</h2>
        <Link to="/entrar" className="gs-btn"><MessageCircle size={18} /> Entrar com o WhatsApp</Link>
      </section>
    </div>
  );
}
