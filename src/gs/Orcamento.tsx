import { useMemo } from 'react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, mesDe, nomeMes } from './datas';
import { acaoOrcamento, linhasDeCategoria, regra503020, resumoDoMes } from './orcamento';
import { corDe, limiteSugerido } from './categorias';
import { definirLimite } from './acoes';
import { Barra, Dica, Titulo, Vazio } from './ui';
import { Anel, Rosquinha } from './graficos';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { toast } from '../components/ui/Toast';

/* ---------- Orçamento: quanto ainda dá em cada coisa, e a regra 50/30/20 com os seus números ---------- */

export function Orcamento() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const linhas = useMemo(() => linhasDeCategoria(e, mes), [e, mes]);
  const regra = useMemo(() => regra503020(e, mes), [e, mes]);
  const total = linhas.reduce((t, l) => t + l.gasto, 0);
  const r = useMemo(() => resumoDoMes(e, mes, hoje), [e, mes, hoje]);
  const acao = useMemo(() => acaoOrcamento(e, mes, hoje), [e, mes, hoje]);
  const semLimite = linhas.filter((l) => l.limite === null && l.gasto > 0);
  return (
    <>
      <Titulo titulo="Orçamento" sub={`Pra onde vai o dinheiro e quanto ainda dá em ${nomeMes(mes)}.`} />
      {e.config.renda <= 0 ? (
        <Vazio titulo="Informe sua renda" texto="Sem ela eu não consigo montar a regra 50/30/20 nem sugerir limites." acao="Informar renda" rota="/dados" avatar="gastos" />
      ) : (
        <>
          <section className="gs-card destaque" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ flex: 'none', width: 104 }}><Anel pct={r.pctUsado} grande={`${Math.round(r.pctUsado)}%`} sub="usado" tamanho={104} cor={r.pctUsado > r.pctMes + 10 ? 'var(--danger)' : 'var(--gold-strong)'} /></div>
            <div>
              <span className="gs-rotulo">Você pode gastar hoje</span>
              <p className="gs-grande" style={{ margin: '2px 0' }}>{brl0(Math.max(0, r.porDia))}</p>
              <p className="gs-sub" style={{ margin: 0 }}>Restam {r.restam} {r.restam === 1 ? 'dia' : 'dias'} no mês</p>
            </div>
          </section>
          <section className="gs-card">
            <Barra pct={r.pctUsado} tom={r.pctUsado > r.pctMes + 10 ? 'perigo' : 'ok'} rotulo="Quanto do dinheiro já foi" />
            <p className="gs-mudo" style={{ margin: '6px 0 0', fontSize: 14 }}>Você gastou {brl0(r.gastoVar)} e ainda dá {brl0(Math.max(0, r.livre))}. O mês passou {Math.round(r.pctMes)}% e o seu dinheiro, {Math.round(r.pctUsado)}%.</p>
          </section>
          <section className="gs-card">
            <span className="gs-rotulo">O que fazer agora</span>
            <p style={{ margin: '6px 0 0' }}><span className={`gs-etiqueta ${acao.tom === 'ok' ? 'ok' : acao.tom === 'perigo' ? 'perigo' : 'aviso'}`} style={{ marginRight: 8 }}>{acao.tom === 'ok' ? 'No trilho' : acao.tom === 'perigo' ? 'Atenção' : 'Cuidado'}</span>{acao.texto.replace(/^No trilho\.?\s*/, '')}</p>
            {acao.rota && <Link to={acao.rota} className="gs-btn" style={{ marginTop: 10 }}>Anotar um gasto</Link>}
          </section>

          {total > 0 && (
            <details className="gs-card" style={{ padding: '4px 20px' }}>
              <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Ver para onde foi o dinheiro</summary>
              <Rosquinha fatias={linhas.map((l) => ({ id: l.categoria, cor: corDe(l.categoria), valor: l.gasto }))} centro={brl0(total)} sub="no mês" />
            </details>
          )}

          <section className="gs-card">
            <span className="gs-rotulo">Limite por categoria</span>
            {semLimite.length > 0 && (
              <Dica icone={<Info size={18} />}>
                {semLimite.length} categoria{semLimite.length > 1 ? 's' : ''} sem limite.{' '}
                <button type="button" className="gs-btn link" style={{ minHeight: 32 }} onClick={() => { semLimite.forEach((l) => definirLimite(l.categoria, limiteSugerido(l.categoria, e.config.renda))); toast('Limites sugeridos aplicados'); }}>Usar os sugeridos</button>
              </Dica>
            )}
            {linhas.filter((l) => l.gasto > 0 || l.limite).map((l) => (
              <div key={l.categoria} style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <b><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: corDe(l.categoria), marginRight: 8 }} />{l.categoria}</b>
                  <span className="gs-valor">{brl(l.gasto)}{l.limite ? <span className="gs-mudo"> de {brl0(l.limite)}</span> : null}</span>
                </div>
                {l.limite ? <Barra pct={Math.min(100, l.pct ?? 0)} tom={l.tom === 'perigo' ? 'perigo' : l.tom === 'ok' ? 'ok' : ''} rotulo={`Limite de ${l.categoria}`} /> : <p className="gs-mudo" style={{ margin: '4px 0 0', fontSize: 13 }}>Sem limite · <button type="button" className="gs-btn link" style={{ minHeight: 32 }} onClick={() => definirLimite(l.categoria, limiteSugerido(l.categoria, e.config.renda))}>Definir {brl0(limiteSugerido(l.categoria, e.config.renda))}</button></p>}
                {l.limite && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <small className="gs-mudo">{(l.pct ?? 0) > 100 ? `Passou ${brl0(l.gasto - l.limite)}` : `Sobra ${brl0(l.limite - l.gasto)}`}</small>
                    <span style={{ whiteSpace: 'nowrap', flex: 'none' }}>
                      <button type="button" className="gs-btn link pequeno" aria-label={`Diminuir limite de ${l.categoria}`} onClick={() => definirLimite(l.categoria, Math.max(50, l.limite! - 50))}>− R$ 50</button>
                      <button type="button" className="gs-btn link pequeno" aria-label={`Aumentar limite de ${l.categoria}`} onClick={() => definirLimite(l.categoria, l.limite! + 50)}>+ R$ 50</button>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </section>
          <details className="gs-card" style={{ padding: '4px 20px', marginTop: 12 }}>
            <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Regra 50/30/20 com os seus números</summary>
            <div style={{ paddingBottom: 12 }}>
              {regra.map((x) => (
                <div key={x.nome} style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>{x.nome}</b>
                    <span className="gs-valor">{Math.round(x.pct)}% <span className="gs-mudo">(ideal {x.menorMelhor ? '≤' : '≥'} {x.ideal}%)</span></span>
                  </div>
                  <Barra pct={Math.min(100, (x.pct / (x.ideal * 1.4)) * 100)} tom={x.ok ? 'ok' : 'perigo'} rotulo={x.nome} />
                </div>
              ))}
              <Dica>
                {regra[0]?.pct > 50
                  ? 'Suas necessidades passam de 50% da renda. O maior peso costuma ser a casa: renegociar o aluguel ou dividir custos muda o jogo.'
                  : regra[2]?.pct < 20
                    ? `Falta ${brl0((e.config.renda * 20) / 100 - (regra[2].pct / 100) * e.config.renda)} pra chegar aos 20% guardados. Comece pelas assinaturas e pelo delivery.`
                    : 'Você está dentro da regra. Mantenha.'}
              </Dica>
            </div>
          </details>
        </>
      )}
    </>
  );
}
