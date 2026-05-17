import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens resolve to CSS variables so a single [data-theme] flip on
        // <html> switches the whole site. Values are defined in globals.css
        // for light (:root) and dark (html[data-theme="dark"]).
        // `ink` = surfaces, `cream` = foreground text.
        ink: {
          950: 'rgb(var(--c-ink-950) / <alpha-value>)',
          900: 'rgb(var(--c-ink-900) / <alpha-value>)',
          800: 'rgb(var(--c-ink-800) / <alpha-value>)',
          700: 'rgb(var(--c-ink-700) / <alpha-value>)',
          500: 'rgb(var(--c-ink-500) / <alpha-value>)',
        },
        ember: {
          400: 'rgb(var(--c-ember-400) / <alpha-value>)',
          500: 'rgb(var(--c-ember-500) / <alpha-value>)',
          600: 'rgb(var(--c-ember-600) / <alpha-value>)',
          700: 'rgb(var(--c-ember-700) / <alpha-value>)',
        },
        gold: {
          400: 'rgb(var(--c-gold-400) / <alpha-value>)',
          500: 'rgb(var(--c-gold-500) / <alpha-value>)',
        },
        cream: 'rgb(var(--c-cream) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'kenburns': {
          '0%': { transform: 'scale(1.02) translate(0,0)' },
          '100%': { transform: 'scale(1.12) translate(-2%, -1.5%)' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
        kenburns: 'kenburns 30s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
export default config;
