import { useEffect, useMemo, useState } from 'react';
import { useEstado } from './store';
import { analisarCompra, contagem, msRestantes } from './ferramentas';
import { livreParaGastar } from './selectores';
import { decidirDesejo, esperar72h, salvarConfig } from './acoes';
import { brl, brl0, mesDe } from './datas';
import { Link } from 'react-router-dom';
import { Campo, CampoDinheiro, CampoNumero, Conquistas, Dica, Heroi, MaisAjuda, Titulo } from './ui';
import { conquistasCompra, conselho, contextoCompra, equivalencias, PERGUNTAS_COMPRA, resumoDesejos, type Respostas } from './compraLogica';
import { Anel } from './graficos';
import { PiggyBank, ShoppingCart, Sprout, Target } from 'lucide-react';
import { useHoje } from './useHoje';
import { toast } from '../components/ui/Toast';

/* ---------- Posso comprar isso? Horas de trabalho, veredito e espera de 72 h (o fim vem de um carimbo) ---------- */

const ROTULO = { cabe: ['Cabe', 'ok'], aperta: ['Aperta', 'aviso'], 'nao-cabe': ['Não cabe agora', 'perigo'] } as const;

export function PossoComprar() {
  const e = useEstado();
  const hoje = useHoje();
  const [item, setItem] = useState('');
  const [valor, setValor] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const livre = livreParaGastar(e, mesDe(hoje));
  const a = useMemo(() => (valor > 0 ? analisarCompra({ valor, renda: e.config.renda, horasMes: e.config.horasMes, livre }) : null), [valor, e.config.renda, e.config.horasMes, livre]);
  const espera = e.desejos.filter((d) => d.status === 'esperando');
  const historico = e.desejos.filter((d) => d.status !== 'esperando');
  const resumo = resumoDesejos(e.desejos);
  const economizado = resumo.economizado;
  const ctx = valor > 0 ? contextoCompra(e, valor, mesDe(hoje), livre) : null;
  const eq = useMemo(() => equivalencias(e, valor, mesDe(hoje)), [e, valor, hoje]);
  const [resp, setResp] = useState<Respostas>({});
  const cons = a ? conselho(a.veredito, resp) : null;
  const limpar = () => {
    setItem('');
    setValor(0);
    setResp({});
  };
  return (
    <>
      <Titulo titulo="Posso comprar isso?" sub="Veja quanto a compra custa em horas de trabalho e se cabe no seu mês." />
      {(resumo.desistiu + resumo.comprou > 0 || espera.length > 0) && (
        <Heroi pct={resumo.pctDesistiu} anel={`${Math.round(resumo.pctDesistiu)}%`} anelSub="desistências" rotulo="Você já economizou" grande={brl0(economizado)} sub={`${resumo.desistiu} ${resumo.desistiu === 1 ? 'compra evitada' : 'compras evitadas'}${espera.length ? ` · ${espera.length} em espera` : ''}`} cor="var(--success)" />
      )}
      <Conquistas lista={conquistasCompra(resumo)} />
      {e.config.renda <= 0 && (
        <div className="gs-card aviso">
          <p className="gs-sub" style={{ margin: '0 0 10px' }}>Informe sua renda pra eu calcular as horas de trabalho.</p>
          <RendaRapida />
        </div>
      )}
      <section className="gs-card">
        <Campo rotulo="O que você quer comprar? (opcional)" valor={item} onChange={setItem} placeholder="Ex.: tênis" maxLength={60} />
        <CampoDinheiro rotulo="Quanto custa?" valor={valor} onChange={setValor} grande />
      </section>
      {a && (
        <>
          <section key={`${valor}-${a.veredito}`} className={`gs-card gs-veredito ${a.veredito}`}>
            <span className="gs-carimbo">{ROTULO[a.veredito][0]}</span>
            <p className="gs-medio" style={{ margin: '12px 0 4px', fontSize: 21, lineHeight: '28px' }}>{item.trim() ? `${item.trim()}: ` : ''}{brl0(valor)}</p>
            <div className="gs-medidor" aria-label={a.pctLivre === null ? 'Sem folga livre' : `${Math.round(a.pctLivre)}% do que está livre`}>
              <i style={{ width: `${Math.min(100, a.pctLivre ?? 100)}%` }} />
            </div>
            <p className="gs-sub" style={{ margin: '6px 0 0' }}>
              {a.pctLivre === null ? 'Você não tem folga livre este mês.' : a.pctLivre > 100 ? `É mais do que está livre no mês (${brl0(livre)}).` : `Come ${Math.round(a.pctLivre)}% do que ainda está livre no mês (${brl0(livre)}).`}
            </p>
            {ctx?.mesesParaJuntar && <p className="gs-sub" style={{ margin: '6px 0 0' }}>Guardando o que sobra por mês, você junta em cerca de <b>{ctx.mesesParaJuntar} {ctx.mesesParaJuntar === 1 ? 'mês' : 'meses'}</b>.</p>}
          </section>

          {e.config.renda > 0 && a.horas > 0 && (
            <section className="gs-card">
              <span className="gs-rotulo">Em horas do seu trabalho</span>
              <p className="gs-medio" style={{ margin: '6px 0 10px', fontSize: 20 }}>{a.frase}</p>
              <div className="gs-dias-trab" aria-hidden="true">
                {Array.from({ length: Math.min(30, Math.ceil(a.dias)) }, (_, i) => {
                  const cheio = Math.min(1, a.dias - i);
                  return <span key={`${valor}-${i}`} style={{ animationDelay: `${i * 0.06}s` }}><i style={{ width: `${Math.max(0, cheio) * 100}%` }} /></span>;
                })}
              </div>
              <p className="gs-nota" style={{ marginTop: 6 }}>Cada bloco é um dia de trabalho (8 horas).{a.dias > 30 ? ` Mostrando 30 de ${Math.round(a.dias)}.` : ''}</p>
            </section>
          )}

          {eq.length > 0 && (
            <section className="gs-card">
              <span className="gs-rotulo">Com {brl0(valor)} você também poderia ter</span>
              {eq.map((q) => <div key={q.id} className="gs-linha" style={{ minHeight: 48 }}><span className="gs-equiv-ic" aria-hidden="true">{q.id === 'mercado' ? <ShoppingCart size={18} /> : q.id === 'reserva' ? <PiggyBank size={18} /> : q.id === 'divida' ? <Target size={18} /> : <Sprout size={18} />}</span><div className="gs-corpo">{q.texto}</div></div>)}
            </section>
          )}

          <section className="gs-card">
            <span className="gs-rotulo">3 perguntas de cabeça fria</span>
            {PERGUNTAS_COMPRA.map((p) => (
              <div key={p.id} className="gs-pergunta">
                <p>{p.texto}</p>
                <div className="gs-chips" role="group" aria-label={p.texto}>
                  <button type="button" className={`gs-chip ${resp[p.id] === true ? 'on' : ''}`} aria-pressed={resp[p.id] === true} onClick={() => setResp({ ...resp, [p.id]: true })}>{p.sim}</button>
                  <button type="button" className={`gs-chip ${resp[p.id] === false ? 'on' : ''}`} aria-pressed={resp[p.id] === false} onClick={() => setResp({ ...resp, [p.id]: false })}>{p.nao}</button>
                </div>
              </div>
            ))}
            {cons && <p className={`gs-conselho ${cons.tom}`}>{cons.texto}</p>}
            {ctx?.dividaCara && <p className="gs-banner" style={{ margin: '10px 0 0' }}>Você tem dívida com juro alto: cada real pago nela rende mais do que esse gasto. <Link to="/plano/dividas" className="gs-btn link">Ver dívidas</Link></p>}
            {ctx?.reservaIncompleta && !ctx.dividaCara && <p className="gs-banner" style={{ margin: '10px 0 0' }}>Sua reserva ainda não está completa. <Link to="/plano/reserva" className="gs-btn link">Ver reserva</Link></p>}
            <div className="gs-acoes">
              <button type="button" className="gs-btn" onClick={() => { if (esperar72h(item, valor)) { toast('Combinado: espere 72 horas e decida de cabeça fria.'); limpar(); } }}>Esperar 72h</button>
              <button type="button" className="gs-btn sec" onClick={limpar}>Limpar</button>
            </div>
          </section>
        </>
      )}
      <section className="gs-card" style={{ padding: '10px 20px' }}>
        <p className="gs-nota">Horas por mês: {e.config.horasMes}. Dá pra mudar em Meus dados.</p>
      </section>

      <h2 className="gs-h2">Em espera</h2>
      {espera.length === 0 ? (
        <p className="gs-mudo">Nada esperando. Quando bater a vontade, use “Esperar 72h”.</p>
      ) : (
        <div className="gs-card">
          {espera.map((d) => {
            const ms = msRestantes(d.terminaEm, agora);
            const pctPassou = 100 - (ms / (72 * 3600_000)) * 100;
            return (
              <div className="gs-linha" key={d.id}>
                <div style={{ flex: 'none', width: 52 }}><Anel pct={Math.max(0, Math.min(100, pctPassou))} grande={ms > 0 ? `${Math.ceil(ms / 3600_000)}h` : 'ok'} sub="" tamanho={52} cor={ms > 0 ? 'var(--gold-strong)' : 'var(--success)'} /></div>
                <div className="gs-corpo">
                  <b>{d.item}</b>
                  <small>{brl(d.valor)} · {ms > 0 ? `faltam ${contagem(ms)}` : 'o prazo acabou: decida'}</small>
                </div>
                {ms > 0 ? (
                  <button type="button" className="gs-btn link" onClick={() => { decidirDesejo(d.id, 'desistiu'); toast(`Você economizou ${brl0(d.valor)}`); }}>Desisti</button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="gs-btn pequeno sec" onClick={() => decidirDesejo(d.id, 'comprou')}>Ainda quero</button>
                    <button type="button" className="gs-btn pequeno" onClick={() => { decidirDesejo(d.id, 'desistiu'); toast(`Você economizou ${brl0(d.valor)}`); }}>Desisti</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {historico.length > 0 && (
        <>
          <h2 className="gs-h2">Histórico</h2>
          <div className="gs-card">
            {historico.map((d) => (
              <div className="gs-linha" key={d.id}>
                <div className="gs-corpo"><b>{d.item}</b><small>{brl(d.valor)}</small></div>
                <span className={`gs-etiqueta ${d.status === 'desistiu' ? 'ok' : ''}`}>{d.status === 'desistiu' ? 'Desisti' : 'Comprei'}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <MaisAjuda>
        <Dica>Antes de comprar, pergunte: eu preciso ou eu quero? Eu usaria isso daqui a 3 meses? Vale as horas de trabalho que custa?</Dica>
        <p className="gs-sub" style={{ marginBottom: 0 }}>A vontade de comprar costuma passar em poucos dias. Esperar 72 horas tira a pressa e deixa você decidir de cabeça fria. Muita gente desiste e guarda o dinheiro.</p>
      </MaisAjuda>
    </>
  );
}

function RendaRapida() {
  const [r, setR] = useState(0);
  const [h, setH] = useState<number | ''>(220);
  return (
    <>
      <CampoDinheiro rotulo="Renda por mês" valor={r} onChange={setR} />
      <CampoNumero rotulo="Horas de trabalho por mês" valor={h} onChange={setH} min={1} max={744} />
      <button type="button" className="gs-btn" disabled={!(r > 0)} onClick={() => salvarConfig({ renda: r, horasMes: typeof h === 'number' ? h : 220, onboardingFeito: true })}>Salvar</button>
    </>
  );
}