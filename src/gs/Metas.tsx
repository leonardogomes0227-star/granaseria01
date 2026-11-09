import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useEstado } from './store';
import { criarMeta, desfazerGuardarNaMeta, guardarNaMeta, removerMeta, restaurarMeta } from './acoes';
import { progressoMeta } from './evolucaoLogica';
import { brl0, dataBR, diasEntre, hoje as hojeSP } from './datas';
import { Car, Home, Landmark, PiggyBank, Plane, Target, type LucideIcon } from 'lucide-react';
import { Barra, Campo, CampoDinheiro, Confirmar, Folha } from './ui';
import { apagarComDesfazer, toast } from '../components/ui/Toast';
import type { Meta } from './tipos';

const MODELOS: [string, LucideIcon][] = [['Reserva de emergência', PiggyBank], ['Comprar um carro', Car], ['Fazer uma viagem', Plane], ['Quitar dívidas', Landmark], ['Comprar um imóvel', Home], ['Outra meta', Target]];

/** Metas financeiras: "Você já guardou R$ 600 de R$ 2.000". Criar, guardar um valor, excluir com desfazer. */
export function Metas({ compacto = false }: { compacto?: boolean }) {
  const e = useEstado();
  const [nova, setNova] = useState(false);
  const [guardando, setGuardando] = useState<Meta | null>(null);
  const [apagar, setApagar] = useState<Meta | null>(null);
  const ativas = e.metas.filter((m) => progressoMeta(m).pct < 100);
  const concluidas = e.metas.filter((m) => progressoMeta(m).pct >= 100);
  return (
    <section aria-label="Metas financeiras">
      {e.metas.length === 0 ? (
        <div className="gs-card gs-vazio">
          <b>Qual é a sua primeira meta?</b>
          <p>Uma viagem, uma moto, a reserva de emergência. Dar um nome e um valor ajuda a guardar com propósito.</p>
          <button type="button" className="gs-btn" onClick={() => setNova(true)}>Criar uma meta</button>
        </div>
      ) : (
        <div className="gs-card">
          {(compacto ? ativas.slice(0, 2) : ativas).map((m) => {
            const p = progressoMeta(m);
            const meses = m.prazo ? Math.max(1, Math.ceil(diasEntre(hojeSP(), m.prazo) / 30)) : 0;
            return (
              <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b>{m.nome}</b>
                  <span className="gs-mudo gs-tab">{p.pct}%</span>
                </div>
                <p className="gs-mudo" style={{ margin: '2px 0 8px' }}>Você já guardou {brl0(p.guardado)} de {brl0(m.alvo)}{m.prazo ? ` · até ${dataBR(m.prazo)}` : ''}</p>
                {m.prazo && p.falta > 0 && <p className="gs-nota" style={{ margin: '-4px 0 8px' }}>{m.prazo < hojeSP() ? 'O prazo já passou: ajuste o valor ou a data.' : `Para chegar a tempo: cerca de ${brl0(p.falta / meses)} por mês.`}</p>}
                <Barra pct={p.pct} tom={p.pct >= 100 ? 'ok' : ''} rotulo={`Meta ${m.nome}`} />
                {!compacto && (
                  <div className="gs-acoes">
                    <button type="button" className="gs-btn sec pequeno" onClick={() => setGuardando(m)}>{p.pct >= 100 ? 'Meta atingida 🎉' : 'Guardar para esta meta'}</button>
                    <button type="button" className="gs-btn link" onClick={() => setApagar(m)}>Excluir</button>
                  </div>
                )}
              </div>
            );
          })}
          {ativas.length === 0 && <p className="gs-mudo" style={{ margin: '8px 0' }}>Todas as metas foram atingidas. Que tal criar a próxima?</p>}
          {!compacto && concluidas.length > 0 && (
            <details className="gs-avancado">
              <summary>Metas concluídas ({concluidas.length})</summary>
              {concluidas.map((m) => <div className="gs-linha" key={m.id}><div className="gs-corpo"><b>{m.nome}</b><small>{brl0(m.alvo)} guardados</small></div><span className="gs-badge ok">Concluída</span><button type="button" className="gs-btn link" onClick={() => setApagar(m)}>Excluir</button></div>)}
            </details>
          )}
          {!compacto && <button type="button" className="gs-btn link" onClick={() => setNova(true)}><Plus size={16} /> Nova meta</button>}
        </div>
      )}
      <NovaMeta aberta={nova} onFechar={() => setNova(false)} />
      <GuardarMeta meta={guardando} onFechar={() => setGuardando(null)} />
      <Confirmar aberta={Boolean(apagar)} titulo="Excluir esta meta?" texto={apagar ? `${apagar.nome} sai da lista. Você pode desfazer logo depois.` : ''} rotulo="Excluir" onCancelar={() => setApagar(null)} onConfirmar={() => { if (apagar) { const m = apagar; removerMeta(m.id); apagarComDesfazer(`${m.nome} excluída`, () => restaurarMeta(m)); } setApagar(null); }} />
    </section>
  );
}

