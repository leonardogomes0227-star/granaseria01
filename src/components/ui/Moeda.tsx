/* ---------- A marca do Grana Séria: o "G" dourado com as barras e a seta, em quadrado arredondado preto. ----------
   Mantém o nome e as propriedades antigas (tamanho, className, girar) para as telas não mudarem. */

export function Moeda({ tamanho = 28, className = '' }: { tamanho?: number; className?: string; girar?: boolean }) {
  return (
    <img
      src={tamanho > 80 ? '/logo-icone.png' : '/logo-icone-160.png'}
      width={tamanho}
      height={tamanho}
      alt="Grana Séria"
      className={`cm-logo ${className}`}
      style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.22), display: 'inline-block', flex: 'none', objectFit: 'contain' }}
      draggable={false}
    />
  );
}
