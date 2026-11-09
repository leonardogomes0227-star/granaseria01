import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import { getName } from '../painel';
import { useEstado } from './store';
import { brl, brl0, mesDe, nomeMes } from './datas';
import { detalheDisponivel, faltaPagar, fatiasDaRenda, fixosPagos, patrimonioGuardado, receitasRecebidas, totalVariaveis } from './selectores';
import { missaoDoDia, recomendacoes, situacaoFinanceira, type Recomendacao } from './coachRegras';
import { gastosPorCategoria } from './evolucaoLogica';
import { informarSaldo } from './acoes';
import { Rosca } from './Rosca';
import { CampoDinheiro, Folha, Titulo } from './ui';
import { FormRenda } from './Onboarding';
import { useHoje } from './useHoje';
import { ProximasAcoes } from './ProximasAcoes';
import { ResumoSemana } from './ResumoSemana';
import { ComoCalculei } from './ComoCalculei';
import { Metas } from './Metas';
import { Checklist } from './Checklist';
import { abrirAdicionar } from './AdicionarMov';
import { corDe } from './categorias';
import { toast } from '../components/ui/Toast';

/* ---------- Início: "Meu dia financeiro" ---------- */

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};
const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
const FRASE_SITUACAO = {
  'sem-dados': 'Vamos começar? Em poucos passos eu te mostro como está seu mês.',
  endividado: 'Hoje o foco é organizar as dívidas e as contas, um passo de cada vez.',
  atencao: 'Seu mês pede um pouco de atenção. Vamos olhar juntos.',
  organizado: 'Você está organizado. Vamos cuidar do seu dinheiro hoje?',
} as const;

