import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { atualizar, useEstado } from '../store';
import { useHoje } from '../useHoje';
import { brl0, mesDe, pct } from '../datas';
import { QUIZ, NOME_PERFIL, ONDE, caminhoInvestir, distribuir, jurosCompostos, perfilDoQuiz, taxaMensalDeAnual, type IdPasso, type PassoCaminho } from './calculos';
import { lerMercadoSalvo } from '../mercadoCache';
import { useMercado } from './useMercado';
import { CampoDinheiro, CampoNumero, Dica } from '../ui';
import { criarAgente, guardar, removerAporte } from '../acoes';
import { poupancaAnualPct } from '../../../server/mercado/calculos';
import { atrasoNoMes } from '../selectores';
import { toast } from '../../components/ui/Toast';
import { addDays } from './util';
import { CheckCheck, Flag, Route, TrendingUp } from 'lucide-react';
import { FaixaKpis } from '../PainelUI';

/* ---------- Meu caminho: um passo de cada vez até investir. O próximo passo fica em destaque, com uma ação. ---------- */

const ROTA: Partial<Record<IdPasso, [string, string]>> = {
  atraso: ['/plano/atrasos', 'Ver o plano do atraso'],
  dividas: ['/plano/dividas', 'Ver minhas dívidas'],
  reserva: ['/plano/reserva', 'Guardar na reserva'],
};

export function Caminho() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const { dados } = useMercado();
  const cdiAnual = dados?.cdi?.valor ?? lerMercadoSalvo()?.cdiAnualPct ?? null;
  const cdiMensal = cdiAnual != null ? taxaMensalDeAnual(cdiAnual) : null;
  const passos = useMemo(() => caminhoInvestir(e, mes, cdiMensal), [e, mes, cdiMensal]);
  const agora = passos.find((p) => p.estado === 'agora') ?? passos[passos.length - 1];
  const [aberto, setAberto] = useState<IdPasso | null>(null);
  const [quiz, setQuiz] = useState(false);
  useEffect(() => setAberto(null), [agora.id]);
  // o passo atual abre sozinho só quando tem conteúdo aqui (perfil e investir); os outros já têm o botão no destaque
  const abre = aberto ?? (agora.id === 'perfil' || agora.id === 'investir' ? agora.id : null);
  const n = passos.findIndex((p) => p.id === agora.id) + 1;

  return (
    <>
      <FaixaKpis itens={[
        { rotulo: 'Passo atual', valor: n, formato: 'int', icone: Flag, nota: `de ${passos.length} até investir` },
        { rotulo: 'Passos feitos', valor: passos.filter((p) => p.estado === 'feito').length, formato: 'int', icone: CheckCheck, tom: 'ok', nota: 'no caminho' },
        { rotulo: 'Falta', valor: passos.filter((p) => p.estado !== 'feito').length, formato: 'int', icone: Route, tom: 'aviso', nota: 'passos' },
        { rotulo: 'CDI', valor: cdiAnual != null ? `${pct(cdiAnual, 2)} a.a.` : '—', icone: TrendingUp, nota: cdiAnual != null ? 'o que a renda fixa rende' : 'sem dado agora' },
      ]} />
      <section className="gs-card destaque">
        <span className="gs-rotulo">Seu próximo passo · {n} de {passos.length}</span>
        <p className="gs-grande" style={{ margin: '4px 0 6px', fontSize: 'clamp(24px, 7vw, 32px)' }}>{agora.titulo}</p>
        <p className="gs-sub" style={{ margin: 0 }}>{agora.resumo}</p>
        <div className="gs-acoes" style={{ marginTop: 14 }}>
          {ROTA[agora.id] ? (
            <Link to={ROTA[agora.id]![0]} className="gs-btn">{ROTA[agora.id]![1]}</Link>
          ) : agora.id === 'perfil' ? (
            <button type="button" className="gs-btn" onClick={() => { setAberto('perfil'); setQuiz(true); }}>Descobrir meu perfil</button>
          ) : (
            <a href="#passo-investir" className="gs-btn">Montar meu plano</a>
          )}
        </div>
      </section>

      <h2 className="gs-h2">O caminho</h2>
      <ol className="gs-caminho">
        {passos.map((p, i) => (
          <li key={p.id} id={`passo-${p.id}`} className={`gs-caminho-passo ${p.estado}`}>
            <button type="button" className="gs-caminho-topo" aria-expanded={abre === p.id} onClick={() => setAberto(abre === p.id ? ('' as IdPasso) : p.id)}>
              <span className="gs-caminho-n" aria-hidden="true">{p.estado === 'feito' ? <Check size={16} /> : i + 1}</span>
              <span className="gs-corpo">
                <b>{p.titulo}</b>
                <small>{p.estado === 'feito' ? 'Feito' : p.estado === 'agora' ? 'Agora' : 'Depois'} · {p.resumo}</small>
              </span>
              <ChevronDown size={18} aria-hidden="true" style={{ transform: abre === p.id ? 'rotate(180deg)' : undefined, flex: 'none' }} />
            </button>
            {abre === p.id && (
              <div className="gs-caminho-corpo">
                <Conteudo passo={p} quiz={quiz} setQuiz={setQuiz} cdiAnual={cdiAnual} />
              </div>
            )}
          </li>
        ))}
      </ol>

      <h2 className="gs-h2">Quando quiser ir além</h2>
      <div className="gs-card" style={{ padding: '4px 16px' }}>
        {([
          ['/investir?aba=mercado', 'Ver o mercado hoje', 'Quanto rende a poupança, o CDI e a inflação'],
          ['/investir?aba=conversar', 'Tirar uma dúvida', 'Pergunte com os seus números'],
          ['/investir?aba=simulacao', 'Treinar sem risco', 'Dinheiro de mentirinha, preço de verdade'],
        ] as const).map(([rota, t, s]) => (
          <Link key={rota} to={rota} className="gs-ferr"><span className="gs-corpo"><b>{t}</b><small>{s}</small></span></Link>
        ))}
      </div>
      <p className="gs-nota">Conteúdo educativo. Não é recomendação de investimento. Rentabilidade passada não garante resultado futuro.</p>
    </>
  );
}

