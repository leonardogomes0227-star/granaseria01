import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { atualizar, useEstado } from '../store';
import { CampoDinheiro, CampoNumero, Folha, Confirmar } from '../ui';
import { ALAVANCAGEM_MAX, SALDO_INICIAL, avaliarPosicao, estatisticas, fechar } from './calculos';
import { brl, brl0, novoId } from '../datas';
import { toast } from '../../components/ui/Toast';
import type { Posicao } from '../tipos';

/* ---------- Mesa de treino: dinheiro de mentirinha, preço real ---------- */

type Preco = { valor: number; em: number } | null;
type Precos = { BTC: Preco; USD: Preco };

function usePrecos(): { precos: Precos; erro: boolean } {
  const [p, setP] = useState<Precos>({ BTC: null, USD: null });
  const [erro, setErro] = useState(false);
  const buscar = useCallback(() => {
    fetch('/api/mercado?rapido=1')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('x'))))
      .then((j: { btc?: { valor: number }; usd?: { valor: number } }) => {
        const em = Date.now();
        setP((a) => ({ BTC: j.btc ? { valor: j.btc.valor, em } : a.BTC, USD: j.usd ? { valor: j.usd.valor, em } : a.USD }));
        setErro(false);
      })
      .catch(() => setErro(true));
  }, []);
  useEffect(() => {
    buscar();
    const t = window.setInterval(() => document.visibilityState === 'visible' && buscar(), 60_000);
    return () => window.clearInterval(t);
  }, [buscar]);
  return { precos: p, erro };
}

