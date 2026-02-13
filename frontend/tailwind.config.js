/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cream': '#FAF7F2',
        'coral': '#D4A088',
        'coral-dark': '#C18F75',
        'brown': {
          'dark': '#3D2F2A',
          'medium': '#6B5D58',
          'light': '#9B8B85',
        }
      },
      fontFamily: {
        'heading': ['Cormorant Garamond', 'serif'],
        'body': ['Montserrat', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
