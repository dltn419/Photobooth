/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Gugi', 'system-ui', 'sans-serif'],
        display: ['Black Han Sans', 'sans-serif'],
        body: ['Gowun Dodum', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff5f7',
          100: '#ffe3e9',
          200: '#ffc1d0',
          300: '#ff98b3',
          400: '#ff6b94',
          500: '#ff407a',
          600: '#e02060',
          700: '#b8124a',
          800: '#910f3c',
          900: '#6b0a2c',
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        flash: {
          '0%': { opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.4s ease-out',
        scaleIn: 'scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        flash: 'flash 0.5s ease-out',
        pop: 'pop 0.3s ease-out',
        slideUp: 'slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        shake: 'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
};
