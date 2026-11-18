import { useMemo, useState } from 'react';
import { RespostaFerramenta } from './RespostaFerramenta';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl0, mesDe, nomeMes } from './datas';
import { envelopes, gastoPorCategoria, planoDeOrcamento, regra503020, resumoDoMes, type Envelope } from './orcamento';
import { corDe } from './categorias';
import { definirLimite, removerLancamento, salvarLancamento } from './acoes';
import { Agora, Barra, Campo, CampoDinheiro, Dica, Folha, MaisAjuda, Titulo, Vazio } from './ui';
import { NumeroVidro } from './vidroComum';
import { Anel, Rosquinha } from './graficos';
import { toast } from '../components/ui/Toast';
import { getEstado } from './store';

/* ---------- Orçamento em envelopes: quanto dá pro dia a dia, dividido por categoria, e quanto ainda dá em cada uma ---------- */

export function Orcamento() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const plano = useMemo(() => planoDeOrcamento(e, mes), [e, mes]);
  const envs = useMemo(() => envelopes(e, mes, hoje), [e, mes, hoje]);
  const r = useMemo(() => resumoDoMes(e, mes, hoje), [e, mes, hoje]);
  const dica = useMemo(() => {
    const estourou = envs.find((x) => x.tom === 'perigo');
    if (estourou) return { tom: 'perigo' as const, texto: `${estourou.categoria} passou ${brl0(-estourou.resta)} do envelope. Segure ou tire de outro envelope.` };
    const acaba = envs.filter((x) => x.acabaDia).sort((a, b) => a.acabaDia! - b.acabaDia!)[0];
    if (acaba) return { tom: 'aviso' as const, texto: `Nesse ritmo, ${acaba.categoria} acaba dia ${acaba.acabaDia}. Daqui pra frente, até ${brl0(acaba.porDia)} por dia nele.` };
    if (!e.lancamentos.some((l) => l.data.slice(0, 7) === mes)) return { tom: 'dica' as const, texto: 'Toque num envelope pra anotar um gasto. Leva dois toques.' };
    return { tom: 'ok' as const, texto: `Tudo dentro dos envelopes. Dá ${brl0(Math.max(0, r.porDia))} por dia até o fim do mês.` };
  }, [envs, e.lancamentos, mes, r.porDia]);
  const [anotar, setAnotar] = useState<string | null>(null);
  const [montar, setMontar] = useState(false);
  const gastos = gastoPorCategoria(e, mes);
  const semEnvelope = Object.entries(gastos).filter(([c, v]) => v > 0 && !e.limites[c]);
  const somaEnv = envs.reduce((t, x) => t + x.limite, 0);
  const temEnvelopes = envs.length > 0;

  if (e.config.renda <= 0)
    return (
      <>
        <Titulo titulo="Orçamento" sub="Quanto ainda dá em cada categoria." />
        <RespostaFerramenta id="orcamento" />
        <Vazio titulo="Informe sua renda" texto="Com ela eu calculo quanto sobra pro dia a dia e divido em envelopes: mercado, transporte, lazer…" acao="Informar renda" rota="/dados" avatar="gastos" />
      </>
    );

  return (
    <>
      <Titulo titulo="Orçamento" sub={`Quanto ainda dá em cada categoria em ${nomeMes(mes)}.`} />

      <section className="gs-card destaque" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ flex: 'none', width: 96 }}><Anel pct={r.pctUsado} grande={`${Math.round(r.pctUsado)}%`} sub="já foi" tamanho={96} cor={r.pctUsado > r.pctMes + 10 ? 'var(--danger)' : 'var(--gold-strong)'} /></div>
        <div style={{ minWidth: 0 }}>
          <span className="gs-rotulo">Ainda dá pro dia a dia</span>
          <p className="gs-grande" style={{ margin: '2px 0' }}><NumeroVidro valor={Math.max(0, r.livre)} formato={brl0} /></p>
          <p className="gs-sub" style={{ margin: 0 }}>{brl0(Math.max(0, r.porDia))} por dia · {r.restam} {r.restam === 1 ? 'dia' : 'dias'} até o fim do mês</p>
        </div>
      </section>

      {!temEnvelopes || montar ? (
        <MontarOrcamento plano={plano} refazer={temEnvelopes} onFeito={() => setMontar(false)} />
      ) : (
        <>
          <Agora tom={dica.tom} texto={dica.texto} />
          {somaEnv > plano.base.diaADia + 10 && (
            <Dica>Seus envelopes somam {brl0(somaEnv)}, mas este mês só dá {brl0(plano.base.diaADia)} pro dia a dia. <button type="button" className="gs-btn link" onClick={() => setMontar(true)}>Reajustar</button></Dica>
          )}
          <div className="gs-envelopes">
            {envs.map((x) => <CartaoEnvelope key={x.categoria} env={x} onAnotar={() => setAnotar(x.categoria)} />)}
          </div>
          {semEnvelope.length > 0 && (
            <section className="gs-card">
              <span className="gs-rotulo">Gastos fora dos envelopes</span>
              {semEnvelope.map(([c, v]) => (
                <div key={c} className="gs-linha" style={{ minHeight: 48 }}>
                  <div className="gs-corpo"><b>{c}</b><small>{brl0(v)} este mês</small></div>
                  <button type="button" className="gs-btn pequeno sec" onClick={() => { definirLimite(c, Math.max(50, Math.ceil((v * 1.2) / 50) * 50)); toast(`Envelope de ${c} criado`); }}>Criar envelope</button>
                </div>
              ))}
            </section>
          )}
          <div className="gs-acoes">
            <button type="button" className="gs-btn sec" onClick={() => setMontar(true)}>Refazer a divisão</button>
            <Link to="/lancamentos?aba=dia" className="gs-btn link">Ver todos os gastos</Link>
          </div>
        </>
      )}

      <MaisAjuda titulo="De onde vem esse valor">
        <ContaDoMes plano={plano} />
      </MaisAjuda>
      <MaisAjuda titulo="Regra 50/30/20 e para onde foi o dinheiro">
        <Regra />
      </MaisAjuda>

      <AnotarSheet categoria={anotar} hoje={hoje} onFechar={() => setAnotar(null)} />
    </>
  );
}

