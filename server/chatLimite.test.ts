import { beforeEach, describe, expect, it, vi } from 'vitest';

const contar = vi.fn();
vi.mock('./whatsapp/hubdb.js', () => ({ bumpUsage: (...a: unknown[]) => contar(...a) }));
vi.mock('./mercado/fontes.js', () => ({ obterMercado: async () => null }));

const pedido = (ip = '1.2.3.4') =>
  new Request('https://x.test/api/investimentos/chat', { method: 'POST', headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }) });

describe('limite diário do chat de investimentos (Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ANTHROPIC_API_KEY', 'chave-de-teste');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ content: [{ type: 'text', text: 'resposta' }] })));
  });

  it('dentro do limite: responde e conta o uso do IP em hash, nunca o IP puro', async () => {
    contar.mockResolvedValue(true);
    const { POST } = await import('../api/investimentos/chat');
    const r = await POST(pedido('9.9.9.9'));
    expect(r.status).toBe(200);
    const [quem, periodo, limite] = contar.mock.calls[0];
    expect(quem).toMatch(/^ip:[0-9a-f]{24}$/);
    expect(String(quem)).not.toContain('9.9.9.9');
    expect(periodo).toMatch(/^chat:\d{4}-\d{2}-\d{2}$/);
    expect(limite).toBe(20);
  });

  it('passou do limite: 429 e a Anthropic nem é chamada', async () => {
    contar.mockResolvedValue(false);
    const { POST } = await import('../api/investimentos/chat');
    const r = await POST(pedido());
    expect(r.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Supabase fora do ar: cai no contador em memória (20 por dia) e segue respondendo', async () => {
    contar.mockRejectedValue(new Error('Supabase fora'));
    const { POST } = await import('../api/investimentos/chat');
    const status: number[] = [];
    for (let i = 0; i < 21; i++) status.push((await POST(pedido('7.7.7.7'))).status);
    expect(status.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(status[20]).toBe(429);
  });
});
