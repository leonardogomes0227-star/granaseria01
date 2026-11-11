import { useEffect, useMemo, useState } from 'react';
import { RespostaFerramenta } from './RespostaFerramenta';
import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, hoje as hojeSP, mesCurto, mesDe, nomeMes } from './datas';
import { definirRecuperacao, registrarMarco, removerAnotados, removerDivida, restaurarDivida, salvarCartao, salvarEtapa } from './acoes';
import { marcosConquistados, ondeCortar, passoDoDia, planoDeSaida, sobrevivencia, triagem, vitorias, type ItemTriagem } from './recuperacaoLogica';
import { detalheDisponivel } from './selectores';
import { resumoDaSemana } from './insights';
import { PassoDespesas, FormRenda } from './Onboarding';
import { AnotarSheet } from './Atrasos';
import { NovaDividaSheet } from './NovaDivida';
import { Barra, CampoDinheiro, CampoNumero, Confirmar, Titulo } from './ui';
import { apagarComDesfazer, toast } from '../components/ui/Toast';
import { mascarar, useOculto } from './privacidade';

/* ---------- Modo Recuperação: para quem está devendo e não sabe por onde começar ---------- */

export function Recuperacao() {
  const e = useEstado();
  const r = e.recuperacao;
  if (!r.ativo) return <Acolhimento />;
  if (!r.raioXFeito) return <RaioX />;
  return <Painel />;
}

/* ---------- 1. Acolhimento ---------- */
function Acolhimento() {
  return (
    <>
      <Titulo titulo="Modo recuperação" />
      <section className="gs-card">
        <b style={{ fontSize: 'var(--t-secao)' }}>Está difícil fechar o mês?</b>
        <p className="gs-sub" style={{ marginTop: 6 }}>Isso é mais comum do que parece, e tem saída. Eu te ajudo a ver o que deve, o que pagar primeiro e quando fica em dia. Sem julgamento.</p>
        <ul className="gs-lista-simples">
          <li>Você conta o que deve (pode ser aproximado).</li>
          <li>Eu organizo a ordem de pagamento.</li>
          <li>Todo dia você vê um passo só.</li>
        </ul>
        <div className="gs-acoes">
          <button type="button" className="gs-btn cheio" onClick={() => definirRecuperacao({ ativo: true, desde: hojeSP(), raioXFeito: false, ofertaDispensada: true })}>Montar meu plano de saída</button>
        </div>
      </section>
    </>
  );
}

/* ---------- 2. Raio-X em passos curtos ---------- */
const PASSOS = ['Renda', 'Contas fixas', 'Atrasadas', 'Dívidas', 'Cartão', 'Pronto'];

function RaioX() {
  const e = useEstado();
  // começa de onde a pessoa parou (a etapa fica salva no estado: aparece "Continuar" no cartão da ferramenta)
  const [passo, setPassoRaw] = useState(() => Math.min(PASSOS.length - 1, Math.max(0, (e.caminho.etapas.recuperacao ?? 1) - 1)));
  const setPasso = (p: number) => { setPassoRaw(p); salvarEtapa('recuperacao', p + 1); };
  const proximo = () => setPasso(Math.min(PASSOS.length - 1, passo + 1));
  return (
    <>
      <Titulo titulo="Raio-X" sub={`Passo ${passo + 1} de ${PASSOS.length}: ${PASSOS[passo]}`} />
      <Barra pct={((passo + 1) / PASSOS.length) * 100} rotulo="Progresso do raio-X" />
      <div style={{ height: 14 }} />
      {passo === 0 && (
        <section className="gs-card">
          <b>Quanto você recebe por mês?</b>
          <p className="gs-mudo" style={{ margin: '2px 0 12px' }}>Pode ser aproximado.</p>
          <FormRenda concluir={false} onFeito={proximo} rotuloBotao="Continuar" />
          <button type="button" className="gs-btn link" onClick={proximo}>Não sei agora</button>
        </section>
      )}
      {passo === 1 && <PassoDespesas semParcelas onFeito={proximo} />}
      {passo === 2 && <PassoAtrasadas onFeito={proximo} />}
      {passo === 3 && <PassoDividas onFeito={proximo} />}
      {passo === 4 && <PassoCartao onFeito={proximo} />}
      {passo === 5 && <PassoPronto />}
      {passo > 0 && passo < 5 && <button type="button" className="gs-btn link" onClick={() => setPasso(passo - 1)}>Voltar</button>}
    </>
  );
}

