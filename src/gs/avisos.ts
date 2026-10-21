// Avisos: Notification API do navegador quando dá; senão, o banner dentro do app. Nada de WhatsApp automático.

export async function pedirPermissaoAvisos(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

const VISTOS = 'grana-seria:avisos-vistos';
/** Mostra uma notificação do navegador uma vez por aviso (id + dia). Devolve se mostrou. */
export function avisarUmaVez(id: string, titulo: string, corpo: string, hoje: string): boolean {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const vistos = new Set<string>(JSON.parse(localStorage.getItem(VISTOS) || '[]'));
    const k = `${id}:${hoje}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    localStorage.setItem(VISTOS, JSON.stringify([...vistos].slice(-200)));
    new Notification(titulo, { body: corpo, icon: '/moeda.svg' });
    return true;
  } catch {
    return false;
  }
}

/** Link pra se lembrar no WhatsApp (sem backend de envio). */
export const lembrarNoWhatsApp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
