import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useEstado } from './store';
import { ASSISTENTES, type Assistente } from './assistentes';
import { assistenteAtivo } from './insights';
import { configurarAssistente, ligarAssistente, salvarConfig } from './acoes';
import { contasDoMes } from './selectores';
import { AvatarAssistente, Folha, Titulo, CampoNumero, Campo } from './ui';
import { diaCurto, somaDias, mesDe } from './datas';
import { useHoje } from './useHoje';
import { CartaoAgente } from './CartaoAgente';
import { CriarAgente } from './CriarAgente';
import { LIMITE_AGENTES } from './acoes';
import { toast } from '../components/ui/Toast';

/* ---------- Assistentes: quem cuida de quê. Ligue os que fazem sentido pra você. ---------- */

function proximoAviso(e: ReturnType<typeof useEstado>, id: string, hoje: string): string | null {
  if (id === 'contas') {
    const c = contasDoMes(e, mesDe(hoje), hoje).find((x) => x.estado !== 'paga');
    return c ? diaCurto(somaDias(c.vencimento, -e.config.avisos.antecedenciaDias) < hoje ? hoje : somaDias(c.vencimento, -e.config.avisos.antecedenciaDias)) : null;
  }
  if (id === 'reserva' && e.config.diaSalario) {
    const d = String(e.config.diaSalario).padStart(2, '0');
    const este = `${hoje.slice(0, 7)}-${d}`;
    return diaCurto(este >= hoje ? este : `${somaMesStr(hoje.slice(0, 7))}-${d}`);
  }
  return null;
}
const somaMesStr = (m: string) => {
  const [y, n] = m.split('-').map(Number);
  return n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, '0')}`;
};

export function Assistentes() {
  const e = useEstado();
  const hoje = useHoje();
  const [aberto, setAberto] = useState<Assistente | null>(null);
  const [criar, setCriar] = useState(false);
  const meus = ASSISTENTES.filter((a) => assistenteAtivo(e, a.id));
  const outros = ASSISTENTES.filter((a) => !assistenteAtivo(e, a.id));
  const Card = ({ a }: { a: Assistente }) => {
    const ativo = assistenteAtivo(e, a.id);
    const aviso = ativo ? proximoAviso(e, a.id, hoje) : null;
    return (
      <div className="gs-assist">
        <button type="button" className="gs-assist-corpo" onClick={() => setAberto(a)} aria-label={`Configurar ${a.nome}`}>
          <AvatarAssistente id={a.id} tamanho={48} />
          <span className="gs-corpo">
            <b>{a.nome}</b>
            <small>{a.descricao}</small>
            {ativo && <small style={{ color: 'var(--gold-texto)' }}>Ativo{aviso ? ` · próximo aviso: ${aviso}` : ''}</small>}
          </span>
        </button>
        <button type="button" role="switch" aria-checked={ativo} className={`gs-switch ${ativo ? 'on' : ''}`} aria-label={`${ativo ? 'Desligar' : 'Ligar'} ${a.nome}`} onClick={() => { ligarAssistente(a.id, !ativo); toast(!ativo ? `${a.nome} ligado` : `${a.nome} desligado`); }}>
          <i />
        </button>
      </div>
    );
  };
  return (
    <>
      <Titulo titulo="Assistentes" sub="Ligue os lembretes que quiser." />
      <h2 className="gs-h2" style={{ marginTop: 0 }}>Meus assistentes</h2>
      <div className="gs-card">
        {meus.length === 0 ? <p className="gs-mudo" style={{ margin: 0 }}>Nenhum ligado. Escolha abaixo.</p> : meus.map((a) => <Card key={a.id} a={a} />)}
        {e.agentesCustom.length > 0 && e.agentesCustom.map((a) => <CartaoAgente key={a.id} agente={a} hoje={hoje} />)}
      </div>
      {outros.length > 0 && (
        <>
          <h2 className="gs-h2">Disponíveis</h2>
          <div className="gs-card">{outros.map((a) => <Card key={a.id} a={a} />)}</div>
        </>
      )}
      <button type="button" className="gs-card" style={{ width: '100%', border: '2px dashed var(--gold)', background: 'transparent', boxShadow: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 72 }} disabled={e.agentesCustom.length >= LIMITE_AGENTES} onClick={() => setCriar(true)}>
        <Plus size={20} /> <b>Criar meu agente</b>
        {e.agentesCustom.length >= LIMITE_AGENTES && <small>(limite de {LIMITE_AGENTES})</small>}
      </button>
      <ConfigAssistente assistente={aberto} onFechar={() => setAberto(null)} />
      <CriarAgente aberta={criar} onFechar={() => setCriar(false)} />
    </>
  );
}

function ConfigAssistente({ assistente, onFechar }: { assistente: Assistente | null; onFechar: () => void }) {
  const e = useEstado();
  const [ant, setAnt] = useState<number | ''>(e.config.avisos.antecedenciaDias);
  const [hora, setHora] = useState(e.config.avisos.horario);
  const [pct, setPct] = useState<number | ''>(e.config.reservaPct);
  return (
    <Folha aberta={Boolean(assistente)} onFechar={onFechar} titulo={assistente?.nome ?? ''}>
      <p className="gs-sub">{assistente?.descricao}</p>
      <div className="gs-dois">
        <CampoNumero rotulo="Avisar dias antes" valor={ant} onChange={setAnt} min={0} max={10} />
        <Campo rotulo="Horário do aviso" valor={hora} onChange={setHora} tipo="time" />
      </div>
      {assistente?.id === 'reserva' && <CampoNumero rotulo="Guardar quando o salário cai" sufixo="%" valor={pct} onChange={setPct} min={1} max={100} />}
      <div className="gs-acoes">
        {assistente && <Link to={assistente.rota} className="gs-btn sec" onClick={onFechar}>Abrir ferramenta</Link>}
        <button
          type="button"
          className="gs-btn"
          onClick={() => {
            salvarConfig({ avisos: { antecedenciaDias: typeof ant === 'number' ? ant : 2, horario: /^\d{2}:\d{2}$/.test(hora) ? hora : '09:00' }, ...(assistente?.id === 'reserva' && typeof pct === 'number' && pct > 0 ? { reservaPct: pct } : {}) });
            if (assistente) configurarAssistente(assistente.id, { antecedencia: typeof ant === 'number' ? ant : 2 });
            toast('Configuração salva');
            onFechar();
          }}
        >
          Salvar
        </button>
      </div>
    </Folha>
  );
}
