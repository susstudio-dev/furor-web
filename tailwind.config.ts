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
          300: 'rgb(var(--c-ember-300) / <alpha-value>)',
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
        // Fixed foreground for ember surfaces — does not flip with the theme,
        // because ember doesn't either.
        'on-ember': 'rgb(var(--c-on-ember) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // marquee / fade-up / kenburns intentionally live in globals.css instead:
      // their durations derive from the --beat/--bar tempo engine, and they are
      // declared inside the prefers-reduced-motion gate so they cannot ship
      // unguarded. Tailwind can't express either.
    },
  },
  plugins: [],
};
export default config;
