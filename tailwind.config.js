/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace']
      },
      colors: {
        brand: {
          orange: '#DB6433',
          'orange-dark': '#B84F23',
          'orange-light': '#FCEFE6',
          navy: '#1E1B5C',
          'navy-dark': '#13104A'
        }
      }
    }
  },
  plugins: []
};