export function NovaMeta({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const [nome, setNome] = useState('');
  const [alvo, setAlvo] = useState(0);
  const [prazo, setPrazo] = useState('');
  const [erro, setErro] = useState('');
  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!nome.trim()) return setErro('Dê um nome para a meta.');
    if (!(alvo > 0)) return setErro('Quanto você quer juntar?');
    if (prazo && prazo <= hojeSP()) return setErro('O prazo precisa ser uma data futura.');
    if (!criarMeta({ nome, alvo, prazo: prazo || undefined })) return setErro('Não consegui criar a meta.');
    toast(`Meta criada: ${nome.trim()}`);
    setNome(''); setAlvo(0); setPrazo(''); setErro('');
    onFechar();
  };
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Nova meta">
      <form onSubmit={salvar}>
        <div className="gs-cats" role="group" aria-label="Modelos de meta">
          {MODELOS.map(([n, I]) => <button key={n} type="button" className={`gs-cat ${nome === n ? 'on' : ''}`} aria-pressed={nome === n} onClick={() => setNome(n)}><I size={22} aria-hidden="true" /><span>{n}</span></button>)}
        </div>
        <Campo rotulo="Nome da meta (pode editar)" valor={nome} onChange={setNome} placeholder="Ex.: viagem, moto, reserva" maxLength={40} autoFocus erro={erro && !nome.trim() ? erro : undefined} />
        <CampoDinheiro rotulo="Quanto você quer juntar?" valor={alvo} onChange={setAlvo} erro={erro && nome.trim() && !(alvo > 0) ? erro : undefined} />
        <Campo rotulo="Até quando? (opcional)" valor={prazo} onChange={setPrazo} tipo="date" />
        {erro && nome.trim() && alvo > 0 && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
        <button type="submit" className="gs-btn cheio">Criar meta</button>
      </form>
    </Folha>
  );
}

function GuardarMeta({ meta, onFechar }: { meta: Meta | null; onFechar: () => void }) {
  const [valor, setValor] = useState(0);
  const [erro, setErro] = useState('');
  if (!meta) return null;
  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!(valor > 0)) return setErro('Digite quanto vai guardar.');
    const m = meta, v = valor, d = hojeSP();
    guardarNaMeta(m.id, v, d);
    toast(`${brl0(v)} guardados para ${m.nome}`, { acao: { rotulo: 'Desfazer', onClick: () => desfazerGuardarNaMeta(m.id, d, v) } });
    setValor(0); setErro('');
    onFechar();
  };
  return (
    <Folha aberta onFechar={onFechar} titulo={`Guardar para ${meta.nome}`}>
      <form onSubmit={salvar}>
        <CampoDinheiro rotulo="Quanto você guardou agora?" valor={valor} onChange={setValor} grande autoFocus erro={erro || undefined} />
        <p className="gs-nota">Esse valor sai do seu "pode gastar", porque já tem destino.</p>
        <button type="submit" className="gs-btn cheio">Guardar</button>
      </form>
    </Folha>
  );
}
