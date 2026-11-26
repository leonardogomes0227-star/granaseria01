// Acesso ao app: o servidor diz se a pessoa está liberada, assinando, no prazo de fundador ou sem acesso.
// Regra de ouro: na dúvida, libera. Só mostra a tela de "acesso encerrado" quando o servidor responde isso com certeza.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, MessageCircle, X } from 'lucide-react';
import { painelToken } from '../painel';
import { supabase } from '../supabase';
import { CHECKOUT_ANUAL, CHECKOUT_FUNDADOR_ANUAL, CHECKOUT_FUNDADOR_MENSAL, CHECKOUT_MENSAL, PRECO_ANUAL, PRECO_FUNDADOR_ANUAL, PRECO_FUNDADOR_MENSAL, PRECO_MENSAL } from '../config';
import { useConvite } from './convite';
import { Moeda } from '../components/ui/Moeda';
import { waLink } from '../whatsapp';
import { brl0 } from './datas';

export interface EstadoAcesso { estado: 'liberado' | 'ativo' | 'carencia' | 'bloqueado'; ate?: string; dias?: number; novo?: boolean }
const LIBERADO: EstadoAcesso = { estado: 'liberado' };
const CHAVE = 'gs-acesso';

async function token(): Promise<string | null> {
  const link = painelToken();
  if (link) return link;
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}

function lerCache(): EstadoAcesso | null {
  try {
    const c = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null') as { t: number; v: EstadoAcesso } | null;
    return c && Date.now() - c.t < 10 * 60_000 ? c.v : null;
  } catch { return null; }
}

/** null enquanto pergunta; depois sempre uma resposta (erro ou demora viram "liberado"). */
export function useAcesso(): EstadoAcesso | null {
  const [a, setA] = useState<EstadoAcesso | null>(() => lerCache());
  useEffect(() => {
    if (a) return;
    let vivo = true;
    const ctl = new AbortController();
    const limite = setTimeout(() => ctl.abort(), 6000);
    (async () => {
      try {
        const t = await token();
        if (!t) throw new Error('sem login');
        const res = await fetch('/api/acesso', { headers: { Authorization: `Bearer ${t}` }, signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const v = (await res.json()) as EstadoAcesso;
        try { sessionStorage.setItem(CHAVE, JSON.stringify({ t: Date.now(), v })); } catch { /* sem storage */ }
        if (vivo) setA(v);
      } catch {
        if (vivo) setA(LIBERADO);
      } finally { clearTimeout(limite); }
    })();
    return () => { vivo = false; clearTimeout(limite); ctl.abort(); };
  }, [a]);
  return a;
}

const dataBR = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) : '');

function Ofertas() {
  return (
    <div className="ac-ofertas">
      <a className="gs-btn" href={CHECKOUT_FUNDADOR_MENSAL} target="_blank" rel="noopener noreferrer">Fundador mensal · {brl0(PRECO_FUNDADOR_MENSAL)}/mês <ArrowRight size={16} aria-hidden="true" /></a>
      <a className="gs-btn sec" href={CHECKOUT_FUNDADOR_ANUAL} target="_blank" rel="noopener noreferrer">Fundador anual · {brl0(PRECO_FUNDADOR_ANUAL)}/ano</a>
    </div>
  );
}

/** Quem já usava antes: agradece, mostra o prazo de verdade e o preço de fundador. */
export function AvisoFundador({ ate, dias }: { ate?: string; dias?: number }) {
  const [fechado, setFechado] = useState(() => { try { return sessionStorage.getItem('gs-aviso-fundador') === '1'; } catch { return false; } });
  if (fechado) return null;
  return (
    <aside className="ac-aviso" aria-label="Preço de fundador">
      <button type="button" className="ac-x" aria-label="Fechar aviso por agora" onClick={() => { setFechado(true); try { sessionStorage.setItem('gs-aviso-fundador', '1'); } catch { /* ok */ } }}><X size={16} aria-hidden="true" /></button>
      <span className="cm-eyebrow">Você é um dos primeiros</span>
      <h2>Obrigado por usar o Grana Séria desde o começo.</h2>
      <p>Seu acesso segue liberado até <b>{dataBR(ate)}</b>{dias !== undefined ? ` (${dias} ${dias === 1 ? 'dia' : 'dias'})` : ''}. Para continuar, garanta o <b>preço de fundador</b>, menor que o preço de lançamento e fixo enquanto a sua assinatura estiver ativa.</p>
      <Ofertas />
      <small>Se preferir não continuar, tudo bem: você pode baixar os seus dados em <Link to="/dados">Meus dados</Link> antes da data.</small>
    </aside>
  );
}

function OfertasNormais() {
  return (
    <div className="ac-ofertas">
      <a className="gs-btn" href={CHECKOUT_MENSAL} target="_blank" rel="noopener noreferrer">Mensal · {brl0(PRECO_MENSAL)}/mês <ArrowRight size={16} aria-hidden="true" /></a>
      <a className="gs-btn sec" href={CHECKOUT_ANUAL} target="_blank" rel="noopener noreferrer">Anual · {brl0(PRECO_ANUAL)}/ano</a>
    </div>
  );
}

/** Sem assinatura e fora do prazo: o app não abre, mas a pessoa leva os dados. Quem já usava vê o preço de fundador; quem chegou agora precisa do convite. */
export function TelaAcesso({ novo = false }: { novo?: boolean }) {
  const convite = useConvite();
  return (
    <section className="ac-tela" aria-label={novo ? 'Acesso por convite' : 'Acesso encerrado'}>
      <Moeda tamanho={64} />
      {novo ? (
        <>
          <h1>{convite.valido ? 'Seu convite está liberado' : 'O Grana Séria é por convite'}</h1>
          <p>{convite.valido ? 'Escolha o seu plano para começar.' : 'Entre na fila de espera. Quando chegar a sua vez, o convite vai para o seu WhatsApp, com prazo para aceitar.'}</p>
          {convite.valido ? <OfertasNormais /> : <div className="ac-ofertas"><a className="gs-btn" href="/#fila">Entrar na fila de espera <ArrowRight size={16} aria-hidden="true" /></a></div>}
        </>
      ) : (
        <>
          <h1>Seu acesso ao Grana Séria terminou</h1>
          <p>O período de uso liberado acabou. Os seus dados continuam guardados por um tempo, e é só assinar para voltar de onde parou.</p>
          <Ofertas />
        </>
      )}
      <div className="ac-links">
        <Link to="/dados"><Download size={15} aria-hidden="true" /> Baixar os meus dados</Link>
        <a href={waLink('Oi! Meu acesso ao Grana Séria terminou e quero ajuda.')} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} aria-hidden="true" /> Falar com a gente</a>
      </div>
    </section>
  );
}
