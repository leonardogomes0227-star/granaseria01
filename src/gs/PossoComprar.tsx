import { useEffect, useMemo, useState } from 'react';
import { useEstado } from './store';
import { analisarCompra, contagem, msRestantes } from './ferramentas';
import { livreParaGastar } from './selectores';
import { decidirDesejo, esperar72h, salvarConfig } from './acoes';
import { brl, brl0, mesDe } from './datas';
import { Link } from 'react-router-dom';
import { Campo, CampoDinheiro, CampoNumero, Conquistas, Dica, Heroi, MaisAjuda, Titulo } from './ui';
import { conquistasCompra, contextoCompra, resumoDesejos } from './compraLogica';
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
        {a && (
          <div className="gs-card ivory" style={{ marginBottom: 0 }}>
            <span className={`gs-etiqueta ${ROTULO[a.veredito][1]}`}>{ROTULO[a.veredito][0]}</span>
            <p className="gs-medio" style={{ margin: '10px 0 6px' }}>{a.frase}</p>
            <p className="gs-sub" style={{ margin: 0 }}>
              {a.pctLivre === null ? 'Você não tem folga livre este mês.' : `Isso consome ${Math.round(a.pctLivre)}% do que ainda está livre (${brl0(livre)}).`}
            </p>
            {ctx?.mesesParaJuntar && <p className="gs-sub" style={{ margin: '8px 0 0' }}>Não cabe no que está livre. Guardando o que sobra por mês, você junta em cerca de <b>{ctx.mesesParaJuntar} {ctx.mesesParaJuntar === 1 ? 'mês' : 'meses'}</b>.</p>}
            {ctx?.dividaCara && <p className="gs-banner" style={{ margin: '10px 0 0' }}>Você tem dívida com juro alto. Cada real pago nela rende mais do que esse gasto. <Link to="/plano/dividas">Ver dívidas</Link></p>}
            {ctx?.reservaIncompleta && !ctx.dividaCara && <p className="gs-banner" style={{ margin: '10px 0 0' }}>Sua reserva de emergência ainda não está completa. <Link to="/plano/reserva">Ver reserva</Link></p>}
            <div className="gs-mini" style={{ marginTop: 10 }}>
              <span>Se investisse esse valor por 5 anos</span>
              <b>{brl0(valor * 1.008 ** 60)}</b>
            </div>
            <div className="gs-acoes">
              <button type="button" className="gs-btn" onClick={() => { if (esperar72h(item, valor)) { toast('Combinado: espere 72 horas e decida de cabeça fria.'); setItem(''); setValor(0); } }}>Esperar 72h</button>
              <button type="button" className="gs-btn sec" onClick={() => { setItem(''); setValor(0); }}>Limpar</button>
            </div>
          </div>
        )}
        <p className="gs-nota">Horas por mês: {e.config.horasMes}. Dá pra mudar em Meus dados.</p>
      </section>

      <h2 className="gs-h2">Em espera</h2>
      {espera.length === 0 ? (
        <p className="gs-mudo">Nada esperando. Quando bater a vontade, use “Esperar 72h”.</p>
      ) : (
        <div className="gs-card">
          {espera.map((d) => {
            const ms = msRestantes(d.terminaEm, agora);
            return (
              <div className="gs-linha" key={d.id}>
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