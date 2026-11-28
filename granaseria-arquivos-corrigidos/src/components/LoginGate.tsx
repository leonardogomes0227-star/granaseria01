import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useSession } from '../account';
import { accountsEnabled, supabase } from '../supabase';
import { fetchPainel, getName, painelToken, rememberAfterLogin, setName } from '../painel';
import { track } from '../analytics';
import { CHECKOUT_ANUAL, CHECKOUT_MENSAL, PRECO_ANUAL, PRECO_MENSAL } from '../config';

/* ---------- Login obrigatório pra usar as ferramentas ---------- */
// O login é o WhatsApp (link pessoal, sem senha); quem tem conta por e-mail também passa. Depois do login, o nome
// é obrigatório. Assim tudo fica salvo e o dono sabe quem usa o quê.

export function LoginGate({ what, header, children }: { what: string; header?: ReactNode; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  const [name, setNameState] = useState(getName());
  const logged = Boolean(painelToken() || session);
  // navegador novo: o nome pode já estar guardado pelo WhatsApp. Confere lá antes de perguntar de novo.
  const [checking, setChecking] = useState(() => Boolean(painelToken()) && !getName());
  useEffect(() => {
    if (!checking) return;
    let alive = true;
    fetchPainel()
      .then((d) => {
        const saved = d?.state['gs-nome'];
        if (saved && alive) {
          setName(saved);
          setNameState(getName());
        }
      })
      .catch(() => undefined)
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [checking]);

  if (!logged) {
    return (
      <>
        {header}
        <LoginWall what={what} onGo={() => rememberAfterLogin(location.pathname + location.search)} />
      </>
    );
  }
  if (!name && checking) {
    return (
      <>
        {header}
        <div className="page-wrap skeleton-stack" aria-label="Carregando"><span className="skeleton skeleton-card" /><span className="skeleton skeleton-row" /></div>
      </>
    );
  }
  if (!name) {
    return (
      <>
        {header}
        <NameForm
          onDone={(n) => {
            setName(n);
            setNameState(n);
            track('nome_informado');
          }}
        />
      </>
    );
  }
  return <>{children}</>;
}

function LoginWall({ what, onGo }: { what: string; onGo: () => void }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado' | 'erro'>('parado');
  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!supabase || !/^\S+@\S+\.\S+$/.test(email.trim())) { setEstado('erro'); return; }
    onGo();
    setEstado('enviando');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/` } });
    setEstado(error ? 'erro' : 'enviado');
    if (!error) track('login_link_enviado');
  };
  return (
    <div className="page-wrap anim-in login-wall">
      <div className="kicker"><span className="wedge" />Área do assinante</div>
      <h1>Entre pra usar {what}</h1>
      <p className="wizard-sub">
        O acesso é só para assinantes. <b>Ainda não assinou?</b> Escolha o plano e pague. Use o <b>mesmo e-mail</b> no pagamento e depois aqui.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '4px 0 22px' }}>
        <a className="btn-primary btn-shine" href={CHECKOUT_MENSAL} target="_blank" rel="noopener noreferrer">Assinar mensal · R$ {PRECO_MENSAL}/mês</a>
        <a className="btn-primary btn-shine" href={CHECKOUT_ANUAL} target="_blank" rel="noopener noreferrer">Assinar anual · R$ {PRECO_ANUAL}/ano</a>
      </div>
      <p className="wizard-sub"><b>Já é assinante?</b> Digite o e-mail do pagamento. Mandamos um link, sem senha.</p>
      {!accountsEnabled ? (
        <p className="field-error">A entrada por e-mail está indisponível no momento. Tente de novo em alguns minutos.</p>
      ) : estado === 'enviado' ? (
        <div className="insight insight-good"><b>Link enviado!</b> Abra o e-mail ({email}) e toque no link para entrar. Pode fechar esta aba.</div>
      ) : (
        <form className="account-form" onSubmit={enviar} noValidate>
          <label className="field-label" htmlFor="login-email">Seu e-mail</label>
          <input id="login-email" className="field-input" type="email" inputMode="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {estado === 'erro' && <p className="field-error">Não consegui mandar o link. Confira o e-mail e tente de novo.</p>}
          <button className="btn-primary" type="submit" disabled={estado === 'enviando'}>
            <Mail size={16} /> {estado === 'enviando' ? 'Enviando…' : 'Mandar link de acesso'}
          </button>
        </form>
      )}
      <p className="field-hint login-safe"><Lock size={13} /> Depois de entrar, você conecta o seu WhatsApp dentro do painel.</p>
    </div>
  );
}

function NameForm({ onDone }: { onDone: (name: string) => void }) {
  const [value, setValue] = useState('');
  const ok = /^[\p{L}][\p{L} '.-]{1,39}$/u.test(value.trim());
  return (
    <div className="page-wrap anim-in login-wall">
      <div className="kicker"><span className="wedge" />Quase lá</div>
      <h1>Como você quer ser chamado?</h1>
      <p className="wizard-sub">É assim que o seu painel e o assistente vão falar com você.</p>
      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onDone(value.trim());
        }}
      >
        <label className="field-label" htmlFor="login-name">Seu nome</label>
        <input id="login-name" className="field-input" autoComplete="given-name" placeholder="Ex.: Ana" value={value} onChange={(e) => setValue(e.target.value)} autoFocus required />
        {value.trim().length > 0 && !ok && <p className="field-error">Escreva só o nome, com letras (ex.: Ana, João).</p>}
        <button type="submit" className="btn-primary" disabled={!ok}>
          Continuar <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
