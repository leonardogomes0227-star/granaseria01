import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../supabase';
import { openWhatsApp } from '../whatsapp';

/* ---------- Ponte pro WhatsApp, sem cadastro ---------- */
// Com diagnóstico no navegador: o site guarda tudo por 24h com um código curto (api/continuar.ts) e abre o WhatsApp
// com a mensagem pronta; o bot importa e já usa os limites do diagnóstico. Sem diagnóstico: abre o WhatsApp com um "oi".

export function WhatsAppButton({ label = 'Continuar no WhatsApp', origin, className = 'btn-primary btn-shine' }: { label?: string; origin: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  if (!WHATSAPP_NUMBER) return null;
  const go = () => {
    setState('sending');
    openWhatsApp(origin).catch(() => setState('error'));
  };
  return (
    <>
      <button type="button" className={className} onClick={go} disabled={state === 'sending'}>
        <MessageCircle size={16} /> {state === 'sending' ? 'Abrindo o WhatsApp…' : label}
      </button>
      {state === 'error' && <p className="field-error">Não consegui abrir agora. Tenta de novo em um minuto.</p>}
    </>
  );
}

/** No resultado do diagnóstico: o card que leva o diagnóstico pro WhatsApp. */
export function ContinueOnWhatsApp({ compact = false }: { compact?: boolean }) {
  if (!WHATSAPP_NUMBER) return null;
  if (compact) return <div className="wa-block"><WhatsAppButton origin="diagnostico_fim" /></div>;
  return (
    <div className="stat-card" style={{ marginTop: 18 }}>
      <p className="diag-label" style={{ marginBottom: 6 }}>
        <MessageCircle size={14} style={{ verticalAlign: '-2px' }} /> Seu dia a dia no WhatsApp
      </p>
      <p className="account-line" style={{ marginBottom: 12 }}>
        Leve este diagnóstico pro WhatsApp: você anota gastos e entradas só mandando mensagem e eu mostro quanto ainda pode gastar em cada coisa, com os limites daqui. <b>Tudo fica salvo nos dois lugares.</b>
      </p>
      <div className="wa-block"><WhatsAppButton origin="diagnostico" /></div>
    </div>
  );
}

/** Faixa no fim de cada ferramenta: o dia a dia continua no WhatsApp. */
export function WhatsAppStrip() {
  if (!WHATSAPP_NUMBER) return null;
  return (
    <div className="wa-strip">
      <p>
        <b>O dia a dia fica no WhatsApp.</b> Mande <i>"mercado 80 no pix"</i> ou <i>"recebi 3000 salário"</i> e veja na hora quanto ainda pode gastar no mês.
      </p>
      <WhatsAppButton label="Anotar no WhatsApp" origin="ferramenta" className="btn-outline" />
    </div>
  );
}
