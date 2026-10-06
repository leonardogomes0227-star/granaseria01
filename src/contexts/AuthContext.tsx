import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { translateAuthError } from '../lib/authErrors';

export interface Profile {
  nome: string;
  telefone: string | null;
}

export interface SignUpInput {
  nome: string;
  email: string;
  senha: string;
  telefone: string; // já normalizado: 55 + DDD + número
}

/** error: mensagem em português, pronta pra mostrar. needsConfirmation: conta criada, falta confirmar o e-mail. */
export interface AuthResult {
  error: string | null;
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Nome pra exibir: do perfil, ou do cadastro enquanto o perfil não carrega. */
  displayName: string;
  loading: boolean;
  signIn: (email: string, senha: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        // sem sessão recuperável — segue deslogado
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    supabase
      .from('profiles')
      .select('nome, telefone')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        // sem perfil (ou erro de rede) o header usa o nome guardado no cadastro
        if (active && !error && data) setProfile(data as Profile);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, senha: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      return { error: error ? translateAuthError(error) : null };
    } catch (e) {
      return { error: translateAuthError(e) };
    }
  }, []);

  const signUp = useCallback(async ({ nome, email, senha, telefone }: SignUpInput): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          data: { nome: nome.trim(), telefone },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) return { error: translateAuthError(error) };
      // com confirmação de e-mail ligada, um e-mail já cadastrado volta como usuário "fantasma" sem identidades
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { error: 'Já existe uma conta com este e-mail. Tente entrar.' };
      }
      return { error: null, needsConfirmation: !data.session };
    } catch (e) {
      return { error: translateAuthError(e) };
    }
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: translateAuthError(error) };
      setSession(null);
      return { error: null };
    } catch (e) {
      return { error: translateAuthError(e) };
    }
  }, []);

  const user = session?.user ?? null;
  const metaName = typeof user?.user_metadata?.nome === 'string' ? (user.user_metadata.nome as string) : '';
  const displayName = profile?.nome || metaName || user?.email?.split('@')[0] || '';

  const value = useMemo<AuthContextValue>(
    () => ({ session, user, profile, displayName, loading, signIn, signUp, signOut }),
    [session, user, profile, displayName, loading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
