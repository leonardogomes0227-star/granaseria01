import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './tokens.css';
import './index.css';
import './site.css';
import './theme.css';
import './app.css';
import './ouro.css';
import './styles/ouro-chat.css';
import './styles/ouro-mes.css';
import './styles/ouro-missoes.css';
import './styles/ouro-agentes.css';
import './styles/ouro-selos.css';
import './styles/ouro-perfil.css';
import './styles/ouro-detalhes.css';
import { initAnalytics } from './analytics';

initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
