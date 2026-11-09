import { brl, brl0 } from './datas';
import { Folha } from './ui';
import type { Disponivel } from './selectores';

/** "Como esse valor foi calculado": cada linha com o selo confirmado/estimado e o que falta para melhorar. */
export function ComoCalculei({ aberta, onFechar, d }: { aberta: boolean; onFechar: () => void; d: Disponivel }) {
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Como calculei">
      {d.modo === 'incompleto' ? (
        <p>{d.avisos[0]}</p>
      ) : (
        <>
          <p className="gs-mudo" style={{ marginTop: 0 }}>
            {d.modo === 'saldo' ? 'Parti do saldo que você informou e descontei o que ainda vai sair neste mês.' : 'Parti da renda do mês e descontei o que já tem destino e o que você já gastou.'}
          </p>
          <div className="gs-calculo" role="table" aria-label="Cálculo do dinheiro disponível">
            {d.linhas.map((l) => (
              <div className="gs-calculo-linha" role="row" key={l.id}>
                <div role="cell">
                  <b>{l.rotulo}</b>
                  <small>
                    <span className={`gs-selo ${l.confianca}`}>{l.confianca === 'confirmado' ? 'confirmado' : 'estimado'}</span>
                    {l.nota ? ` ${l.nota}` : ''}
                  </small>
                </div>
                <span role="cell" className="gs-tab">{l.sinal === '-' ? '−' : '+'} {brl(l.valor)}</span>
              </div>
            ))}
            <div className="gs-calculo-linha total" role="row">
              <b role="cell">Livre no mês</b>
              <b role="cell" className="gs-tab">{brl(d.livre)}</b>
            </div>
            <div className="gs-calculo-linha" role="row">
              <span role="cell">Dividido por {d.diasRestantes} {d.diasRestantes === 1 ? 'dia' : 'dias'} (hoje até o fim do mês)</span>
              <b role="cell" className="gs-tab">{brl(d.porDia)} por dia</b>
            </div>
          </div>
          {d.livre < 0 && <p className="gs-nota">O resultado ficou negativo ({brl0(d.livre)}): os compromissos do mês já passam do que você tem. Mostro R$ 0 por dia, sem inventar folga.</p>}
          {d.avisos.map((a) => <p key={a} className="gs-nota">• {a}</p>)}
          <p className="gs-nota">Valor <b>estimado</b> é uma previsão (renda ainda não recebida, parcelas, reserva combinada). Valor <b>confirmado</b> veio do que você registrou. Isto não é o saldo do seu banco.</p>
        </>
      )}
    </Folha>
  );
}
