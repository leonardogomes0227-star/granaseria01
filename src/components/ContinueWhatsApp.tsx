import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../supabase';
import { snapshot } from '../sync';
import { track } from '../analytics';

/* ---------- Leva o diagnóstico pro WhatsApp, sem cadastro ---------- */
// O site guarda o que está no navegador por 24h com um código curto (api/continuar.ts) e abre o WhatsApp com a
// mensagem pronta. O bot lê o código, importa o diagnóstico e já responde com o próximo passo.

export function ContinueOnWhatsApp({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  if (!WHATSAPP_NUMBER) return null;

  const go = async () => {
    setState('sending');
    track('whatsapp_continuar');
    try {
      const res = await fetch('/api/continuar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: snapshot() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { code } = (await res.json()) as { code: string };
      const text = `Oi! Fiz meu diagnóstico no site e quero continuar por aqui. Código: GS-${code}`;
      window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    } catch {
      setState('error');
    }
  };

  const button = (
    <button type="button" className="btn-primary btn-shine" onClick={go} disabled={state === 'sending'} style={{ width: '100%' }}>
      <MessageCircle size={16} /> {state === 'sending' ? 'Abrindo o WhatsApp…' : 'Continuar no WhatsApp'}
    </button>
  );

  if (compact) return button;
  return (
    <div className="stat-card" style={{ marginTop: 18 }}>
      <p className="diag-label" style={{ marginBottom: 6 }}>
        <MessageCircle size={14} style={{ verticalAlign: '-2px' }} /> Seu plano no WhatsApp
      </p>
      <p className="account-line" style={{ marginBottom: 12 }}>
        Leve este diagnóstico pro WhatsApp: lá eu te digo o próximo passo, você anota gastos só mandando mensagem e vê quanto ainda pode gastar no mês. <b>Sem cadastro.</b>
      </p>
      {button}
      {state === 'error' && <p className="field-error">Não consegui abrir agora. Tenta de novo em um minuto.</p>}
    </div>
  );
}
