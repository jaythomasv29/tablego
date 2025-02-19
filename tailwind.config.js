/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      textColor: {
        DEFAULT: '#000000',
      },
      placeholderColor: {
        DEFAULT: '#000000',
      },
    },
  },
  plugins: [
  ],
}
