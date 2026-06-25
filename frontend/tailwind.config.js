/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enables class-based dark mode toggling
  theme: {
    extend: {
      colors: {
        brand: {
          navy: {
            DEFAULT: '#0B1B3D',
            light: '#1F2E54',
            dark: '#060F24',
          },
          gold: {
            DEFAULT: '#C5A880',
            light: '#DCC39E',
            dark: '#AA8C60',
            metallic: '#D4AF37',
          },
          matte: {
            DEFAULT: '#121212',
            card: '#1C1C1E',
            border: '#2C2C2E',
            text: '#8E8E93',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
