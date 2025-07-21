/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  variants: {
    extend: {
      backgroundColor: ['print'],
      textColor: ['print'],
      borderColor: ['print'],
      margin: ['print'],
      padding: ['print'],
      width: ['print'],
      maxWidth: ['print'],
      fontSize: ['print'],
      display: ['print'],
      gap: ['print'],
    },
  },
} 