import { motion } from 'framer-motion';
import type { Resultado } from '../../chat/engine';
import { infoAgente } from '../../chat/agentes';
import { Guilloche, Ornamento } from '../ui/Guilloche';
import { Medalhao } from '../ui/Medalhao';
import { barras, juntarNomes, partesDoItem, romano, semNumero } from './resultado';

/* ---------- Cartão de resultado no fim do chat (spec v2, seção 6; design 6.5) ---------- */
// Card cofre com filete, guilhochê e ornamento; linhas em algarismos romanos; lista e gráfico quando o roteiro
// manda; a pilha de medalhões dos agentes que ficam de olho e o botão em linho sólido.

const curva = [0.22, 1, 0.36, 1] as const;

export function ResultadoCard({
  resultado,
  concluida,
  saindo,
  calmo,
  onComecar,
  onAjustar,
  onVerMissoes,
  onRefazer,
}: {
  resultado: Resultado;
  concluida: boolean;
  saindo: boolean;
  calmo: boolean;
  onComecar: () => void;
  onAjustar: () => void;
  onVerMissoes: () => void;
  onRefazer: () => void;
}) {
  const nomes = resultado.agentes.map((a) => infoAgente(a).nome);
  const colunas = barras(resultado.grafico);
  const lista = (resultado.lista ?? []).filter(Boolean);
  // as linhas entram uma depois da outra (40 ms), e as barras crescem da esquerda; com pouco movimento, nada se mexe
  const item = (i: number) =>
    calmo
      ? { initial: false as const }
      : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease: curva, delay: 0.18 + i * 0.04 } };

  return (
    <motion.section
      className="cc-resultado cofre"
      aria-label={resultado.titulo}
      initial={calmo ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    >
      <Guilloche />
      {nomes.length > 0 && (
        <div className="cc-res-topo">
          <span className="cc-faces">
            {resultado.agentes.map((a) => (
              <Medalhao key={a} id={a} nome={infoAgente(a).nome} tamanho={34} />
            ))}
          </span>
          <span className="sobrelinha">{juntarNomes(nomes)} de olho</span>
        </div>
      )}
      <h2 className="cc-res-titulo">{resultado.titulo}</h2>
      <Ornamento className="cc-res-ornamento" />

      {resultado.linhas.length > 0 && (
        <ol className="cc-res-linhas">
          {resultado.linhas.map((l, i) => (
            <motion.li key={`${i}:${l}`} {...item(i)}>
              <span className="cc-romano" aria-hidden="true">
                {romano(i + 1)}.
              </span>
              <span>{semNumero(l)}</span>
            </motion.li>
          ))}
        </ol>
      )}

      {colunas.length > 0 && (
        <ul className="cc-grafico" aria-label="Projeção">
          {colunas.map((b, i) => (
            <li key={`${i}:${b.rotulo}`}>
              <span className="cc-grafico-rotulo">
                <span>{b.rotulo}</span>
                <b>{b.texto}</b>
              </span>
              <span className="cc-grafico-trilha" aria-hidden="true">
                <motion.i
                  style={{ width: `${b.pct}%` }}
                  initial={calmo ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, ease: curva, delay: 0.3 + i * 0.08 }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {lista.length > 0 && (
        <ul className="cc-res-lista">
          {lista.map((t, i) => {
            const { nome, detalhe } = partesDoItem(t);
            return (
              <motion.li key={`${i}:${t}`} {...item(resultado.linhas.length + i)}>
                <span className="cc-res-item">{nome}</span>
                {detalhe && <span className="cc-res-detalhe">{detalhe}</span>}
              </motion.li>
            );
          })}
        </ul>
      )}

      {resultado.rodape && <p className="cc-rodape">{resultado.rodape}</p>}

      <div className="cc-resultado-acoes">
        {concluida ? (
          <>
            <button type="button" className="btn-primary cc-botao-linho" onClick={onVerMissoes}>
              Ver minhas missões
            </button>
            <button type="button" className="btn-ghost cc-botao-fio" onClick={onRefazer}>
              Refazer
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary cc-botao-linho" disabled={saindo} onClick={onComecar}>
              {resultado.botao ?? 'Começar missão'}
            </button>
            <button type="button" className="btn-ghost cc-botao-fio" disabled={saindo} onClick={onAjustar}>
              Ajustar respostas
            </button>
          </>
        )}
      </div>
    </motion.section>
  );
}
