import { describe, expect, it } from 'vitest';
import { FERRAMENTAS } from './registroFerramentas';
import { PROBLEMAS, acharProblema } from './problemas';
import { responderLocal } from './assistenteLocal';
import { ESTADO_INICIAL } from './tipos';

const primeira = (t: string) => acharProblema(t, 1)[0]?.passos[0].ferramenta.id;

describe('Midas acha a ferramenta pelo problema', () => {
  it('toda ferramenta citada existe', () => {
    for (const p of PROBLEMAS) for (const s of p.passos) expect(FERRAMENTAS.some((f) => f.id === s.ferramenta), `${p.id} -> ${s.ferramenta}`).toBe(true);
  });
  it.each([
    ['meu dinheiro acaba antes do fim do mês', 'orcamento'],
    ['estou com conta atrasada', 'atrasos'],
    ['to devendo muito, quero sair das dívidas', 'dividas'],
    ['o cartão estourou', 'cartao'],
    ['quero começar a guardar dinheiro', 'reserva'],
    ['quero investir', 'investir'],
    ['vou comprar um celular novo, será que cabe?', 'comprar'],
    ['pago assinatura que nem uso', 'assinaturas'],
    ['não sei por onde começar', 'caminho'],
    ['ganhei um bônus no trabalho', 'extras'],
    ['quero ser avisado antes de vencer', 'assistentes'],
    ['para onde foi meu dinheiro', 'lancamentos'],
  ])('"%s" começa por %s', (frase, id) => expect(primeira(frase)).toBe(id));
  it('o que não reconhece volta vazio (o Midas pede para a pessoa contar melhor)', () => {
    expect(acharProblema('xyzzy qwerty')).toEqual([]);
    expect(acharProblema('')).toEqual([]);
  });
  it('a resposta do Midas traz o porquê de cada ferramenta e os atalhos para abrir', () => {
    const r = responderLocal('meu dinheiro acaba antes do fim do mês', ESTADO_INICIAL(), '2026-11-26');
    expect(r.texto).toContain('1. Orçamento:');
    expect(r.links?.map((l) => l.rota)).toContain('/plano/orcamento');
    expect(r.links?.length).toBeGreaterThanOrEqual(2);
  });
  it('perguntas de número continuam respondendo com números', () => {
    expect(responderLocal('Quanto posso gastar hoje?', ESTADO_INICIAL(), '2026-11-26').texto).toMatch(/renda|gastar/i);
    expect(responderLocal('Quando fico livre das dívidas?', ESTADO_INICIAL(), '2026-11-26').texto).toMatch(/dívida/i);
  });
});
