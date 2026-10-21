import { useMemo, useState } from 'react';
import { Check, Pause, Pencil, Trash2, Undo2 } from 'lucide-react';
import type { AgenteCustom } from './tipos';
import { situacaoDoAgente } from './agentesCustom';
import { atualizarAgente, desfazerRegistroAgente, registrarNoAgente, removerAgente } from './acoes';
import { Barra, CampoDinheiro, Confirmar, Folha } from './ui';
import { brl0 } from './datas';
import { CriarAgente } from './CriarAgente';
import { toast } from '../components/ui/Toast';
import { poucoMovimento } from '../lib/celebrar';
import confetti from 'canvas-confetti';

/* ---------- Cartão do agente criado por você ---------- */

export function CartaoAgente({ agente, hoje }: { agente: AgenteCustom; hoje: string }) {
  const s = useMemo(() => situacaoDoAgente(agente, hoje), [agente, hoje]);
  const [registrar, setRegistrar] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [editar, setEditar] = useState(false);
  const [v, setV] = useState(0);
  const valorBase = agente.tipo === 'juntar' || agente.tipo === 'metodo';
  const fazer = (valor: number) => {
    const antes = s.concluido;
    if (!registrarNoAgente(agente.id, valorBase ? valor : 1)) return;
    toast(valorBase ? `Registrado: ${brl0(valor)}` : 'Feito', { acao: { rotulo: 'Desfazer', onClick: () => desfazerRegistroAgente(agente.id) } });
    const depois = situacaoDoAgente({ ...agente, progresso: [...agente.progresso, { data: hoje, valor: valorBase ? valor : 1 }] }, hoje);
    if (!antes && depois.concluido) {
      atualizarAgente(agente.id, (a) => ({ ...a, concluidoEm: hoje }));
      if (!poucoMovimento()) void confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: ['#C5A059', '#B8860B', '#F9F6F0'] });
      toast(`${agente.nome}: meta batida. Parabéns!`, { duracao: 6000 });
    }
  };
  return (
    <div className="gs-card ivory" style={{ margin: '10px 0 0', opacity: agente.ativo ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="gs-avatar" style={{ color: agente.cor, background: 'var(--bg-2)', width: 48, height: 48 }} aria-hidden="true">{agente.avatar}</span>
        <div className="gs-corpo" style={{ flex: 1 }}><b>{agente.nome}</b><small className="gs-mudo" style={{ display: 'block' }}>{agente.ativo ? s.resumo : 'Pausado'}</small></div>
        <button type="button" className="gs-menu-pontos" aria-label={agente.ativo ? 'Pausar' : 'Retomar'} onClick={() => atualizarAgente(agente.id, (a) => ({ ...a, ativo: !a.ativo }))}><Pause size={17} /></button>
        <button type="button" className="gs-menu-pontos" aria-label="Editar" onClick={() => setEditar(true)}><Pencil size={17} /></button>
        <button type="button" className="gs-menu-pontos" aria-label="Excluir" onClick={() => setApagar(true)}><Trash2 size={17} /></button>
      </div>
      <Barra pct={s.pct} rotulo={`Progresso de ${agente.nome}`} tom={s.concluido ? 'ok' : ''} />
      <p className="gs-sub" style={{ margin: '10px 0 0' }}>{s.proximoPasso}</p>
      {agente.ativo && !s.concluido && (
        <div className="gs-acoes" style={{ marginTop: 10 }}>
          <button type="button" className="gs-btn pequeno" onClick={() => (valorBase ? (setV(s.sugestao), setRegistrar(true)) : fazer(1))}><Check size={16} /> {s.rotuloBotao}</button>
          {agente.progresso.length > 0 && <button type="button" className="gs-btn link" onClick={() => { desfazerRegistroAgente(agente.id); toast('Último registro desfeito'); }}><Undo2 size={15} /> Desfazer último</button>}
        </div>
      )}
      {s.concluido && <span className="gs-etiqueta ouro" style={{ marginTop: 10 }}>Concluído</span>}
      <Folha aberta={registrar} onFechar={() => setRegistrar(false)} titulo={`Registrar em ${agente.nome}`}>
        <CampoDinheiro rotulo="Quanto você guardou?" valor={v} onChange={setV} grande />
        <div className="gs-acoes"><button type="button" className="gs-btn sec" onClick={() => setRegistrar(false)}>Cancelar</button><button type="button" className="gs-btn" disabled={!(v > 0)} onClick={() => { fazer(v); setRegistrar(false); }}>Registrar</button></div>
      </Folha>
      <CriarAgente aberta={editar} editar={agente} onFechar={() => setEditar(false)} />
      <Confirmar aberta={apagar} titulo={`Excluir ${agente.nome}?`} texto="O progresso e os valores guardados por ele saem também." rotulo="Excluir" onCancelar={() => setApagar(false)} onConfirmar={() => { removerAgente(agente.id); setApagar(false); }} />
    </div>
  );
}

