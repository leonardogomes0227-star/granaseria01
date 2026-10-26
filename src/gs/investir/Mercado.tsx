import { RefreshCw } from 'lucide-react';
import { useMercado, haQuanto } from './useMercado';
import { Grafico, type Serie } from './Grafico';
import { Esqueleto } from '../ui';
import { brl, pct } from '../datas';
import type { Item } from './tipos';

/* ---------- Mercado: dados reais, com fonte e "atualizado há X". Sem dado, aviso honesto. ---------- */

const COR: Record<string, string> = { poupanca: 'var(--success)', cdi: 'var(--ink)', ipca: 'var(--danger)', dolar: 'var(--gold-strong)', bitcoin: 'var(--gold)', ibovespa: 'var(--ink-muted)' };
const NOME: Record<string, string> = { poupanca: 'Poupança', cdi: 'CDI', ipca: 'Inflação', dolar: 'Dólar', bitcoin: 'Bitcoin', ibovespa: 'Ibovespa' };

const EDUCATIVOS: { titulo: string; serve: string; risco: string; evitar: string }[] = [
  { titulo: 'Reserva de emergência', serve: 'Todo mundo, antes de qualquer outro investimento.', risco: 'Baixo. O objetivo é segurança, não ganho.', evitar: 'Nunca em algo que pode cair ou que trava o dinheiro.' },
  { titulo: 'Tesouro Selic e CDB com liquidez diária', serve: 'Reserva e metas de curto prazo.', risco: 'Baixo. Confira as regras e a garantia vigentes de cada produto.', evitar: 'Se você pode precisar do dinheiro e o produto não tem liquidez diária.' },
  { titulo: 'LCI e LCA', serve: 'Quem já tem reserva e pode deixar o dinheiro parado por um prazo.', risco: 'Baixo a médio. Confira a regra vigente de tributação e de garantia.', evitar: 'Pra dinheiro que você pode precisar antes do vencimento.' },
  { titulo: 'Ações e fundos imobiliários', serve: 'Quem investe por vários anos e aguenta ver o valor oscilar.', risco: 'Alto. O preço sobe e desce, e pode ficar abaixo do que você pagou por muito tempo.', evitar: 'Com dívida cara, sem reserva ou com dinheiro que tem data pra ser usado.' },
  { titulo: 'Bitcoin e cripto', serve: 'Quem já tem o básico em dia e aceita perder o valor investido.', risco: 'Muito alto. Variações grandes em poucos dias.', evitar: 'Com dinheiro das contas, da reserva ou emprestado. Limite a uma parcela pequena.' },
  { titulo: 'Mercado futuro e day trade', serve: 'Quase ninguém. É operação de curtíssimo prazo com alavancagem.', risco: 'Extremo. Dá pra perder mais do que você colocou, e a grande maioria perde dinheiro.', evitar: 'Sempre que não for dinheiro de treino. Use a aba Simulação pra aprender sem risco.' },
];

function Cartao({ rotulo, item, formato, extra }: { rotulo: string; item?: Item; formato: (n: number) => string; extra?: string }) {
  if (!item) return null;
  return (
    <div className="gs-card ivory" style={{ margin: 0, padding: 16 }}>
      <span className="gs-rotulo">{rotulo}</span>
      <p className="gs-medio gs-tab" style={{ margin: '4px 0' }}>{formato(item.valor)}</p>
      {extra && <span className="gs-mudo" style={{ display: 'block' }}>{extra}</span>}
      <span className="gs-mudo" style={{ fontSize: 12 }}>{item.fonte} · {item.desatualizado ? 'desatualizado, ' : ''}atualizado {haQuanto(item.atualizadoEm)}</span>
    </div>
  );
}

