import { useMemo, useState } from 'react';
import { useEstado } from './store';
import { resumoDaSemana } from './insights';
import { useHoje } from './useHoje';
import { brl0, diaCurto } from './datas';

/* ---------- Resumo da semana: na segunda, a semana que passou; nos outros dias, a de agora (e a anterior sob demanda) ---------- */

export function ResumoSemana() {
  const e = useEstado();
  const hoje = useHoje();
  const segunda = new Date(`${hoje}T12:00:00Z`).getUTCDay() === 1;
  const [anterior, setAnterior] = useState(segunda);
  const r = useMemo(() => resumoDaSemana(e, hoje, anterior ? 1 : 0), [e, hoje, anterior]);
  const vazio = r.gasto === 0 && r.guardado === 0 && r.contasPagas === 0;
  return (
    <section className="gs-card" aria-label="Resumo da semana">
      <p className="gs-rotulo">
        {anterior ? 'Semana passada' : 'Esta semana'} · {diaCurto(r.de)} a {diaCurto(r.ate)}
      </p>
      {vazio ? (
        <p className="gs-sub" style={{ margin: '10px 0 0' }}>Nada anotado {anterior ? 'na semana passada' : 'ainda nesta semana'}. {r.recomendacao}</p>
      ) : (
        <>
          <div className="gs-tres" style={{ marginTop: 12 }}>
            <div><span className="gs-mudo">Gastou</span><b className="gs-tab">{brl0(r.gasto)}</b></div>
            <div><span className="gs-mudo">Contas pagas</span><b className="gs-tab">{r.contasPagas}</b></div>
            <div><span className="gs-mudo">Guardou</span><b className="gs-tab">{brl0(r.guardado)}</b></div>
          </div>
          {r.categoriaTop && <p className="gs-sub" style={{ margin: '12px 0 0' }}>Mais pesou: {r.categoriaTop.nome} ({brl0(r.categoriaTop.valor)}).</p>}
          <p className="gs-banner" style={{ margin: '12px 0 0' }}>{r.recomendacao}</p>
        </>
      )}
      <button type="button" className="gs-btn link" onClick={() => setAnterior(!anterior)}>
        {anterior ? 'Ver esta semana' : 'Ver semana anterior'}
      </button>
    </section>
  );
}
