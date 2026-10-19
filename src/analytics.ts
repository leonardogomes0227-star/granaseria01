// Métricas do funil: quem começa o diagnóstico, onde desiste, quem segue o plano.
// Liga sozinho quando as variáveis existem na Vercel:
//   VITE_PLAUSIBLE_DOMAIN  → Plausible (sem cookies, não precisa de banner)
//   VITE_META_PIXEL_ID     → Pixel da Meta (pra anúncios no Instagram/Facebook)
// Regra: nunca mandar valores em reais nem nada que identifique a pessoa — só o evento e rótulos.

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: ((event: string, opts?: { props?: Props; u?: string }) => void) & { q?: unknown[] };
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; callMethod?: (...a: unknown[]) => void };
    _fbq?: unknown;
  }
}

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

let started = false;

function loadScript(src: string, attrs: Record<string, string> = {}) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
}

export function initAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  if (PLAUSIBLE_DOMAIN) {
    // fila: eventos disparados antes do script carregar não se perdem
    window.plausible =
      window.plausible ||
      Object.assign((...args: unknown[]) => {
        (window.plausible!.q = window.plausible!.q || []).push(args);
      }, {});
    loadScript('https://plausible.io/js/script.manual.js', { 'data-domain': PLAUSIBLE_DOMAIN });
  }

  if (PIXEL_ID) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as NonNullable<Window['fbq']>;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = window.fbq || fbq;
    window._fbq = window._fbq || window.fbq;
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
  }
}

export function trackPageview(): void {
  try {
    window.plausible?.('pageview', { u: window.location.origin + window.location.pathname });
    window.fbq?.('track', 'PageView');
  } catch {
    // métrica nunca pode quebrar o site
  }
}

export function track(event: AnalyticsEvent, props?: Props): void {
  try {
    window.plausible?.(event, props ? { props } : undefined);
    window.fbq?.('trackCustom', event, props);
  } catch {
    // métrica nunca pode quebrar o site
  }
}

// Lista fechada de eventos: os nomes viram metas/funis no Plausible
export type AnalyticsEvent =
  | 'diagnostico_iniciado'
  | 'diagnostico_etapa'
  | 'diagnostico_concluido'
  | 'ferramenta_aberta'
  | 'plano_seguido'
  | 'mes_fechado'
  | 'vazamento_marcado'
  | 'mensagem_copiada'
  | 'extra_simulado'
  | 'fatura_lida'
  | 'login_link_enviado'
  | 'login_feito'
  | 'whatsapp_vinculado'
  | 'whatsapp_continuar'
  | 'checkout_clique'
  | 'guia_lido';
