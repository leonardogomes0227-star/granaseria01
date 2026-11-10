import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { detalheDisponivel, faturaAberta } from './selectores';
import { prioridades } from './prioridades';
import { avisosPendentes } from './avisosPendentes';
import { migrar } from './migracao';

const HOJE = '2026-11-10';
const base = (p: Partial<Estado> = {}): Estado => ({ ...ESTADO_INICIAL(), ...p, config: { ...ESTADO_INICIAL().config, renda: 3000, reservaPct: 0, onboardingFeito: true } });

describe('outros cartões e avisos', () => {
  it('a fatura dos outros cartões entra no que está em aberto e reduz o disponível, sem duplicar', () => {
    const e = base({ cartao: { limite: 2000, usado: 500, fechaDia: 1, venceDia: 20 }, outrosCartoes: [{ id: 'o', nome: 'Inter', limite: 1000, usado: 300, venceDia: 12 }] });
    expect(faturaAberta(e)).toBe(800);
    expect(detalheDisponivel(e, '2026-11', HOJE).livre).toBe(2200);
  });
  it('o vencimento do outro cartão aparece nas prioridades', () => {
    const e = base({ outrosCartoes: [{ id: 'o', nome: 'Inter', limite: 1000, usado: 300, venceDia: 12 }] });
    const p = prioridades(e, HOJE).find((x) => x.chave === 'oc-o');
    expect(p?.titulo).toBe('Fatura Inter');
    expect(p?.semaforo).toBe('vermelho'); // vence em 2 dias
  });
  it('estado antigo sem outrosCartoes continua válido; dados inválidos são descartados', () => {
    expect(migrar({ config: { renda: 1 } }).outrosCartoes).toEqual([]);
    expect(migrar({ outrosCartoes: [{ id: 'a', nome: '  ', usado: 5, venceDia: 3 }, { id: 'b', nome: 'Loja', usado: -5, limite: 10, venceDia: 99 }] }).outrosCartoes).toEqual([{ id: 'b', nome: 'Loja', limite: 10, usado: 0, venceDia: 31 }]);
  });
  it('Modo Recuperação ligado: o passo de hoje vira o aviso do dia', () => {
    const e = base({ recuperacao: { ativo: true, desde: '2026-11-01', raioXFeito: true } });
    expect(avisosPendentes(e, HOJE).some((a) => a.id === `recup-${HOJE}`)).toBe(true);
    expect(avisosPendentes(base(), HOJE).some((a) => a.id.startsWith('recup-'))).toBe(false);
  });
});
