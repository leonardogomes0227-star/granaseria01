import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getName } from '../painel';
import { useEstado } from './store';
import { brl0, mesDe, brl } from './datas';
import { fatiasDaRenda, limiteDiario, livreParaGastar, patrimonioGuardado } from './selectores';
import { Rosca } from './Rosca';
import { Folha, Titulo } from './ui';
import { FormRenda } from './Onboarding';
import { useHoje } from './useHoje';
import { ProximasAcoes } from './ProximasAcoes';
import { ResumoSemana } from './ResumoSemana';

/* ---------- Início: "o que eu faço hoje?" ---------- */

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};

export function Inicio() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [renda, setRenda] = useState(false);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const fatias = useMemo(() => fatiasDaRenda(e, mes), [e, mes]);
  const livre = livreParaGastar(e, mes);
  const semRenda = e.config.renda <= 0;
  return (
    <>
      <Titulo titulo={nome ? `Oi, ${nome}` : 'Oi!'} sub={semRenda ? 'Informe sua renda pra ver o seu mês.' : `Você pode gastar ${brl(limiteDiario(e, mes, hoje))} por dia até o fim do mês.`} />
      <section className="gs-card destaque" aria-label="Sua renda do mês">
        {semRenda ? (
          <>
            <Rosca fatias={fatias.map((f) => ({ ...f, valor: 0, pct: 0 }))} guardadoTotal={patrimonioGuardado(e)} semRenda />
            <div className="gs-acoes" style={{ justifyContent: 'center' }}>
              <button type="button" className="gs-btn" onClick={() => setRenda(true)}>Informar minha renda</button>
            </div>
          </>
        ) : (
          <>
            <Rosca fatias={fatias} guardadoTotal={patrimonioGuardado(e)} />
            {livre < 0 && (
              <p className="gs-banner" role="alert" style={{ marginTop: 14 }}>
                Você gastou {brl0(-livre)} além da renda. <Link to="/mes?aba=dia" className="gs-btn link">Ver gastos</Link>
              </p>
            )}
          </>
        )}
      </section>
      <h2 className="gs-h2">Próximas ações</h2>
      <ProximasAcoes />
      <h2 className="gs-h2">Resumo da semana</h2>
      <ResumoSemana />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês">
        <FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" />
      </Folha>
    </>
  );
}
