/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        theme: {
          bg: {
            primary: 'rgb(var(--color-bg-primary) / <alpha-value>)',
            secondary: 'rgb(var(--color-bg-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--color-bg-tertiary) / <alpha-value>)',
            hover: 'rgb(var(--color-bg-hover) / <alpha-value>)',
            active: 'rgb(var(--color-bg-active) / <alpha-value>)',
          },
          text: {
            primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
            secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
            muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          },
          border: {
            primary: 'rgb(var(--color-border-primary) / <alpha-value>)',
            secondary: 'rgb(var(--color-border-secondary) / <alpha-value>)',
            accent: 'rgb(var(--color-border-accent) / <alpha-value>)',
          },
          accent: {
            DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
            hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
            light: 'rgb(var(--color-accent-light) / <alpha-value>)',
          },
          surface: {
            DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
            raised: 'rgb(var(--color-surface-raised) / <alpha-value>)',
            overlay: 'rgb(var(--color-surface-overlay) / <alpha-value>)',
          },
        },
      },
      boxShadow: {
        'theme-sm': 'var(--shadow-sm)',
        'theme-md': 'var(--shadow-md)',
        'theme-lg': 'var(--shadow-lg)',
      },
      borderRadius: {
        'theme-sm': 'var(--radius-sm)',
        'theme-md': 'var(--radius-md)',
        'theme-lg': 'var(--radius-lg)',
        'theme-xl': 'var(--radius-xl)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'rgb(var(--color-text-primary))',
            '--tw-prose-body': 'rgb(var(--color-text-primary))',
            '--tw-prose-headings': 'rgb(var(--color-text-primary))',
            '--tw-prose-lead': 'rgb(var(--color-text-secondary))',
            '--tw-prose-links': 'rgb(var(--color-accent))',
            '--tw-prose-bold': 'rgb(var(--color-text-primary))',
            '--tw-prose-counters': 'rgb(var(--color-text-tertiary))',
            '--tw-prose-bullets': 'rgb(var(--color-text-tertiary))',
            '--tw-prose-hr': 'rgb(var(--color-border-primary))',
            '--tw-prose-quotes': 'rgb(var(--color-text-secondary))',
            '--tw-prose-quote-borders': 'rgb(var(--color-border-accent))',
            '--tw-prose-captions': 'rgb(var(--color-text-tertiary))',
            '--tw-prose-code': 'rgb(var(--color-text-primary))',
            '--tw-prose-pre-code': 'rgb(var(--color-text-primary))',
            '--tw-prose-pre-bg': 'rgb(var(--color-bg-tertiary))',
            '--tw-prose-th-borders': 'rgb(var(--color-border-primary))',
            '--tw-prose-td-borders': 'rgb(var(--color-border-secondary))',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}