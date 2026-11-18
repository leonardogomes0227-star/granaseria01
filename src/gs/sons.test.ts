import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAVE_SONS, audioLiberado, definirSons, marcarGesto, reiniciarSonsParaTeste, sonsLigados, tipoDoAviso, tocar } from './sons';

const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  reiniciarSonsParaTeste();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
  });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('sons da interface', () => {
  it('começa ligado e grava numa chave nova', () => {
    expect(sonsLigados()).toBe(true);
    expect(mem.has('grana-seria:v1')).toBe(false);
    expect(mem.has('gs-midas-guia')).toBe(false);
    definirSons(false);
    expect(mem.get(CHAVE_SONS)).toBe('0');
    expect(sonsLigados()).toBe(false);
    definirSons(true);
    expect(mem.get(CHAVE_SONS)).toBe('1');
    expect([...mem.keys()]).toEqual([CHAVE_SONS]);
  });

  it('não cria áudio antes do primeiro gesto', () => {
    const criado = vi.fn();
    vi.stubGlobal('AudioContext', criado);
    vi.stubGlobal('window', { AudioContext: criado });
    tocar('toque');
    tocar('sucesso');
    expect(audioLiberado()).toBe(false);
    expect(criado).not.toHaveBeenCalled();
    marcarGesto();
    expect(audioLiberado()).toBe(true);
  });

  it('com o som desligado, o gesto não libera o áudio', () => {
    definirSons(false);
    marcarGesto();
    expect(audioLiberado()).toBe(false);
  });

  it('separa o aviso de salvou do aviso de erro', () => {
    expect(tipoDoAviso('Gasto anotado: R$ 35 em Mercado')).toBe('sucesso');
    expect(tipoDoAviso('Meta criada: viagem')).toBe('sucesso');
    expect(tipoDoAviso('Não consegui responder agora.')).toBe('erro');
    expect(tipoDoAviso('Confira os dados e tente de novo.')).toBe('erro');
    expect(tipoDoAviso('Olá')).toBeNull();
  });
});
