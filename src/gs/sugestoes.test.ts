import { describe, expect, it } from 'vitest';
import { atalhosFrequentes, sugerirCategoria } from './sugestoes';
import { CATEGORIAS_DIA, CATEGORIAS_MOV } from './tipos';
import { ESTADO_INICIAL } from './tipos';

const CATS = CATEGORIAS_MOV;
describe('sugestões', () => {
  it('mapeia descrições comuns', () => {
    expect(sugerirCategoria('Mercado do mês', CATS)).toBe('Mercado');
    expect(sugerirCategoria('combustível', CATS)).toBe('Transporte');
    expect(sugerirCategoria('Netflix', CATS)).toBe('Assinaturas');
    expect(sugerirCategoria('farmácia', CATS)).toBe('Saúde');
    expect(sugerirCategoria('xyzzy', CATS)).toBeNull();
    expect(sugerirCategoria('', CATS)).toBeNull();
  });
  it('só sugere categoria que existe', () => {
    expect(sugerirCategoria('netflix', CATEGORIAS_DIA)).not.toBe('Assinaturas');
  });
  it('atalhos: só repetidos, com o último valor', () => {
    const e = ESTADO_INICIAL();
    e.lancamentos = [
      { id: '1', descricao: 'Café', valor: 5, data: '2026-11-01', categoria: 'Comida' },
      { id: '2', descricao: 'café', valor: 6, data: '2026-11-03', categoria: 'Comida' },
      { id: '3', descricao: 'Uber', valor: 20, data: '2026-11-02', categoria: 'Transporte' },
    ];
    const a = atalhosFrequentes(e, '2026-11-09');
    expect(a).toHaveLength(1);
    expect(a[0].valor).toBe(6);
  });
});
