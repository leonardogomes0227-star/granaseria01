/* ---------- Valor em estilo cédula (Ouro Antigo, seção 3): "R$" pequeno no topo, centavos menores ---------- */

export function Valor({ valor, centavos = false, className = '' }: { valor: number; centavos?: boolean; className?: string }) {
  const negativo = valor < 0;
  const abs = Math.abs(valor);
  const inteiro = Math.floor(abs + (centavos ? 0 : 0.5));
  const cent = Math.round((abs - Math.floor(abs)) * 100);
  return (
    <span className={`valor ${className}`} aria-label={`${negativo ? 'menos ' : ''}${abs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}>
      <span className="moeda" aria-hidden="true">
        {negativo ? '−' : ''}R$
      </span>
      <span aria-hidden="true">{(centavos ? Math.floor(abs) : inteiro).toLocaleString('pt-BR')}</span>
      {centavos && (
        <span className="centavos" aria-hidden="true">
          ,{String(cent).padStart(2, '0')}
        </span>
      )}
    </span>
  );
}