function PassoAtrasadas({ onFeito }: { onFeito: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const [aberta, setAberta] = useState(false);
  const manuais = e.atrasos?.manuais ?? [];
  return (
    <section className="gs-card">
      <b>Alguma conta de meses passados ficou sem pagar?</b>
      <p className="gs-mudo" style={{ margin: '2px 0 12px' }}>Luz, aluguel, parcela… Anote o que lembrar. Pode ser estimativa.</p>
      {manuais.map((m) => (
        <div className="gs-linha" key={m.id}>
          <div className="gs-corpo"><b>{m.nome}{m.estimado && <span className="gs-tag-est">valor estimado</span>}</b><small>{brl(m.valor)} · {mesCurto(m.mes)}</small></div>
          <button type="button" className="gs-btn link" onClick={() => removerAnotados([m.id])}>Remover</button>
        </div>
      ))}
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={() => setAberta(true)}>+ Anotar conta atrasada</button>
        <button type="button" className="gs-btn cheio" onClick={onFeito}>{manuais.length ? 'Continuar' : 'Não tenho'}</button>
      </div>
      <AnotarSheet aberta={aberta} hoje={hoje} onFechar={() => setAberta(false)} />
    </section>
  );
}

function PassoDividas({ onFeito }: { onFeito: () => void }) {
  const e = useEstado();
  const [aberta, setAberta] = useState(false);
  return (
    <section className="gs-card">
      <b>Você deve a banco, cartão ou loja?</b>
      <p className="gs-mudo" style={{ margin: '2px 0 12px' }}>Cartão no rotativo, empréstimo, financiamento, crediário. Se não souber o valor, estime.</p>
      {e.dividas.map((d) => (
        <div className="gs-linha" key={d.id}>
          <div className="gs-corpo"><b>{d.nome}{d.estimado && <span className="gs-tag-est">valor estimado</span>}</b><small>{brl(d.saldo)}{d.parcelaMinima ? ` · parcela ${brl(d.parcelaMinima)}` : ''}{d.parcelasRestantes ? ` · faltam ${d.parcelasRestantes}` : ''}</small></div>
          <button type="button" className="gs-btn link" onClick={() => { removerDivida(d.id); apagarComDesfazer(`${d.nome} removida`, () => restaurarDivida(d)); }}>Remover</button>
        </div>
      ))}
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={() => setAberta(true)}>+ Cadastrar dívida</button>
        <button type="button" className="gs-btn cheio" onClick={onFeito}>{e.dividas.length ? 'Continuar' : 'Não tenho'}</button>
      </div>
      <NovaDividaSheet aberta={aberta} onFechar={() => setAberta(false)} />
    </section>
  );
}

function PassoCartao({ onFeito }: { onFeito: () => void }) {
  const e = useEstado();
  const [usado, setUsado] = useState(e.cartao?.usado ?? 0);
  const [limite, setLimite] = useState(e.cartao?.limite ?? 0);
  const [dia, setDia] = useState<number | ''>(e.cartao?.venceDia ?? '');
  const [erro, setErro] = useState('');
  const salvar = () => {
    if (!(limite > 0)) return setErro('Informe o limite (aproximado).');
    if (typeof dia !== 'number' || dia < 1 || dia > 31) return setErro('Informe o dia do vencimento (1 a 31).');
    salvarCartao({ limite, usado, venceDia: dia, fechaDia: e.cartao?.fechaDia ?? Math.max(1, dia - 7), parcelados: e.cartao?.parcelados, pagas: e.cartao?.pagas });
    toast('Cartão salvo');
    onFeito();
  };
  return (
    <section className="gs-card">
      <b>Você usa cartão de crédito?</b>
      <p className="gs-mudo" style={{ margin: '2px 0 12px' }}>Com a fatura e o limite eu mostro o quanto já está comprometido.</p>
      <CampoDinheiro rotulo="Fatura atual" valor={usado} onChange={setUsado} />
      <CampoDinheiro rotulo="Limite do cartão" valor={limite} onChange={setLimite} />
      <CampoNumero rotulo="Vence todo dia…" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 10" />
      {erro && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
      <div className="gs-acoes">
        <button type="button" className="gs-btn cheio" onClick={salvar}>Salvar cartão</button>
        <button type="button" className="gs-btn link" onClick={onFeito}>Não uso cartão</button>
      </div>
    </section>
  );
}

function PassoPronto() {
  const e = useEstado();
  useEffect(() => { salvarEtapa('recuperacao', 0); }, []);
  const hoje = useHoje();
  const plano = useMemo(() => planoDeSaida(e, hoje), [e, hoje]);
  return (
    <section className="gs-card">
      <b>Tudo mapeado</b>
      <p className="gs-sub" style={{ marginTop: 6 }}>
        {plano.nItens === 0 ? 'Você não registrou dívidas nem contas atrasadas. Ótimo: se lembrar de algo, é só adicionar depois.' : <>Você tem <b>{brl0(plano.totalDevido)}</b> em {plano.nItens} {plano.nItens === 1 ? 'item' : 'itens'} para resolver. Já montei a ordem de pagamento.</>}
        {plano.temEstimativa ? ' Alguns valores são estimados; refine quando puder.' : ''}
      </p>
      <div className="gs-acoes"><button type="button" className="gs-btn cheio" onClick={() => definirRecuperacao({ raioXFeito: true })}>Ver meu plano de saída</button></div>
    </section>
  );
}

/* ---------- 3. Plano de saída ---------- */
const GRUPOS: Record<number, string> = { 1: 'Primeiro: o essencial', 2: 'Depois: o que mais pesa', 3: 'Por último: o resto' };

function Painel() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const plano = useMemo(() => planoDeSaida(e, hoje), [e, hoje]);
  const lista = useMemo(() => triagem(e, hoje), [e, hoje]);
  const passo = useMemo(() => passoDoDia(e, hoje), [e, hoje]);
  const sob = useMemo(() => sobrevivencia(e, mes), [e, mes]);
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const vit = useMemo(() => vitorias(e, hoje), [e, hoje]);
  const semana = useMemo(() => resumoDaSemana(e, hoje, 1), [e, hoje]);
  const [sair, setSair] = useState(false);
  const corte = useMemo(() => ondeCortar(e, mes), [e, mes]);
  const novoMarco = useMemo(() => marcosConquistados(e, hoje).find((x) => !(e.recuperacao.marcos ?? []).includes(x.id)), [e, hoje]);
  const grupos = [1, 2, 3].map((g) => ({ g, itens: lista.filter((i) => i.grupo === g) })).filter((x) => x.itens.length > 0);
  const totalGasto = sob.essenciais + sob.outrasFixas + sob.superfluos;
  const segunda = new Date().getDay() === 1;

  return (
    <>
      <Titulo titulo="Meu plano de saída" />
      <RespostaFerramenta id="recuperacao" />

      {novoMarco && (
        <section className="gs-card gs-marco" role="status" aria-label="Conquista">
          <span className="gs-marco-check" aria-hidden="true"><Check size={20} /></span>
          <div><b>{novoMarco.titulo}</b><p className="gs-mudo" style={{ margin: '2px 0 8px' }}>{novoMarco.texto}</p><button type="button" className="gs-btn sec pequeno" onClick={() => registrarMarco(novoMarco.id)}>Valeu!</button></div>
        </section>
      )}

      <section className="gs-card gs-plano-topo" aria-label="Resumo do plano">
        <span className="gs-rotulo">Você deve</span>
        <p className="gs-grande" style={{ margin: '2px 0' }}>{m(brl0(plano.totalDevido))}</p>
        <p className="gs-mudo" style={{ margin: 0 }}>
          {plano.nItens === 0 ? 'Nada em aberto.' : plano.emDiaEm ? <>Em dia em <b>{mesCurto(plano.emDiaEm)}</b>, pagando o plano.</> : 'Ainda não dá para calcular a data: falta sobrar mais por mês ou completar os dados.'}
          {plano.capacidade > 0 && <> Cabem {m(brl0(plano.capacidade))} por mês.</>}
          {plano.temEstimativa && <span className="gs-tag-est">valor estimado</span>}
        </p>
      </section>

      <section className="gs-card gs-passo" aria-label="Passo de hoje">
        <span className="gs-rotulo">Seu passo de hoje</span>
        <b>{passo.titulo}</b>
        <p className="gs-mudo" style={{ margin: '2px 0 10px' }}>{passo.texto}</p>
        {passo.rota && <Link to={passo.rota} className="gs-btn cheio">{passo.tipo === 'pagar' ? 'Resolver agora' : 'Abrir'}</Link>}
      </section>

      {grupos.length > 0 && (
        <>
          <h2 className="gs-h2">O que pagar primeiro</h2>
          {grupos.map(({ g, itens }) => (
            <div key={g} className="gs-card" aria-label={GRUPOS[g]}>
              <span className="gs-rotulo">{GRUPOS[g]}</span>
              {itens.map((i) => <LinhaTriagem key={i.chave} i={i} oculto={oculto} />)}
            </div>
          ))}
        </>
      )}

      <h2 className="gs-h2">Orçamento de emergência</h2>
      <div className="gs-card">
        {totalGasto > 0 ? (
          <>
            <Faixa rotulo="Essenciais" valor={sob.essenciais} total={totalGasto} oculto={oculto} />
            <Faixa rotulo="Outras contas fixas" valor={sob.outrasFixas} total={totalGasto} oculto={oculto} />
            <Faixa rotulo="Supérfluos" valor={sob.superfluos} total={totalGasto} oculto={oculto} aviso />
            {sob.superfluos > 0 && <p className="gs-nota">Cortar os supérfluos libera até {m(brl0(sob.superfluos))} por mês para as dívidas.</p>}
            {(corte.categorias.length > 0 || corte.assinaturas.n > 0) && (
              <div className="gs-corte">
                <span className="gs-rotulo">Onde cortar primeiro</span>
                {corte.categorias.map((c) => <div className="gs-linha" key={c.categoria}><div className="gs-corpo"><b>{c.categoria}</b></div><span className="gs-valor">{m(brl0(c.valor))}</span></div>)}
                <Link to="/plano/cortar" className="gs-btn link">Ver tudo em Onde cortar</Link>
                {corte.assinaturas.n > 0 && <div className="gs-linha"><div className="gs-corpo"><b>Assinaturas ativas ({corte.assinaturas.n})</b><small><Link to="/plano/assinaturas">Revisar e cancelar</Link></small></div><span className="gs-valor">{m(brl0(corte.assinaturas.total))}</span></div>}
              </div>
            )}
          </>
        ) : <p className="gs-mudo" style={{ margin: 0 }}>Anote seus gastos e eu separo o essencial do que dá para cortar.</p>}
        {disp.modo !== 'incompleto' && <p className="gs-mudo" style={{ margin: '10px 0 0' }}>Teto de hoje: <b>{m(brl(disp.porDia))}</b></p>}
      </div>

      <h2 className="gs-h2">Vitórias</h2>
      <div className="gs-card">
        <div className="gs-trio">
          <div><span className="gs-rotulo">Já paguei</span><b className="gs-tab">{m(brl0(vit.pago))}</b></div>
          <div><span className="gs-rotulo">Quitadas</span><b className="gs-tab">{vit.quitadas}</b></div>
          <div><span className="gs-rotulo">Dias sem supérfluo</span><b className="gs-tab">{vit.diasSemSuperfluo}</b></div>
        </div>
        {vit.pago === 0 && vit.quitadas === 0 && <p className="gs-nota">Sua primeira vitória é o primeiro pagamento. Qualquer valor conta.</p>}
      </div>

      <details className="gs-aprende" open={segunda}>
        <summary>Revisão da semana passada</summary>
        <p>Você gastou {brl0(semana.gasto)} no dia a dia{semana.categoriaTop ? `, mais em ${semana.categoriaTop.nome} (${brl0(semana.categoriaTop.valor)})` : ''}. {semana.recomendacao}</p>
      </details>

      <div className="gs-acoes" style={{ marginTop: 20 }}>
        <button type="button" className="gs-btn link" onClick={() => definirRecuperacao({ raioXFeito: false })}>Refazer o raio-X</button>
        <button type="button" className="gs-btn link" onClick={() => setSair(true)}>Sair do modo recuperação</button>
      </div>
      <Confirmar aberta={sair} titulo="Sair do modo recuperação?" texto="Seus dados continuam salvos. Você pode voltar quando quiser." rotulo="Sair do modo" perigo={false} onCancelar={() => setSair(false)} onConfirmar={() => { definirRecuperacao({ ativo: false }); setSair(false); toast('Modo recuperação desligado'); }} />
      <p className="gs-nota" style={{ marginTop: 8 }}>Mês de referência: {nomeMes(mes)}.</p>
    </>
  );
}

function LinhaTriagem({ i, oculto }: { i: ItemTriagem; oculto: boolean }) {
  return (
    <div className="gs-linha gs-linha-triagem">
      <div className="gs-corpo">
        <b>{i.nome}{i.estimado && <span className="gs-tag-est">valor estimado</span>}{i.atrasada && <span className="gs-badge erro" style={{ marginLeft: 6 }}>atrasada</span>}</b>
        <small>{mascarar(brl0(i.valor), oculto)}{i.parcela ? ` · parcela ${mascarar(brl0(i.parcela), oculto)}` : ''}</small>
        <small>{i.motivo}</small>
      </div>
      <Link to={i.rota} className="gs-icone-btn" aria-label={`Abrir ${i.nome}`}><ChevronRight size={18} aria-hidden="true" /></Link>
    </div>
  );
}

function Faixa({ rotulo, valor, total, oculto, aviso = false }: { rotulo: string; valor: number; total: number; oculto: boolean; aviso?: boolean }) {
  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{rotulo}</span><b className="gs-tab">{mascarar(brl0(valor), oculto)}</b></div>
      <Barra pct={total > 0 ? (valor / total) * 100 : 0} tom={aviso && valor > 0 ? 'perigo' : ''} rotulo={`${rotulo}: ${Math.round(total > 0 ? (valor / total) * 100 : 0)}% dos gastos`} />
    </div>
  );
}
