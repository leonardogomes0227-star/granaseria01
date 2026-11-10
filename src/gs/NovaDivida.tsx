import { useState } from 'react';
import { Car, CreditCard, HelpCircle, Landmark, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react';
import { salvarDivida } from './acoes';
import { brl } from './datas';
import { Campo, CampoDinheiro, CampoNumero, Folha } from './ui';
import { toast } from '../components/ui/Toast';

/* ---------- Nova dívida, do jeito simples: que tipo é → quanto deve (e quanto paga por mês) → pronto ---------- */
// O juro vem de um valor comum para o tipo (e isso é dito na tela); quem sabe os detalhes usa o formulário completo.

interface Tipo { nome: string; dica: string; juros: number; tipo: 'parcelada' | 'rotativa'; icone: LucideIcon }
const TIPOS: Tipo[] = [
  { nome: 'Cartão de crédito', dica: 'Fatura que não foi paga inteira', juros: 12, tipo: 'rotativa', icone: CreditCard },
  { nome: 'Empréstimo', dica: 'Banco, financeira ou consignado', juros: 4, tipo: 'parcelada', icone: Landmark },
  { nome: 'Financiamento', dica: 'Carro, moto, casa', juros: 1.5, tipo: 'parcelada', icone: Car },
  { nome: 'Loja / crediário', dica: 'Compra parcelada na loja', juros: 5, tipo: 'parcelada', icone: ShoppingBag },
  { nome: 'Cheque especial', dica: 'Saldo negativo na conta', juros: 8, tipo: 'rotativa', icone: Wallet },
  { nome: 'Outra dívida', dica: 'Parente, amigo, outra coisa', juros: 0, tipo: 'parcelada', icone: HelpCircle },
];

export function NovaDividaSheet({ aberta, onFechar, onCompleto }: { aberta: boolean; onFechar: () => void; onCompleto: () => void }) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [t, setT] = useState<Tipo | null>(null);
  const [nome, setNome] = useState('');
  const [total, setTotal] = useState(0);
  const [mensal, setMensal] = useState(0);
  const [dia, setDia] = useState<number | ''>('');
  const [erro, setErro] = useState('');
  const [feita, setFeita] = useState<{ nome: string; estimou: number; juros: number } | null>(null);

  const zerar = () => { setPasso(1); setT(null); setNome(''); setTotal(0); setMensal(0); setDia(''); setErro(''); setFeita(null); };
  const fechar = () => { onFechar(); setTimeout(zerar, 200); };

  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!t) return;
    if (!(total > 0)) return setErro('Quanto você deve no total? Pode ser um valor aproximado.');
    if (typeof dia === 'number' && (dia < 1 || dia > 31)) return setErro('O dia do vencimento vai de 1 a 31.');
    const estimou = mensal > 0 ? 0 : Math.max(10, Math.round(total * (t.juros / 100 + 0.01)));
    const final = nome.trim() || t.nome;
    const ok = salvarDivida({ nome: final, saldo: total, jurosMensal: t.juros, parcelaMinima: mensal > 0 ? mensal : estimou, venceDia: typeof dia === 'number' ? dia : undefined, tipo: t.tipo });
    if (!ok) return setErro('Não consegui salvar. Confira o nome e o valor.');
    setFeita({ nome: final, estimou, juros: t.juros });
    toast(`Dívida cadastrada: ${final}`);
    setPasso(3);
  };

  return (
    <Folha aberta={aberta} onFechar={fechar} titulo={passo === 3 ? 'Pronto!' : 'Nova dívida'}>
      {passo === 1 && (
        <>
          <p className="gs-sub" style={{ marginTop: 0 }}>Que tipo de dívida é? Escolha a que mais se parece.</p>
          <div className="gs-tipos-divida">
            {TIPOS.map((x) => (
              <button key={x.nome} type="button" className="gs-tipo-divida" onClick={() => { setT(x); setPasso(2); }}>
                <x.icone size={22} aria-hidden="true" />
                <span><b>{x.nome}</b><small>{x.dica}</small></span>
              </button>
            ))}
          </div>
          <button type="button" className="gs-btn link" onClick={() => { fechar(); onCompleto(); }}>Já sei os detalhes (formulário completo)</button>
        </>
      )}
      {passo === 2 && t && (
        <form onSubmit={salvar} noValidate>
          <p className="gs-sub" style={{ marginTop: 0 }}><b>{t.nome}</b>. Só o essencial; o resto você ajusta depois.</p>
          <CampoDinheiro rotulo="Quanto você deve no total?" valor={total} onChange={setTotal} grande autoFocus erro={erro && !(total > 0) ? erro : undefined} />
          <CampoDinheiro rotulo="Quanto você paga por mês? (opcional)" valor={mensal} onChange={setMensal} placeholder="Não sei" />
          <p className="gs-nota" style={{ marginTop: -6 }}>Se deixar em branco, eu estimo e aviso na tela.</p>
          <Campo rotulo="Nome ou credor (opcional)" valor={nome} onChange={setNome} placeholder="Ex.: Nubank, Banco do Brasil" maxLength={60} />
          <CampoNumero rotulo="Vence todo dia… (opcional)" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 10" />
          {erro && (total > 0) && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
          <div className="gs-acoes">
            <button type="button" className="gs-btn sec" onClick={() => { setPasso(1); setErro(''); }}>Voltar</button>
            <button type="submit" className="gs-btn cheio">Salvar dívida</button>
          </div>
        </form>
      )}
      {passo === 3 && feita && (
        <>
          <p className="gs-sub" style={{ marginTop: 0 }}><b>{feita.nome}</b> entrou na sua lista de dívidas.</p>
          {feita.juros > 0 && <p className="gs-nota">Usei <b>{String(feita.juros).replace('.', ',')}% ao mês</b>, um juro comum para esse tipo. Se souber o juro certo, toque na dívida na lista e ajuste.</p>}
          {feita.estimou > 0 && <p className="gs-nota">Você não informou o valor mensal, então estimei <b>{brl(feita.estimou)}</b> por mês. Ajuste na lista quando souber.</p>}
          <div className="gs-acoes">
            <button type="button" className="gs-btn cheio" onClick={zerar}>Adicionar outra dívida</button>
            <button type="button" className="gs-btn sec" onClick={fechar}>Concluir</button>
          </div>
          <p className="gs-nota">Dívida em atraso (parcela que já venceu)? Anote em <b>Sair do atraso</b>: ela entra no plano de recuperação.</p>
        </>
      )}
    </Folha>
  );
}
