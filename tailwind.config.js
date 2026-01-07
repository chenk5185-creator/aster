/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ASTER-like dark theme colors
        background: '#0d0d0f',
        surface: '#16161a',
        'surface-light': '#1e1e24',
        border: '#2a2a32',
        primary: '#00d4aa',
        'primary-hover': '#00e6bb',
        secondary: '#7b61ff',
        success: '#00d4aa',
        error: '#ff4757',
        warning: '#ffa502',
        'text-primary': '#ffffff',
        'text-secondary': '#9ca3af',
        'text-muted': '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