function Conteudo({ passo, quiz, setQuiz, cdiAnual }: { passo: PassoCaminho; quiz: boolean; setQuiz: (b: boolean) => void; cdiAnual: number | null }) {
  const e = useEstado();
  if (passo.id === 'atraso')
    return (
      <>
        <p>Conta atrasada cobra multa e juros todo mês. Nenhum investimento rende isso, então o dinheiro que sobra vai primeiro pra ela.</p>
        <Link to="/plano/atrasos" className="gs-btn pequeno">Ver o plano do atraso</Link>
      </>
    );
  if (passo.id === 'dividas')
    return (
      <>
        <p>Se a dívida cobra mais do que o investimento rende, cada real que vai pra ela "rende" o juro que você deixa de pagar. Por isso quitar vem antes.</p>
        {passo.estado !== 'feito' && <Link to="/plano/dividas" className="gs-btn pequeno">Ver minhas dívidas</Link>}
      </>
    );
  if (passo.id === 'reserva')
    return (
      <>
        <p>É o dinheiro pra quando a renda falha ou aparece um imprevisto. Não é pra render muito: é pra estar lá, rápido, quando precisar.</p>
        <Dica><b>Onde guardar:</b> Tesouro Selic ou CDB com liquidez diária (dá pra tirar no mesmo dia). Rendem mais que a poupança e são de baixo risco.</Dica>
        <Link to="/plano/reserva" className="gs-btn pequeno">{passo.estado === 'feito' ? 'Abrir a reserva' : 'Guardar na reserva'}</Link>
      </>
    );
  if (passo.id === 'perfil')
    return quiz ? (
      <Quiz onFim={() => setQuiz(false)} />
    ) : (
      <>
        <p>{e.investir.perfilRisco ? `Seu perfil é ${NOME_PERFIL[e.investir.perfilRisco].toLowerCase()}. Ele define quanto do dinheiro pode ir pra coisas que sobem e descem.` : 'Responda 5 perguntas sobre prazo e quanto sobe e desce você aguenta. O resultado define onde colocar o dinheiro.'}</p>
        <button type="button" className={`gs-btn pequeno ${e.investir.perfilRisco ? 'sec' : ''}`} onClick={() => setQuiz(true)}>{e.investir.perfilRisco ? 'Refazer as perguntas' : 'Começar (1 minuto)'}</button>
      </>
    );
  return <PlanoDeAporte cdiAnual={cdiAnual} onPerfil={() => setQuiz(true)} />;
}

