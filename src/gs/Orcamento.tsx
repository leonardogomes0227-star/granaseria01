import { useMemo } from 'react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, mesDe, nomeMes } from './datas';
import { linhasDeCategoria, regra503020 } from './orcamento';
import { corDe, limiteSugerido } from './categorias';
import { definirLimite } from './acoes';
import { Aprende, Barra, Dica, Titulo, Vazio } from './ui';
import { Rosquinha } from './graficos';
import { toast } from '../components/ui/Toast';

/* ---------- Orçamento: quanto ainda dá em cada coisa, e a regra 50/30/20 com os seus números ---------- */

export function Orcamento() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const linhas = useMemo(() => linhasDeCategoria(e, mes), [e, mes]);
  const regra = useMemo(() => regra503020(e, mes), [e, mes]);
  const total = linhas.reduce((t, l) => t + l.gasto, 0);
  const semLimite = linhas.filter((l) => l.limite === null && l.gasto > 0);
  return (
    <>
      <Titulo titulo="Orçamento" sub={`Quanto ainda dá em cada coisa em ${nomeMes(mes)}.`} />
      {e.config.renda <= 0 ? (
        <Vazio titulo="Informe sua renda" texto="Sem ela eu não consigo montar a regra 50/30/20 nem sugerir limites." acao="Informar renda" rota="/dados" avatar="gastos" />
      ) : (
        <>
          <section className="gs-card destaque">
            <span className="gs-rotulo">Regra 50/30/20 com os seus números</span>
            {regra.map((r) => (
              <div key={r.nome} style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <b>{r.nome}</b>
                  <span className="gs-valor">{Math.round(r.pct)}% <span className="gs-mudo">(ideal {r.menorMelhor ? '≤' : '≥'} {r.ideal}%)</span></span>
                </div>
                <Barra pct={Math.min(100, (r.pct / (r.ideal * 1.4)) * 100)} tom={r.ok ? 'ok' : 'perigo'} rotulo={r.nome} />
              </div>
            ))}
            <Dica>
              {regra[0]?.pct > 50
                ? 'Suas necessidades passam de 50% da renda. O maior peso costuma ser a casa: renegociar o aluguel ou dividir custos muda o jogo.'
                : regra[2]?.pct < 20
                  ? `Falta ${brl0((e.config.renda * 20) / 100 - (regra[2].pct / 100) * e.config.renda)} pra chegar aos 20% guardados. Comece pelas assinaturas e pelo delivery.`
                  : 'Você está dentro da regra. Mantenha.'}
            </Dica>
          </section>

          {total > 0 && (
            <section className="gs-card">
              <span className="gs-rotulo">Para onde foi o dinheiro</span>
              <Rosquinha fatias={linhas.map((l) => ({ id: l.categoria, cor: corDe(l.categoria), valor: l.gasto }))} centro={brl0(total)} sub="no mês" />
            </section>
          )}

          <section className="gs-card">
            <span className="gs-rotulo">Limite por categoria</span>
            {semLimite.length > 0 && (
              <Dica icone="ℹ️">
                {semLimite.length} categoria{semLimite.length > 1 ? 's' : ''} sem limite.{' '}
                <button type="button" className="gs-btn link" style={{ minHeight: 32 }} onClick={() => { semLimite.forEach((l) => definirLimite(l.categoria, limiteSugerido(l.categoria, e.config.renda))); toast('Limites sugeridos aplicados'); }}>Usar os sugeridos</button>
              </Dica>
            )}
            {linhas.map((l) => (
              <div key={l.categoria} style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <b><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: corDe(l.categoria), marginRight: 8 }} />{l.categoria}</b>
                  <span className="gs-valor">{brl(l.gasto)}{l.limite ? <span className="gs-mudo"> de {brl0(l.limite)}</span> : null}</span>
                </div>
                {l.limite ? <Barra pct={Math.min(100, l.pct ?? 0)} tom={l.tom === 'perigo' ? 'perigo' : l.tom === 'ok' ? 'ok' : ''} rotulo={`Limite de ${l.categoria}`} /> : <p className="gs-mudo" style={{ margin: '4px 0 0', fontSize: 13 }}>Sem limite · <button type="button" className="gs-btn link" style={{ minHeight: 32 }} onClick={() => definirLimite(l.categoria, limiteSugerido(l.categoria, e.config.renda))}>Definir {brl0(limiteSugerido(l.categoria, e.config.renda))}</button></p>}
                {l.limite && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <small className="gs-mudo">{(l.pct ?? 0) > 100 ? `Passou ${brl0(l.gasto - l.limite)}` : `Sobra ${brl0(l.limite - l.gasto)}`}</small>
                    <span>
                      <button type="button" className="gs-btn link pequeno" aria-label={`Diminuir limite de ${l.categoria}`} onClick={() => definirLimite(l.categoria, Math.max(50, l.limite! - 50))}>− R$ 50</button>
                      <button type="button" className="gs-btn link pequeno" aria-label={`Aumentar limite de ${l.categoria}`} onClick={() => definirLimite(l.categoria, l.limite! + 50)}>+ R$ 50</button>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
      <Aprende titulo="Por que limitar por categoria" texto="Dizer 'vou gastar menos' não funciona. Dizer 'R$ 450 de comida este mês' funciona, porque você vê a barra encher e decide antes de passar. O limite não é proibição: é um combinado com você." />
    </>
  );
}
