import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useEstado } from './store';
import { Onboarding } from './Onboarding';
import { useImportarServidor } from './servidor';
import { InstalarApp } from './InstalarApp';
import { NotificadorAvisos } from './BannerAvisos';
import { AvisoFundador, TelaAcesso, useAcesso } from './acesso';

/* ---------- Porteiro: na primeira abertura, só pergunta a renda. Também traz o WhatsApp e mostra os avisos. ---------- */

export function Porteiro({ children }: { children: ReactNode }) {
  const e = useEstado();
  const { pathname } = useLocation();
  useImportarServidor();
  const acesso = useAcesso();
  if (!e.config.onboardingFeito && pathname !== '/dados') return <Onboarding />;
  // sem acesso (só quando o servidor tem certeza): o app não abre, mas "Meus dados" e "Perfil" ficam abertos para levar os dados
  if (acesso?.estado === 'bloqueado' && !['/dados', '/perfil', '/entrar'].includes(pathname)) return <TelaAcesso novo={acesso.novo} />;
  return (
    <>
      <NotificadorAvisos />
      <InstalarApp />
      {acesso?.estado === 'carencia' && <AvisoFundador ate={acesso.ate} dias={acesso.dias} />}
      {children}
    </>
  );
}
