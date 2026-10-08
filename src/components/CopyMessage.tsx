import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { track } from '../analytics';

// Texto pronto (renegociação, cancelamento, pedido de direito) com botão de copiar.
export function CopyMessage({ text, label = 'Copiar mensagem' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      track('mensagem_copiada');
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // clipboard bloqueado: deixa o texto selecionável pra copiar na mão
      setManual(true);
    }
  };

  return (
    <>
      <pre className={`plan-nego-text ${manual ? 'manual' : ''}`}>{text}</pre>
      <button type="button" className="btn-outline copy-btn" onClick={copy}>
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado!' : label}
      </button>
    </>
  );
}
