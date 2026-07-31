/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '475px',
        // Landscape phones and short desktop windows — compress vertical space
        short: { raw: '(max-height: 500px)' },
      },
    },
  },
  plugins: [],
};
