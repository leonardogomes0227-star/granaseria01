import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { analisarParcelado, duelo } from './parcelado';
import { comprarNoCartao, esperar72h } from './acoes';
import { Campo, CampoDinheiro, CampoNumero, MaisAjuda, Titulo } from './ui';
import { brl0, mesCurto, mesDe, pct, somaMes } from './datas';
import { livreParaGastar } from './selectores';
import { lerCdiMensal } from './mercadoCache';
import { toast } from '../components/ui/Toast';

/* ---------- À vista ou parcelado? Um duelo: o total de cada lado, o juro escondido e quem ganha ---------- */

const PARCELAS = [3, 6, 10, 12, 18, 24];
const DESCONTOS = [0, 5, 7, 10];
const RENDE_PADRAO = 0.8; // % ao mês, quando não há o CDI de hoje

export function ParceladoTela() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [item, setItem] = useState('');
  const [avista, setAvista] = useState(0);
  const [n, setN] = useState<number | ''>(10);
  const [parcela, setParcela] = useState(0);
  const [desc, setDesc] = useState(0);
  const parcelas = typeof n === 'number' ? n : 0;
  const pronto = avista > 0 && parcelas > 1 && parcela > 0;
  const r = pronto ? analisarParcelado({ avista, parcelas, parcela, descontoAvistaPct: desc }) : null;
  const cdi = lerCdiMensal();
  const rende = cdi ?? RENDE_PADRAO;
  const d = pronto ? duelo({ avista, parcelas, parcela, descontoAvistaPct: desc, rendeMensalPct: rende }) : null;
  const precoAvista = r ? r.comDescontoAvista : 0;
  const maior = r ? Math.max(r.total, precoAvista) : 1;
  const livre = livreParaGastar(e, mes);
  const outras = (e.cartao?.parcelados ?? []).reduce((t, p) => t + p.parcela, 0);
  const fim = somaMes(mes, parcelas);

  return (
    <>
      <Titulo titulo="À vista ou parcelado?" sub="Compare os dois preços." />
      <section className="gs-card">
        <Campo rotulo="O que você quer comprar? (opcional)" valor={item} onChange={setItem} placeholder="Ex.: geladeira" maxLength={60} />
        <CampoDinheiro rotulo="Preço à vista" valor={avista} onChange={setAvista} grande />
        <span className="gs-rotulo">Parcelado em</span>
        <div className="gs-chips" role="group" aria-label="Parcelas" style={{ marginTop: 6 }}>
          {PARCELAS.map((x) => <button key={x} type="button" className={`gs-chip ${n === x ? 'on' : ''}`} aria-pressed={n === x} onClick={() => setN(x)}>{x}x</button>)}
        </div>
        <div className="gs-dois">
          <CampoNumero rotulo="Outro número" valor={n} onChange={setN} min={2} max={60} placeholder="Ex.: 10" />
          <CampoDinheiro rotulo="Valor da parcela" valor={parcela} onChange={setParcela} />
        </div>
        <span className="gs-rotulo">Desconto se pagar à vista</span>
        <div className="gs-chips" role="group" aria-label="Desconto à vista" style={{ marginTop: 6 }}>
          {DESCONTOS.map((x) => <button key={x} type="button" className={`gs-chip ${desc === x ? 'on' : ''}`} aria-pressed={desc === x} onClick={() => setDesc(x)}>{x === 0 ? 'Sem desconto' : `${x}%`}</button>)}
        </div>
        {!pronto && <p className="gs-nota">Preencha o preço à vista e a parcela pra começar o duelo. Na dúvida, pergunte o desconto: quase toda loja dá.</p>}
      </section>

      {r && d && (
        <>
          <section key={`${avista}-${parcelas}-${parcela}-${desc}`} className="gs-duelo" aria-label="Comparação">
            <div className={`gs-lado ${d.vencedor === 'avista' ? 'vence' : ''}`}>
              {d.vencedor === 'avista' && <span className="gs-selo"><Crown size={14} /> Melhor escolha</span>}
              <span className="gs-rotulo">À vista</span>
              <b className="gs-lado-total">{brl0(precoAvista)}</b>
              <small>{desc > 0 ? `${brl0(avista)} − ${desc}%` : 'de uma vez'}</small>
              <div className="gs-lado-barra"><i style={{ height: `${(precoAvista / maior) * 100}%` }} /></div>
            </div>
            <span className="gs-vs" aria-hidden="true">vs</span>
            <div className={`gs-lado ${d.vencedor === 'parcelado' ? 'vence' : ''}`}>
              {d.vencedor === 'parcelado' && <span className="gs-selo"><Crown size={14} /> Melhor escolha</span>}
              <span className="gs-rotulo">Parcelado</span>
              <b className="gs-lado-total">{brl0(r.total)}</b>
              <small>{parcelas}x de {brl0(parcela)}</small>
              <div className="gs-lado-barra parc"><i style={{ height: `${(r.total / maior) * 100}%` }} /></div>
            </div>
          </section>

          <section className={`gs-card gs-veredito ${d.vencedor === 'avista' ? 'nao-cabe' : d.vencedor === 'empate' ? 'cabe' : 'aperta'}`} style={{ borderWidth: 2 }}>
            {d.diferenca > 1 ? (
              <>
                <span className="gs-carimbo">Juro escondido</span>
                <p className="gs-grande" style={{ margin: '10px 0 2px' }}>{brl0(d.diferenca)}</p>
                <p className="gs-sub" style={{ margin: 0 }}>a mais no parcelado: {pct((d.diferenca / precoAvista) * 100, 0)} em cima do preço à vista{desc > 0 ? ' com desconto' : ''}{d.taxaContraDesconto > 0 ? ` (${pct(d.taxaContraDesconto, 2)} ao mês)` : ''}.</p>
              </>
            ) : (
              <span className="gs-carimbo">{d.vencedor === 'empate' ? 'Mesmo preço' : 'Parcelado mais barato'}</span>
            )}
            <p style={{ margin: '12px 0 0', fontWeight: 700 }}>{d.motivo}</p>
            {cdi === null && d.vencedor !== 'empate' && <p className="gs-nota">Comparei com o dinheiro rendendo {pct(RENDE_PADRAO, 1)} ao mês (uma estimativa, sem o CDI de hoje).</p>}
          </section>

          <section className="gs-card">
            <span className="gs-rotulo">Se parcelar: {parcelas} meses pagando {brl0(parcela)}</span>
            <div className="gs-parcelas-tempo" aria-hidden="true">
              {Array.from({ length: Math.min(24, parcelas) }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.04}s` }}>{mesCurto(somaMes(mes, i + 1)).slice(0, 3)}</span>)}
              {parcelas > 24 && <span className="mais">+{parcelas - 24}</span>}
            </div>
            <p className="gs-sub" style={{ margin: '8px 0 0' }}>
              Você paga até <b>{mesCurto(fim)}</b>.{e.config.renda > 0 ? ` A parcela pesa ${Math.round((parcela / e.config.renda) * 100)}% da sua renda.` : ''}{outras > 0 ? ` Você já tem ${brl0(outras)} por mês em outras parcelas no cartão: juntas, ${brl0(outras + parcela)}.` : ''}{livre < parcela ? ` Neste mês só restam ${brl0(Math.max(0, livre))} livres.` : ''}
            </p>
            <div className="gs-acoes">
              {e.cartao && <button type="button" className={`gs-btn ${d.vencedor === 'avista' ? 'sec' : ''}`} onClick={() => { if (comprarNoCartao({ descricao: item || 'Compra parcelada', valor: r.total, parcelas })) toast('Anotado no cartão. As parcelas aparecem nas próximas faturas.'); }}>Parcelei no cartão</button>}
              <button type="button" className={`gs-btn ${d.vencedor === 'avista' || !e.cartao ? '' : 'sec'}`} onClick={() => { if (esperar72h(item || 'Compra', precoAvista)) toast('Combinado: espere 72 horas e decida de cabeça fria.'); }}>Esperar 72h</button>
            </div>
            {!e.cartao && <p className="gs-nota">Vai parcelar no cartão? Cadastre o cartão em <Link to="/plano/cartao">Cartão de crédito</Link> pra ver as parcelas nas próximas faturas.</p>}
          </section>
        </>
      )}

      <MaisAjuda titulo="Por que a parcela engana">
        <p className="gs-sub" style={{ margin: 0 }}>A parcela pequena cabe no mês, por isso o parcelado vende. O preço de verdade é o total. "Sem juros" muitas vezes tem o juro escondido no desconto à vista que você deixa de ganhar: por isso eu comparo com o preço com desconto. Se a loja dá o mesmo preço nos dois, parcele e deixe o dinheiro rendendo até cada parcela.</p>
      </MaisAjuda>
    </>
  );
}
