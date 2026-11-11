import { describe, expect, it } from 'vitest';
import { combinadoParaHoje } from './lembretesCoach';

const estado = (passos: unknown[]) => ({ 'grana-seria:v1': JSON.stringify({ config: { renda: 3000 }, caminho: { passos } }) });

describe('volta combinada com o Coach pelo WhatsApp', () => {
  it('manda só no dia combinado, só o que veio do Coach e ainda não foi resolvido', () => {
    const s = estado([
      { id: 'a', titulo: 'Ver se o\ncorte do streaming deu certo', origem: 'coach', criadoEm: '2026-11-03', lembrarEm: '2026-11-10' },
      { id: 'b', titulo: 'Outro', origem: 'coach', criadoEm: '2026-11-03', lembrarEm: '2026-11-11' },
      { id: 'c', titulo: 'Já feito', origem: 'coach', criadoEm: '2026-11-03', lembrarEm: '2026-11-10', feitoEm: '2026-11-09' },
      { id: 'd', titulo: 'De uma ferramenta', origem: 'cortar', criadoEm: '2026-11-03', lembrarEm: '2026-11-10' },
    ]);
    const t = combinadoParaHoje(s, '2026-11-10')!;
    expect(t).toContain('Ver se o corte do streaming deu certo');
    expect(t).not.toMatch(/\n|Outro|Já feito|De uma ferramenta/);
    expect(combinadoParaHoje(s, '2026-11-12')).toBeNull();
  });
  it('estado vazio ou quebrado não manda nada', () => {
    expect(combinadoParaHoje({}, '2026-11-10')).toBeNull();
    expect(combinadoParaHoje({ 'grana-seria:v1': '{quebrado' }, '2026-11-10')).toBeNull();
  });
});
