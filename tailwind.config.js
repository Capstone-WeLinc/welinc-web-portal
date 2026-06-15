/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0d1240',
          darker: '#0a0e35',
          gold: '#e8b800',
          goldHover: '#d4a600',
          blueAccent: '#1a1f6e',
        }
      }
    },
  },
  plugins: [],
}
