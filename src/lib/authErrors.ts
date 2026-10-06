import { AuthError } from '@supabase/supabase-js';

// Mensagens do Supabase Auth traduzidas — o usuário nunca deve ver "Invalid login credentials".
export function translateAuthError(error: unknown): string {
  const code = error instanceof AuthError ? error.code : undefined;
  const message = error instanceof Error ? error.message : String(error ?? '');
  const m = message.toLowerCase();

  if (code === 'invalid_credentials' || m.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (code === 'email_not_confirmed' || m.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar — enviamos um link para a sua caixa de entrada.';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || m.includes('already registered')) {
    return 'Já existe uma conta com este e-mail. Tente entrar.';
  }
  if (code === 'weak_password' || m.includes('password should be')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (code === 'email_address_invalid' || m.includes('invalid format') || m.includes('is invalid')) {
    return 'Esse e-mail não parece válido. Confere aí.';
  }
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    m.includes('rate limit') ||
    m.includes('for security purposes')
  ) {
    return 'Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.';
  }
  if (m.includes('database error saving new user')) {
    // o trigger que cria o perfil falha quando o telefone já está em outra conta (telefone é único)
    return 'Não foi possível criar a conta. Esse WhatsApp pode já estar cadastrado em outra conta.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  }
  return 'Algo deu errado. Tente de novo em instantes.';
}

/** Erros de banco (PostgREST) em português, para as telas de diagnóstico e gastos. */
export function translateDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message ?? '';
  const m = message.toLowerCase();
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  }
  if (m.includes('jwt') || m.includes('row-level security') || m.includes('permission')) {
    return 'Sua sessão expirou. Saia e entre de novo.';
  }
  return 'Não foi possível falar com o servidor agora. Tente de novo em instantes.';
}
