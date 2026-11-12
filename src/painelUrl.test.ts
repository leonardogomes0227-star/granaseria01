import { describe, expect, it } from 'vitest';
import { tokenNaUrl } from './painel';

describe('token do link', () => {
  it('lê ?t= e #t= e ignora lixo', () => {
    expect(tokenNaUrl(new URL('https://granaseria.com.br/painel?t=abcdefghijklmnopqrstuvwxyz12'))).toBe('abcdefghijklmnopqrstuvwxyz12');
    expect(tokenNaUrl(new URL('https://granaseria.com.br/painel#t=abcdefghijklmnopqrstuvwxyz12'))).toBe('abcdefghijklmnopqrstuvwxyz12');
    expect(tokenNaUrl(new URL('https://granaseria.com.br/painel?t=curto'))).toBeNull();
    expect(tokenNaUrl(new URL('https://granaseria.com.br/painel'))).toBeNull();
  });
});