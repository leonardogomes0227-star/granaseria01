import { describe, expect, it } from 'vitest';
import { contarLimite, excedeuLimite, ipDoCliente, zerarLimites } from './rede';
import { mesmoSegredo } from './segredo';

describe('limite e segredo', () => {
  it('não conta o IP inventado no começo do x-forwarded-for', () => {
    const req = new Request('https://granaseria.com.br/api/painel', {
      headers: { 'x-real-ip': '203.0.113.8', 'x-forwarded-for': '1.2.3.4, 203.0.113.8' },
    });
    expect(ipDoCliente(req)).toBe('203.0.113.8');
  });

  it('trava depois do limite e o segredo não aceita tamanho diferente', () => {
    zerarLimites();
    const agora = 1_000_000;
    expect(excedeuLimite('t', 2, 1000, agora)).toBe(false);
    contarLimite('t', 1000, agora);
    contarLimite('t', 1000, agora);
    expect(excedeuLimite('t', 2, 1000, agora)).toBe(true);
    expect(mesmoSegredo('certo', 'certo')).toBe(true);
    expect(mesmoSegredo('certo', 'certo-demais')).toBe(false);
    expect(mesmoSegredo('certo', undefined)).toBe(false);
  });
});
