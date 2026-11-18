import type { HumorMidas } from './midasDicas';

/** O corpo do Midas: só SVG e CSS. A bolinha simples (Orbe) continua no chat e na busca. */
export function MidasFigura({ humor = 'feliz', andando = false, falando = false, apontando = false, toque = false }: {
  humor?: HumorMidas;
  andando?: boolean;
  falando?: boolean;
  apontando?: boolean;
  toque?: boolean;
}) {
  const cls = `midas-svg ${humor}${andando ? ' andando' : ''}${falando ? ' falando' : ''}${apontando ? ' apontando' : ''}${toque ? ' toque' : ''}`;
  return (
    <svg className={cls} viewBox="0 0 88 104" aria-hidden="true">
      <ellipse className="sombra" cx="44" cy="100" rx="16" ry="3.2" />
      <g className="braco braco-e">
        <path d="M22 50 C10 52 4 62 6 70" />
        <circle className="mao" cx="6" cy="74" r="5.2" />
      </g>
      <g className="braco braco-d">
        <path d="M66 48 C80 46 86 56 84 66" />
        <circle className="mao" cx="84" cy="70" r="5.2" />
      </g>
      <g className="corpo">
        <ellipse className="perna perna-e" cx="34" cy="88" rx="7" ry="9" />
        <ellipse className="perna perna-d" cx="54" cy="88" rx="7" ry="9" />
        <circle className="bola" cx="44" cy="46" r="28" />
        <ellipse className="luz" cx="33" cy="34" rx="9" ry="5" />
        <g className="rosto">
          <path className="sobra sobra-e" d="M28 36 q6 -6 12 0" />
          <path className="sobra sobra-d" d="M48 36 q6 -6 12 0" />
          <ellipse className="olho olho-e" cx="34" cy="46" rx="4.2" ry="5" />
          <ellipse className="olho olho-d" cx="54" cy="46" rx="4.2" ry="5" />
          <circle className="pupila" cx="35.2" cy="47" r="1.7" />
          <circle className="pupila" cx="55.2" cy="47" r="1.7" />
          <path className="boca boca-feliz" d="M32 58 Q44 70 56 58" />
          <path className="boca boca-preocupado" d="M33 62 Q44 54 55 62" />
          <ellipse className="boca boca-fala" cx="44" cy="60" rx="5" ry="3.2" />
          <circle className="boca boca-o" cx="44" cy="60" r="3.6" />
          <path className="boca boca-pensa" d="M36 60 h10" />
        </g>
      </g>
      <g className="faiscas">
        <circle cx="14" cy="22" r="2.1" />
        <circle cx="74" cy="16" r="2.6" />
        <circle cx="78" cy="32" r="1.5" />
      </g>
    </svg>
  );
}

/** Destaca o número da frase (R$ e porcentagem) sem mudar o texto. */
export function FraseDica({ texto }: { texto: string }) {
  const pedacos = texto.split(/(R\$\s?[\d.]+|\d+%)/g);
  return (
    <>
      {pedacos.map((p, i) => (/^(R\$|\d+%)/.test(p) ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}
