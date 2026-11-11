import { useEffect, useState } from 'react';
import { Car, CreditCard, Home, HelpCircle, Landmark, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react';
import { salvarDivida } from './acoes';
import { brl } from './datas';
import { completarParcelada } from './painelDividas';
import { Campo, CampoDinheiro, CampoNumero, Folha } from './ui';
import { toast } from '../components/ui/Toast';

/* ---------- Nova dívida, do jeito simples: que tipo é → quanto deve (e quanto paga por mês) → pronto ---------- */
// O juro vem de um valor comum para o tipo (e isso é dito na tela); quem sabe os detalhes usa o formulário completo.

// prazo: quantas parcelas costumam faltar nesse tipo, para estimar o total quando a pessoa só sabe a parcela
interface Tipo { nome: string; dica: string; juros: number; tipo: 'parcelada' | 'rotativa'; icone: LucideIcon; prazo: number }
const TIPOS: Tipo[] = [
  { nome: 'Cartão de crédito', dica: 'Fatura que não foi paga inteira', juros: 12, tipo: 'rotativa', icone: CreditCard, prazo: 0 },
  { nome: 'Empréstimo', dica: 'Banco, financeira ou consignado', juros: 4, tipo: 'parcelada', icone: Landmark, prazo: 24 },
  { nome: 'Financiamento da casa', dica: 'Casa ou apartamento (parcelas por muitos anos)', juros: 1, tipo: 'parcelada', icone: Home, prazo: 180 },
  { nome: 'Parcela do carro ou moto', dica: 'Financiamento de veículo', juros: 1.8, tipo: 'parcelada', icone: Car, prazo: 36 },
  { nome: 'Loja / crediário', dica: 'Compra parcelada na loja', juros: 5, tipo: 'parcelada', icone: ShoppingBag, prazo: 10 },
  { nome: 'Cheque especial', dica: 'Saldo negativo na conta', juros: 8, tipo: 'rotativa', icone: Wallet, prazo: 0 },
  { nome: 'Outra dívida', dica: 'Parente, amigo, outra coisa', juros: 0, tipo: 'parcelada', icone: HelpCircle, prazo: 12 },
];

export function NovaDividaSheet({ aberta, onFechar, onCompleto, tipoInicial }: { aberta: boolean; onFechar: () => void; onCompleto?: () => void; tipoInicial?: string }) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [t, setT] = useState<Tipo | null>(null);
  const [nome, setNome] = useState('');
  const [total, setTotal] = useState(0);
  const [mensal, setMensal] = useState(0);
  const [dia, setDia] = useState<number | ''>('');
  const [faltam, setFaltam] = useState<number | ''>('');
  const [estimado, setEstimado] = useState(false);
  const [erro, setErro] = useState('');
  const [feita, setFeita] = useState<{ nome: string; estimou: number; juros: number; calculado: boolean; totalEstimado: number; prazo: number } | null>(null);

  const zerar = () => { setPasso(1); setT(null); setNome(''); setTotal(0); setMensal(0); setDia(''); setFaltam(''); setEstimado(false); setErro(''); setFeita(null); };
  const fechar = () => { onFechar(); setTimeout(zerar, 200); };

  // abre já no tipo pedido (ex.: "Financiamento da casa" vindo do cadastro de contas)
  useEffect(() => {
    const pedido = tipoInicial ? TIPOS.find((x) => x.nome === tipoInicial) : undefined;
    if (aberta && pedido) { setT(pedido); setPasso(2); }
  }, [aberta, tipoInicial]);

  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!t) return;
    const n = typeof faltam === 'number' && faltam > 0 ? faltam : 0;
    if (!(total > 0) && !(mensal > 0)) return setErro('Informe pelo menos um valor: quanto deve no total, ou quanto paga por mês.');
    if (typeof dia === 'number' && (dia < 1 || dia > 31)) return setErro('O dia do vencimento vai de 1 a 31.');
    // saldo: o que a pessoa disse; sem isso, calculado pela parcela e pelo número de parcelas que faltam
    // só a parcela, sem saber o total nem quantas faltam: estimo pelo prazo comum do tipo e marco como estimativa
    const soParcela = !(total > 0) && mensal > 0 && n === 0;
    const prazo = soParcela ? t.prazo : 0;
    const saldo = total > 0 ? total : t.tipo === 'rotativa' && soParcela ? Math.round(mensal / (t.juros / 100 + 0.01)) : completarParcelada({ parcela: mensal, n: n || prazo || 12, juros: t.juros }).saldo;
    // juro: com saldo, parcela e parcelas que faltam, dá pra calcular o juro real; senão, o comum do tipo
    let juros = t.juros;
    let calculado = false;
    if (t.tipo === 'parcelada' && total > 0 && mensal > 0 && n > 0) {
      const c = completarParcelada({ parcela: mensal, n, saldo: total });
      if (c.juros > 0 && c.juros <= 15) { juros = c.juros; calculado = true; }
    }
    const estimou = mensal > 0 ? 0 : Math.max(10, Math.round(saldo * (juros / 100 + 0.01)));
    const final = nome.trim() || t.nome;
    const ok = salvarDivida({ nome: final, saldo, jurosMensal: juros, parcelaMinima: mensal > 0 ? mensal : estimou, venceDia: typeof dia === 'number' ? dia : undefined, tipo: t.tipo, estimado: estimado || soParcela, parcelasRestantes: n > 0 ? n : undefined });
    if (!ok) return setErro('Não consegui salvar. Confira o nome e o valor.');
    setFeita({ nome: final, estimou, juros, calculado, totalEstimado: soParcela ? saldo : 0, prazo: t.tipo === 'parcelada' && soParcela ? prazo || 12 : 0 });
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
          {onCompleto && <button type="button" className="gs-btn link" onClick={() => { fechar(); onCompleto(); }}>Já sei os detalhes (formulário completo)</button>}
        </>
      )}
      {passo === 2 && t && (
        <form onSubmit={salvar} noValidate>
          <p className="gs-sub" style={{ marginTop: 0 }}><b>{t.nome}</b>. Só o essencial; o resto você ajusta depois.</p>
          <CampoDinheiro rotulo="Quanto você deve no total?" valor={total} onChange={setTotal} grande autoFocus placeholder="Não sei" erro={erro && !(total > 0) && !(mensal > 0) ? erro : undefined} />
          <div className="gs-dois">
            <CampoDinheiro rotulo="Valor da parcela por mês" valor={mensal} onChange={setMensal} placeholder="Não sei" />
            <CampoNumero rotulo="Parcelas que faltam" valor={faltam} onChange={setFaltam} min={1} max={480} placeholder="Ex.: 36" />
          </div>
          <p className="gs-nota" style={{ marginTop: -6 }}>Basta um valor: o total <b>ou</b> a parcela. Não sabe o resto? Deixe em branco: eu estimo, marco como estimativa e você ajusta quando souber. Com total, parcela e quantas faltam, eu calculo o juro real.</p>
          <Campo rotulo="Nome ou credor (opcional)" valor={nome} onChange={setNome} placeholder="Ex.: Nubank, Banco do Brasil" maxLength={60} />
          <CampoNumero rotulo="Vence todo dia… (opcional)" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 10" />
          <label className="gs-check-linha"><input type="checkbox" checked={estimado} onChange={(ev) => setEstimado(ev.target.checked)} /> <span>Não tenho certeza do valor (é uma estimativa)</span></label>
          {erro && (total > 0 || mensal > 0) && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
          <div className="gs-acoes">
            <button type="button" className="gs-btn sec" onClick={() => { setPasso(1); setErro(''); }}>Voltar</button>
            <button type="submit" className="gs-btn cheio">Salvar dívida</button>
          </div>
        </form>
      )}
      {passo === 3 && feita && (
        <>
          <p className="gs-sub" style={{ marginTop: 0 }}><b>{feita.nome}</b> entrou na sua lista de dívidas.</p>
          {feita.juros > 0 && <p className="gs-nota">{feita.calculado ? <>Calculei o juro pela parcela: cerca de <b>{String(feita.juros).replace('.', ',')}% ao mês</b>.</> : <>Usei <b>{String(feita.juros).replace('.', ',')}% ao mês</b>, um juro comum para esse tipo. Se souber o juro certo, toque na dívida na lista e ajuste.</>}</p>}
          {feita.totalEstimado > 0 && <p className="gs-nota">Você não sabia o total, então estimei <b>{brl(feita.totalEstimado)}</b>{feita.prazo ? <> (umas {feita.prazo} parcelas, o comum para esse tipo)</> : null}. Está marcado como <b>valor estimado</b>. Quando souber, ajuste na lista de dívidas: o banco informa o saldo devedor no app ou no extrato.</p>}
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
