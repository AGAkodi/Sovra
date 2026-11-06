/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B1018',
        surface: {
          raised: '#121B27',
          secondary: '#182433',
          hover: '#1E2C3D',
        },
        border: {
          subtle: '#273446',
          active: '#3B4E68',
        },
        telemetry: {
          cyan: '#4CC9E8',
          cyanDim: '#1B4754',
        },
        caution: {
          amber: '#F2B544',
          amberDim: '#543D16',
        },
        blocked: {
          red: '#EF6464',
          redDim: '#4D1D1D',
        },
        confirmed: {
          green: '#38C98B',
          greenDim: '#134731',
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        panel: '16px',
        control: '8px',
      },
    },
  },
  plugins: [],
};

