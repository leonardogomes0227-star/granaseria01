/** Depois de uma publicação, um navegador com a versão antiga pode pedir um arquivo que não existe mais: recarrega uma vez. */
export function importarComRetry<T>(f: () => Promise<T>): Promise<T> {
  return f().catch((err) => {
    try {
      if (!sessionStorage.getItem('gs-recarregou')) {
        sessionStorage.setItem('gs-recarregou', '1');
        window.location.reload();
        return new Promise<T>(() => undefined);
      }
    } catch {
      /* sem storage */
    }
    throw err;
  });
}
