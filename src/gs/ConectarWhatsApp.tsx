import { useEffect, useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { useSession } from '../account';
import { supabase, WHATSAPP_NUMBER } from '../supabase';
import { painelToken } from '../painel';
import { track } from '../analytics';

/* ---------- Conectar o WhatsApp de dentro do painel ----------
   Quem entrou pelo WhatsApp já está conectado. Quem entrou por e-mail (ou pagou e criou conta)
   gera um código aqui e manda "VINCULAR código" para o WhatsApp da Grana Séria. Usa a mesma API da página Minha conta. */

interface Linha { phone: string | null; link_code: string | null; link_code_expires: string | null }

const mascarar = (p: string) => {
  const d = p.replace(/\D/g, '');
  return d.length >= 12 ? `(${d.slice(2, 4)}) •••••-${d.slice(-4)}` : p;
};

export function ConectarWhatsApp() {
  const session = useSession();
  const [linha, setLinha] = useState<Linha | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const conectadoPorZap = Boolean(painelToken());

  const carregar = async () => {
    if (!supabase || !session) return;
    const { data } = await supabase.from('user_state').select('phone, link_code, link_code_expires').eq('user_id', session.user.id).maybeSingle();
    setLinha((data as Linha | null) ?? { phone: null, link_code: null, link_code_expires: null });
  };

  useEffect(() => {
    if (conectadoPorZap || !session) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por conta
  }, [session?.user.id, conectadoPorZap]);

  const codigoValido = Boolean(linha?.link_code && linha.link_code_expires && new Date(linha.link_code_expires) > new Date());

  // com o código na tela, confere de tempos em tempos se o vínculo já foi feito
  useEffect(() => {
    if (!codigoValido || linha?.phone) return;
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void carregar(); }, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoValido, linha?.phone]);

  useEffect(() => { if (linha?.phone) track('whatsapp_vinculado'); }, [linha?.phone]);

  const gerarCodigo = async () => {
    if (!supabase) return;
    setOcupado(true); setErro('');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = token ? await fetch('/api/painel?acao=vincular', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => null) : null;
    if (!res?.ok) setErro(res?.status === 429 ? 'Você gerou vários códigos. Espere um pouco e tente de novo.' : 'Não consegui gerar o código agora. Tente de novo em instantes.');
    await carregar();
    setOcupado(false);
  };

  if (conectadoPorZap) {
    return <p className="cm-mudo" style={{ margin: '0 0 14px' }}><Check size={15} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> <b>WhatsApp conectado</b> a este painel. O que você anotar lá aparece aqui.</p>;
  }
  if (!session || !supabase) return null;
  if (linha === null) return <p className="cm-mudo" style={{ margin: '0 0 14px' }}>Carregando…</p>;
  if (linha.phone) {
    return <p className="cm-mudo" style={{ margin: '0 0 14px' }}><Check size={15} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> <b>WhatsApp conectado:</b> {mascarar(linha.phone)}</p>;
  }
  const link = codigoValido && linha.link_code && WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`VINCULAR ${linha.link_code}`)}` : null;
  return (
    <div style={{ margin: '0 0 16px' }}>
      <p className="cm-mudo" style={{ margin: '0 0 8px' }}><b>Conecte o seu WhatsApp</b> a este painel para anotar gastos por mensagem e receber os lembretes.</p>
      {codigoValido && linha.link_code ? (
        <>
          <p className="cm-mudo" style={{ margin: '0 0 8px' }}>Mande esta mensagem para o WhatsApp da Grana Séria: <b>VINCULAR {linha.link_code}</b></p>
          {link && <a className="gs-btn" href={link} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true" /> Abrir o WhatsApp com a mensagem pronta</a>}
          <p className="cm-mudo" style={{ margin: '8px 0 0' }}>O código vale por 30 minutos. Esta tela atualiza sozinha quando conectar.</p>
        </>
      ) : (
        <button type="button" className="gs-btn" onClick={() => void gerarCodigo()} disabled={ocupado}><MessageCircle size={16} aria-hidden="true" /> Conectar meu WhatsApp</button>
      )}
      {erro && <p className="field-error" role="alert">{erro}</p>}
    </div>
  );
}
