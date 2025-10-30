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
        'wells-blue': '#183b6d',
        'wells-black': '#000000',
        'wells-gray-dark': '#575757',
        'wells-gray-light': '#9ea1a7',
        'wells-gold': '#dba63f',
      },
    },
  },
  plugins: [],
}
