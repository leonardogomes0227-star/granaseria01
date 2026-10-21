# Direção de design "Ouro Antigo" (resumo de trabalho)

Resumo do documento de design enviado pelo dono, pra quem for mexer nas telas. Só muda a aparência: nenhuma
função, rota, dado ou texto funcional sai. Vale só dentro do app (`html.ouro`, ver `src/lib/visual.ts`); a landing,
os guias, os termos, a privacidade, o diagnóstico e o admin ficam como estão.

**Conceito:** um banco privado suíço que guarda os segredos da Babilônia. Papel de algodão, verde cofre, ouro como
joia (pouco, só no que é conquista ou marca), tipografia de cédula. Calmo, caro, nunca berrante.

## 1. Tokens (num lugar só: `src/tokens.css`)

- Base: `--papel` (fundo), `--papel-escuro` (trilhas, fundos de chip), `--linho` (cards), `--tinta`, `--tinta-2`,
  `--tinta-3`, `--fio`, `--fio-forte` (bordas).
- Verde cofre: `--cofre-950/900/800/100`, `--fundo-cofre` (gradiente do card principal), `--sombra-cofre`.
- Ouro: `--ouro-300/500/700`, `--ouro-foil` (folheado, só conquistas e logo), `--filete-ouro` (filete fino).
- Estados: `--em-dia`, `--atencao` (+ `--atencao-texto` pra texto), `--estourou` (tijolo, nunca vermelho alarme).
- Cor de assinatura de cada agente: `--ag-arkad`, `--ag-dabasir`, `--ag-nomasir`, `--ag-sharru`, `--ag-bansir`,
  `--ag-mathon`, `--ag-rodan`. Use `var(--ag-${id}, var(--cofre-800))`.
- Material: `--sombra-linho`, `--raio-cofre` (28px), `--raio-botao` (16px), raio de card 20–22px.
- Movimento: `--curva` (cubic-bezier(0.22, 1, 0.36, 1)).
- Nunca cor solta no componente: sempre token.

## 2. Tipografia

- Display: Fraunces (`--fonte-display`), com `font-variation-settings: 'SOFT' 50, 'WONK' 0`. Títulos de página 32/38,
  de bloco 22/28, números grandes 64 (card principal) e 40 (destaques), valores de input 28–56.
- Interface: Inter (`--fonte-ui`). Corpo 15, legendas 13, rótulos 11.
- Rótulo de seção ("sobrelinha"): classe `sobrelinha` — 11px, 600, `letter-spacing: .12em`, maiúsculas, `--tinta-3`
  (ou `--ouro-700` em lugar nobre). Não use a classe `overline` (é utilitário do Tailwind e risca o texto).
- Valores em estilo cédula: `<Valor valor={n} />` (`src/components/ui/Valor.tsx`): "R$" pequeno no alto, centavos
  menores. Números de interface com `font-variant-numeric: tabular-nums`.
- Frases dos agentes: Fraunces itálico, com o nome do agente pequeno depois ("— Arkad").

## 3. Textura e ornamento

- Grão de papel no fundo (já aplicado no `body::after`).
- Guilhochê de cédula: `<Guilloche />` (`src/components/ui/Guilloche.tsx`), só em fundo cofre, bem sutil.
- Filete dourado interno nos cards cofre (borda 1px `--filete-ouro` a 6px da borda).
- Divisor ornamentado: `<Ornamento />` (fio + losango dourado), só em lugares nobres (resultado, dica, selo).
- Ícones: lucide-react, traço fino (1.75–1.9).

## 4. Componentes

- **Card cofre** (6.1): fundo `--fundo-cofre`, `--sombra-cofre`, raio 28, filete, guilhochê; texto linho; rótulo em
  ouro-300. É o card do "Quanto posso gastar hoje" (`src/components/HomePage.tsx`, classe `home-hero cofre`).
- **Card linho** (6.2): fundo `--linho`, borda `--fio`, `--sombra-linho`, raio 20–22.
- **Medalhão do agente** (5): `<Medalhao id nome tamanho sepia />` (`src/components/ui/Medalhao.tsx`): retrato no
  círculo, anel duplo de ouro, fundo na cor do agente; `sepia` pra agente ainda não ativado.
- **Missão de hoje** (6.4): faixa de 4px na cor do agente à esquerda, medalhão, título em Fraunces, frase em itálico,
  ação direta; ao concluir o cartão gira (verso cofre com "Feito.").
