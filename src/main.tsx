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
import './gs/vidroGlobal.css';
import './gs/tema';
import { initAnalytics } from './analytics';

initAnalytics();

// PWA: guarda só o casco do app; nunca mexe em /api (public/sw.js)
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