export function Mercado() {
  const { carregando, dados, erro, recarregar } = useMercado();
  if (carregando && !dados) return <Esqueleto linhas={5} />;
  if (!dados)
    return (
      <div className="gs-card gs-vazio" role="alert">
        <b>Sem conexão com os dados de mercado agora</b>
        <p>Não vou mostrar número que eu não consiga confirmar. Tente de novo em instantes.</p>
        <button type="button" className="gs-btn" onClick={recarregar}><RefreshCw size={16} /> Tentar de novo</button>
      </div>
    );
  const nMeses = dados.meses?.length ?? 0;
  const series: Serie[] = Object.entries(dados.series ?? {})
    .filter(([, v]) => Array.isArray(v) && v.length === nMeses && v.every((n) => typeof n === 'number' && Number.isFinite(n)))
    .map(([id, valores]) => ({ id, nome: NOME[id] ?? id, cor: COR[id] ?? 'var(--ink)', valores }));
  return (
    <>
      {erro && <p className="gs-banner" role="status">Não consegui atualizar agora. Mostrando o último dado disponível.</p>}
      <div className="gs-grade duas">
        <Cartao rotulo="Selic (meta)" item={dados.selic} formato={(n) => `${pct(n, 2)} a.a.`} />
        <Cartao rotulo="CDI" item={dados.cdi} formato={(n) => `${pct(n, 2)} a.a.`} />
        <Cartao rotulo="Inflação (IPCA 12 meses)" item={dados.ipca12m} formato={(n) => pct(n, 2)} />
        <Cartao rotulo="Poupança" item={dados.poupanca} formato={(n) => `${pct(n, 2)} a.a.`} extra="Calculada pela regra da Selic, sem a TR." />
        <Cartao rotulo="Dólar" item={dados.dolar} formato={(n) => brl(n)} />
        <Cartao rotulo="Bitcoin" item={dados.bitcoin} formato={(n) => brl(n)} extra={dados.bitcoin?.var24h != null ? `${dados.bitcoin.var24h.toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}% em 24 h` : undefined} />
        <Cartao rotulo="Ibovespa" item={dados.ibovespa} formato={(n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} pts`} extra={dados.ibovespa?.var24h != null ? `${dados.ibovespa.var24h.toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}% no dia` : undefined} />
      </div>
      {dados.jurosReal && (
        <div className="gs-card destaque" style={{ marginTop: 16 }}>
          <span className="gs-rotulo">Juro real (CDI − inflação)</span>
          <p className="gs-medio" style={{ margin: '6px 0 0' }}>Hoje a renda fixa rende cerca de {pct(Math.abs(dados.jurosReal.valor), 1)} ao ano {dados.jurosReal.valor >= 0 ? 'acima' : 'abaixo'} da inflação.</p>
        </div>
      )}
      {dados.meses && nMeses > 1 && series.length > 0 && (
        <>
          <h2 className="gs-h2">Quanto cada um rendeu em 12 meses</h2>
          <div className="gs-card"><Grafico meses={dados.meses} series={series} /></div>
        </>
      )}
      {dados.ranking && dados.ranking.length > 0 && (
        <>
          <h2 className="gs-h2">Ranking dos últimos 12 meses</h2>
          <div className="gs-card">
            {dados.ranking.map((r) => (
              <div className="gs-linha" key={r.id}>
                <div className="gs-corpo"><b>{r.nome}</b><small>Risco {r.risco} · liquidez {r.liquidez}</small></div>
                <span className="gs-valor">{r.retorno12m.toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}%</span>
              </div>
            ))}
            <p className="gs-nota">O melhor investimento depende do seu prazo, do risco que você aguenta e do objetivo. Passado não garante futuro.</p>
          </div>
        </>
      )}
      {dados.cripto && dados.cripto.length > 0 && (
        <>
          <h2 className="gs-h2">Em alta hoje (cripto)</h2>
          <div className="gs-card">
            {dados.cripto.map((c) => (
              <div className="gs-linha" key={c.simbolo} style={{ minHeight: 48 }}>
                <div className="gs-corpo"><b>{c.nome}</b><small>{c.simbolo}</small></div>
                <div style={{ textAlign: 'right' }}><div className="gs-valor">{brl(c.preco)}</div><small className="gs-mudo">{c.var24h != null ? `${c.var24h.toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}% em 24 h` : '—'}</small></div>
              </div>
            ))}
          </div>
        </>
      )}
      {dados.b3 && dados.b3.altas.length > 0 && (
        <>
          <h2 className="gs-h2">Maiores altas da B3 hoje</h2>
          <div className="gs-card">
            {dados.b3.altas.map((a) => <div className="gs-linha" key={a.simbolo} style={{ minHeight: 48 }}><div className="gs-corpo"><b>{a.simbolo}</b></div><span className="gs-valor">{brl(a.preco)} · {a.var.toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}%</span></div>)}
          </div>
        </>
      )}
      <h2 className="gs-h2">Entenda cada um</h2>
      {EDUCATIVOS.map((c) => (
        <details className="gs-card" key={c.titulo} style={{ padding: '4px 20px' }}>
          <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>{c.titulo}</summary>
          <p><b>Pra quem serve:</b> {c.serve}</p>
          <p><b>Risco:</b> {c.risco}</p>
          <p><b>Quando evitar:</b> {c.evitar}</p>
        </details>
      ))}
    </>
  );
}
