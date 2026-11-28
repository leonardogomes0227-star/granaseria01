import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailDoUsuario } from './exigir';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const ID = '123e4567-e89b-12d3-a456-426614174000';

describe('emailDoUsuario', () => {
  it('sem Supabase configurado ou com id estranho, devolve null sem chamar a rede', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    expect(await emailDoUsuario(ID)).toBeNull();
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    expect(await emailDoUsuario('nao-e-uuid')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it('devolve o e-mail da conta', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ email: 'ana@email.com' })));
    expect(await emailDoUsuario(ID)).toBe('ana@email.com');
  });
  it('erro de rede ou resposta ruim vira null', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    expect(await emailDoUsuario(ID)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede'); }));
    expect(await emailDoUsuario(ID)).toBeNull();
  });
});
