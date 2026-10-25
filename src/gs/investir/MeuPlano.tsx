import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado, atualizar } from '../store';
import { useHoje } from '../useHoje';
import { mesDe, brl0, pct } from '../datas';
import { QUIZ, perfilDoQuiz, distribuir, jurosCompostos, prioridadeAntesDeInvestir, taxaMensalDeAnual } from './calculos';
import { lerMercadoSalvo, lerCdiMensal } from '../mercadoCache';
import { CampoDinheiro, CampoNumero } from '../ui';
import { criarAgente, guardar, removerAporte } from '../acoes';
import { poupancaAnualPct } from '../../../server/mercado/calculos';
import { toast } from '../../components/ui/Toast';
import { addDays } from './util';

/* ---------- Meu plano: o que fazer antes de investir, seu perfil, um exemplo de divisão e o simulador ---------- */

const NOME_PERFIL = { conservador: 'Conservador', moderado: 'Moderado', arrojado: 'Arrojado' } as const;

export function MeuPlano() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const cdiMensal = lerCdiMensal();
  const prioridade = prioridadeAntesDeInvestir(e, mes, cdiMensal);
  const [quiz, setQuiz] = useState(false);
  const planejado = e.investir.aporteMensalPlanejado ?? Math.round(e.config.renda * 0.1);
  const [aporte, setAporte] = useState(planejado);
  const [meses, setMeses] = useState<number | ''>(120);
  const mercado = lerMercadoSalvo();
  const [taxaAnual, setTaxaAnual] = useState<number | ''>(mercado?.cdiAnualPct ? Math.round(mercado.cdiAnualPct * 100) / 100 : '');
  const taxaMensal = typeof taxaAnual === 'number' ? taxaMensalDeAnual(taxaAnual) : null;
  const inflMensal = mercado?.ipca12mPct != null ? taxaMensalDeAnual(mercado.ipca12mPct) : null;
  const sim = useMemo(() => (taxaMensal !== null && typeof meses === 'number' && aporte > 0 ? jurosCompostos({ aporteMensal: aporte, meses, taxaMensalPct: taxaMensal, inflacaoMensalPct: inflMensal }) : null), [aporte, meses, taxaMensal, inflMensal]);
  const poup = mercado?.selicAnualPct != null && typeof meses === 'number' && aporte > 0 ? jurosCompostos({ aporteMensal: aporte, meses, taxaMensalPct: taxaMensalDeAnual(poupancaAnualPct(mercado.selicAnualPct)) }) : null;
  const perfil = e.investir.perfilRisco;
  const salvarAporte = (n: number) => {
    setAporte(n);
    atualizar((s) => ({ ...s, investir: { ...s.investir, aporteMensalPlanejado: n } }));
  };
  return (
    <>
      <section className={`gs-card ${prioridade.passo === 'investir' ? 'destaque' : 'aviso'}`}>
        <span className="gs-rotulo">Prioridade agora</span>
        <p className="gs-medio" style={{ margin: '4px 0 6px' }}>{prioridade.frase}</p>
        <p className="gs-sub" style={{ margin: 0 }}>{prioridade.detalhe}</p>
        {prioridade.rota && <Link to={prioridade.rota} className="gs-btn" style={{ marginTop: 12 }}>{prioridade.passo === 'dividas' ? 'Ver minhas dívidas' : 'Guardar na reserva'}</Link>}
      </section>

      <h2 className="gs-h2">Seu perfil</h2>
      {perfil ? (
        <section className="gs-card">
          <span className="gs-rotulo">Perfil de risco</span>
          <p className="gs-medio" style={{ margin: '4px 0 10px' }}>{NOME_PERFIL[perfil]}</p>
          <button type="button" className="gs-btn sec" onClick={() => setQuiz(true)}>Refazer o quiz</button>
        </section>
      ) : (
        <section className="gs-card">
          <p className="gs-sub">5 perguntas rápidas pra descobrir o quanto de oscilação você aguenta.</p>
          <button type="button" className="gs-btn" onClick={() => setQuiz(true)}>Descobrir meu perfil</button>
        </section>
      )}
      {quiz && <Quiz onFim={() => setQuiz(false)} />}

      {perfil && (
        <>
          <h2 className="gs-h2">Exemplo de divisão</h2>
          <section className="gs-card">
            <CampoDinheiro rotulo="Quanto você pretende investir por mês?" valor={aporte} onChange={salvarAporte} />
            {distribuir(perfil, aporte).map((d) => (
              <div className="gs-linha" key={d.rotulo} style={{ minHeight: 48 }}>
                <div className="gs-corpo"><b>{d.rotulo}</b></div>
                <span className="gs-valor">{brl0(d.valor)} · {d.pct}%</span>
              </div>
            ))}
            <p className="gs-nota">Exemplo educativo, não é recomendação. Cripto e derivativos ficam numa parcela pequena e só com dinheiro que você pode perder.</p>
          </section>
        </>
      )}

      <h2 className="gs-h2">Simulador de juros compostos</h2>
      <section className="gs-card">
        <CampoDinheiro rotulo="Aporte por mês" valor={aporte} onChange={salvarAporte} />
        <div className="gs-dois">
          <CampoNumero rotulo="Prazo" sufixo="meses" valor={meses} onChange={setMeses} min={1} max={600} />
          <CampoNumero rotulo="Taxa" sufixo="% ao ano" valor={taxaAnual} onChange={setTaxaAnual} min={0} max={100} placeholder={mercado?.cdiAnualPct ? undefined : 'Ex.: 10'} />
        </div>
        {!mercado?.cdiAnualPct && <p className="gs-nota" style={{ marginTop: -6 }}>Sem o CDI atual agora: digite a taxa que quer testar.</p>}
        {sim && typeof meses === 'number' && (
          <>
            <div className="gs-tres" style={{ marginTop: 6 }}>
              <div><span className="gs-mudo">Você põe</span><b className="gs-tab">{brl0(sim.investido)}</b></div>
              <div><span className="gs-mudo">Juros</span><b className="gs-tab">{brl0(sim.juros)}</b></div>
              <div><span className="gs-mudo">Total</span><b className="gs-tab">{brl0(sim.final)}</b></div>
            </div>
            {poup && <p className="gs-sub" style={{ margin: '12px 0 0' }}>Na poupança, o mesmo aporte viraria {brl0(poup.final)} ({brl0(sim.final - poup.final)} a menos).</p>}
            {sim.poderDeCompra !== null && <p className="gs-sub" style={{ margin: '8px 0 0' }}>Descontada a inflação de hoje ({pct(mercado!.ipca12mPct!, 1)} ao ano), esse total vale {brl0(sim.poderDeCompra)} em poder de compra de hoje.</p>}
            <div className="gs-acoes">
              <button type="button" className="gs-btn" onClick={() => {
                const id = criarAgente({ tipo: 'juntar', nome: 'Meta de investimento', avatar: '◆', cor: 'var(--gold-strong)', config: { meta: 'Meta de investimento', alvo: Math.round(sim.final), jaGuardado: 0, prazo: addDays(hoje, meses * 30) } });
                toast(id ? 'Meta criada em Assistentes' : 'Você já tem 10 agentes. Exclua um pra criar outro.');
              }}>Criar meta com isso</button>
              <button type="button" className="gs-btn sec" onClick={() => {
                const id = guardar(aporte, 'investimento', 'investimentos');
                if (id) toast(`Aporte de ${brl0(aporte)} registrado`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
              }}>Registrei um aporte</button>
            </div>
            <p className="gs-nota">Estimativa com os seus números. Não é recomendação de investimento. Rentabilidade passada não garante resultado futuro.</p>
          </>
        )}
      </section>
    </>
  );
}

function Quiz({ onFim }: { onFim: () => void }) {
  const [respostas, setRespostas] = useState<number[]>([]);
  const i = respostas.length;
  const q = QUIZ[i];
  if (!q) return null;
  return (
    <section className="gs-card destaque" aria-label="Quiz de perfil">
      <div className="gs-passos">{QUIZ.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
      <h3 className="gs-medio" style={{ fontSize: 20, margin: '0 0 12px' }}>{q.texto}</h3>
      <div className="gs-lista-acoes">
        {q.opcoes.map((o, k) => (
          <button key={o.rotulo} type="button" className="gs-acao" style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'inherit' }} onClick={() => {
            const novas = [...respostas, k];
            if (novas.length === QUIZ.length) {
              atualizar((s) => ({ ...s, investir: { ...s.investir, respostasQuiz: novas, perfilRisco: perfilDoQuiz(novas) } }));
              toast('Perfil salvo');
              onFim();
            } else setRespostas(novas);
          }}><p>{o.rotulo}</p></button>
        ))}
      </div>
      <button type="button" className="gs-btn link" onClick={onFim}>Cancelar</button>
    </section>
  );
}
