// Guias: páginas de conteúdo pra quem pesquisa no Google ("como sair do rotativo", "o que fazer com o 13º"...).
// Cada guia responde a dúvida e termina levando pra ferramenta certa.
// Sem imports de componentes: este arquivo também é lido no build (scripts/prerender.mjs)
// pra gerar o HTML estático de cada guia, que é o que o Google indexa.

export interface GuideSection {
  h?: string;
  p?: string[];
  list?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string; // meta description: até ~155 caracteres
  kicker: string;
  sections: GuideSection[];
  cta: { text: string; label: string; tool?: string }; // tool = slug da ferramenta; sem tool → diagnóstico
}

export const GUIDES: Guide[] = [
  {
    slug: 'como-sair-do-rotativo-do-cartao',
    kicker: 'Dívidas',
    title: 'Como sair do rotativo do cartão de crédito',
    description: 'O rotativo é a dívida mais cara do Brasil. Veja por que ela cresce tão rápido, quais são seus direitos e o passo a passo pra sair.',
    sections: [
      {
        p: [
          'Quando você paga menos que o total da fatura, o que ficou pra trás entra no rotativo — e passa a cobrar juros que costumam ficar acima de 10% ao mês. Uma dívida de R$ 2.000 nessa taxa vira mais de R$ 6.000 em um ano se você não fizer nada.',
        ],
      },
      {
        h: 'O que a lei já garante',
        list: [
          'O banco só pode deixar a dívida no rotativo por um mês. Depois disso, tem que oferecer um parcelamento com juros menores (Resolução CMN 4.549/2017).',
          'Juros e encargos do rotativo e do parcelamento da fatura não podem passar de 100% do valor da dívida original (Lei 14.690/2023).',
          'Você pode quitar ou adiantar parcelas a qualquer momento com redução proporcional dos juros (Código de Defesa do Consumidor, art. 52).',
        ],
      },
      {
        h: 'Passo a passo pra sair',
        list: [
          'Pare de usar o cartão enquanto estiver no rotativo: cada compra nova entra na mesma bola de neve.',
          'Descubra o valor exato da dívida e a taxa de juros no app do banco ou na fatura.',
          'Compare com um empréstimo pessoal ou consignado: se a taxa for bem menor, trocar a dívida cara pela barata economiza muito.',
          'Peça uma proposta de renegociação por escrito, com o Custo Efetivo Total (CET), e desconto pra pagamento à vista se você tiver algum dinheiro guardado ou o 13º chegando.',
          'Monte um plano: quanto vai pagar por mês e em que mês a dívida acaba. Sem data, a dívida não sai do lugar.',
        ],
      },
      {
        h: 'Cuidado com golpes',
        p: ['Ninguém sério cobra taxa antecipada pra "limpar seu nome" ou liberar empréstimo. Negocie só pelos canais oficiais do banco, pelo Serasa Limpa Nome ou pelo consumidor.gov.br.'],
      },
    ],
    cta: {
      text: 'O diagnóstico grátis monta seu plano de saída: quanto pagar em cada dívida, em que mês você fica livre e uma mensagem pronta pra renegociar.',
      label: 'Montar meu plano de saída',
    },
  },
  {
    slug: 'portabilidade-de-credito',
    kicker: 'Seus direitos',
    title: 'Portabilidade de crédito: como levar sua dívida pra um banco mais barato',
    description: 'Você pode transferir empréstimo, consignado ou financiamento pra outro banco com juros menores. Veja como funciona e como pedir.',
    sections: [
      {
        p: [
          'Portabilidade de crédito é levar uma dívida que você já tem pra outra instituição que cobre menos juros. O novo banco quita a dívida no banco antigo e você passa a pagar a ele, com parcelas menores ou prazo mais curto.',
          'É um direito garantido pela Resolução CMN 4.292/2013: o banco atual não pode impedir. O máximo que ele pode fazer é uma contraproposta pra você ficar — o que também é bom pra você.',
        ],
      },
      {
        h: 'O que pode ser transferido',
        list: ['Empréstimo pessoal', 'Crédito consignado', 'Financiamento de veículo', 'Financiamento imobiliário'],
      },
      {
        h: 'Como pedir',
        list: [
          'Pegue no banco atual o saldo devedor e o número do contrato.',
          'Peça propostas em outros bancos e compare o Custo Efetivo Total (CET), não só a taxa de juros.',
          'Escolha a melhor e peça a portabilidade ao novo banco — ele resolve o resto com o banco antigo.',
          'Antes de assinar, confira se o prazo e o valor total pago fazem sentido pra você.',
        ],
      },
      {
        h: 'Vale a pena?',
        p: ['Na maioria das vezes, sim — principalmente se você contratou quando os juros estavam altos ou se seu score melhorou. Uma diferença de 1 ponto na taxa mensal muda bastante o total de um empréstimo longo.'],
      },
    ],
    cta: {
      text: 'Veja todos os seus direitos com o banco, com a mensagem pronta pra pedir cada um.',
      label: 'Ver meus direitos',
      tool: 'seus-direitos',
    },
  },
  {
    slug: 'o-que-fazer-com-o-13-salario',
    kicker: '13º salário',
    title: 'O que fazer com o 13º salário: a ordem que mais rende',
    description: 'Quitar dívida, montar reserva ou investir? Veja a ordem certa pra usar o 13º e quanto ele adianta seus planos.',
    sections: [
      {
        p: [
          'O 13º vem em duas parcelas: a primeira até 30 de novembro e a segunda, já com os descontos de INSS e Imposto de Renda, até 20 de dezembro. É o maior dinheiro extra do ano pra muita gente — e some rápido sem um plano.',
        ],
      },
      {
        h: 'A ordem que mais rende',
        list: [
          'Dívidas caras primeiro: cartão de crédito, cheque especial e empréstimo pessoal cobram de 5% a 15% ao mês. Nenhum investimento rende isso — quitar é o melhor retorno que existe.',
          'Depois, a reserva de emergência: até ter uns 6 meses dos seus gastos guardados num lugar com resgate no mesmo dia (CDB de liquidez diária ou Tesouro Selic).',
          'Depois, dívidas baratas: financiamento e consignado. Amortizar antes reduz os juros — e é seu direito pedir o desconto.',
          'Por último, investir pensando no longo prazo.',
        ],
      },
      {
        h: 'O que evitar',
        list: [
          'Comprometer o 13º com compras parceladas novas: o dinheiro acaba em dezembro, as parcelas continuam até o meio do ano.',
          'Deixar parado na conta corrente ou na poupança, que rendem menos que as alternativas seguras.',
        ],
      },
    ],
    cta: {
      text: 'Diga quanto vai receber e veja onde colocar cada real — e quantos meses antes você sai das dívidas.',
      label: 'Simular meu 13º',
      tool: 'decimo-terceiro',
    },
  },
  {
    slug: 'reserva-de-emergencia',
    kicker: 'Reserva',
    title: 'Reserva de emergência: quanto guardar e onde deixar',
    description: 'Quanto você precisa ter guardado pra imprevistos, onde deixar esse dinheiro e como montar a reserva mesmo ganhando pouco.',
    sections: [
      {
        p: [
          'A reserva de emergência é o dinheiro que segura as pontas quando algo dá errado: perda de emprego, problema de saúde, carro quebrado. Sem ela, qualquer imprevisto vira dívida no cartão.',
        ],
      },
      {
        h: 'Quanto guardar',
        p: [
          'A referência mais usada é 6 meses dos seus gastos mensais. Quem tem renda instável (autônomo, comissão) pode mirar mais. Se 6 meses parece impossível agora, comece com a meta de 1 mês — já evita muita dívida.',
        ],
      },
      {
        h: 'Onde deixar',
        list: [
          'CDB de liquidez diária que pague 100% do CDI ou mais, de um banco coberto pelo FGC.',
          'Tesouro Selic, pelo app do seu banco ou corretora.',
          'Evite deixar na conta corrente (não rende) ou em investimentos que você não pode resgatar no mesmo dia.',
        ],
      },
      {
        h: 'Como montar ganhando pouco',
        list: [
          'Separe o valor no dia em que o salário cai, antes de qualquer gasto — o "pague-se primeiro" do livro O Homem Mais Rico da Babilônia.',
          'Programe uma transferência automática, mesmo que pequena.',
          'Corte um vazamento (assinatura esquecida, tarifa do banco) e mande esse valor direto pra reserva.',
        ],
      },
    ],
    cta: {
      text: 'O diagnóstico calcula sua meta de reserva e em que mês você chega lá.',
      label: 'Calcular minha reserva',
    },
  },
  {
    slug: 'como-cancelar-tarifa-bancaria',
    kicker: 'Vazamentos',
    title: 'Como parar de pagar tarifa do banco',
    description: 'Todo banco tem que oferecer serviços essenciais de graça. Veja o que está incluído e a mensagem pronta pra cancelar o pacote.',
    sections: [
      {
        p: [
          'Muita gente paga todo mês um "pacote de serviços" sem saber. Mas a Resolução CMN 3.919/2010 obriga os bancos a oferecer os serviços essenciais da conta de graça — e o Pix é gratuito pra pessoa física.',
        ],
      },
      {
        h: 'O que costuma estar entre os serviços essenciais gratuitos',
        list: [
          'Cartão de débito',
          'Alguns saques e transferências por mês',
          'Extratos e consultas pela internet',
          'Pix para pessoas físicas',
        ],
      },
      {
        h: 'Como cancelar',
        list: [
          'Procure no extrato por "tarifa", "cesta" ou "pacote de serviços".',
          'Peça pelo app, chat ou na agência a troca do pacote pelos serviços essenciais gratuitos, e anote o protocolo.',
          'Se o banco se recusar, reclame no consumidor.gov.br ou no Banco Central.',
          'Outra opção: levar a conta pra um banco digital sem tarifa.',
        ],
      },
    ],
    cta: {
      text: 'O caça-vazamentos tem a mensagem pronta pra cancelar a tarifa — e mais 7 vazamentos comuns pra conferir.',
      label: 'Caçar meus vazamentos',
      tool: 'caca-vazamentos',
    },
  },
  {
    slug: 'lei-do-superendividamento',
    kicker: 'Seus direitos',
    title: 'Lei do Superendividamento: como renegociar todas as dívidas de uma vez',
    description: 'Quando as dívidas não cabem mais na renda, a lei permite renegociar com todos os credores juntos. Veja quem pode usar e como pedir.',
    sections: [
      {
        p: [
          'A Lei 14.181/2021, conhecida como Lei do Superendividamento, criou um caminho pra quem não consegue mais pagar as dívidas sem comprometer o básico: aluguel, comida, contas.',
        ],
      },
      {
        h: 'Como funciona',
        list: [
          'Você pede uma conciliação com todos os credores ao mesmo tempo, pelo Procon da sua cidade ou pela Justiça.',
          'É montado um plano de pagamento de até 5 anos.',
          'O plano tem que preservar o mínimo pras suas despesas básicas (o "mínimo existencial").',
        ],
      },
      {
        h: 'Quem pode usar',
        p: [
          'Pessoas físicas de boa-fé com dívidas de consumo (cartão, empréstimos, crediário, contas) que não conseguem pagar sem comprometer o sustento. Algumas dívidas, como financiamento imobiliário e crédito rural, ficam de fora.',
        ],
      },
      {
        h: 'Antes de chegar lá',
        p: ['Organize a lista de todas as dívidas, com valor, juros e parcela. Isso ajuda tanto na conciliação quanto numa renegociação direta com cada credor.'],
      },
    ],
    cta: {
      text: 'O diagnóstico grátis organiza todas as suas dívidas e mostra se o que você paga hoje cobre os juros.',
      label: 'Organizar minhas dívidas',
    },
  },
  {
    slug: 'avalanche-ou-bola-de-neve',
    kicker: 'Dívidas',
    title: 'Avalanche ou bola de neve: qual dívida pagar primeiro?',
    description: 'Duas estratégias pra quitar várias dívidas: pagar primeiro a de maior juros ou a de menor saldo. Veja qual economiza mais.',
    sections: [
      {
        p: [
          'Quando você tem mais de uma dívida, a pergunta é sempre a mesma: com o dinheiro que sobra, qual eu ataco primeiro? Nas duas estratégias você paga o mínimo de todas e coloca o resto numa só.',
        ],
      },
      {
        h: 'Avalanche: maior juros primeiro',
        p: ['Você ataca a dívida que cobra a maior taxa (geralmente o cartão ou o cheque especial). É a que economiza mais dinheiro em juros no total — matematicamente, é sempre a melhor.'],
      },
      {
        h: 'Bola de neve: menor saldo primeiro',
        p: ['Você ataca a dívida menor, quita rápido e usa o valor que sobrou na próxima. Custa um pouco mais em juros, mas a sensação de progresso ajuda muita gente a não desistir.'],
      },
      {
        h: 'Qual escolher',
        p: ['Se a diferença de juros entre as dívidas é grande (cartão a 14% e financiamento a 1,5%), vá de avalanche. Se as taxas são parecidas e você precisa de motivação, a bola de neve funciona.'],
      },
    ],
    cta: {
      text: 'O plano de ação da Grana Séria usa a avalanche e mostra o mês em que cada dívida acaba.',
      label: 'Ver minha ordem de ataque',
    },
  },
  {
    slug: 'pague-se-primeiro',
    kicker: 'Princípios',
    title: 'Pague-se primeiro: a regra dos 10% do Homem Mais Rico da Babilônia',
    description: 'A primeira lei do livro O Homem Mais Rico da Babilônia: guardar pelo menos 10% de tudo que você ganha, antes de qualquer gasto.',
    sections: [
      {
        p: [
          'No livro O Homem Mais Rico da Babilônia, a primeira lei do dinheiro é simples: de cada dez moedas que entram, pelo menos uma fica com você. Não o que sobra no fim do mês — o que você separa primeiro.',
        ],
      },
      {
        h: 'Por que primeiro',
        p: ['Quem guarda o que sobra quase nunca guarda nada: os gastos crescem até ocupar todo o dinheiro. Separando no dia do pagamento, você ajusta os gastos ao que ficou — e não o contrário.'],
      },
      {
        h: 'Como aplicar hoje',
        list: [
          'Programe uma transferência automática de 10% da renda pro dia em que o salário cai.',
          'Se 10% é impossível agora, comece com 3% ou 5% e suba um pouco a cada mês.',
          'Com dívida cara, esses 10% vão primeiro pra quitar a dívida — é a forma mais rápida de fazer o dinheiro trabalhar pra você.',
        ],
      },
    ],
    cta: {
      text: 'Descubra quanto da sua renda você já guarda e qual é o próximo passo, em 10 minutos.',
      label: 'Fazer meu diagnóstico grátis',
    },
  },
];

export function getGuide(slug: string | undefined): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