export function Simulacao() {
  const e = useEstado();
  const { precos, erro } = usePrecos();
  const sim = e.investir.simulacao;
  const [abrir, setAbrir] = useState(false);
  const [resetar, setResetar] = useState(false);
  const processado = useRef('');
  const preco = (a: 'BTC' | 'USD') => precos[a]?.valor ?? null;

  // liquida, stop e alvo: ao abrir e a cada preço novo (com o último preço disponível)
  useEffect(() => {
    const chave = `${precos.BTC?.em}-${precos.USD?.em}`;
    if (processado.current === chave || (!precos.BTC && !precos.USD)) return;
    processado.current = chave;
    const encerradas: string[] = [];
    atualizar((s) => {
      let saldo = s.investir.simulacao.saldoVirtual;
      const abertas: Posicao[] = [];
      const hist = [...s.investir.simulacao.historico];
      for (const p of s.investir.simulacao.posicoes) {
        const pr = p.ativo === 'BTC' ? precos.BTC?.valor : precos.USD?.valor;
        if (!pr) {
          abertas.push(p);
          continue;
        }
        const a = avaliarPosicao(p, pr);
        if (a.estado === 'aberta') abertas.push(p);
        else {
          const { op, devolver } = fechar(p, pr, a.estado === 'liquidada' ? 'liquidado' : a.estado, new Date().toISOString());
          saldo += devolver;
          hist.push(op);
          encerradas.push(a.estado === 'liquidada' ? `${p.ativo === 'BTC' ? 'Bitcoin' : 'Dólar'}: liquidado, você perdeu tudo desta operação` : `${p.ativo === 'BTC' ? 'Bitcoin' : 'Dólar'}: ${a.estado === 'stop' ? 'stop' : 'alvo'} atingido (${brl0(op.resultado)})`);
        }
      }
      return encerradas.length ? { ...s, investir: { ...s.investir, simulacao: { saldoVirtual: Math.round(saldo * 100) / 100, posicoes: abertas, historico: hist } } } : s;
    });
    if (encerradas.length) toast(`${encerradas.join('. ')}. Calculado com o último preço disponível.`, { duracao: 7000 });
  }, [precos]);

  const aberto = useMemo(
    () => sim.posicoes.map((p) => {
      const pr = preco(p.ativo);
      return { p, pr, a: pr ? avaliarPosicao(p, pr) : null };
    }),
    [sim.posicoes, precos] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const lucroAberto = aberto.reduce((t, x) => t + (x.a?.resultado ?? 0), 0);
  const st = estatisticas(sim.historico);

  return (
    <>
      <p className="gs-banner" role="note" style={{ fontWeight: 600 }}>Simulação com dinheiro de mentirinha. No mercado futuro real, com alavancagem, dá para perder mais do que você colocou. Estudos com dados da B3 indicam que a grande maioria de quem faz day trade em futuros perde dinheiro.</p>
      <section className="gs-card destaque">
        <span className="gs-rotulo">Saldo virtual</span>
        <p className="gs-grande gs-tab" style={{ margin: '4px 0' }}>{brl(sim.saldoVirtual + sim.posicoes.reduce((t, p) => t + p.margem, 0) + lucroAberto)}</p>
        <span className="gs-mudo">Livre pra operar: {brl(sim.saldoVirtual)}</span>
        <div className="gs-grade duas" style={{ marginTop: 12 }}>
          {(['BTC', 'USD'] as const).map((a) => (
            <div key={a} className="gs-card ivory" style={{ margin: 0, padding: 14 }}>
              <span className="gs-rotulo">{a === 'BTC' ? 'Bitcoin (BTC/BRL)' : 'Dólar (USD/BRL)'}</span>
              <p className="gs-medio gs-tab" style={{ margin: '4px 0 0' }}>{preco(a) ? brl(preco(a)!) : '—'}</p>
              <span className="gs-mudo" style={{ fontSize: 12 }}>{precos[a] ? `atualizado ${Math.max(0, Math.round((Date.now() - precos[a]!.em) / 1000))} s atrás` : erro ? 'sem preço agora' : 'carregando…'}</span>
            </div>
          ))}
        </div>
        <div className="gs-acoes">
          <button type="button" className="gs-btn" disabled={!precos.BTC && !precos.USD} onClick={() => setAbrir(true)}>Nova operação</button>
          <button type="button" className="gs-btn sec" onClick={() => setResetar(true)}>Recomeçar com R$ 10.000</button>
        </div>
        {erro && !precos.BTC && !precos.USD && <p className="gs-nota">Sem preço de mercado agora, então não dá pra operar. Tente de novo em instantes.</p>}
      </section>

      <h2 className="gs-h2">Operações abertas</h2>
      {aberto.length === 0 ? <p className="gs-mudo">Nenhuma aberta.</p> : (
        <div className="gs-card">
          {aberto.map(({ p, pr, a }) => (
            <div className="gs-linha" key={p.id}>
              <div className="gs-corpo">
                <b>{p.ativo === 'BTC' ? 'Bitcoin' : 'Dólar'} · {p.lado === 'long' ? 'Compra' : 'Venda'} · {p.alavancagem}x</b>
                <small>Margem {brl0(p.margem)} · entrada {brl(p.precoEntrada)}{p.stop ? ` · stop ${brl(p.stop)}` : ''}{p.alvo ? ` · alvo ${brl(p.alvo)}` : ''}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="gs-valor" style={{ color: (a?.resultado ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{a ? brl(a.resultado) : '—'}</div>
                <button type="button" className="gs-btn link" disabled={!pr} onClick={() => {
                  if (!pr) return;
                  const { op, devolver } = fechar(p, pr, 'manual', new Date().toISOString());
                  atualizar((s) => ({ ...s, investir: { ...s.investir, simulacao: { saldoVirtual: Math.round((s.investir.simulacao.saldoVirtual + devolver) * 100) / 100, posicoes: s.investir.simulacao.posicoes.filter((x) => x.id !== p.id), historico: [...s.investir.simulacao.historico, op] } } }));
                  toast(`Operação fechada: ${brl(op.resultado)}`);
                }}>Fechar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="gs-h2">Seu histórico</h2>
      <div className="gs-tres">
        <div><span className="gs-mudo">Operações</span><b className="gs-tab">{st.total}</b></div>
        <div><span className="gs-mudo">Acertos</span><b className="gs-tab">{st.taxaAcerto}%</b></div>
        <div><span className="gs-mudo">Resultado</span><b className="gs-tab">{brl0(st.acumulado)}</b></div>
      </div>
      <p className="gs-mudo" style={{ margin: '10px 4px' }}>Maior perda: {brl0(st.maiorPerda)}</p>
      {sim.historico.length > 0 && (
        <div className="gs-card">
          {[...sim.historico].reverse().slice(0, 15).map((o) => (
            <div className="gs-linha" key={`${o.id}-${o.fechadaEm}`} style={{ minHeight: 48 }}>
              <div className="gs-corpo"><b>{o.ativo === 'BTC' ? 'Bitcoin' : 'Dólar'} · {o.lado === 'long' ? 'Compra' : 'Venda'} · {o.alavancagem}x</b><small>{o.motivo === 'liquidado' ? 'Liquidado' : o.motivo === 'stop' ? 'Stop' : o.motivo === 'alvo' ? 'Alvo' : 'Fechado'} · {new Date(o.fechadaEm).toLocaleDateString('pt-BR')}</small></div>
              <span className="gs-valor" style={{ color: o.resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>{brl(o.resultado)}</span>
            </div>
          ))}
        </div>
      )}

      <NovaOperacao aberta={abrir} onFechar={() => setAbrir(false)} precos={precos} saldo={sim.saldoVirtual} />
      <Confirmar aberta={resetar} titulo="Recomeçar a simulação?" texto="O saldo volta pra R$ 10.000 e o histórico some." rotulo="Recomeçar" onCancelar={() => setResetar(false)} onConfirmar={() => { atualizar((s) => ({ ...s, investir: { ...s.investir, simulacao: { saldoVirtual: SALDO_INICIAL, posicoes: [], historico: [] } } })); setResetar(false); }} />
    </>
  );
}

function NovaOperacao({ aberta, onFechar, precos, saldo }: { aberta: boolean; onFechar: () => void; precos: Precos; saldo: number }) {
  const [ativo, setAtivo] = useState<'BTC' | 'USD'>('BTC');
  const [lado, setLado] = useState<'long' | 'short'>('long');
  const [margem, setMargem] = useState(0);
  const [alav, setAlav] = useState<number | ''>(1);
  const [stop, setStop] = useState(0);
  const [alvo, setAlvo] = useState(0);
  const [tentou, setTentou] = useState(false);
  const preco = precos[ativo]?.valor;
  const erro = !preco ? 'Sem preço agora.' : margem <= 0 ? 'Digite a margem.' : margem > saldo ? 'Você não tem saldo pra isso.' : typeof alav !== 'number' || alav < 1 ? 'Alavancagem de 1x a 10x.' : stop > 0 && (lado === 'long' ? stop >= preco : stop <= preco) ? 'O stop precisa estar do lado do prejuízo.' : alvo > 0 && (lado === 'long' ? alvo <= preco : alvo >= preco) ? 'O alvo precisa estar do lado do lucro.' : '';
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Nova operação (de mentirinha)">
      <div className="gs-seg" role="group" aria-label="Ativo">
        {(['BTC', 'USD'] as const).map((a) => <button key={a} type="button" className={ativo === a ? 'on' : ''} onClick={() => setAtivo(a)}>{a === 'BTC' ? 'Bitcoin' : 'Dólar'}</button>)}
      </div>
      <div className="gs-seg" role="group" aria-label="Lado">
        <button type="button" className={lado === 'long' ? 'on' : ''} onClick={() => setLado('long')}>Comprar (long)</button>
        <button type="button" className={lado === 'short' ? 'on' : ''} onClick={() => setLado('short')}>Vender (short)</button>
      </div>
      <p className="gs-mudo">Preço agora: {preco ? brl(preco) : '—'}</p>
      <CampoDinheiro rotulo="Margem" valor={margem} onChange={setMargem} />
      <CampoNumero rotulo="Alavancagem" sufixo={`1x a ${ALAVANCAGEM_MAX}x`} valor={alav} onChange={setAlav} min={1} max={ALAVANCAGEM_MAX} />
      <div className="gs-dois">
        <CampoDinheiro rotulo="Stop (opcional)" valor={stop} onChange={setStop} />
        <CampoDinheiro rotulo="Alvo (opcional)" valor={alvo} onChange={setAlvo} />
      </div>
      {tentou && erro && <p className="gs-erro" role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button type="button" className="gs-btn" onClick={() => {
          setTentou(true);
          if (erro || !preco || typeof alav !== 'number') return;
          const p: Posicao = { id: novoId('pos'), ativo, lado, margem, alavancagem: alav, precoEntrada: preco, abertaEm: new Date().toISOString(), stop: stop > 0 ? stop : undefined, alvo: alvo > 0 ? alvo : undefined };
          atualizar((s) => ({ ...s, investir: { ...s.investir, simulacao: { ...s.investir.simulacao, saldoVirtual: Math.round((s.investir.simulacao.saldoVirtual - margem) * 100) / 100, posicoes: [...s.investir.simulacao.posicoes, p] } } }));
          toast('Operação aberta. Dinheiro de mentirinha.');
          setMargem(0);
          setStop(0);
          setAlvo(0);
          setTentou(false);
          onFechar();
        }}>Abrir operação</button>
      </div>
    </Folha>
  );
}
