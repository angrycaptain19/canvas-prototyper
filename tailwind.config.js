/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // tokens read from CSS variables defined in styles.css / themeStore
        bg: 'rgb(var(--ui-bg) / <alpha-value>)',
        surface: 'rgb(var(--ui-surface) / <alpha-value>)',
        fg: 'rgb(var(--ui-fg) / <alpha-value>)',
        muted: 'rgb(var(--ui-muted) / <alpha-value>)',
        border: 'rgb(var(--ui-border) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--ui-brand) / <alpha-value>)',
          fg: 'rgb(var(--ui-brand-fg) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--ui-success) / <alpha-value>)',
          fg: 'rgb(var(--ui-success-fg) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--ui-warning) / <alpha-value>)',
          fg: 'rgb(var(--ui-warning-fg) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--ui-danger) / <alpha-value>)',
          fg: 'rgb(var(--ui-danger-fg) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--ui-info) / <alpha-value>)',
          fg: 'rgb(var(--ui-info-fg) / <alpha-value>)',
        },
      },
      borderRadius: {
        token: 'var(--ui-radius)',
        'token-sm': 'var(--ui-radius-sm)',
        'token-lg': 'var(--ui-radius-lg)',
      },
      fontFamily: {
        sans: 'var(--ui-font-sans)',
      },
    },
  },
  plugins: [],
}
