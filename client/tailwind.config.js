/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Paleta militar
      colors: {
        khaki: { DEFAULT: '#c9b37a', light: '#e3d4a6', dark: '#a08c55' },
        olive: { 700: '#4b5320', 800: '#353b17', 900: '#22260f', 950: '#14170a' },
      },
    },
  },
  plugins: [],
};
