import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, RotateCcw, X } from 'lucide-react';
import { formatBRL } from '../../calculations';
import type { Hoje } from '../../lib/financas';
import { abrirAnotar } from '../../lib/anotar';
import { poucoMovimento } from '../../lib/celebrar';
import { Medalhao } from '../ui/Medalhao';
import { DecimalInput } from '../DecimalInput';
import { falasDaResposta, possoComprar } from './possoComprar';
import { brlCentavos } from './mes';

/* ---------- "Posso comprar isso?" como conversa curta com o Nomasir (spec v2, 7.2; Ouro Antigo 6.5) ---------- */
// O preço → à vista ou parcelado (e em quantas vezes) → a resposta, com o mesmo número do card da Início.

type Etapa = 'preco' | 'forma' | 'parcelas' | 'fim';
const VEZES = [2, 3, 4, 6, 10, 12];

interface Balao {
  id: string;
  de: 'nomasir' | 'eu';
  texto: string;
  voo?: string; // layoutId do chip que virou este balão
}

export function PossoComprarChat({
  conta,
  hoje,
  gastosDoMes,
  semDados,
  onFechar,
  onVerDetalhes,
}: {
  conta: Hoje;
  hoje: string;
  gastosDoMes: number;
  semDados: boolean;
  onFechar: () => void;
  onVerDetalhes: () => void;
}) {
  const reduzir = useReducedMotion() || poucoMovimento();
  const [etapa, setEtapa] = useState<Etapa>('preco');
  const [preco, setPreco] = useState(0);
  const [digitado, setDigitado] = useState(0);
  const [parcelas, setParcelas] = useState(1);
  const [escolhas, setEscolhas] = useState<{ forma?: 'vista' | 'parcelado'; vezes?: number }>({});
  const [digitando, setDigitando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLDivElement>(null);

  // cada resposta: o Nomasir "digita" um instante antes de falar (sem espera pra quem pediu menos movimento)
  const avancar = (proxima: Etapa) => {
    setEtapa(proxima);
    if (reduzir) return;
    setDigitando(true);
    window.setTimeout(() => setDigitando(false), 650);
  };

  const resposta = useMemo(() => (etapa === 'fim' ? falasDaResposta(possoComprar(conta, { preco, parcelas }, { hoje, gastosDoMes, semDados }), hoje) : []), [etapa, conta, preco, parcelas, hoje, gastosDoMes, semDados]);

  const baloes: Balao[] = [{ id: 'oi', de: 'nomasir', texto: 'Me diz o preço. Eu olho o seu mês e digo se cabe.' }];
  if (etapa !== 'preco') {
    baloes.push({ id: 'preco', de: 'eu', texto: preco % 1 ? brlCentavos(preco) : formatBRL(preco) });
    baloes.push({ id: 'forma?', de: 'nomasir', texto: 'À vista ou parcelado?' });
  }
  if (escolhas.forma) baloes.push({ id: 'forma', de: 'eu', texto: escolhas.forma === 'vista' ? 'À vista' : 'Parcelado', voo: `pc-${escolhas.forma}` });
  if (escolhas.forma === 'parcelado') baloes.push({ id: 'vezes?', de: 'nomasir', texto: 'Em quantas vezes?' });
  if (escolhas.vezes) baloes.push({ id: 'vezes', de: 'eu', texto: `${escolhas.vezes}x`, voo: `pc-${escolhas.vezes}x` });
  resposta.forEach((t, i) => baloes.push({ id: `r${i}`, de: 'nomasir', texto: t }));

  // o último balão do Nomasir espera o "digitando"
  const visiveis = digitando ? baloes.slice(0, baloes.map((b) => b.de).lastIndexOf('eu') + 1) : baloes;

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
    if (etapa === 'preco') campo.current?.querySelector('input')?.focus();
  }, [etapa, digitando, reduzir]);

  const enviarPreco = () => {
    if (!(digitado > 0)) return;
    setPreco(digitado);
    avancar('forma');
  };
  const escolherForma = (f: 'vista' | 'parcelado') => {
    setEscolhas({ forma: f });
    if (f === 'vista') {
      setParcelas(1);
      avancar('fim');
    } else avancar('parcelas');
  };
  const escolherVezes = (n: number) => {
    setEscolhas((e) => ({ ...e, vezes: n }));
    setParcelas(n);
    avancar('fim');
  };
  const recomecar = () => {
    setEscolhas({});
    setPreco(0);
    setDigitado(0);
    setParcelas(1);
    setEtapa('preco');
    setDigitando(false);
  };

  const entrada = reduzir ? false : { opacity: 0, y: 8 };
  const mola = { type: 'spring' as const, stiffness: 420, damping: 32 };

  return (
    <section
      className="mes-compra"
      aria-label="Posso comprar isso? Conversa com o Nomasir"
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') onFechar();
      }}
    >
      <header className="mes-compra-topo">
        <Medalhao id="nomasir" nome="Nomasir" tamanho={40} />
        <span>
          <b>Nomasir</b>
          <small><i aria-hidden="true" /> online · Posso comprar isso?</small>
        </span>
        <button type="button" className="mes-compra-fechar" aria-label="Fechar a conversa" onClick={onFechar}>
          <X size={18} />
        </button>
      </header>

      <LayoutGroup id="posso-comprar">
        <div className="mes-compra-msgs" aria-live="polite" aria-relevant="additions">
          <AnimatePresence initial={false}>
            {visiveis.map((b) => (
              <motion.p
                key={b.id}
                layoutId={!reduzir && b.voo ? b.voo : undefined}
                className={`mes-bolha ${b.de === 'eu' ? 'eu' : 'nomasir'}`}
                initial={b.voo ? false : entrada}
                animate={{ opacity: 1, y: 0 }}
                transition={mola}
              >
                {b.texto}
              </motion.p>
            ))}
          </AnimatePresence>
          {digitando && (
            <p className="mes-bolha nomasir digitando" aria-label="Nomasir está digitando">
              <i />
              <i />
              <i />
            </p>
          )}
          <div ref={fim} />
        </div>

        {!digitando && (
          <div className="mes-compra-resp">
            {etapa === 'preco' && (
              <form
                className="mes-compra-preco"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarPreco();
                }}
              >
                <div ref={campo} className="mes-compra-campo">
                  <label htmlFor="pc-preco">Preço</label>
                  <span aria-hidden="true">R$</span>
                  <DecimalInput id="pc-preco" inputMode="decimal" placeholder="0" value={digitado} onChange={setDigitado} />
                </div>
                <button type="submit" className="btn-primary" disabled={!(digitado > 0)}>
                  Perguntar <ArrowRight size={16} />
                </button>
              </form>
            )}
            {etapa === 'forma' && (
              <div className="mes-chips" role="group" aria-label="Como vai pagar">
                {(['vista', 'parcelado'] as const).map((f) => (
                  <motion.button key={f} type="button" layoutId={reduzir ? undefined : `pc-${f}`} className="mes-chip" onClick={() => escolherForma(f)}>
                    {f === 'vista' ? 'À vista' : 'Parcelado'}
                  </motion.button>
                ))}
              </div>
            )}
            {etapa === 'parcelas' && (
              <div className="mes-chips" role="group" aria-label="Em quantas vezes">
                {VEZES.map((n) => (
                  <motion.button key={n} type="button" layoutId={reduzir ? undefined : `pc-${n}x`} className="mes-chip" onClick={() => escolherVezes(n)}>
                    {n}x
                  </motion.button>
                ))}
              </div>
            )}
            {etapa === 'fim' && (
              <div className="mes-compra-fim">
                {semDados ? (
                  <button type="button" className="btn-primary" onClick={() => abrirAnotar({ tipo: 'in', origem: 'posso-comprar' })}>
                    Anotar o que entrou
                  </button>
                ) : (
                  <button type="button" className="btn-outline" onClick={recomecar}>
                    <RotateCcw size={15} /> Perguntar de outra coisa
                  </button>
                )}
                <button type="button" className="link-btn" onClick={onVerDetalhes}>
                  Ver em dias de trabalho
                </button>
              </div>
            )}
          </div>
        )}
      </LayoutGroup>
      <p className="mes-compra-rodape">Conta feita com o que você anotou e com o seu plano. Não é recomendação de investimento.</p>
    </section>
  );
}
