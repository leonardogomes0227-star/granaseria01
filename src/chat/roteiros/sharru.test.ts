import { describe, expect, it } from 'vitest';
import { conferir, falasDoRoteiro, percorrer, respostaDe, rotuloDe, type RespostaDada, type Valor } from '../engine';
import { dadosDeEstado } from '../dados';
import type { Missao } from '../../missoes';
import { curasDe, faltam, forcou, liberado, marcoDe, metaDe, projecoes, reservaCompleta, ROTEIRO_INVESTIR } from './sharru';

const NOW = new Date('2026-10-21T15:00:00Z'); // hoje = 2026-10-21
const base = (state: Record<string, string> = {}, nome = 'Ana') => ({ agente: 'sharru' as const, nome, dados: dadosDeEstado(state, NOW) });

function responder(pares: [string, Valor][], state: Record<string, string> = {}, nome = 'Ana') {
  const r: RespostaDada[] = [];
  for (const [passo, valor] of pares) {
    const p = percorrer(ROTEIRO_INVESTIR, r, base(state, nome));
    expect(p.atual?.id, `esperava ${passo}`).toBe(passo);
    expect(conferir(p.atual!, valor, p.ctx)).toBeNull();
    r.push({ passo, valor });
  }
  return percorrer(ROTEIRO_INVESTIR, r, base(state, nome));
}

/** Onde a conversa está depois dessas respostas (sem conferir). */
const ate = (pares: [string, Valor][], state: Record<string, string> = {}, nome = 'Ana') =>
  percorrer(
    ROTEIRO_INVESTIR,
    pares.map(([passo, valor]) => ({ passo, valor })),
    base(state, nome)
  );

const falasDe = (p: ReturnType<typeof percorrer>, id: string) => {
  const v = [...p.visitas].reverse().find((x) => x.passo.id === id);
  return v ? falasDoRoteiro.falas(v.passo, v.ctx) : [];
};
const falasAtuais = (p: ReturnType<typeof percorrer>) => falasDoRoteiro.falas(p.atual!, p.ctx);
const caminho = (p: ReturnType<typeof percorrer>) => p.visitas.map((v) => v.passo.id);

/* ---------- missões de exemplo ---------- */

const missao = (p: Partial<Missao> & Pick<Missao, 'id' | 'tipo' | 'titulo'>): Missao => ({
  agente: 'arkad',
  metaValor: 0,
  valorInicial: 0,
  valorMensal: 0,
  dataInicio: '2026-09-01',
  dataPrevista: null,
  previsaoOriginal: null,
  prioridade: 3,
  status: 'ativa',
  passos: [],
  registros: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...p,
});

// 9.000 de meta, 1.000 guardado, 400/mês: faltam 20 meses (mai/28)
const RESERVA = missao({ id: 'm-res', tipo: 'reserva', titulo: 'Reserva de emergência', metaValor: 9000, valorInicial: 1000, valorMensal: 400 });
const RESERVA_QUASE = missao({ ...RESERVA, valorInicial: 8800 });
const RESERVA_SEM_MENSAL = missao({ ...RESERVA, valorMensal: 0 });
const RESERVA_CHEIA = missao({ ...RESERVA, valorInicial: 9000 });
const RESERVA_CONCLUIDA = missao({ ...RESERVA, status: 'concluida', registros: [{ mes: '2026-09', valor: 8000, em: '2026-09-10', origem: 'site' }] });
const RESERVA_ARQUIVADA = missao({ ...RESERVA_CHEIA, id: 'm-old', status: 'arquivada' });
const INVESTIR = missao({ id: 'm-inv', agente: 'sharru', tipo: 'investir', titulo: 'Fazer o ouro trabalhar', metaValor: 600000, valorMensal: 300, prioridade: 5 });

const RENDA = { 'gs-eu': JSON.stringify({ renda: 4000 }) };
const estado = (missoes: Missao[], extra: Record<string, string> = RENDA) => ({ 'gs-missoes': JSON.stringify(missoes), ...extra });
const COMPLETA = estado([RESERVA_CHEIA]);
const INCOMPLETA = estado([RESERVA]);
const CONTAS = JSON.stringify([{ id: 'a', name: 'Aluguel', amount: 1500, dueDay: 5, startMonth: '2026-10', payments: [] }]);

const NORMAL: [string, Valor][] = [
  ['custo', 3000],
  ['mensal', 500],
  ['renda', ['curso', 'aumento']],
];

