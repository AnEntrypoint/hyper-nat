/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,html}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('rippleui'),
  ],
};
