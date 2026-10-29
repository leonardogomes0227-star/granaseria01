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
          <p style={{ margin: '10px 0 0' }}>
            Gastou <b>{brl0(r.gasto)}</b>, pagou <b>{r.contasPagas}</b> {r.contasPagas === 1 ? 'conta' : 'contas'} e guardou <b>{brl0(r.guardado)}</b>.
            {r.categoriaTop ? ` Mais pesou: ${r.categoriaTop.nome}.` : ''}
          </p>
          <p className="gs-sub" style={{ margin: '8px 0 0' }}>{r.recomendacao}</p>
        </>
      )}
      <button type="button" className="gs-btn link" onClick={() => setAnterior(!anterior)}>
        {anterior ? 'Ver esta semana' : 'Ver semana anterior'}
      </button>
    </section>
  );
}