- **Chat** (6.5): cabeçalho translúcido com blur, medalhão + nome + ponto verde "online"; bolha do agente em linho
  com borda fio e canto inferior-esquerdo 6px; bolha da pessoa em verde cofre com texto linho e canto
  inferior-direito 6px; "digitando" com três pontos dourados; bolhas entram com mola (framer-motion: y 8→0, opacidade);
  campo de dinheiro grande em Fraunces 28; chips de resposta em linho com borda fina dourada (ouro-300) — ao tocar,
  o chip "voa" pro lugar da bolha da pessoa (`layoutId`); cartão de resultado = card cofre com ornamento, linhas
  numeradas em algarismos romanos (I., II., III.) em Fraunces dourado, pilha de medalhões dos agentes envolvidos e
  botão linho sólido (fundo linho, texto cofre).
- **Missões** (6.6): anel de 96px com `conic-gradient` (trilha papel-escuro, valor cofre; a 100% vira ouro folheado),
  chips de status ("Em dia" verde suave, "R$ X atrás" âmbar), trilha de passos pontilhada na vertical com check
  desenhado (traço animado), dica em itálico com ornamento.
- **Anotar** (6.7): folha que sobe de baixo (alça, arrastar pra fechar; no PC, janela central de ~440px); valor em
  Fraunces 56 centralizado; teclado numérico 3x4 com teclas grandes (≥ 56px) em linho; pílula Saída/Entrada;
  chips de categoria com ícone (rolagem horizontal) com detecção pela descrição; data (Hoje / Ontem / escolher);
  "Isso foi pra minha reserva" liga à missão; salvar = botão primário largo; depois de salvar, o saldo conta até o
  valor novo e aparece o toast com Desfazer.
- **Cartões dos agentes** (6.8): cartão alto 3:4 no fundo da cor do agente (gradiente escuro), marca d'água grande
  (inicial em Fraunces, ~8% de opacidade), medalhão de 88px saindo pra fora do topo do cartão, inclinação 3D sutil ao
  passar o mouse / inclinar o celular (no máximo 6°, nunca com movimento reduzido), disponíveis em sépia.
- **Navegação** (6.9): feito (header translúcido com a moeda; barra flutuante no celular com "+ Anotar" no meio).
- **Botões** (6.10) e **toasts** (6.11): feitos (`src/ouro.css`). `.btn-ouro` só pra conquista.
- **Selos** (6.12): moeda serrilhada em SVG (borda dentada), ouro folheado quando conquistada, estanho (cinza frio)
  com cadeado quando bloqueada; página `/selos` em fundo cofre; selo novo = a moeda cai e gira em 3D (three.js
  carregado só quando precisa, com alternativa em CSS `rotateY`); compartilhar = imagem 1080x1920 (canvas) com fundo
  cofre, a moeda grande, nome, princípio, data e a marca Grana Séria.
- **Celebração de missão** (6.13): tela cheia cofre, confete dourado (`src/lib/celebrar.ts`), medalhão grande do
  agente, frase, selo ganho, [Compartilhar] [Próxima missão].

## 5. Movimento

Entrada de página: fade + 8px de subida, 200ms. Listas: stagger 40ms. Valores: count-up 600ms. Folhas com arrasto
pra fechar. Mola leve nos toques (scale .97). Tudo respeita `prefers-reduced-motion` (sem giro, sem parallax, sem
confete; troca direta).

## 6. Layout

Coluna do app de até ~780px (desktop centralizado), margens 16px no celular. Conferir em 375, 390, 768, 1280 e 1440.
Alvos de toque ≥ 44px. Nada estoura com R$ 1.000.000 nem com R$ 0,50.

## 7. Detalhes que fazem parecer caro (9)

Seleção de texto dourada, foco visível em ouro-300, barra de rolagem fina (feitos). Favicon e ícone do app = a moeda
(`src/components/ui/Moeda.tsx`); imagem de compartilhamento (og) com a moeda no cofre; carregando = moeda girando
(só se demorar mais de 300ms, no máximo 600ms de animação); página 404 com o Arkad; skeleton com brilho de linho;
estados vazios com medalhão + frase + botão; tema escuro (`html[data-tema='escuro']`, tokens já prontos) ligado no
Perfil; vibração leve ao concluir.
