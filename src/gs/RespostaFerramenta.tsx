import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { mesDe } from './datas';
import { respostaDe } from './respostas';
import { Resposta, BotaoCaminho } from './Impacto';
import { abrirAdicionar } from './AdicionarMov';
import { BaixaSheet } from './BaixaSheet';
import { FormRenda } from './Onboarding';
import { Folha } from './ui';
import { mascarar, useOculto } from './privacidade';

/** O topo de cada ferramenta: a resposta em uma frase, o porquê, um botão e "Colocar no meu caminho". */
export function RespostaFerramenta({ id }: { id: string }) {
  const e = useEstado();
  const hoje = useHoje();
  const oculto = useOculto();
  const r = useMemo(() => respostaDe(id, e, hoje), [id, e, hoje]);
  const [baixa, setBaixa] = useState<string | null>(null);
  const [renda, setRenda] = useState(false);
  if (!r) return null;
  const esconde = (t: string) => (oculto ? t.replace(/R\$\s?[\d.,]+/g, mascarar('x', true)) : t);
  const a = r.acao;
  const botao = a.rota ? <Link to={a.rota} className="gs-btn">{a.rotulo}</Link> : <button type="button" className="gs-btn" onClick={() => (a.handler === 'adicionar' ? abrirAdicionar() : a.handler === 'renda' ? setRenda(true) : a.refId && setBaixa(a.refId))}>{a.rotulo}</button>;
  return (
    <>
      <Resposta rotulo={r.tom === 'perigo' ? 'Resolva primeiro' : 'A resposta'} frase={esconde(r.frase)} porque={r.porque.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{r.porque.map((p) => <li key={p}>{esconde(p)}</li>)}</ul> : undefined}>
        {botao}
        {r.passo && <BotaoCaminho passo={{ ...r.passo, origem: id }} />}
      </Resposta>
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mesDe(hoje)} onFechar={() => setBaixa(null)} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </>
  );
}