export function Inicio() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [renda, setRenda] = useState(false);
  const [saldo, setSaldo] = useState(false);
  const [calc, setCalc] = useState(false);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const sit = useMemo(() => situacaoFinanceira(e, hoje), [e, hoje]);
  const recs = useMemo(() => recomendacoes(e, hoje), [e, hoje]);
  const missao = useMemo(() => missaoDoDia(e, hoje), [e, hoje]);
  const fatias = useMemo(() => fatiasDaRenda(e, mes), [e, mes]);
  const semRenda = e.config.renda <= 0;
  const cats = useMemo(() => gastosPorCategoria(e, mes).slice(0, 3), [e, mes]);
  const pendentes = e.gastosFixos.filter((g) => !g.pagamentos[mes]).length;

  const blocoAcoes = (
    <>
      <h2 className="gs-h2">Próximas ações</h2>
      <ProximasAcoes />
    </>
  );
  const blocoMetas = (
    <>
      <h2 className="gs-h2">Suas metas</h2>
      <Metas compacto />
      {e.metas.length > 0 && <Link to="/evolucao" className="gs-btn link">Ver todas as metas</Link>}
    </>
  );

  return (
    <>
      <Titulo titulo={`${saudacao()}${nome ? `, ${nome}` : ''}!`} sub={FRASE_SITUACAO[sit]} />

      {disp.modo === 'incompleto' ? (
        <section className="gs-cofre" aria-label="Quanto você pode gastar hoje">
          <span>Pode gastar hoje</span>
          <b style={{ fontSize: 28, lineHeight: 1.2 }}>Ainda não sei</b>
          <p>{disp.avisos[0]}</p>
          <div className="gs-acoes" style={{ marginTop: 14 }}>
            <button type="button" className="gs-btn" onClick={() => setRenda(true)}>Informar minha renda</button>
            <button type="button" className="gs-btn sec" onClick={() => setSaldo(true)}>Informar meu saldo</button>
          </div>
        </section>
      ) : (
        <button type="button" className="gs-cofre gs-cofre-btn" onClick={() => setCalc(true)} aria-label="Quanto você pode gastar hoje. Toque para ver como foi calculado.">
          <span>Pode gastar hoje{disp.temEstimativa ? ' · estimado' : ' · confirmado'}</span>
          <b>{brl(disp.porDia)}</b>
          <p>
            {disp.livre < 0 ? `Seus compromissos passam ${brl0(-disp.livre)} do que você tem neste mês.` : `${brl0(disp.livre)} livres no mês · ${disp.diasRestantes} ${disp.diasRestantes === 1 ? 'dia' : 'dias'} até o fim`}
          </p>
          <p className="gs-cofre-como">Como calculei <ChevronRight size={14} aria-hidden="true" /></p>
        </button>
      )}
      {disp.modo !== 'incompleto' && disp.avisos.length > 0 && <p className="gs-nota" style={{ margin: '-6px 4px 14px' }}>{disp.avisos[0]}</p>}

      {sit === 'sem-dados' && <Checklist onRenda={() => setRenda(true)} />}

      <CoachCard rec={recs[0]} />

      <section className="gs-card gs-missao" aria-label="Missão financeira de hoje">
        <span className="gs-rotulo">Minha missão financeira de hoje</span>
        <b>{missao.titulo}</b>
        <p className="gs-mudo" style={{ margin: '2px 0 10px' }}>{missao.texto}</p>
        {missao.acao && (missao.acao.rota ? <Link className="gs-btn sec pequeno" to={missao.acao.rota}>{missao.acao.rotulo}</Link> : <button type="button" className="gs-btn sec pequeno" onClick={() => abrirAdicionar()}>{missao.acao.rotulo}</button>)}
        {missao.feita && <span className="gs-etiqueta ok">Concluída</span>}
      </section>

      {sit === 'endividado' || sit === 'atencao' ? blocoAcoes : null}

      {sit !== 'sem-dados' && (
        <>
          <h2 className="gs-h2">{nomeMes(mes)}</h2>
          <div className="gs-resumo">
            <Indicador rotulo="Saldo conhecido" valor={e.config.saldoInformado ? brl0(e.config.saldoInformado.valor) : '—'} nota={e.config.saldoInformado ? `informado em ${e.config.saldoInformado.data.split('-').reverse().slice(0, 2).join('/')}` : 'informe para um número mais firme'} acao={e.config.saldoInformado ? 'Atualizar' : 'Informar'} onAcao={() => setSaldo(true)} />
            <Indicador rotulo="Receitas do mês" valor={brl0(receitasRecebidas(e, mes))} nota={receitasRecebidas(e, mes) > 0 ? 'o que você registrou como recebido' : semRenda ? 'nada registrado' : `previsto: ${brl0(e.config.renda)} (ainda não registrado)`} />
            <Indicador rotulo="Despesas do mês" valor={brl0(totalVariaveis(e, mes) + fixosPagos(e, mes))} nota="dia a dia + contas fixas já pagas" />
            <Indicador rotulo="Reservado" valor={brl0(patrimonioGuardado(e))} nota="sua reserva de emergência" />
            <Indicador rotulo="Disponível no mês" valor={disp.modo === 'incompleto' ? '—' : brl0(disp.livre)} nota={disp.modo === 'incompleto' ? 'faltam dados' : 'o que sobra depois dos compromissos'} />
            <Indicador rotulo="Contas pendentes" valor={`${pendentes}`} nota={pendentes ? `${brl0(faltaPagar(e, mes))} a pagar neste mês` : 'tudo pago neste mês'} />
          </div>
        </>
      )}

      {sit !== 'endividado' && sit !== 'atencao' && sit !== 'sem-dados' && blocoMetas}
      {(sit === 'organizado' || sit === 'sem-dados') && blocoAcoes}

      {sit !== 'sem-dados' && (
        <>
          <h2 className="gs-h2">Para onde está indo</h2>
          <ResumoSemana />
          {cats.length > 0 ? (
            <div className="gs-card" style={{ marginTop: 12 }}>
              <span className="gs-rotulo">Maiores gastos do mês</span>
              {cats.map((c) => (
                <div key={c.categoria} style={{ margin: '10px 0 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.categoria}</span>
                    <b className="gs-tab">{brl0(c.valor)}{c.anterior > 0 ? <small className="gs-mudo"> · mês passado {brl0(c.anterior)}</small> : null}</b>
                  </div>
                  <div className="gs-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, c.pct)}%`, background: corDe(c.categoria) }} /></div>
                </div>
              ))}
              <Link to="/evolucao" className="gs-btn link">Ver minha evolução</Link>
            </div>
          ) : (
            <p className="gs-nota">Anote seus gastos do dia a dia e eu mostro aqui para onde seu dinheiro está indo.</p>
          )}
        </>
      )}

      {(sit === 'endividado' || sit === 'atencao') && blocoMetas}
      {sit !== 'sem-dados' && <Checklist onRenda={() => setRenda(true)} />}

      {!semRenda && (
        <details className="gs-card" style={{ padding: '4px 20px', marginTop: 16 }}>
          <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Pra onde vai a sua renda</summary>
          <Rosca fatias={fatias} guardadoTotal={patrimonioGuardado(e)} />
        </details>
      )}

      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês">
        <FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" />
      </Folha>
      <SaldoSheet key={String(saldo)} aberta={saldo} onFechar={() => setSaldo(false)} atual={e.config.saldoInformado?.valor} />
    </>
  );
}

function Indicador({ rotulo, valor, nota, acao, onAcao }: { rotulo: string; valor: string; nota: string; acao?: string; onAcao?: () => void }) {
  return (
    <div className="gs-ind">
      <span className="gs-rotulo">{rotulo}</span>
      <b className="gs-tab">{valor}</b>
      <small>{nota}</small>
      {acao && <button type="button" className="gs-btn link" onClick={onAcao}>{acao}</button>}
    </div>
  );
}

function CoachCard({ rec }: { rec: Recomendacao | undefined }) {
  const [porque, setPorque] = useState(false);
  if (!rec) return null;
  return (
    <section className={`gs-card gs-coach ${rec.tom}`} aria-label="Orientação do coach">
      <span className="gs-rotulo"><Sparkles size={13} style={{ verticalAlign: -2 }} aria-hidden="true" /> Seu coach tem uma orientação para você</span>
      <b>{rec.titulo}</b>
      <p>{rec.texto}</p>
      <div className="gs-acoes">
        {rec.acao && (rec.acao.rota ? <Link className="gs-btn" to={rec.acao.rota}>{rec.acao.rotulo}</Link> : <button type="button" className="gs-btn" onClick={() => abrirAdicionar()}>{rec.acao.rotulo}</button>)}
        <button type="button" className="gs-btn link" aria-expanded={porque} onClick={() => setPorque(!porque)}>Por que estou vendo isso?</button>
        <Link to="/coach" className="gs-btn link">Falar com o coach</Link>
      </div>
      {porque && <p className="gs-nota">{rec.porque}</p>}
    </section>
  );
}

function SaldoSheet({ aberta, onFechar, atual }: { aberta: boolean; onFechar: () => void; atual?: number }) {
  const [v, setV] = useState(atual ?? 0);
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Quanto você tem na conta hoje?">
      <form onSubmit={(ev) => { ev.preventDefault(); informarSaldo(v); toast(`Saldo atualizado: ${brl(v)}`); onFechar(); }}>
        <CampoDinheiro rotulo="Saldo atual (soma das contas que você usa)" valor={v} onChange={setV} grande autoFocus />
        <p className="gs-nota">É o número que você vê no app do banco. Daqui para frente eu somo o que você registrar. Seu salário só entra depois de registrado.</p>
        <div className="gs-acoes">
          <button type="submit" className="gs-btn cheio">Salvar saldo</button>
          {atual !== undefined && <button type="button" className="gs-btn link" onClick={() => { informarSaldo(undefined); toast('Saldo removido: volto a usar a renda'); onFechar(); }}>Usar só a renda</button>}
        </div>
      </form>
    </Folha>
  );
}