/* ---------- testes ---------- */

describe('6.8 Sharru Nada — investir e viver de renda', () => {
  it('é o roteiro "investir" do Sharru Nada', () => {
    expect(ROTEIRO_INVESTIR).toMatchObject({ id: 'investir', agente: 'sharru', primeiro: 'abertura' });
    for (const p of ROTEIRO_INVESTIR.passos) expect(ROTEIRO_INVESTIR.passos.filter((x) => x.id === p.id)).toHaveLength(1);
  });

  describe('a reserva está completa?', () => {
    const ctx = (state: Record<string, string>) => ate([], state).ctx;
    it('pela missão de reserva: concluída ou com o valor atual na meta', () => {
      expect(reservaCompleta(ctx(COMPLETA))).toBe(true);
      expect(reservaCompleta(ctx(estado([RESERVA_CONCLUIDA])))).toBe(true);
      expect(reservaCompleta(ctx(INCOMPLETA))).toBe(false);
      expect(reservaCompleta(ctx(estado([missao({ ...RESERVA_CHEIA, status: 'pausada' })])))).toBe(true);
    });
    it('a missão ativa vale mais que uma arquivada cheia', () => {
      expect(reservaCompleta(ctx(estado([RESERVA_ARQUIVADA, RESERVA])))).toBe(false);
    });
    it('missão sem meta não conta como completa', () => {
      expect(reservaCompleta(ctx(estado([missao({ ...RESERVA, metaValor: 0, valorInicial: 0 })])))).toBe(false);
    });
    it('sem missão, pelo guardado e a meta que o app conhece', () => {
      const c = ctx({});
      expect(reservaCompleta({ ...c, dados: { ...c.dados, guardado: 9000, reservaMeta: 9000 } })).toBe(true);
      expect(reservaCompleta({ ...c, dados: { ...c.dados, guardado: 5000, reservaMeta: 9000 } })).toBe(false);
      // meta zero (usuário novo) nunca é "completa"
      expect(reservaCompleta({ ...c, dados: { ...c.dados, guardado: 100, reservaMeta: 0 } })).toBe(false);
      expect(reservaCompleta(c)).toBe(false);
    });
    it('"Faltam x meses" no singular e no plural', () => {
      expect(faltam(20)).toBe('Faltam 20 meses.');
      expect(faltam(1)).toBe('Falta 1 mês.');
      expect(faltam(null)).toBeNull();
    });
  });

  describe('reserva completa: caminho normal', () => {
    it('abre animado e vai direto pro custo de vida', () => {
      const p = ate([], COMPLETA);
      expect(falasDe(p, 'abertura')).toEqual(['Sua reserva está completa, Ana. Agora a gente faz o ouro trabalhar.', 'Dinheiro guardado trabalha. Dinheiro parado dorme.']);
      expect(p.atual?.id).toBe('custo');
      expect(caminho(p)).toEqual(['abertura']);
      expect(falasAtuais(p)).toEqual(['Quanto você gostaria de ter por mês pra viver, sem trabalhar?']);
      expect(respostaDe(p.atual!, p.ctx)).toMatchObject({ tipo: 'dinheiro', min: 1 });
      // sem contas cadastradas, sem chip de sugestão
      const r = respostaDe(p.atual!, p.ctx);
      expect(r.tipo === 'dinheiro' && r.sugestao?.(p.ctx)).toBeNull();
    });

    it('sem nome, a vírgula some', () => {
      expect(falasDe(ate([], COMPLETA, ''), 'abertura')[0]).toBe('Sua reserva está completa. Agora a gente faz o ouro trabalhar.');
    });

    it('com missão de investir ativa, avisa que o plano atual continua valendo', () => {
      const p = ate([], estado([RESERVA_CHEIA, INVESTIR]));
      expect(falasDe(p, 'abertura')).toHaveLength(3);
      expect(falasDe(p, 'abertura')[2]).toBe('Vamos rever o seu plano. O atual continua valendo até você terminar.');
    });

    it('com contas cadastradas, sugere os gastos de hoje como custo de vida', () => {
      const p = ate([], estado([RESERVA_CHEIA], { ...RENDA, 'gs-contas': CONTAS }));
      const r = respostaDe(p.atual!, p.ctx);
      expect(r.tipo === 'dinheiro' && r.sugestao?.(p.ctx)).toEqual({ valor: 1500, rotulo: 'R$ 1.500 (seus gastos de hoje)' });
    });

    it('diz quanto precisaria investido (0,5% ao mês) e pede o valor do mês com sugestão de 10%', () => {
      const p = ate([['custo', 3000]], COMPLETA);
      expect(falasDe(p, 'meta')).toEqual([
        'Pra viver de renda com R$ 3.000/mês, você precisaria de aproximadamente R$ 600.000 investidos (estimativa conservadora de 0,5% ao mês).',
        'Parece muito? Todo tesouro começou com uma moeda. O tempo faz a maior parte do trabalho.',
      ]);
      expect(p.atual?.id).toBe('mensal');
      expect(falasAtuais(p)).toEqual(['Os 10% que iam pra reserva podem vir pra cá: R$ 400.', 'Quanto você consegue investir por mês?']);
      const r = respostaDe(p.atual!, p.ctx);
      expect(r).toMatchObject({ tipo: 'dinheiro', min: 1 });
      expect(r.tipo === 'dinheiro' && r.sugestao?.(p.ctx)).toEqual({ valor: 400, rotulo: 'R$ 400 (10%)' });
    });

    it('pergunta se quer aumentar o que entra, com as opções da 7ª cura', () => {
      const p = ate([['custo', 3000], ['mensal', 500]], COMPLETA);
      expect(p.atual?.id).toBe('renda');
      expect(falasAtuais(p)).toEqual(['Tem outro jeito de chegar lá mais rápido: ganhar mais.', 'Quer aumentar o que entra?']);
      const r = respostaDe(p.atual!, p.ctx);
      expect(r.tipo === 'multiplo' && r.opcoes.map((o) => o.rotulo)).toEqual(['Fazer um curso', 'Freela ou bico', 'Pedir aumento', 'Agora não']);
    });

    it('caminho feliz: projeção em 5, 10 e 20 anos, gráfico, rodapé e missão', () => {
      const fim = responder(NORMAL, COMPLETA);
      expect(fim.fim).toBe(true);
      expect(caminho(fim)).toEqual(['abertura', 'custo', 'meta', 'mensal', 'renda', 'resultado']);
      expect(falasDe(fim, 'resultado')).toEqual([
        'Pronto, Ana. Investindo R$ 500 por mês, em 20 anos você teria cerca de R$ 231.020.',
        'E ganhando mais, você chega lá antes. Deixei os passos na sua missão.',
      ]);
      expect(metaDe(fim.ctx)).toBe(600000);
      expect(marcoDe(fim.ctx)).toBe(60000);
      expect(projecoes(fim.ctx).map((p) => p.valor)).toEqual([34885, 81940, 231020]);

      const res = ROTEIRO_INVESTIR.resultado!(fim.ctx);
      expect(res.titulo).toBe('Seu plano com Sharru Nada');
      expect(res.linhas).toEqual(['1. Em 5 anos: R$ 34.885', '2. Em 10 anos: R$ 81.940', '3. Em 20 anos: R$ 231.020']);
      expect(res.grafico).toEqual([
        { rotulo: '5 anos', valor: 34885 },
        { rotulo: '10 anos', valor: 81940 },
        { rotulo: '20 anos', valor: 231020 },
      ]);
      expect(res.rodape).toBe('Estimativa. Não é recomendação de investimento.');
      expect(res.botao).toBe('Começar missão');
      expect(res.agentes).toEqual(['sharru']);
      expect(res.lista).toEqual(['Pra viver de renda: R$ 600.000 investidos', 'Procurar um curso que aumente sua renda', 'Pedir aumento: anote o que você entregou este ano']);

      const c = ROTEIRO_INVESTIR.concluir!(fim.ctx, 'sharru:investir');
      expect(c.ativar).toEqual(['sharru']);
      expect(c.destino).toBeUndefined();
      expect(c.efeitos).toBeUndefined();
      expect(c.missoes).toHaveLength(1);
      const m = c.missoes[0];
      expect(m).toMatchObject({
        agente: 'sharru',
        conversa: 'sharru:investir',
        titulo: 'Fazer o ouro trabalhar',
        tipo: 'investir',
        metaValor: 600000,
        valorInicial: 0,
        valorMensal: 500,
        dataInicio: '2026-10-21',
        editarPasso: 'mensal',
        status: 'ativa',
        prioridade: 5,
      });
      expect(m.notas).toBeUndefined();
      expect(m.passos).toEqual([
        { id: 'p1', ordem: 1, titulo: 'Investir R$ 500 este mês', acao: 'guardar', dataAlvo: '2026-10' },
        { id: 'p2', ordem: 2, titulo: 'Chegar a R$ 60.000', valor: 60000 },
        { id: 'p3', ordem: 3, titulo: 'Procurar um curso que aumente sua renda', acao: 'conferir' },
        { id: 'p4', ordem: 4, titulo: 'Pedir aumento: anote o que você entregou este ano', acao: 'conferir' },
        { id: 'p5', ordem: 5, titulo: 'Viver de renda: R$ 600.000', valor: 600000 },
      ]);
      // o passo que "Editar respostas" reabre existe no roteiro
      expect(ROTEIRO_INVESTIR.passos.some((p) => p.id === m.editarPasso)).toBe(true);
    });

    it('as três opções da 7ª cura viram três passos de conferir, na ordem dos botões', () => {
      const fim = responder([['custo', 2000], ['mensal', 300], ['renda', ['aumento', 'freela', 'curso']]], COMPLETA);
      const m = ROTEIRO_INVESTIR.concluir!(fim.ctx, 'x').missoes[0];
      expect(m.passos.map((p) => p.titulo)).toEqual([
        'Investir R$ 300 este mês',
        'Chegar a R$ 40.000',
        'Procurar um curso que aumente sua renda',
        'Conseguir um freela ou bico',
        'Pedir aumento: anote o que você entregou este ano',
        'Viver de renda: R$ 400.000',
      ]);
      expect(m.passos.filter((p) => p.acao === 'conferir')).toHaveLength(3);
      expect(m.passos.map((p) => p.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('"Agora não": sem passos da 7ª cura e a fala final convida pra depois', () => {
      const fim = responder([['custo', 3000], ['mensal', 500], ['renda', ['nao']]], COMPLETA);
      expect(curasDe(fim.ctx)).toEqual([]);
      expect(falasDe(fim, 'resultado')[1]).toBe('Quando quiser aumentar o que entra, é só me chamar.');
      expect(ROTEIRO_INVESTIR.resultado!(fim.ctx).lista).toEqual(['Pra viver de renda: R$ 600.000 investidos']);
      const m = ROTEIRO_INVESTIR.concluir!(fim.ctx, 'x').missoes[0];
      expect(m.passos.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
      expect(m.passos[2]).toEqual({ id: 'p3', ordem: 3, titulo: 'Viver de renda: R$ 600.000', valor: 600000 });
    });

    it('"Agora não" junto com outras opções vale como nenhuma (e o balão mostra isso)', () => {
      const fim = responder([['custo', 3000], ['mensal', 500], ['renda', ['curso', 'nao']]], COMPLETA);
      expect(curasDe(fim.ctx)).toEqual([]);
      expect(ROTEIRO_INVESTIR.concluir!(fim.ctx, 'x').missoes[0].passos.some((p) => p.acao === 'conferir')).toBe(false);
      const v = fim.visitas.find((x) => x.passo.id === 'renda')!;
      expect(rotuloDe(v.passo, ['curso', 'nao'], v.ctx)).toBe('Agora não');
      expect(rotuloDe(v.passo, ['freela', 'curso'], v.ctx)).toBe('Fazer um curso, Freela ou bico');
    });

    it('validações: custo e valor do mês positivos, e o mês não passa do que entra', () => {
      const pCusto = ate([], COMPLETA);
      expect(conferir(pCusto.atual!, 0, pCusto.ctx)).toBe('Digite pelo menos R$ 1,00.');
      expect(conferir(pCusto.atual!, 3000, pCusto.ctx)).toBeNull();

      const pMensal = ate([['custo', 3000]], COMPLETA);
      expect(conferir(pMensal.atual!, 0, pMensal.ctx)).toBe('Digite pelo menos R$ 1,00.');
      expect(conferir(pMensal.atual!, 5000, pMensal.ctx)).toBe('Isso é mais do que entra por mês. Prefiro um valor que você consiga manter.');
      expect(conferir(pMensal.atual!, 4000, pMensal.ctx)).toBeNull();

      const pRenda = ate([['custo', 3000], ['mensal', 500]], COMPLETA);
      expect(conferir(pRenda.atual!, [], pRenda.ctx)).toBe('Escolha pelo menos uma opção.');
    });

    it('sem renda conhecida: sem dica de 10%, sem sugestão e sem teto no valor do mês', () => {
      const semRenda = estado([RESERVA_CHEIA], {});
      const p = ate([['custo', 3000]], semRenda);
      expect(falasAtuais(p)).toEqual(['Quanto você consegue investir por mês?']);
      const r = respostaDe(p.atual!, p.ctx);
      expect(r.tipo === 'dinheiro' && r.sugestao?.(p.ctx)).toBeNull();
      expect(conferir(p.atual!, 50000, p.ctx)).toBeNull();
    });

    it('reserva concluída também libera, e meta muito pequena não cria marco de R$ 0', () => {
      const fim = responder([['custo', 1], ['mensal', 1], ['renda', ['nao']]], estado([RESERVA_CONCLUIDA]));
      expect(metaDe(fim.ctx)).toBe(200);
      expect(ROTEIRO_INVESTIR.resultado!(fim.ctx).linhas).toEqual(['1. Em 5 anos: R$ 70', '2. Em 10 anos: R$ 164', '3. Em 20 anos: R$ 462']);
      const m = ROTEIRO_INVESTIR.concluir!(fim.ctx, 'x').missoes[0];
      expect(m.passos.map((p) => p.titulo)).toEqual(['Investir R$ 1 este mês', 'Viver de renda: R$ 200']);
    });
  });

  describe('reserva incompleta', () => {
    it('diz quantos meses faltam e oferece esperar ou investir mesmo assim', () => {
      const p = ate([], INCOMPLETA);
      expect(falasDe(p, 'abertura')).toEqual(['Que bom ter você aqui, Ana. Eu cuido do ouro que trabalha por você.']);
      expect(p.atual?.id).toBe('espera');
      expect(falasAtuais(p)).toEqual(['Primeiro a reserva, depois a gente faz o ouro trabalhar. Faltam 20 meses.', 'Com a reserva pronta, um imprevisto não mexe no que você investiu.']);
      const r = respostaDe(p.atual!, p.ctx);
      expect(r.tipo === 'botoes' && r.opcoes.map((o) => o.rotulo)).toEqual(['Me avisa quando chegar a hora', 'Quero investir mesmo assim']);
      expect(conferir(p.atual!, 'talvez', p.ctx)).toBe('Escolha uma das opções.');
      expect(liberado(p.ctx)).toBe(false);
    });

    it('no singular quando falta 1 mês', () => {
      expect(falasAtuais(ate([], estado([RESERVA_QUASE])))[0]).toBe('Primeiro a reserva, depois a gente faz o ouro trabalhar. Falta 1 mês.');
    });

    it('sem previsão (missão sem valor do mês): sem número, e sugere o Arkad', () => {
      const p = ate([], estado([RESERVA_SEM_MENSAL]));
      expect(falasAtuais(p)).toEqual(['Primeiro a reserva, depois a gente faz o ouro trabalhar.', 'Converse com o Arkad pra definir quanto guardar por mês. Aí eu sei quando chega a hora.']);
    });

    it('usuário novo (tudo zerado): sem número, e sugere montar a reserva com o Arkad', () => {
      const p = ate([], {});
      expect(p.atual?.id).toBe('espera');
      expect(falasAtuais(p)).toEqual(['Primeiro a reserva, depois a gente faz o ouro trabalhar.', 'O Arkad te ajuda a montar a sua. Vale conversar com ele.']);
    });

    it('"Me avisa": termina com uma fala, cartão de uma linha e nenhuma missão', () => {
      const fim = responder([['espera', 'avisar']], INCOMPLETA);
      expect(fim.fim).toBe(true);
      expect(caminho(fim)).toEqual(['abertura', 'espera', 'avisar']);
      expect(falasDe(fim, 'avisar')).toEqual(['Pode deixar, Ana. Quando a reserva completar, é a hora do ouro trabalhar.', 'Enquanto isso, cada mês guardado com o Arkad te deixa mais perto.']);
      const res = ROTEIRO_INVESTIR.resultado!(fim.ctx);
      expect(res.linhas).toEqual(['1. Reserva primeiro: faltam 20 meses']);
      expect(res.botao).toBe('Combinado');
      expect(res.agentes).toEqual(['sharru']);
      expect(res.grafico).toBeUndefined();
      const c = ROTEIRO_INVESTIR.concluir!(fim.ctx, 'x');
      expect(c).toEqual({ missoes: [], ativar: ['sharru'] });
    });

    it('"Me avisa" no singular e sem previsão', () => {
      expect(ROTEIRO_INVESTIR.resultado!(responder([['espera', 'avisar']], estado([RESERVA_QUASE])).ctx).linhas).toEqual(['1. Reserva primeiro: falta 1 mês']);
      const novo = responder([['espera', 'avisar']], {});
      expect(falasDe(novo, 'avisar')[1]).toBe('Enquanto isso, o Arkad te ajuda a montar a reserva.');
      expect(ROTEIRO_INVESTIR.resultado!(novo.ctx).linhas).toEqual(['1. Reserva primeiro: converse com o Arkad']);
      expect(ROTEIRO_INVESTIR.concluir!(novo.ctx, 'x').missoes).toEqual([]);
    });

    it('"Quero investir mesmo assim": aviso calmo, segue o caminho normal e a missão anota', () => {
      const fim = responder([['espera', 'forcar'], ...NORMAL], INCOMPLETA);
      expect(fim.fim).toBe(true);
      expect(caminho(fim)).toEqual(['abertura', 'espera', 'aviso', 'custo', 'meta', 'mensal', 'renda', 'resultado']);
      expect(falasDe(fim, 'aviso')).toEqual([
        'Tudo bem, a escolha é sua.',
        'Só um cuidado: sem reserva, um imprevisto pode te fazer vender o investimento numa hora ruim.',
        'Então começamos com calma, e você segue guardando na reserva também.',
      ]);
      // a dica do valor do mês não fala em "os 10% que iam pra reserva"
      expect(falasDe(fim, 'mensal')[0]).toBe('Uma boa base é 10% do que entra: R$ 400. Se apertar, comece com menos.');
      expect(forcou(fim.ctx)).toBe(true);
      expect(liberado(fim.ctx)).toBe(true);

      const res = ROTEIRO_INVESTIR.resultado!(fim.ctx);
      expect(res.titulo).toBe('Seu plano com Sharru Nada');
      expect(res.linhas).toEqual(['1. Em 5 anos: R$ 34.885', '2. Em 10 anos: R$ 81.940', '3. Em 20 anos: R$ 231.020']);
      expect(res.rodape).toBe('Estimativa. Não é recomendação de investimento.');
      expect(res.lista?.[res.lista.length - 1]).toBe('A reserva ainda está completando. Siga guardando nela também.');

      const c = ROTEIRO_INVESTIR.concluir!(fim.ctx, 'x');
      expect(c.ativar).toEqual(['sharru']);
      expect(c.missoes[0]).toMatchObject({ tipo: 'investir', agente: 'sharru', metaValor: 600000, valorMensal: 500, notas: 'Começou antes da reserva completar.' });
    });

    it('a escolha de esperar não aparece quando a reserva já está completa', () => {
      const p = ate([['espera', 'forcar']], COMPLETA);
      expect(p.atual?.id).toBe('custo');
      expect(p.validas).toEqual([]);
      expect(forcou(p.ctx)).toBe(false);
    });
  });

  it('nenhum passo diz mais de 3 balões, e nenhum texto usa palavras proibidas', () => {
    const percursos = [
      responder(NORMAL, COMPLETA),
      responder(NORMAL, estado([RESERVA_CHEIA, INVESTIR])),
      responder([['espera', 'forcar'], ...NORMAL], INCOMPLETA),
      responder([['espera', 'avisar']], INCOMPLETA),
      responder([['espera', 'avisar']], {}),
    ];
    const proibidas = /aporte|despesa|fechar o mês|o combinado|inadimplência/i;
    for (const p of percursos) {
      for (const v of p.visitas) {
        const f = falasDoRoteiro.falas(v.passo, v.ctx);
        expect(f.length).toBeGreaterThan(0);
        expect(f.length).toBeLessThanOrEqual(3);
        for (const s of f) expect(s).not.toMatch(proibidas);
      }
      const res = ROTEIRO_INVESTIR.resultado!(p.ctx);
      expect(res.linhas.length).toBeLessThanOrEqual(3);
      for (const s of [res.titulo, ...res.linhas, ...(res.lista ?? []), res.rodape ?? '', res.botao ?? '']) expect(s).not.toMatch(proibidas);
      for (const m of ROTEIRO_INVESTIR.concluir!(p.ctx, 'x').missoes) for (const s of [m.titulo, m.notas ?? '', ...m.passos.map((x) => x.titulo)]) expect(s).not.toMatch(proibidas);
    }
  });
});
