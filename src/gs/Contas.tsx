import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useEstado } from './store';
import { criarConta, removerConta, renomearConta } from './acoes';
import { Campo, Folha } from './ui';
import { toast } from '../components/ui/Toast';

/** Gerenciar contas (onde o dinheiro está): criar, renomear e remover. Só organiza; não muda o "pode gastar". */
export function ContasSheet({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const e = useEstado();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const add = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!nome.trim()) return setErro('Dê um nome para a conta.');
    if (!criarConta(nome)) return setErro('Esse nome já existe (ou você atingiu o limite de 12 contas).');
    toast(`Conta criada: ${nome.trim()}`);
    setNome('');
    setErro('');
  };
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Minhas contas">
      <p className="gs-mudo" style={{ marginTop: 0 }}>Banco, carteira, poupança. Serve para organizar seus lançamentos e transferências; não altera quanto você pode gastar.</p>
      {e.contas.length === 0 && <p className="gs-nota">Nenhuma conta ainda. Crie a primeira abaixo.</p>}
      {e.contas.map((c) => (
        <div className="gs-linha" key={c.id}>
          <input className="gs-campo-inline" defaultValue={c.nome} maxLength={30} aria-label={`Nome da conta ${c.nome}`} onBlur={(ev) => ev.target.value.trim() && ev.target.value.trim() !== c.nome && renomearConta(c.id, ev.target.value)} />
          <button type="button" className="gs-icone-btn" aria-label={`Remover ${c.nome}`} onClick={() => (removerConta(c.id) ? toast(`${c.nome} removida`) : toast('Essa conta tem transferências e não pode ser removida'))}><Trash2 size={18} /></button>
        </div>
      ))}
      <form onSubmit={add} style={{ marginTop: 12 }}>
        <Campo rotulo="Nova conta" valor={nome} onChange={setNome} placeholder="Ex.: Nubank, Carteira" maxLength={30} erro={erro || undefined} />
        <button type="submit" className="gs-btn cheio">Adicionar conta</button>
      </form>
    </Folha>
  );
}
