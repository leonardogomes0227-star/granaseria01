import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useEstado } from './store';
import { Onboarding } from './Onboarding';
import { useImportarServidor } from './servidor';
import { InstalarApp } from './InstalarApp';
import { NotificadorAvisos } from './BannerAvisos';

/* ---------- Porteiro: na primeira abertura, só pergunta a renda. Também traz o WhatsApp e mostra os avisos. ---------- */

export function Porteiro({ children }: { children: ReactNode }) {
  const e = useEstado();
  const { pathname } = useLocation();
  useImportarServidor();
  if (!e.config.onboardingFeito && pathname !== '/dados') return <Onboarding />;
  return (
    <>
      <NotificadorAvisos />
      <InstalarApp />
      {children}
    </>
  );
}