/* ---------- montar: a divisão sugerida, ajustável, com 1 toque pra usar ---------- */
function MontarOrcamento({ plano, refazer, onFeito }: { plano: ReturnType<typeof planoDeOrcamento>; refazer: boolean; onFeito: () => void }) {
  const [valores, setValores] = useState<Record<string, number>>(() => Object.fromEntries(plano.itens.map((i) => [i.categoria, i.valor])));
  const soma = Object.values(valores).reduce((t, v) => t + v, 0);
  const passa = soma - plano.base.diaADia;
  const muda = (c: string, d: number) => setValores((v) => ({ ...v, [c]: Math.max(0, (v[c] ?? 0) + d) }));
  return (
    <section className="gs-card">
      <span className="gs-rotulo">{refazer ? 'Refazer a divisão' : 'Monte seu orçamento em 1 toque'}</span>
      <p style={{ margin: '6px 0 4px' }}>
        Este mês sobram <b>{brl0(plano.base.diaADia)}</b> pro dia a dia.{' '}
        {plano.fonte === 'historico'
          ? plano.costuma > plano.base.diaADia
            ? `Você costuma gastar ${brl0(plano.costuma)}: eu cortei um pouco de cada pra caber.`
            : `Eu dividi pelo que você costuma gastar (${brl0(plano.costuma)} por mês).`
          : 'Eu dividi por partes da sua renda. Quando você anotar os gastos, a divisão fica do seu jeito.'}
      </p>
      {Object.entries(valores).map(([c, v]) => (
        <div key={c} className="gs-linha" style={{ minHeight: 52 }}>
          <i className="gs-env-cor" style={{ background: corDe(c) }} aria-hidden="true" />
          <div className="gs-corpo"><b>{c}</b></div>
          <button type="button" className="gs-btn link pequeno" aria-label={`Menos em ${c}`} onClick={() => muda(c, -50)}>−50</button>
          <span className="gs-valor" style={{ minWidth: 70, textAlign: 'center' }}>{brl0(v)}</span>
          <button type="button" className="gs-btn link pequeno" aria-label={`Mais em ${c}`} onClick={() => muda(c, 50)}>+50</button>
        </div>
      ))}
      <p className="gs-nota" style={{ color: passa > 0 ? 'var(--danger)' : undefined }}>
        {passa > 0 ? `Passou ${brl0(passa)} do que dá. Tire de algum envelope.` : passa < 0 ? `Ficam ${brl0(-passa)} sem envelope: bom pra imprevisto ou pra guardar.` : 'Fechou certinho.'}
      </p>
      <div className="gs-acoes">
        {refazer && <button type="button" className="gs-btn sec" onClick={onFeito}>Cancelar</button>}
        <button
          type="button"
          className="gs-btn"
          disabled={soma <= 0}
          onClick={() => {
            Object.entries(valores).forEach(([c, v]) => definirLimite(c, v));
            toast('Orçamento montado. Agora é acompanhar os envelopes.');
            onFeito();
          }}
        >
          {refazer ? 'Salvar a divisão' : 'Usar esse orçamento'}
        </button>
      </div>
    </section>
  );
}

