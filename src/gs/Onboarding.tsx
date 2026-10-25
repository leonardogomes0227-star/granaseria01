import { useState } from 'react';
import { Moeda } from '../components/ui/Moeda';
import { atualizar } from './store';
import { CampoDinheiro, CampoNumero } from './ui';

/* ---------- Primeira abertura: só a renda. O resto é opcional. ---------- */

export function FormRenda({ onFeito, rotuloBotao = 'Continuar', pular }: { onFeito?: () => void; rotuloBotao?: string; pular?: boolean }) {
  const [renda, setRenda] = useState(0);
  const [dia, setDia] = useState<number | ''>('');
  const [horas, setHoras] = useState<number | ''>(220);
  const [ajustar, setAjustar] = useState(false);
  const [tentou, setTentou] = useState(false);
  const salvar = (semRenda = false) => {
    if (!semRenda && !(renda > 0)) return setTentou(true);
    atualizar((e) => ({
      ...e,
      config: { ...e.config, renda: semRenda ? e.config.renda : renda, diaSalario: typeof dia === 'number' && dia >= 1 && dia <= 31 ? dia : e.config.diaSalario, horasMes: typeof horas === 'number' && horas > 0 ? horas : 220, onboardingFeito: true },
    }));
    onFeito?.();
  };
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        salvar();
      }}
    >
      <CampoDinheiro rotulo="Quanto você recebe por mês?" valor={renda} onChange={setRenda} grande autoFocus erro={tentou && !(renda > 0) ? 'Digite um valor maior que zero.' : undefined} />
      <CampoNumero rotulo="Dia em que o salário cai (opcional)" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 5" />
      {ajustar ? (
        <CampoNumero rotulo="Horas de trabalho por mês" valor={horas} onChange={setHoras} min={1} max={744} placeholder="220" />
      ) : (
        <button type="button" className="gs-btn link" onClick={() => setAjustar(true)}>
          Ajustar horas de trabalho por mês (padrão 220)
        </button>
      )}
      <div className="gs-acoes">
        <button type="submit" className="gs-btn cheio">{rotuloBotao}</button>
        {pular && (
          <button type="button" className="gs-btn link" onClick={() => salvar(true)}>
            Pular por agora
          </button>
        )}
      </div>
    </form>
  );
}

export function Onboarding() {
  return (
    <div className="gs-card destaque" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Moeda tamanho={36} />
        <span className="gs-rotulo">Bem-vindo à Grana Séria</span>
      </div>
      <h1 className="gs-titulo">Vamos começar pela sua renda</h1>
      <p className="gs-sub">Com ela eu mostro, em segundos, quanto sobra pra gastar hoje.</p>
      <FormRenda pular rotuloBotao="Ver meu mês" />
    </div>
  );
}