/* ---------- investir todo mês: quanto, onde e quanto vira ---------- */
const PRAZOS = [1, 5, 10, 20];

function PlanoDeAporte({ cdiAnual, onPerfil }: { cdiAnual: number | null; onPerfil: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const sugestao = Math.max(50, Math.round((e.config.renda * 0.1) / 10) * 10) || 100;
  const [aporte, setAporte] = useState(e.investir.aporteMensalPlanejado ?? sugestao);
  const [anos, setAnos] = useState(10);
  const [taxa, setTaxa] = useState<number | ''>(cdiAnual != null ? Math.round(cdiAnual * 100) / 100 : '');
  useEffect(() => {
    if (taxa === '' && cdiAnual != null) setTaxa(Math.round(cdiAnual * 100) / 100);
  }, [cdiAnual, taxa]);
  const mercado = lerMercadoSalvo();
  const perfil = e.investir.perfilRisco;
  const salvar = (n: number) => {
    setAporte(n);
    atualizar((s) => ({ ...s, investir: { ...s.investir, aporteMensalPlanejado: n } }));
  };
  const meses = anos * 12;
  const sim = typeof taxa === 'number' && aporte > 0 ? jurosCompostos({ aporteMensal: aporte, meses, taxaMensalPct: taxaMensalDeAnual(taxa), inflacaoMensalPct: mercado?.ipca12mPct != null ? taxaMensalDeAnual(mercado.ipca12mPct) : null }) : null;
  const poup = mercado?.selicAnualPct != null && aporte > 0 ? jurosCompostos({ aporteMensal: aporte, meses, taxaMensalPct: taxaMensalDeAnual(poupancaAnualPct(mercado.selicAnualPct)) }) : null;
  const atraso = atrasoNoMes(e, mes); // só conta quando há conta atrasada (ou já saiu dinheiro pra ela)
  return (
    <>
      <CampoDinheiro rotulo="Quanto por mês?" valor={aporte} onChange={salvar} grande />
      <p className="gs-nota" style={{ marginTop: -4 }}>
        {e.config.renda > 0 ? `Pra começar, 10% da renda: ${brl0(sugestao)}. Pode ser menos: o hábito vale mais que o valor.` : 'Pode começar pequeno: o hábito vale mais que o valor.'}
        {atraso > 0 ? ` Enquanto tiver conta atrasada, ${brl0(atraso)} por mês já vão pro atraso.` : ''}
      </p>

      <h3 className="gs-caminho-sub">Onde colocar</h3>
      {perfil ? (
        <>
          {distribuir(perfil, aporte).filter((d) => d.pct > 0).map((d) => (
            <div className="gs-linha" key={d.rotulo} style={{ minHeight: 52 }}>
              <div className="gs-corpo"><b>{d.rotulo} · {d.pct}%</b><small>{ONDE[d.rotulo] ?? ''}</small></div>
              <span className="gs-valor">{brl0(d.valor)}</span>
            </div>
          ))}
          <p className="gs-nota">Exemplo pro perfil {NOME_PERFIL[perfil].toLowerCase()}. Não é recomendação. Cripto fica numa parte pequena e só com dinheiro que você pode perder.</p>
        </>
      ) : (
        <>
          <p className="gs-sub" style={{ margin: '0 0 10px' }}>Sem o seu perfil, o seguro é tudo em renda fixa com liquidez diária (Tesouro Selic ou CDB). Descubra o perfil pra ver uma divisão.</p>
          <button type="button" className="gs-btn pequeno sec" onClick={onPerfil}>Descobrir meu perfil</button>
        </>
      )}

      <h3 className="gs-caminho-sub">Quanto isso vira</h3>
      <div className="gs-chips" role="group" aria-label="Prazo">
        {PRAZOS.map((a) => <button key={a} type="button" className={`gs-chip ${anos === a ? 'on' : ''}`} aria-pressed={anos === a} onClick={() => setAnos(a)}>{a} {a === 1 ? 'ano' : 'anos'}</button>)}
      </div>
      {cdiAnual == null && <CampoNumero rotulo="Quanto rende" sufixo="% ao ano" valor={taxa} onChange={setTaxa} min={0} max={100} placeholder="Ex.: 10" />}
      {sim ? (
        <>
          <section className="gs-card destaque" style={{ margin: '4px 0 0' }}>
            <span className="gs-rotulo">Em {anos} {anos === 1 ? 'ano' : 'anos'}</span>
            <p className="gs-grande" style={{ margin: '4px 0' }}>{brl0(sim.final)}</p>
            <p className="gs-sub" style={{ margin: 0 }}>Você coloca {brl0(sim.investido)}. Os juros fazem {brl0(sim.juros)}.{cdiAnual != null ? ` Rendendo como o CDI de hoje (${pct(cdiAnual, 1)} ao ano).` : ''}</p>
          </section>
          {poup && poup.final < sim.final && <p className="gs-sub" style={{ margin: '10px 0 0' }}>Na poupança, o mesmo dinheiro viraria {brl0(poup.final)}: {brl0(sim.final - poup.final)} a menos.</p>}
          {sim.poderDeCompra !== null && anos >= 5 && <p className="gs-nota">Com a inflação de hoje, {brl0(sim.final)} daqui a {anos} anos compram o que {brl0(sim.poderDeCompra)} compram hoje.</p>}
        </>
      ) : (
        <p className="gs-nota">Sem o CDI de agora: digite quanto quer testar ao ano.</p>
      )}

      <div className="gs-acoes">
        <button type="button" className="gs-btn" disabled={!(aporte > 0)} onClick={() => {
          const id = guardar(aporte, 'investimento', 'investimentos');
          if (id) toast(`Aporte de ${brl0(aporte)} registrado`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
        }}>Investi {brl0(aporte)} este mês</button>
        {sim && (
          <button type="button" className="gs-btn sec" onClick={() => {
            const id = criarAgente({ tipo: 'juntar', nome: 'Meta de investimento', avatar: '◆', cor: 'var(--gold-strong)', config: { meta: 'Meta de investimento', alvo: Math.round(sim.final), jaGuardado: 0, prazo: addDays(hoje, meses * 30) } });
            toast(id ? 'Meta criada em Assistentes' : 'Você já tem 10 agentes. Exclua um pra criar outro.');
          }}>Virar meta</button>
        )}
      </div>
    </>
  );
}

function Quiz({ onFim }: { onFim: () => void }) {
  const [respostas, setRespostas] = useState<number[]>([]);
  const i = respostas.length;
  const q = QUIZ[i];
  if (!q) return null;
  return (
    <div aria-label="Perguntas do perfil">
      <div className="gs-passos">{QUIZ.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
      <p className="gs-rotulo" style={{ margin: 0 }}>Pergunta {i + 1} de {QUIZ.length}</p>
      <h3 className="gs-medio" style={{ fontSize: 19, margin: '4px 0 12px' }}>{q.texto}</h3>
      <div className="gs-lista-acoes">
        {q.opcoes.map((o, k) => (
          <button key={o.rotulo} type="button" className="gs-acao" style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'inherit' }} onClick={() => {
            const novas = [...respostas, k];
            if (novas.length === QUIZ.length) {
              const perfil = perfilDoQuiz(novas);
              atualizar((s) => ({ ...s, investir: { ...s.investir, respostasQuiz: novas, perfilRisco: perfil } }));
              toast(`Seu perfil: ${NOME_PERFIL[perfil].toLowerCase()}`);
              onFim();
            } else setRespostas(novas);
          }}><p>{o.rotulo}</p></button>
        ))}
      </div>
      <div className="gs-acoes">
        {i > 0 && <button type="button" className="gs-btn link" onClick={() => setRespostas(respostas.slice(0, -1))}>Voltar</button>}
        <button type="button" className="gs-btn link" onClick={onFim}>Cancelar</button>
      </div>
    </div>
  );
}