function CartaoEnvelope({ env, onAnotar }: { env: Envelope; onAnotar: () => void }) {
  const pctUsado = env.limite > 0 ? (env.gasto / env.limite) * 100 : 0;
  return (
    <button type="button" className={`gs-env ${env.tom}`} onClick={onAnotar} aria-label={`${env.categoria}: anotar gasto`}>
      <span className="gs-env-topo">
        <i className="gs-env-cor" style={{ background: corDe(env.categoria) }} aria-hidden="true" />
        <b>{env.categoria}</b>
        <span className="gs-env-mais" aria-hidden="true"><Plus size={16} /></span>
      </span>
      <span className="gs-env-valor">{env.resta >= 0 ? brl0(env.resta) : `−${brl0(-env.resta)}`}</span>
      <small>{env.resta >= 0 ? `ainda dá · ${brl0(env.porDia)} por dia` : 'passou do envelope'}</small>
      <Barra pct={Math.min(100, pctUsado)} tom={env.tom === 'perigo' ? 'perigo' : env.tom === 'ok' ? 'ok' : ''} rotulo={`${env.categoria}: ${Math.round(pctUsado)}% usado`} />
      <small className="gs-env-pe">{env.acabaDia ? `Nesse ritmo, acaba dia ${env.acabaDia}` : `${brl0(env.gasto)} de ${brl0(env.limite)}`}</small>
    </button>
  );
}

/* ---------- anotar direto no envelope ---------- */
function AnotarSheet({ categoria, hoje, onFechar }: { categoria: string | null; hoje: string; onFechar: () => void }) {
  const [v, setV] = useState(0);
  const [desc, setDesc] = useState('');
  return (
    <Folha aberta={Boolean(categoria)} onFechar={() => { setV(0); setDesc(''); onFechar(); }} titulo={categoria ? `Gasto em ${categoria}` : ''}>
      <CampoDinheiro rotulo="Quanto?" valor={v} onChange={setV} grande autoFocus />
      <Campo rotulo="O que foi? (opcional)" valor={desc} onChange={setDesc} maxLength={80} placeholder="Ex.: padaria" />
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={() => { setV(0); setDesc(''); onFechar(); }}>Cancelar</button>
        <button
          type="button"
          className="gs-btn"
          disabled={!(v > 0) || !categoria}
          onClick={() => {
            if (!categoria || !salvarLancamento({ descricao: desc, valor: v, data: hoje, categoria })) return;
            const novo = [...getEstado().lancamentos].reverse().find((l) => l.categoria === categoria && l.valor === Math.round(v * 100) / 100 && l.data === hoje);
            toast(`Anotado: ${brl0(v)} em ${categoria}`, novo ? { acao: { rotulo: 'Desfazer', onClick: () => removerLancamento(novo.id) } } : undefined);
            setV(0);
            setDesc('');
            onFechar();
          }}
        >
          Anotar
        </button>
      </div>
    </Folha>
  );
}

function ContaDoMes({ plano }: { plano: ReturnType<typeof planoDeOrcamento> }) {
  const b = plano.base;
  const linhas: [string, number][] = [['Sua renda', b.renda], ['− Contas fixas', -b.fixos], ...(b.parcelas > 0 ? ([['− Parcelas de dívidas', -b.parcelas]] as [string, number][]) : []), ['− Guardar (reserva)', -b.guardar], ...(b.atraso > 0 ? ([['− Conta atrasada', -b.atraso]] as [string, number][]) : [])];
  return (
    <>
      {linhas.map(([n, v]) => <div key={n} className="gs-linha" style={{ minHeight: 40 }}><div className="gs-corpo">{n}</div><span className="gs-valor">{brl0(Math.abs(v))}</span></div>)}
      <div className="gs-linha" style={{ minHeight: 44 }}><div className="gs-corpo"><b>= Pro dia a dia</b></div><b className="gs-valor">{brl0(b.diaADia)}</b></div>
      <p className="gs-nota">Primeiro as contas e o que você guarda. O dia a dia vive com o que sobra: assim o mês fecha no positivo.{b.atraso > 0 ? ' Enquanto tiver conta atrasada, a reserva espera.' : ''}</p>
    </>
  );
}

function Regra() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const regra = regra503020(e, mes);
  const g = gastoPorCategoria(e, mes);
  const total = Object.values(g).reduce((t, v) => t + v, 0);
  return (
    <>
      {regra.map((x) => (
        <div key={x.nome} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <b>{x.nome}</b>
            <span className="gs-valor">{Math.round(x.pct)}% <span className="gs-mudo">(ideal {x.menorMelhor ? 'até' : 'pelo menos'} {x.ideal}%)</span></span>
          </div>
          <Barra pct={Math.min(100, (x.pct / (x.ideal * 1.4)) * 100)} tom={x.ok ? 'ok' : 'perigo'} rotulo={x.nome} />
        </div>
      ))}
      <p className="gs-nota">50% pro que é necessário (casa, contas, mercado), 30% pro que é desejo (lazer, delivery, compras) e 20% pra guardar.</p>
      {total > 0 && <Rosquinha fatias={Object.entries(g).map(([c, v]) => ({ id: c, cor: corDe(c), valor: v }))} centro={brl0(total)} sub="no mês" />}
    </>
  );
}
