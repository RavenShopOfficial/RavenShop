/** @type {import('tailwindcss').Config} */
// Moved verbatim out of the inline `tailwind.config` script that used to sit in
// index.html when the page loaded cdn.tailwindcss.com. Version 3.4.17 is pinned
// in package.json because that is exactly what the Play CDN was serving, so the
// generated CSS matches what the browser used to build at runtime.
module.exports = {
  content: ['./index.html', './assets/app.js'],
  // These land in the DOM from JS (search highlighting), so pin them explicitly
  // instead of relying on the content scanner finding them inside a string.
  safelist: [
    'search-highlight',
    'bg-gaming-neon/60',
    'shadow-[0_0_8px_rgba(0,255,85,0.5)]',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      colors: {
        gaming: {
          dark: '#030504',
          card: '#0a0d0a',
          neon: '#00FF55',
          accent: '#00B33C',
          surface: '#111511',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        wave: 'wave 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wave: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
