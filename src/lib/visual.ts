// O visual "Ouro Antigo" vale só dentro do app (decisão do dono): Início logado, Missões, Meu mês, Agentes, chat,
// selos, perfil e ferramentas. A landing (quem não entrou), os guias, os termos e a privacidade ficam como estavam.
// A marca fica na tag <html> (classe 'ouro'), pra valer também no que abre fora da página (diálogos, toasts).

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { painelToken } from '../painel';

const PUBLICAS = ['/guias', '/termos-de-uso', '/politica-de-privacidade', '/diagnostico', '/admin'];

export function rotaDoApp(pathname: string, logado: boolean): boolean {
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  // a landing é a página inicial de quem ainda não entrou
  if ((pathname === '/' || pathname === '/inicio') && !logado) return false;
  return true;
}

/** Liga o visual do app enquanto a tela estiver aberta. */
export function useVisualDoApp(forcar?: boolean) {
  const { pathname } = useLocation();
  const on = forcar ?? rotaDoApp(pathname, Boolean(painelToken()));
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('ouro', on);
    return () => {
      el.classList.remove('ouro');
    };
  }, [on]);
  return on;
}
