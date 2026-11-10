import { useState } from 'react';
import { salvarGastoFixo } from './acoes';
import { Campo, CampoDinheiro, CampoNumero, Folha } from './ui';
import { toast } from '../components/ui/Toast';

/** Folha curta para cadastrar (ou editar) UMA conta fixa: quanto custa e que dia vence. Cada abertura começa limpa. */
export interface ContaInicial { id?: string; nome: string; categoria: string; valor?: number; dia?: number; nomeLivre?: boolean }

export function ContaRapida({ conta, onFechar }: { conta: ContaInicial | null; onFechar: () => void }) {
  // cada abertura monta o formulário do zero (key): nada de valor da conta anterior
  return conta ? <Formulario key={`${conta.id ?? 'nova'}:${conta.nome}`} conta={conta} onFechar={onFechar} /> : null;
}

function Formulario({ conta, onFechar }: { conta: ContaInicial; onFechar: () => void }) {
  const [nome, setNome] = useState(conta.nomeLivre ? '' : conta.nome);
  const [valor, setValor] = useState(conta.valor ?? 0);
  const [dia, setDia] = useState<number | ''>(conta.dia ?? '');
  const [tentou, setTentou] = useState(false);
  const nomeOk = nome.trim().length > 0;
  const diaOk = typeof dia === 'number' && dia >= 1 && dia <= 31;
  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    setTentou(true);
    if (!nomeOk || !(valor > 0) || !diaOk) return;
    if (!salvarGastoFixo({ id: conta.id, nome, valor, diaVencimento: dia as number, categoria: conta.categoria })) return;
    toast(`${nome.trim()} ${conta.id ? 'atualizada' : 'adicionada'}`);
    onFechar();
  };
  return (
    <Folha aberta onFechar={onFechar} titulo={conta.id ? `Editar ${conta.nome}` : conta.nomeLivre ? 'Outra conta fixa' : conta.nome}>
      <form onSubmit={salvar} noValidate>
        {conta.nomeLivre && <Campo rotulo="Nome da conta" valor={nome} onChange={setNome} placeholder="Ex.: Escola, Plano de saúde" maxLength={60} autoFocus erro={tentou && !nomeOk ? 'Dê um nome.' : undefined} />}
        <CampoDinheiro rotulo="Quanto custa por mês?" valor={valor} onChange={setValor} grande autoFocus={!conta.nomeLivre} erro={tentou && !(valor > 0) ? 'Digite o valor (ex.: 870).' : undefined} />
        <CampoNumero rotulo="Vence todo dia…" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 10" erro={tentou && !diaOk ? 'Digite um dia de 1 a 31.' : undefined} />
        <div className="gs-acoes">
          <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="gs-btn cheio">Salvar conta</button>
        </div>
      </form>
    </Folha>
  );
}
