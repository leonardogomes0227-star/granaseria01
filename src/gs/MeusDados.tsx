import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apagarCopiaDoNumero, limparCopiaDoNumero, clearPainelToken, painelToken, startPainelSync, stopPainelSync } from '../painel';
import { CHAVE_PERMITIR, guardarCopiaLocal } from '../sync';
import { SecaoRecuperar } from './RecuperarDados';
import { apagarCopiaDaConta, clearLocalData, limparCopiaDaConta, stopSync } from '../sync';
import { apagarTudo, getEstado, STORE_KEY, substituir } from './store';
import { salvarConfig } from './acoes';
import { Campo, CampoDinheiro, CampoNumero, Confirmar, Titulo } from './ui';
import { toast } from '../components/ui/Toast';
import { hoje } from './datas';
import { pedirPermissaoAvisos } from './avisos';

/* ---------- Meus dados: o que o app sabe de você, e o controle total ---------- */

/** Preferências deste aparelho que não vão para o servidor (histórico do coach, ocultar valores, última conta). */
const PREFERENCIAS_LOCAIS = ['gs-coach-conversa', 'gs-ocultar-valores', 'gs-ultima-conta'];

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
  const [limpar, setLimpar] = useState<0 | 1 | 2>(0);
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
      // importar é de propósito: vale mesmo que o arquivo tenha menos dados que a conta (src/sync.ts)
      guardarCopiaLocal(JSON.stringify(getEstado()));
      try { localStorage.setItem(CHAVE_PERMITIR, '1'); } catch { /* sem armazenamento */ }
      substituir(novo);
      toast('Dados importados');
      navigate(0);
    } catch {
      toast('Esse arquivo não parece ser um backup da Grana Séria.');
    }
  };

  return (
    <>
      <Titulo titulo="Meus dados" sub="Seus dados ficam no aparelho e na sua conta." />
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
      <SecaoRecuperar />

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

      <section className="gs-card perigo" id="limpar" aria-label="Limpar meus dados">
        <b>Limpar tudo e recomeçar</b>
        <p className="gs-sub" style={{ margin: '4px 0 8px' }}>Zera os seus dados e <b>mantém a sua conta e o WhatsApp conectados</b>. Você não precisa entrar de novo.</p>
        <ul className="gs-lista-simples">
          <li><b>No site:</b> renda, contas, gastos, receitas, dívidas, metas, cartão, histórico do coach e preferências, neste aparelho e na cópia da conta.</li>
          <li><b>No WhatsApp:</b> gastos e entradas anotados por mensagem, seu plano e a conversa com o assistente.</li>
        </ul>
        <p className="gs-nota">Não dá pra desfazer. Se quiser guardar uma cópia antes, use "Exportar (JSON)" aqui em cima.</p>
        <button type="button" className="gs-btn perigo" onClick={() => setLimpar(1)}>Limpar tudo</button>
      </section>

      <section className="gs-card">
        <b>Apagar conta e desconectar</b>
        <p className="gs-sub" style={{ margin: '4px 0 12px' }}>Faz o mesmo que "Limpar tudo" e ainda apaga o acesso: o link do painel e a conta de e-mail. Para voltar, você precisa conectar o WhatsApp de novo.</p>
        <button type="button" className="gs-btn sec" onClick={() => setApagar(1)}>Apagar conta e desconectar</button>
      </section>

      <Confirmar aberta={limpar === 1} titulo="Limpar tudo?" texto="Você vai perder todos os dados do app e do WhatsApp. Sua conta e a conexão com o WhatsApp continuam." rotulo="Continuar" onCancelar={() => setLimpar(0)} onConfirmar={() => setLimpar(2)} />
      <Confirmar
        aberta={limpar === 2}
        titulo="Última confirmação"
        texto="Para confirmar, digite a palavra abaixo. Depois disso não há como recuperar."
        digitar="LIMPAR"
        rotulo="Limpar tudo agora"
        onCancelar={() => setLimpar(0)}
        onConfirmar={async () => {
          // primeiro o servidor: se não der pra limpar, não finge que limpou e não mexe no aparelho
          stopPainelSync();
          stopSync();
          const [numero, conta] = await Promise.all([limparCopiaDoNumero(), limparCopiaDaConta().catch(() => false)]);
          if (!numero || !conta) {
            void startPainelSync().catch(() => undefined);
            toast('Não consegui limpar a cópia guardada no servidor. Nada foi apagado neste aparelho. Confira a internet e tente de novo.');
            setLimpar(0);
            return;
          }
          const nomeAntes = (() => { try { return localStorage.getItem('gs-nome'); } catch { return null; } })();
          apagarTudo();
          clearLocalData();
          for (const k of [STORE_KEY, ...PREFERENCIAS_LOCAIS]) {
            try { localStorage.removeItem(k); } catch { /* sem localStorage */ }
          }
          if (nomeAntes) { try { localStorage.setItem('gs-nome', nomeAntes); } catch { /* sem localStorage */ } }
          setLimpar(0);
          window.location.assign('/'); // recarrega: a sincronização recomeça já com tudo vazio
        }}
      />
      <Confirmar aberta={apagar === 1} titulo="Apagar conta e desconectar?" texto="Além dos dados, você perde o acesso: o link do painel e a conta de e-mail. Para voltar, precisa conectar o WhatsApp de novo." rotulo="Continuar" onCancelar={() => setApagar(0)} onConfirmar={() => setApagar(2)} />
      <Confirmar
        aberta={apagar === 2}
        titulo="Última confirmação"
        texto="Para confirmar, digite a palavra abaixo. Depois disso não há como recuperar."
        digitar="APAGAR"
        rotulo="Apagar conta agora"
        onCancelar={() => setApagar(0)}
        onConfirmar={async () => {
          // primeiro a cópia no servidor: se não der pra apagar, não finge que apagou e não mexe no aparelho
          stopPainelSync();
          const [numero, conta] = await Promise.all([apagarCopiaDoNumero(), apagarCopiaDaConta().catch(() => false)]);
          if (!numero || !conta) {
            void startPainelSync().catch(() => undefined);
            toast('Não consegui apagar a cópia guardada no servidor. Nada foi apagado neste aparelho. Confira a internet e tente de novo.');
            setApagar(0);
            return;
          }
          apagarTudo();
          clearLocalData();
          try {
            localStorage.removeItem(STORE_KEY);
          } catch {
            // sem localStorage
          }
          for (const k of PREFERENCIAS_LOCAIS) {
            try { localStorage.removeItem(k); } catch { /* sem localStorage */ }
          }
          setApagar(0);
          toast('Tudo limpo: site e WhatsApp. Você pode começar de novo.');
          navigate('/');
        }}
      />
    </>
  );
}
