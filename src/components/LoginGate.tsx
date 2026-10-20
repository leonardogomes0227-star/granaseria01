import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Lock, ArrowRight } from 'lucide-react';
import { useSession } from '../account';
import { accountsEnabled } from '../supabase';
import { fetchPainel, getName, painelToken, rememberAfterLogin, setName } from '../painel';
import { waLink } from '../whatsapp';
import { track } from '../analytics';

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
  return (
    <div className="page-wrap anim-in login-wall">
      <div className="kicker"><span className="wedge" />Entrar</div>
      <h1>Entre pra usar {what}</h1>
      <p className="wizard-sub">
        Seu login é o seu WhatsApp: <b>sem senha e sem e-mail</b>. Assim seu plano, seus gastos e suas ferramentas ficam salvos e você continua de onde
        parou, aqui e no WhatsApp.
      </p>
      <ol className="login-steps">
        <li><b>Toque em Entrar com WhatsApp.</b> A conversa com a Grana Séria abre com a mensagem pronta.</li>
        <li><b>Envie a mensagem.</b> O assistente responde na hora com o seu link de acesso.</li>
        <li><b>Toque no link.</b> Você volta pra cá já logado, direto em {what}.</li>
      </ol>
      <a
        className="btn-primary btn-shine login-cta"
        href={waLink('Quero entrar no site')}
        onClick={() => {
          onGo();
          track('login_whatsapp_clique');
        }}
      >
        <MessageCircle size={17} /> Entrar com WhatsApp
      </a>
      {accountsEnabled && (
        <p className="field-hint" style={{ marginTop: 12 }}>
          Prefere e-mail? <Link to="/conta" onClick={onGo}>Entrar com e-mail</Link>
        </p>
      )}
      <p className="field-hint login-safe"><Lock size={13} /> O link é só seu. Pra desconectar, mande <b>sair do painel</b> no WhatsApp.</p>
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
