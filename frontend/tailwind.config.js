/** @type {import('tailwindcss').Config} */
// Tokens from design.md section 4. New screens use the "Sovra" tokens only.
// The "legacy" names below are aliases mapped onto the new palette so screens
// that have not been rebuilt yet still sit in the same world; remove them once
// every screen is rebuilt.
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

        // Legacy aliases (pre-rebuild screens)
        bg: '#141415',
        surface: { raised: '#19191b', secondary: '#232325', hover: '#2a2a2d' },
        border: { subtle: '#2a2a2c', active: '#3a3a3d' },
        telemetry: { cyan: '#c9a86a', cyanDim: '#3a3122' },
        caution: { amber: '#c9a86a', amberDim: '#3a3122' },
        blocked: { red: '#e5484d', redDim: '#3d1d1f' },
        confirmed: { green: '#4cc38a', greenDim: '#17382a' },
        text: { primary: '#ededed', secondary: '#a1a1a6', muted: '#85858b' },
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
      },
      animation: {
        rise: 'rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'sheet-in': 'sheet-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
