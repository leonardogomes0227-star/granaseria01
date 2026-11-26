import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { CHECKOUT_ANUAL, CHECKOUT_MENSAL, PRECO_ANUAL, PRECO_MENSAL, checkoutPronto } from '../config';
import { waLink } from '../whatsapp';
import { brl0 } from './datas';
import { Titulo } from './ui';

/* ---------- Planos: grátis, mensal e anual. Os preços e os links de pagamento ficam em src/config.ts ---------- */

const NO_PAGO = [
  'Painel completo: funil do mês, contas, gastos, dívidas e metas',
  'Seu caminho até sair das dívidas: a data em que você fica livre, e o que fazer a cada mês',
  'Um Coach que resolve com você, com os seus números, um passo de cada vez',
  'Anote pelo WhatsApp: "gastei 35 no mercado"',
  'Saiba antes de decidir: o que uma compra, um parcelamento ou um empréstimo fazem com a sua data',
  'Mande a fatura do cartão (PDF, foto ou texto) e veja para onde foi o dinheiro',
  'Reserva, metas e investir em passos, com dados reais do mercado',
  'Seus dados na sua conta, em qualquer aparelho',
];
const EM_BREVE = ['Lembretes das contas e do plano no WhatsApp'];

interface Cartao {
  id: 'mensal' | 'anual';
  nome: string;
  preco: string;
  detalhe: string;
  destaque?: string;
  itens: string[];
  breve?: string[];
}

const mensalNoAnual = Math.round((PRECO_ANUAL / 12) * 100) / 100;
const CARTOES: Cartao[] = [
  { id: 'mensal', nome: 'Mensal', preco: brl0(PRECO_MENSAL), detalhe: 'por mês', itens: NO_PAGO, breve: EM_BREVE },
  { id: 'anual', nome: 'Anual', preco: brl0(PRECO_ANUAL), detalhe: `por ano (${mensalNoAnual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por mês)`, destaque: `Melhor valor: ${Math.round((PRECO_MENSAL * 12 - PRECO_ANUAL) / PRECO_MENSAL)} meses de graça`, itens: NO_PAGO, breve: EM_BREVE },
];

function Botao({ c }: { c: Cartao }) {
  const url = c.id === 'mensal' ? CHECKOUT_MENSAL : CHECKOUT_ANUAL;
  if (checkoutPronto(url)) return <a href={url} target="_blank" rel="noopener noreferrer" className="lp-btn ouro" style={{ width: '100%' }}>Assinar {c.nome.toLowerCase()}</a>;
  return <a href={waLink(`Oi! Quero entrar na lista de acesso do plano ${c.nome.toLowerCase()} da Grana Séria.`)} target="_blank" rel="noopener noreferrer" className="lp-btn ouro" style={{ width: '100%' }}>Entrar na lista de acesso</a>;
}

/** Os três cartões. Usado na página /planos e na capa. */
export function CartoesPlanos({ semNota = false }: { semNota?: boolean }) {
  const aberto = CARTOES.some((c) => checkoutPronto(c.id === 'mensal' ? CHECKOUT_MENSAL : CHECKOUT_ANUAL));
  return (
    <>
      <div className="gs-planos">
        {CARTOES.map((c) => (
          <article key={c.id} className={`gs-plano ${c.id === 'anual' ? 'dest' : ''}`} aria-label={`Plano ${c.nome}`}>
            {c.destaque && <span className="gs-plano-selo">{c.destaque}</span>}
            <h3>{c.nome}</h3>
            <p className="gs-plano-preco"><b>{c.preco}</b> <small>{c.detalhe}</small></p>
            <ul>
              {c.itens.map((t) => <li key={t}><Check size={16} aria-hidden="true" /><span>{t}</span></li>)}
              {c.breve?.map((t) => <li key={t} className="breve"><Check size={16} aria-hidden="true" /><span>{t} <em>(em breve)</em></span></li>)}
            </ul>
            <Botao c={c} />
          </article>
        ))}
      </div>
      {!aberto && !semNota && <p className="gs-nota" style={{ textAlign: 'center' }}>A cobrança ainda não abriu, então por enquanto o app está todo liberado. Toque em “Quero ser avisado” e a gente te chama no WhatsApp quando abrir.</p>}
    </>
  );
}

export function Planos() {
  return (
    <>
      <Titulo titulo="Planos" sub={`Acesso completo ao Grana Séria: ${brl0(PRECO_MENSAL)} por mês, ou o anual com desconto.`} />
      <CartoesPlanos />
      <p className="gs-nota">Conteúdo educativo, não é consultoria financeira. Veja os <Link to="/termos-de-uso">termos de uso</Link> e a <Link to="/politica-de-privacidade">política de privacidade</Link>.</p>
    </>
  );
}
