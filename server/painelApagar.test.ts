import { beforeEach, describe, expect, it, vi } from 'vitest';

const apagarNumero = vi.fn();
const limparNumero = vi.fn();
const salvarEstado = vi.fn();
const acharConta = vi.fn();
const tokenParaNumero = vi.fn();
let contasLigadas = true;

vi.mock('./whatsapp/hubdb.js', () => ({ phoneFromWebLink: (t: string) => tokenParaNumero(t), eraseWhatsAppData: (p: string) => apagarNumero(p), clearWhatsAppData: (p: string) => limparNumero(p), getProfileWithDate: vi.fn(), saveProfile: vi.fn(), trackEvent: vi.fn(), HANDOFF_KEYS: [] }));
vi.mock('./whatsapp/db.js', () => ({ listExpensesSince: vi.fn(), listIncomesSince: vi.fn() }));
vi.mock('./whatsapp/bot.js', () => ({ startOfMonthBRT: vi.fn() }));
vi.mock('./account/db.js', () => ({ accountsConfigured: () => contasLigadas, findUserByPhone: (p: string) => acharConta(p), saveState: (id: string, s: unknown) => salvarEstado(id, s) }));
vi.mock('../src/reset.js', () => ({ PLAN_KEYS: [], RESET_ID: 'x', RESET_KEY: 'k', resetIfOld: (s: unknown) => ({ state: s, changed: false }) }));
vi.mock('../src/lib/mesesFuturos.js', () => ({ limparMesesFuturos: (s: unknown) => ({ state: s, changed: false }) }));

const chamar = async (token?: string, manter = false) => {
  const { DELETE } = await import('../api/painel');
  return DELETE(new Request(`https://x.test/api/painel${manter ? '?manter=1' : ''}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} }));
};

describe('DELETE /api/painel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contasLigadas = true;
    tokenParaNumero.mockResolvedValue('5567999999999');
    acharConta.mockResolvedValue(null);
    apagarNumero.mockResolvedValue(undefined);
    limparNumero.mockResolvedValue(undefined);
  });

  it('sem token ou com link inválido: 401 e nada é apagado', async () => {
    tokenParaNumero.mockResolvedValue(null);
    expect((await chamar()).status).toBe(401);
    expect((await chamar('ruim')).status).toBe(401);
    expect(apagarNumero).not.toHaveBeenCalled();
  });

  it('apaga o que é do número e responde 204', async () => {
    const r = await chamar('bom');
    expect(r.status).toBe(204);
    expect(apagarNumero).toHaveBeenCalledWith('5567999999999');
    expect(salvarEstado).not.toHaveBeenCalled();
  });

  it('limpar (manter=1): esvazia os dados mas NÃO apaga o acesso (usa clearWhatsAppData, não eraseWhatsAppData)', async () => {
    acharConta.mockResolvedValue({ user_id: 'u1' });
    expect((await chamar('bom', true)).status).toBe(204);
    expect(limparNumero).toHaveBeenCalledWith('5567999999999');
    expect(apagarNumero).not.toHaveBeenCalled();
    expect(salvarEstado).toHaveBeenCalledWith('u1', {});
  });

  it('limpar sem token: 401 e nada é mexido', async () => {
    tokenParaNumero.mockResolvedValue(null);
    expect((await chamar(undefined, true)).status).toBe(401);
    expect(limparNumero).not.toHaveBeenCalled();
  });

  it('limpar com falha no banco: 502', async () => {
    limparNumero.mockRejectedValue(new Error('Supabase delete 500'));
    expect((await chamar('bom', true)).status).toBe(502);
  });

  it('conta vinculada: esvazia o estado dela também', async () => {
    acharConta.mockResolvedValue({ user_id: 'u1' });
    expect((await chamar('bom')).status).toBe(204);
    expect(salvarEstado).toHaveBeenCalledWith('u1', {});
    expect(apagarNumero).toHaveBeenCalled();
  });

  it('contas desligadas: não procura a conta', async () => {
    contasLigadas = false;
    expect((await chamar('bom')).status).toBe(204);
    expect(acharConta).not.toHaveBeenCalled();
  });

  it('falha no banco: 502, para o app não dizer que apagou', async () => {
    apagarNumero.mockRejectedValue(new Error('Supabase delete 500'));
    expect((await chamar('bom')).status).toBe(502);
  });
});
