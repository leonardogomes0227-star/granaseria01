/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ouro Antigo (src/tokens.css)
        papel: { DEFAULT: 'var(--papel)', escuro: 'var(--papel-escuro)' },
        linho: 'var(--linho)',
        tinta: { DEFAULT: 'var(--tinta)', 2: 'var(--tinta-2)', 3: 'var(--tinta-3)' },
        cofre: { 100: 'var(--cofre-100)', 800: 'var(--cofre-800)', 900: 'var(--cofre-900)', 950: 'var(--cofre-950)' },
        ouro: { 300: 'var(--ouro-300)', 500: 'var(--ouro-500)', 700: 'var(--ouro-700)' },
        estado: { emdia: 'var(--em-dia)', atencao: 'var(--atencao)', estourou: 'var(--estourou)' },
        // tokens da spec v2 (src/tokens.css); a paleta antiga abaixo continua
        verde: { 800: 'var(--verde-800)', 900: 'var(--verde-900)' },
        areia: { 50: 'var(--areia-50)', 100: 'var(--areia-100)', 200: 'var(--areia-200)' },
        dourado: { 500: 'var(--dourado-500)', 600: 'var(--dourado-600)' },
        ambar: { 500: 'var(--ambar-500)' },
        vermelho: { 500: 'var(--vermelho-500)' },
        branco: 'var(--branco)',
        sand: {
          DEFAULT: '#F7EFDC',
          50: '#FDFAF1',
          100: '#F7EFDC',
          200: '#EFE3C4',
          300: '#E4D5A8',
        },
        ink: {
          DEFAULT: '#241A0F',
          900: '#1B140C',
          800: '#241A0F',
          700: '#3A2C18',
          600: '#584627',
          500: '#6B5D42',
          400: '#8A7C57',
          300: '#A69572',
          200: '#C9B98C',
          100: '#E4D5B0',
        },
        gold: {
          DEFAULT: '#C9A227',
          light: '#E0BE4A',
          dark: '#A8851D',
          deep: '#7A5311',
          muted: '#8A7220',
        },
        sage: {
          DEFAULT: '#6E9A78',
          light: '#8BB895',
          dark: '#5A8062',
        },
        terracota: {
          DEFAULT: '#C97557',
          light: '#E08E6F',
          dark: '#A85E44',
        },
        lapis: {
          DEFAULT: '#1C4F72',
          light: '#2E6D94',
          dark: '#123A56',
          muted: '#173F5C',
        },
      },
      fontFamily: {
        fraunces: ['Fraunces', 'Georgia', 'serif'], // Ouro Antigo: títulos e números grandes
        inter: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        wizard: '560px',
      },
    },
  },
  plugins: [],
};
