import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './tokens.css';
import './index.css';
import './site.css';
import './theme.css';
import './app.css';
import './gs/gs.css';
import './gs/gs2.css';
import './gs/caminho.css';
import './gs/painelVisual.css';
import './gs/sistema.css';
import './gs/movimento.css';
import './gs/visual.css';
import './gs/video.css';
import './gs/noite.css';
import './gs/painelVideo.css';
import './gs/painelRv.css';
import './gs/planosCartoes.css';
import './gs/fluidez.css';
import './gs/tema';
import { initAnalytics } from './analytics';

initAnalytics();

// PWA: guarda só o casco do app; nunca mexe em /api (public/sw.js)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // se já havia uma versão guardada no aparelho, assim que a nova assume a página recarrega uma vez para mostrar a nova
  const havia = Boolean(navigator.serviceWorker.controller);
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (havia && !recarregou) { recarregou = true; window.location.reload(); } });
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').then((r) => r.update()).catch(() => undefined));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
