import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearPainelToken, painelToken } from '../painel';
import { apagarTudo, getEstado, STORE_KEY, substituir } from './store';
import { salvarConfig } from './acoes';
import { Campo, CampoDinheiro, CampoNumero, Confirmar, Titulo } from './ui';
import { toast } from '../components/ui/Toast';
import { hoje } from './datas';
import { pedirPermissaoAvisos } from './avisos';

/* ---------- Meus dados: o que o app sabe de você, e o controle total ---------- */

export function MeusDados() {
  const navigate = useNavigate();
  const e0 = getEstado();
  const [nome, setNome] = useState(e0.config.nome ?? '');
  const [renda, setRenda] = useState(e0.config.renda);
  const [horas, setHoras] = useState<number | ''>(e0.config.horasMes);
  const [dia, setDia] = useState<number | ''>(e0.config.diaSalario ?? '');
  const [ant, setAnt] = useState<number | ''>(e0.config.avisos.antecedenciaDias);
  const [hora, setHora] = useState(e0.config.avisos.horario);
  const [pct, setPct] = useState<number | ''>(e0.config.reservaPct);
  const [apagar, setApagar] = useState<0 | 1 | 2>(0);
  const arquivo = useRef<HTMLInputElement>(null);

  const salvar = () => {
    salvarConfig({
      nome: nome.trim() || undefined,
      renda,
      horasMes: typeof horas === 'number' && horas > 0 ? horas : 220,
      diaSalario: typeof dia === 'number' && dia >= 1 && dia <= 31 ? dia : undefined,
      avisos: { antecedenciaDias: typeof ant === 'number' ? ant : 2, horario: /^\d{2}:\d{2}$/.test(hora) ? hora : '09:00' },
      reservaPct: typeof pct === 'number' && pct > 0 && pct <= 100 ? pct : 10,
      onboardingFeito: true,
    });
    toast('Dados salvos');
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(getEstado(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grana-seria-${hoje()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importar = async (f: File | undefined) => {
    if (!f) return;
    try {
      const novo = JSON.parse(await f.text());
      if (!novo || typeof novo !== 'object' || !('config' in novo)) throw new Error('formato');
      substituir(novo);
      toast('Dados importados');
      navigate(0);
    } catch {
      toast('Esse arquivo não parece ser um backup da Grana Séria.');
    }
  };

  return (
    <>
      <Titulo titulo="Meus dados" sub="Tudo fica no seu aparelho. Você manda e apaga quando quiser." />
      <section className="gs-card">
        <Campo rotulo="Nome" valor={nome} onChange={setNome} placeholder="Como quer ser chamado" maxLength={40} />
        <CampoDinheiro rotulo="Renda por mês" valor={renda} onChange={setRenda} />
        <div className="gs-dois">
          <CampoNumero rotulo="Dia do salário" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 5" />
          <CampoNumero rotulo="Horas por mês" valor={horas} onChange={setHoras} min={1} max={744} />
        </div>
        <CampoNumero rotulo="Guardar quando o salário cai" valor={pct} onChange={setPct} min={1} max={100} sufixo="%" />
        <h2 className="gs-h2" style={{ marginTop: 8 }}>Avisos</h2>
        <div className="gs-dois">
          <CampoNumero rotulo="Avisar quantos dias antes" valor={ant} onChange={setAnt} min={0} max={10} />
          <Campo rotulo="Horário" valor={hora} onChange={setHora} tipo="time" />
        </div>
        <button type="button" className="gs-btn link" onClick={() => void pedirPermissaoAvisos().then((r) => toast(r === 'granted' ? 'Avisos ligados neste aparelho' : r === 'unsupported' ? 'Este navegador não mostra avisos. Eles aparecem aqui dentro do app.' : 'Sem permissão: os avisos aparecem aqui dentro do app.'))}>
          Ligar avisos neste aparelho
        </button>
        <div className="gs-acoes">
          <button type="button" className="gs-btn" onClick={salvar}>Salvar</button>
        </div>
      </section>

      <h2 className="gs-h2">Seus dados</h2>
      <section className="gs-card">
        <div className="gs-acoes" style={{ marginTop: 0 }}>
          <button type="button" className="gs-btn sec" onClick={exportar}>Exportar (JSON)</button>
          <button type="button" className="gs-btn sec" onClick={() => arquivo.current?.click()}>Importar</button>
          <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={(ev) => void importar(ev.target.files?.[0])} />
        </div>
        <p className="gs-nota">O backup tem tudo: contas, gastos, dívidas, assistentes. Importar substitui o que está no app agora.</p>
      </section>

      <section className="gs-card">
        <div className="gs-linha"><div className="gs-corpo"><b>Conta</b><small>{painelToken() ? 'Ligada ao seu WhatsApp' : 'Sem WhatsApp ligado'}</small></div>
          <Link to="/conta" className="gs-btn pequeno sec">Entrar com e-mail</Link></div>
        {painelToken() && (
          <div className="gs-linha"><div className="gs-corpo"><b>Sair deste aparelho</b><small>Seus dados continuam guardados aqui.</small></div>
            <button type="button" className="gs-btn pequeno sec" onClick={() => { clearPainelToken(); navigate('/'); }}>Sair</button></div>
        )}
        <div className="gs-linha"><div className="gs-corpo"><b>Sobre e avisos</b><small>Conteúdo educativo, privacidade e termos.</small></div>
          <Link to="/sobre" className="gs-btn pequeno sec">Abrir</Link></div>
      </section>

      <section className="gs-card perigo">
        <b>Apagar todos os dados</b>
        <p className="gs-sub" style={{ margin: '4px 0 12px' }}>Remove tudo deste aparelho: renda, contas, gastos, dívidas e assistentes. Não dá pra desfazer.</p>
        <button type="button" className="gs-btn perigo" onClick={() => setApagar(1)}>Apagar tudo</button>
      </section>

      <Confirmar aberta={apagar === 1} titulo="Apagar tudo?" texto="Você vai perder todos os dados do app neste aparelho." rotulo="Continuar" onCancelar={() => setApagar(0)} onConfirmar={() => setApagar(2)} />
      <Confirmar
        aberta={apagar === 2}
        titulo="Tem certeza?"
        texto="Última chance: depois disso o app volta ao começo."
        digitar="APAGAR"
        rotulo="Apagar tudo agora"
        onCancelar={() => setApagar(0)}
        onConfirmar={() => {
          apagarTudo();
          try {
            localStorage.removeItem(STORE_KEY);
          } catch {
            // sem localStorage
          }
          setApagar(0);
          navigate('/');
        }}
      />
    </>
  );
}
