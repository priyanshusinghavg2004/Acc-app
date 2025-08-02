/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      minHeight: {
        '44': '44px',
        '120': '120px',
        '140': '140px',
      },
      minWidth: {
        '44': '44px',
      },
    },
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