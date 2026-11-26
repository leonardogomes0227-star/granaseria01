import { afterEach, describe, expect, it } from 'vitest';
import { rotaAcesso, rotaCakto, rotaFilaGet, rotaFilaPost } from './rotas';

const limpar = () => { for (const k of ['ACESSO_MODO', 'CAKTO_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_SECRET']) delete process.env[k]; };
afterEach(limpar);
const get = (u: string, h: Record<string, string> = {}) => new Request(`https://x.test${u}`, { headers: h });
const post = (u: string, corpo: unknown, h: Record<string, string> = {}) => new Request(`https://x.test${u}`, { method: 'POST', body: JSON.stringify(corpo), headers: h });

describe('acesso: nada é cortado por engano', () => {
  it('sem ACESSO_MODO=convite todo mundo fica liberado', async () => {
    expect(await (await rotaAcesso(get('/api/acesso', { authorization: 'Bearer qualquer' }))).json()).toEqual({ estado: 'liberado' });
  });
  it('no modo convite, sem saber quem é, também libera', async () => {
    process.env.ACESSO_MODO = 'convite';
    expect(await (await rotaAcesso(get('/api/acesso'))).json()).toEqual({ estado: 'liberado' });
  });
});

describe('webhook da Cakto', () => {
  it('sem segredo configurado, recusa tudo', async () => {
    expect((await rotaCakto(post('/api/cakto', { event: 'purchase_approved' }))).status).toBe(503);
  });
  it('com segredo errado, recusa', async () => {
    process.env.CAKTO_WEBHOOK_SECRET = 'certo';
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    expect((await rotaCakto(post('/api/cakto', { secret: 'errado', event: 'purchase_approved' }))).status).toBe(401);
  });
});

describe('fila', () => {
  it('sem banco ligado, avisa em vez de quebrar', async () => {
    expect((await rotaFilaGet(get('/api/fila?total=1'))).status).toBe(503);
    expect((await rotaFilaPost(post('/api/fila', { nome: 'Ana', whatsapp: '67999991234' }))).status).toBe(503);
  });
  it('chamar os próximos exige o segredo do dono', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    process.env.ADMIN_SECRET = 'dono';
    expect((await rotaFilaPost(post('/api/fila', { acao: 'convidar', quantidade: 5 }, { authorization: 'Bearer errado' }))).status).toBe(401);
    expect((await rotaFilaGet(get('/api/fila?lista=1'))).status).toBe(401);
  });
});
