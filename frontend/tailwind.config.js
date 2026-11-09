/** @type {import('tailwindcss').Config} */
// Tokens from docs/DESIGN.md section 4. Every screen uses these and nothing else.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sovra
        canvas: { DEFAULT: '#141415', deep: '#0f0f10' },
        card: '#19191b',
        raised: { DEFAULT: '#232325', hover: '#2a2a2d' },
        line: { DEFAULT: 'rgb(237 237 237 / 0.08)', strong: 'rgb(237 237 237 / 0.14)' },
        fg: { DEFAULT: '#ededed', 2: '#a1a1a6', 3: '#85858b' },
        brass: { DEFAULT: '#c9a86a', light: '#dcc28c', deep: '#8a6a2f', ink: '#141415' },
        positive: '#4cc38a',
        negative: '#e5484d',
        frozen: '#8b95a1',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      fontSize: {
        meta: ['12px', '16px'],
        caption: ['13px', '20px'],
        body: ['14px', '20px'],
        title: ['16px', '24px'],
        figure: ['28px', '32px'],
        page: ['36px', '40px'],
        hero: ['64px', { lineHeight: '64px', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        control: '8px',
        card: '14px',
        panel: '18px',
        slip: '16px',
      },
      transitionTimingFunction: {
        vault: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        hover: '140ms',
        menu: '180ms',
        sheet: '360ms',
      },
      boxShadow: {
        lift: '0 24px 48px rgba(0, 0, 0, 0.35)',
        'row-active': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        'button-top': 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-in': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        'drawer-in': { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        rise: 'rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'sheet-in': 'sheet-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'drawer-in': 'drawer-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
