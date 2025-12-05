/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Wells Onyx Navy Blue System
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
          950: '#0c1f33',
        },
        // Wells Onyx Gold System
        gold: {
          50: '#fefcf3',
          100: '#fef5d9',
          200: '#fde9a8',
          300: '#fcd667',
          400: '#f5c23c',
          500: '#D4A84B',
          600: '#b88f3a',
          700: '#947429',
          800: '#6e5619',
          900: '#4a3a0e',
        },
        // Legacy Grain palette (for backward compatibility)
        grain: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(212, 168, 75, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(212, 168, 75, 0.5), 0 0 60px rgba(212, 168, 75, 0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #D4A84B 0%, #b88f3a 100%)',
        'gradient-gold-light': 'linear-gradient(135deg, #f5c23c 0%, #D4A84B 100%)',
        'gradient-navy': 'linear-gradient(180deg, #102a43 0%, #0c1f33 100%)',
        'gradient-hero': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212, 168, 75, 0.15), transparent)',
      },
      boxShadow: {
        'gold': '0 0 20px rgba(212, 168, 75, 0.3)',
        'gold-lg': '0 0 40px rgba(212, 168, 75, 0.4), 0 0 80px rgba(212, 168, 75, 0.2)',
        'gold-button': '0 8px 24px rgba(212, 168, 75, 0.4)',
      },
    },
  },
  plugins: [],
}
