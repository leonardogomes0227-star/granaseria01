// Comemorações em tela cheia (spec v2, seção 9): quem conclui algo chama daqui, e o <CelebracaoHost />
// (montado uma vez no App) mostra o momento. Separado do componente pra qualquer tela poder chamar sem importar React.

export const EVENTO_CELEBRAR = 'gs-celebrar';

export type PedidoCelebracao =
  | { tipo: 'missao'; missaoId: string } // missão cumprida: tela cheia com confete, agente, frase, selo ganho
  | { tipo: 'selo'; seloId: string }; // selo novo: modal com a moeda girando

let temHost = false;
export const registrarHostCelebracao = (on: boolean) => {
  temHost = on;
};
export const haHostCelebracao = () => temHost;

export function celebrar(p: PedidoCelebracao) {
  try {
    window.dispatchEvent(new CustomEvent<PedidoCelebracao>(EVENTO_CELEBRAR, { detail: p }));
  } catch {
    // sem window (testes): nada a mostrar
  }
}

export const celebrarMissao = (missaoId: string) => celebrar({ tipo: 'missao', missaoId });
export const celebrarSelo = (seloId: string) => celebrar({ tipo: 'selo', seloId });
