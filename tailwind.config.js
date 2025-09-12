/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'dpe-green': '#00A859',
        'dpe-yellow': '#FFC107',
        'dpe-orange': '#FF9800',
        'dpe-red': '#F44336',
        'france-blue': '#0055A4',
        'france-red': '#EF4135'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        triangulate: 'triangulate 2s ease-in-out infinite',
        scan: 'scan 1.5s ease-in-out infinite',
        'pulse-green': 'pulse-green 1s ease-in-out infinite',
        typing: 'typing 1.5s steps(40, end) infinite'
      },
      keyframes: {
        triangulate: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.7' }
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400px)' }
        },
        'pulse-green': {
          '0%, 100%': { backgroundColor: '#10B981', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' },
          '50%': { backgroundColor: '#059669', boxShadow: '0 0 0 10px rgba(16, 185, 129, 0)' }
        },
        typing: {
          '0%': { width: '0' },
          '100%': { width: '100%' }
        }
      }
    }
  },
  plugins: []
}
