/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#12181B',
          900: '#0C1113',
          800: '#12181B',
          700: '#1A2226',
          600: '#222C31',
          500: '#2B373D',
          400: '#3A474E',
          300: '#5A6A72',
          200: '#8A9BA3',
          100: '#B8C5CB',
        },
        gold: {
          DEFAULT: '#C9A227',
          light: '#E0BE4A',
          dark: '#A8851D',
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
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        wizard: '560px',
      },
    },
  },
  plugins: [],
};
