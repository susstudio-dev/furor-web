import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme. `ink` = surfaces (950 = page bg, lower = deeper cards/borders).
        // `cream` = foreground text (warm near-black). Inverted so the existing
        // bg-ink-* / text-cream / border-cream utilities render light.
        ink: {
          950: '#fbf7f1',
          900: '#f3ebdf',
          800: '#ece1d0',
          700: '#e0d1bb',
          500: '#cab597',
        },
        ember: {
          400: '#d4551c',
          500: '#ff8a4c',
          600: '#e1591f',
          700: '#b8430f',
        },
        gold: {
          400: '#c98a16',
          500: '#a7770f',
        },
        cream: '#241a12',
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
          '0%': { transform: 'scale(1) translate(0,0)' },
          '100%': { transform: 'scale(1.08) translate(-1%, -1%)' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
        kenburns: 'kenburns 18s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
export default config;
