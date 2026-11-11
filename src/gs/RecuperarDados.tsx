import { useEffect, useState } from 'react';
import { buscarCopias, restaurarCopia } from '../painel';
import { lerCopiasLocais, type CopiaDeDados } from '../sync';
import { pesoDoEstado, reducaoBrusca } from './pesoEstado';
import { STORE_KEY } from './store';
import { Confirmar } from './ui';
import { toast } from '../components/ui/Toast';

/* ---------- Recuperar dados: as cópias de segurança (da conta e deste aparelho) e o botão de voltar para uma delas ---------- */
// O servidor guarda o estado anterior sempre que os dados diminuem; o aparelho guarda o dele antes de ser trocado pelo da conta.

type Copia = CopiaDeDados & { onde: 'conta' | 'aparelho' };
const quando = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? 'data desconhecida' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const pesoAtual = () => { try { return pesoDoEstado(localStorage.getItem(STORE_KEY)); } catch { return 0; } };

function useCopias(): Copia[] | null {
  const [copias, setCopias] = useState<Copia[] | null>(null);
  useEffect(() => {
    let vivo = true;
    void buscarCopias().then((daConta) => {
      if (!vivo) return;
      const todas: Copia[] = [...daConta.map((c) => ({ ...c, onde: 'conta' as const })), ...lerCopiasLocais().map((c) => ({ ...c, onde: 'aparelho' as const }))];
      // a mesma cópia pode estar nos dois lugares
      setCopias(todas.filter((c, i) => todas.findIndex((x) => x.estado === c.estado) === i).sort((a, b) => b.salvoEm.localeCompare(a.salvoEm)));
    });
    return () => { vivo = false; };
  }, []);
  return copias;
}

function useRestaurar() {
  const [escolhida, setEscolhida] = useState<Copia | null>(null);
  const folha = (
    <Confirmar
      aberta={Boolean(escolhida)}
      titulo={`Voltar para a cópia de ${escolhida ? quando(escolhida.salvoEm) : ''}?`}
      texto={`Ela tem ${escolhida?.peso ?? 0} registros. O que está no app agora (${pesoAtual()} registros) fica guardado como cópia neste aparelho, então dá para desfazer.`}
      rotulo="Restaurar"
      onCancelar={() => setEscolhida(null)}
      onConfirmar={() => {
        const c = escolhida!;
        setEscolhida(null);
        void restaurarCopia(c.estado).then(() => { toast('Dados restaurados'); window.location.reload(); });
      }}
    />
  );
  return { pedir: setEscolhida, folha };
}

/** Em Meus dados: a lista de cópias, com data e tamanho. */
export function SecaoRecuperar() {
  const copias = useCopias();
  const { pedir, folha } = useRestaurar();
  return (
    <section className="gs-card" id="recuperar" style={{ scrollMarginTop: 80 }}>
      <b>Recuperar dados</b>
      <p className="gs-nota" style={{ marginTop: 4 }}>Sempre que seus dados diminuem de uma vez, eu guardo a versão anterior. Agora você tem {pesoAtual()} registros.</p>
      {copias === null ? <p className="gs-mudo">Procurando cópias…</p> : copias.length === 0 ? <p className="gs-mudo">Nenhuma cópia guardada. Isso é normal quando nada foi trocado.</p> : copias.map((c) => (
        <div key={c.onde + c.salvoEm} className="gs-linha">
          <div className="gs-corpo"><b>{c.peso} registros</b><small>Guardada em {quando(c.salvoEm)} · {c.onde === 'conta' ? 'na sua conta' : 'neste aparelho'}</small></div>
          <button type="button" className="gs-btn sec pequeno" onClick={() => pedir(c)}>Restaurar</button>
        </div>
      ))}
      {folha}
    </section>
  );
}

const CHAVE_DISPENSADO = 'gs-copia-dispensada';
/** No Início: se existe uma cópia bem maior que os dados de agora, é sinal de que algo foi perdido. Oferece voltar. */
export function AvisoCopiaMaior() {
  const copias = useCopias();
  const { pedir, folha } = useRestaurar();
  const [fechado, setFechado] = useState(false);
  const atual = pesoAtual();
  const maior = (copias ?? []).filter((c) => reducaoBrusca(c.peso, atual)).sort((a, b) => b.peso - a.peso)[0];
  let dispensada = '';
  try { dispensada = localStorage.getItem(CHAVE_DISPENSADO) ?? ''; } catch { /* sem armazenamento */ }
  if (!maior || fechado || dispensada === maior.salvoEm) return <>{folha}</>;
  return (
    <section className="ini-recuperar" role="status">
      <b>Achei uma cópia dos seus dados com {maior.peso} registros</b>
      <p>Ela foi guardada em {quando(maior.salvoEm)}. Agora o app tem {atual}. Se você perdeu contas ou gastos, dá para voltar.</p>
      <div className="gs-acoes">
        <button type="button" className="gs-btn" onClick={() => pedir(maior)}>Restaurar meus dados</button>
        <button type="button" className="gs-btn link" onClick={() => { try { localStorage.setItem(CHAVE_DISPENSADO, maior.salvoEm); } catch { /* idem */ } setFechado(true); }}>Está certo assim</button>
      </div>
      {folha}
    </section>
  );
}
