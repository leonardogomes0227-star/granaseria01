import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useEstado } from './store';
import { salvarConfig } from './acoes';
import { abrirAdicionar } from './AdicionarMov';
import { Barra } from './ui';

interface Passo { id: string; titulo: string; feito: boolean; rota?: string; acao?: () => void }

/** Checklist de configuração progressiva: sem pressão. "Agora não" dispensa o passo; some quando tudo está resolvido. */
export function Checklist({ onRenda }: { onRenda: () => void }) {
  const e = useEstado();
  const dispensados = new Set(e.config.checklistFeito ?? []);
  const passos: Passo[] = [
    { id: 'renda', titulo: 'Informar sua renda', feito: e.config.renda > 0, acao: onRenda },
    { id: 'fixas', titulo: 'Cadastrar despesas fixas', feito: e.gastosFixos.length > 0, rota: '/mes' },
    { id: 'gasto', titulo: 'Registrar o primeiro gasto', feito: e.lancamentos.length > 0, acao: () => abrirAdicionar() },
    { id: 'cartao', titulo: 'Adicionar seu cartão (se tiver)', feito: Boolean(e.cartao), rota: '/plano/cartao' },
    { id: 'dividas', titulo: 'Cadastrar dívidas (se tiver)', feito: e.dividas.length > 0, rota: '/plano/dividas' },
    { id: 'meta', titulo: 'Definir sua primeira meta', feito: e.metas.length > 0, rota: '/evolucao' },
  ];
  const resolvido = (p: Passo) => p.feito || dispensados.has(p.id);
  const feitos = passos.filter((p) => p.feito).length;
  if (passos.every(resolvido)) return null;
  const dispensar = (id: string) => salvarConfig({ checklistFeito: [...dispensados, id] });
  return (
    <section className="gs-card" aria-label="Configuração">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b>Configure no seu ritmo</b>
        <span className="gs-mudo gs-tab">{feitos} de {passos.length}</span>
      </div>
      <Barra pct={(feitos / passos.length) * 100} rotulo="Configuração" />
      {passos.filter((p) => !resolvido(p)).slice(0, 3).map((p) => (
        <div className="gs-linha" key={p.id}>
          <span className="gs-bolinha" aria-hidden="true" />
          <div className="gs-corpo"><b>{p.titulo}</b></div>
          {p.rota ? <Link className="gs-btn sec pequeno" to={p.rota}>Fazer</Link> : <button type="button" className="gs-btn sec pequeno" onClick={p.acao}>Fazer</button>}
          <button type="button" className="gs-btn link" onClick={() => dispensar(p.id)}>Agora não</button>
        </div>
      ))}
      {feitos > 0 && <p className="gs-nota"><Check size={14} style={{ verticalAlign: -2 }} /> Já feito: {passos.filter((p) => p.feito).map((p) => p.titulo.toLowerCase()).join(', ')}.</p>}
    </section>
  );
}
