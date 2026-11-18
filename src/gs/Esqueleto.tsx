/** Enquanto uma tela do app chega: o mesmo desenho dos cartões, com um brilho passando. */
export function EsqueletoTela() {
  return (
    <div className="gs-skel" role="status" aria-label="Carregando">
      <span className="sk sk-titulo" />
      <span className="sk sk-linha" />
      <span className="sk sk-card" />
      <span className="sk sk-card curto" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
