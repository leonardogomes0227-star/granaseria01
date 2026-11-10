import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moeda } from '../components/ui/Moeda';
import { atualizar, useEstado } from './store';
import { CampoDinheiro, CampoNumero, Campo } from './ui';
import { salvarConfig, salvarGastoFixo, removerGastoFixo } from './acoes';
import { detalheDisponivel } from './selectores';
import { brl, hoje as hojeSP, mesDe } from './datas';
import { toast } from '../components/ui/Toast';
import { NovaDividaSheet } from './NovaDivida';
import { saldoAtual } from './dividas';

/* ---------- Primeira abertura: só a renda. O resto é opcional. ---------- */

export function FormRenda({ onFeito, rotuloBotao = 'Continuar', pular, concluir = true }: { onFeito?: () => void; rotuloBotao?: string; pular?: boolean; concluir?: boolean }) {
  const [renda, setRenda] = useState(0);
  const [dia, setDia] = useState<number | ''>('');
  const [horas, setHoras] = useState<number | ''>(220);
  const [ajustar, setAjustar] = useState(false);
  const [tentou, setTentou] = useState(false);
  const salvar = (semRenda = false) => {
    if (!semRenda && !(renda > 0)) return setTentou(true);
    atualizar((e) => ({
      ...e,
      config: { ...e.config, renda: semRenda ? e.config.renda : renda, diaSalario: typeof dia === 'number' && dia >= 1 && dia <= 31 ? dia : e.config.diaSalario, horasMes: typeof horas === 'number' && horas > 0 ? horas : 220, onboardingFeito: concluir || semRenda ? true : e.config.onboardingFeito },
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

const DESPESAS = [['Aluguel', 'Aluguel'], ['Luz', 'Luz'], ['Água', 'Água'], ['Internet', 'Internet'], ['Carro', 'Carro'], ['Outros', 'Outra']] as const;
const OBJETIVOS = ['Organizar meu mês', 'Sair das dívidas', 'Montar minha reserva', 'Comprar algo (viagem, moto…)', 'Começar a investir'];

/** Primeiro acesso em passos curtos. Tudo pode ser pulado e completado depois (o Início tem um checklist). */
export function Onboarding() {
  const e = useEstado();
  const nav = useNavigate();
  const [passo, setPasso] = useState(0);
  const [temDivida, setTemDivida] = useState<boolean | null>(null);
  const [temCartao, setTemCartao] = useState<boolean | null>(null);
  const [objetivo, setObjetivo] = useState('');
  const TOTAL = 5;
  const proximo = () => setPasso((p) => p + 1);
  const terminar = (rota?: string) => {
    salvarConfig({ onboardingFeito: true, objetivo: objetivo || e.config.objetivo });
    nav(rota ?? '/');
  };
  return (
    <div className="gs-card destaque" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Moeda tamanho={36} />
        <span className="gs-rotulo">{passo < TOTAL ? `Bem-vindo · passo ${passo + 1} de ${TOTAL}` : 'Tudo pronto'}</span>
      </div>
      {passo === 0 && (
        <>
          <h1 className="gs-titulo">Vamos começar pela sua renda</h1>
          <p className="gs-sub">Com ela eu mostro, em segundos, quanto sobra pra gastar hoje. Um valor aproximado já ajuda.</p>
          <FormRenda pular concluir={false} onFeito={proximo} rotuloBotao="Continuar" />
        </>
      )}
      {passo === 1 && <PassoDespesas onFeito={proximo} />}
      {passo === 2 && <PassoSimNao titulo="Você tem dívidas?" texto="Parcelas, empréstimos, cartão no rotativo. Sem julgamento: saber é o primeiro passo para resolver." valor={temDivida} onEscolher={(v) => { setTemDivida(v); proximo(); }} sim="Sim, tenho" nao="Não tenho" />}
      {passo === 3 && <PassoSimNao titulo="Você usa cartão de crédito?" texto="Eu acompanho limite, fatura e parcelas para a fatura não te pegar de surpresa." valor={temCartao} onEscolher={(v) => { setTemCartao(v); proximo(); }} sim="Sim, uso" nao="Não uso" />}
      {passo === 4 && (
        <>
          <h1 className="gs-titulo">Qual é o seu principal objetivo?</h1>
          <p className="gs-sub">Escolha um. Você pode mudar quando quiser.</p>
          <div className="gs-chips" role="group" aria-label="Objetivo">
            {OBJETIVOS.map((o) => <button key={o} type="button" className={`gs-chip ${objetivo === o ? 'on' : ''}`} onClick={() => setObjetivo(o)}>{o}</button>)}
          </div>
          <div className="gs-acoes">
            <button type="button" className="gs-btn cheio" onClick={() => { salvarConfig({ objetivo: objetivo || undefined }); proximo(); }}>{objetivo ? 'Ver minha situação' : 'Pular e ver minha situação'}</button>
          </div>
        </>
      )}
      {passo >= TOTAL && <PrimeiraVisao temDivida={temDivida} temCartao={temCartao} onIr={terminar} />}
      {passo > 0 && passo < TOTAL && passo !== 1 && passo !== 4 && <button type="button" className="gs-btn link" onClick={proximo}>Pular esta pergunta</button>}
    </div>
  );
}

function PassoDespesas({ onFeito }: { onFeito: () => void }) {
  const e = useEstado();
  const [nome, setNome] = useState('Aluguel');
  const [custom, setCustom] = useState('');
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState<number | ''>('');
  const [erro, setErro] = useState('');
  const [parcela, setParcela] = useState(false);
  /** Adiciona a conta digitada. Devolve true se entrou (e limpa os campos); false mostra o que falta. */
  const adicionar = (): boolean => {
    const n = nome === 'Outros' ? custom.trim() : nome;
    const falha = (m: string) => { setErro(m); return false; };
    if (!n) return falha('Dê um nome para a conta.');
    if (!(valor > 0)) return falha('Digite o valor.');
    if (typeof dia !== 'number' || dia < 1 || dia > 31) return falha('Informe o dia do vencimento (1 a 31).');
    if (!salvarGastoFixo({ nome: n, valor, diaVencimento: dia, categoria: nome, criadaEm: hojeSP() })) return falha('Confira os dados.');
    setValor(0); setDia(''); setCustom(''); setErro('');
    toast(`${n} adicionada`);
    return true;
  };
  // quem preencheu e apertou "Continuar" não perde a conta: ela entra antes de seguir
  const preenchido = valor > 0 || dia !== '' || (nome === 'Outros' && custom.trim() !== '');
  /** Trocar de tipo (Aluguel → Luz) começa uma conta nova: se a atual estava completa, ela entra; senão, os campos limpam. */
  const trocarTipo = (k: string) => {
    if (k === nome) return;
    if (valor > 0 && typeof dia === 'number' && (nome !== 'Outros' || custom.trim())) adicionar();
    setNome(k); setValor(0); setDia(''); setCustom(''); setErro('');
  };
  const continuar = () => {
    if (preenchido && !adicionar()) return;
    onFeito();
  };
  return (
    <>
      <h1 className="gs-titulo">Quais são suas principais despesas fixas?</h1>
      <p className="gs-sub">Contas que se repetem todo mês. Cadastre as maiores; as outras você completa depois.</p>
      <div className="gs-chips" role="group" aria-label="Tipo de conta">
        {DESPESAS.map(([k, r]) => <button key={k} type="button" className={`gs-chip ${nome === k ? 'on' : ''}`} aria-pressed={nome === k} onClick={() => trocarTipo(k)}>{r}</button>)}
      </div>
      {nome === 'Outros' && <Campo rotulo="Nome da conta" valor={custom} onChange={setCustom} maxLength={40} />}
      <CampoDinheiro rotulo="Valor por mês" valor={valor} onChange={setValor} />
      <CampoNumero rotulo="Dia do vencimento" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 10" />
      {erro && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
      <button type="button" className="gs-btn sec" onClick={adicionar}>+ Adicionar esta conta e cadastrar outra</button>
      {e.gastosFixos.length > 0 && (
        <div style={{ margin: '12px 0' }}>
          {e.gastosFixos.map((g) => (
            <div className="gs-linha" key={g.id}>
              <div className="gs-corpo"><b>{g.nome}</b><small>{brl(g.valor)} · dia {g.diaVencimento}</small></div>
              <button type="button" className="gs-btn link" onClick={() => removerGastoFixo(g.id)}>Remover</button>
            </div>
          ))}
        </div>
      )}
      <div className="gs-parcelas-bloco">
        <b>Tem parcela de casa, carro ou loja?</b>
        <p className="gs-nota" style={{ margin: '2px 0 8px' }}>Financiamento tem número de parcelas e acaba um dia. Cadastre aqui com quantas faltam e eu mostro quando termina.</p>
        <button type="button" className="gs-btn sec pequeno" onClick={() => setParcela(true)}>+ Cadastrar parcela (casa, carro, loja)</button>
        {e.dividas.length > 0 && e.dividas.map((d) => (
          <div className="gs-linha" key={d.id}><div className="gs-corpo"><b>{d.nome}</b><small>{brl(d.parcelaMinima)} por mês{d.parcelasRestantes ? ` · faltam ${d.parcelasRestantes} parcelas` : ''} · deve {brl(saldoAtual(d))}</small></div></div>
        ))}
      </div>
      <NovaDividaSheet aberta={parcela} onFechar={() => setParcela(false)} />
      <div className="gs-acoes">
        <button type="button" className="gs-btn cheio" onClick={continuar}>{preenchido ? 'Adicionar e continuar' : e.gastosFixos.length ? 'Continuar' : 'Pular por agora'}</button>
      </div>
    </>
  );
}

function PassoSimNao({ titulo, texto, valor, onEscolher, sim, nao }: { titulo: string; texto: string; valor: boolean | null; onEscolher: (v: boolean) => void; sim: string; nao: string }) {
  return (
    <>
      <h1 className="gs-titulo">{titulo}</h1>
      <p className="gs-sub">{texto}</p>
      <div className="gs-acoes">
        <button type="button" className={`gs-btn ${valor === true ? 'cheio' : ''}`} onClick={() => onEscolher(true)}>{sim}</button>
        <button type="button" className="gs-btn sec" onClick={() => onEscolher(false)}>{nao}</button>
      </div>
    </>
  );
}

function PrimeiraVisao({ temDivida, temCartao, onIr }: { temDivida: boolean | null; temCartao: boolean | null; onIr: (rota?: string) => void }) {
  const e = useEstado();
  const d = useMemo(() => detalheDisponivel(e, mesDe(hojeSP()), hojeSP()), [e]);
  const proximos: [string, string][] = [];
  if (temDivida) proximos.push(['Cadastrar minhas dívidas', '/plano/dividas']);
  if (temCartao) proximos.push(['Cadastrar meu cartão', '/plano/cartao']);
  return (
    <>
      <h1 className="gs-titulo">Sua primeira visão</h1>
      {d.modo === 'incompleto' ? (
        <p className="gs-sub">Você pulou a renda, então ainda não sei quanto você pode gastar. Sem problema: informe depois no Início.</p>
      ) : (
        <p className="gs-sub">
          Pelo que você me contou, você pode gastar cerca de <b>{brl(d.porDia)}</b> por dia até o fim do mês. É uma <b>estimativa</b>: ela fica mais certeira quando você registra gastos e informa seu saldo.
        </p>
      )}
      <div className="gs-acoes">
        {proximos.map(([t, r]) => <button key={r} type="button" className="gs-btn sec" onClick={() => onIr(r)}>{t}</button>)}
        <button type="button" className="gs-btn cheio" onClick={() => onIr()}>Ir para o início</button>
      </div>
      <p className="gs-nota">No Início tem um checklist para completar o resto no seu ritmo.</p>
    </>
  );
}
