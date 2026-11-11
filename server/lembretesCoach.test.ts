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

describe('linha do caminho no resumo semanal', async () => {
  const { linhaDoCaminho } = await import('./lembretesCoach');
  it('diz o destino e o que a semana mudou, sem quebra de linha', () => {
    const s = { 'grana-seria:v1': JSON.stringify({ config: { renda: 4000 }, dividas: [{ id: 'c', nome: 'Cartão', saldo: 6000, jurosMensal: 8, parcelaMinima: 300, cadastradaEm: '2026-10-01', pagamentos: [{ data: '2026-11-08', valor: 2000 }] }], planoDividas: { estrategia: 'bola-de-neve', pagamentoMensal: 900, criadoEm: '2026-10-01' } }) };
    const t = linhaDoCaminho(s, '2026-11-10')!;
    expect(t).toMatch(/^Seu destino: livre das dívidas caras em \w+ de 20\d\d\./);
    expect(t).toContain('pagou R$ 2.000');
    expect(t).not.toMatch(/\n/);
    expect(linhaDoCaminho({}, '2026-11-10')).toBeNull();
  });
});
