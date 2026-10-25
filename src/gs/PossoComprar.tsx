import { useEffect, useMemo, useState } from 'react';
import { useEstado } from './store';
import { analisarCompra, contagem, msRestantes } from './ferramentas';
import { livreParaGastar } from './selectores';
import { decidirDesejo, esperar72h, salvarConfig } from './acoes';
import { brl, brl0, mesDe } from './datas';
import { Campo, CampoDinheiro, CampoNumero, Titulo } from './ui';
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
  const economizado = e.desejos.filter((d) => d.status === 'desistiu').reduce((t, d) => t + d.valor, 0);
  return (
    <>
      <Titulo titulo="Posso comprar isso?" sub="Veja quanto a compra custa em horas de trabalho e se cabe no seu mês." />
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
      {economizado > 0 && <div className="gs-card destaque"><span className="gs-rotulo">Você já economizou</span><p className="gs-grande" style={{ margin: '4px 0 0' }}>{brl0(economizado)}</p></div>}
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
