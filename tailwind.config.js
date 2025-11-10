/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        'wells-blue': '#183b6d',
        'wells-black': '#000000',
        'wells-gray-dark': '#575757',
        'wells-gray-light': '#9ea1a7',
        'wells-gold': '#dba63f',
        // Status colors (aligned with brand palette)
        'wells-success': '#2d5f3f',
        'wells-error': '#8b3a3a',
        'wells-warning': '#dba63f',
        'wells-info': '#183b6d',
        // Neutral scale
        'wells-neutral': {
          50: '#fafbfc',
          100: '#f5f5f0',
          200: '#e5e7eb',
          400: '#9ea1a7',
          600: '#575757',
          900: '#000000',
        },
      },
    },
  },
  plugins: [],
}
