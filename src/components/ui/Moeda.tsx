import type { CSSProperties } from 'react';

/* ---------- A moeda da marca, em 3D de CSS: 9 discos empilhados, "G" na frente e "S" no verso. ----------
   Gira devagar (8s) e para sozinha para quem pediu menos movimento (src/gs/caminho.css). */

const DISCOS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

export function Moeda({ tamanho = 28, className = '', girar = true }: { tamanho?: number; className?: string; girar?: boolean }) {
  return (
    <span className={`cm-moeda${girar ? ' gira' : ''} ${className}`} style={{ '--t': `${tamanho}px` } as CSSProperties} role="img" aria-label="Grana Séria">
      <span className="cm-moeda-giro" aria-hidden="true">
        {DISCOS.map((z) => (
          <i key={z} style={{ '--z': z } as CSSProperties} />
        ))}
        <b className="frente">G</b>
        <b className="verso">S</b>
      </span>
    </span>
  );
}
