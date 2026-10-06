import { FormEvent, ReactNode, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isValidPhone, maskPhone, toE164Digits } from '../lib/phone';
import { authLink, safeNext } from '../lib/redirect';

export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="wizard-wrap">
      <div className="auth-loading anim-in" role="status">
        <span className="btn-spinner gold" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

/** Rotas que exigem login: sem sessão, manda pro login e volta pra cá depois. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={authLink('entrar', location.pathname + location.search)} replace />;
  return <>{children}</>;
}

function PasswordField({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-suffix">
      <input
        id="auth-senha"
        className="field-input"
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={6}
        required
      />
      <button
        type="button"
        className="pw-toggle"
        aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function AuthPage({ mode }: { mode: 'entrar' | 'cadastro' }) {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const isSignup = mode === 'cadastro';

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  if (loading) return <LoadingScreen />;
  // já logado (ou acabou de logar): segue pro destino
  if (user) return <Navigate to={next} replace />;

  const phoneError = touched && !isValidPhone(telefone) ? 'Informe um celular com DDD, ex.: (67) 99999-9999.' : undefined;
  const nameError = touched && nome.trim().length < 2 ? 'Informe seu nome.' : undefined;
  const passwordError = touched && senha.length < 6 ? 'A senha precisa ter pelo menos 6 caracteres.' : undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!email.trim()) return;
    if (isSignup) {
      if (nome.trim().length < 2 || senha.length < 6 || !isValidPhone(telefone)) return;
    } else if (!senha) {
      // no login não valida o tamanho da senha: o servidor responde se estiver errada
      return;
    }

    setSubmitting(true);
    const result = isSignup
      ? await signUp({ nome, email, senha, telefone: toE164Digits(telefone) })
      : await signIn(email, senha);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setConfirmEmail(email.trim());
      return;
    }
    navigate(next, { replace: true });
  };

  if (confirmEmail) {
    return (
      <div className="wizard-wrap">
        <div className="wizard-card anim-in auth-card" style={{ textAlign: 'center' }}>
          <span className="tool-icon tone-sage lg auth-icon"><MailCheck size={24} /></span>
          <h1 className="wizard-h2">Confirme seu e-mail</h1>
          <p className="wizard-sub">
            Enviamos um link de confirmação para <b>{confirmEmail}</b>. Abra o e-mail, clique no link e depois entre
            com sua senha.
          </p>
          <Link to={authLink('entrar', next)} className="btn-primary">
            Ir para o login <ArrowRight size={16} className="arrow" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-wrap">
      <form className="wizard-card anim-in auth-card" onSubmit={onSubmit} noValidate>
        <div className="wizard-kicker"><span className="wedge" />{isSignup ? 'Crie sua conta' : 'Bem-vindo de volta'}</div>
        <h1 className="wizard-h2">{isSignup ? 'Comece seu diagnóstico' : 'Entre na sua conta'}</h1>
        <p className="wizard-sub">
          {isSignup
            ? 'Leva 30 segundos. Sua conta guarda o diagnóstico, o plano de ação e os seus gastos.'
            : 'Veja seu último diagnóstico e acompanhe seus gastos.'}
        </p>

        {isSignup && (
          <div className="field-group">
            <label className="field-label" htmlFor="auth-nome">Nome</label>
            <input
              id="auth-nome"
              className="field-input"
              type="text"
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como quer ser chamado"
              autoFocus
              required
            />
            {nameError && <p className="field-error">{nameError}</p>}
          </div>
        )}

        <div className="field-group">
          <label className="field-label" htmlFor="auth-email">E-mail</label>
          <input
            id="auth-email"
            className="field-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoFocus={!isSignup}
            required
          />
          {touched && !email.trim() && <p className="field-error">Informe seu e-mail.</p>}
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="auth-senha">Senha</label>
          <PasswordField value={senha} onChange={setSenha} autoComplete={isSignup ? 'new-password' : 'current-password'} />
          {isSignup ? (
            passwordError ? <p className="field-error">{passwordError}</p> : <p className="field-hint">Mínimo de 6 caracteres.</p>
          ) : (
            touched && !senha && <p className="field-error">Informe sua senha.</p>
          )}
        </div>

        {isSignup && (
          <div className="field-group">
            <label className="field-label" htmlFor="auth-telefone">WhatsApp</label>
            <input
              id="auth-telefone"
              className="field-input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={telefone}
              onChange={(e) => setTelefone(maskPhone(e.target.value))}
              placeholder="(67) 99999-9999"
              required
            />
            {phoneError ? (
              <p className="field-error">{phoneError}</p>
            ) : (
              <p className="field-hint">Com DDD. É por ele que você vai anotar gastos pelo WhatsApp.</p>
            )}
          </div>
        )}

        {error && <div className="insight insight-bad auth-error" role="alert">{error}</div>}

        <button className="btn-primary auth-submit" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <span className="btn-spinner" aria-hidden="true" /> {isSignup ? 'Criando conta…' : 'Entrando…'}
            </>
          ) : (
            <>
              {isSignup ? 'Criar conta e continuar' : 'Entrar'} <ArrowRight size={16} className="arrow" />
            </>
          )}
        </button>

        <p className="auth-switch">
          {isSignup ? 'Já tem conta? ' : 'Ainda não tem conta? '}
          <Link to={authLink(isSignup ? 'entrar' : 'cadastro', next)}>{isSignup ? 'Entrar' : 'Criar conta grátis'}</Link>
        </p>
      </form>
    </div>
  );
}
