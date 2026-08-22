import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#08090b', card: '#111216', elevated: '#16181e', subtle: '#0d0e12' },
        border: { DEFAULT: '#20222a', subtle: '#181920', hover: '#2e323e' },
        text: { DEFAULT: '#f4f5f8', muted: '#8b8e99', dim: '#575a65' },
        accent: { DEFAULT: '#7c3aed', hover: '#8b5cf6', light: '#a78bfa', glow: 'rgba(124, 58, 237, 0.25)' },
        cyan: { DEFAULT: '#00d2ff', hover: '#38bdf8' },
        success: { DEFAULT: '#10b981', light: '#34d399' },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
export default config;
