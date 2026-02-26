/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        // Apple 设计系统颜色
        'apple-gray': {
          50: '#FAFAFA',
          100: '#F5F5F7',
          200: '#E8E8ED',
          300: '#D2D2D7',
          400: '#B0B0B8',
          500: '#86868B',
          600: '#6E6E73',
          700: '#515154',
          800: '#3A3A3C',
          900: '#1C1C1E',
        },
        'apple-blue': {
          DEFAULT: '#007AFF',
          light: '#5AC8FA',
          dark: '#0A84FF',
          50: '#E5F3FF',
          100: '#CCE7FF',
          500: '#007AFF',
          600: '#0066DB',
          700: '#0055BA',
        },
        'apple-green': {
          DEFAULT: '#34C759',
          light: '#30D158',
          50: '#E8F9ED',
          500: '#34C759',
          600: '#2DB04C',
        },
        'apple-red': {
          DEFAULT: '#FF3B30',
          light: '#FF453A',
          50: '#FFE8E6',
          500: '#FF3B30',
          600: '#E6342A',
        },
        'apple-orange': {
          DEFAULT: '#FF9500',
          50: '#FFF4E5',
          500: '#FF9500',
        },
        'apple-purple': {
          DEFAULT: '#AF52DE',
          50: '#F5EDFC',
          500: '#AF52DE',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Apple 风格圆角
        'apple-sm': '8px',
        'apple-md': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
      },
      boxShadow: {
        // Apple 风格阴影（增强版多层阴影）
        'apple-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'apple-md': '0 2px 8px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'apple-lg': '0 8px 16px 0 rgba(0, 0, 0, 0.08), 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'apple-xl': '0 12px 24px 0 rgba(0, 0, 0, 0.10), 0 4px 8px 0 rgba(0, 0, 0, 0.05)',
        'apple-2xl': '0 20px 40px 0 rgba(0, 0, 0, 0.12), 0 8px 16px 0 rgba(0, 0, 0, 0.06)',
        // 深色模式阴影
        'apple-dark-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.20)',
        'apple-dark-md': '0 2px 8px 0 rgba(0, 0, 0, 0.25)',
        'apple-dark-lg': '0 8px 16px 0 rgba(0, 0, 0, 0.30)',
        'apple-dark-xl': '0 12px 24px 0 rgba(0, 0, 0, 0.35)',
      },
      backdropBlur: {
        'apple': '40px',
        'apple-sm': '20px',
        'apple-lg': '60px',
      },
      backdropSaturate: {
        'apple': '180%',
      },
      animation: {
        'scale-in': 'scale-in 0.2s ease-apple',
        'fade-in': 'fade-in 0.3s ease-apple',
        'slide-up': 'slide-up 0.3s ease-apple',
      },
      keyframes: {
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Apple 字体系统，响应全局缩放
        'apple-xs': ['calc(13px * var(--interface-scale))', { lineHeight: 'calc(18px * var(--interface-scale))', letterSpacing: 'calc(-0.08px * var(--interface-scale))' }],
        'apple-sm': ['calc(14px * var(--interface-scale))', { lineHeight: 'calc(20px * var(--interface-scale))', letterSpacing: 'calc(-0.08px * var(--interface-scale))' }],
        'apple-base': ['calc(15px * var(--interface-scale))', { lineHeight: 'calc(21px * var(--interface-scale))', letterSpacing: 'calc(-0.09px * var(--interface-scale))' }],
        'apple-lg': ['calc(17px * var(--interface-scale))', { lineHeight: 'calc(24px * var(--interface-scale))', letterSpacing: 'calc(-0.41px * var(--interface-scale))' }],
        'apple-xl': ['calc(20px * var(--interface-scale))', { lineHeight: 'calc(28px * var(--interface-scale))', letterSpacing: 'calc(-0.45px * var(--interface-scale))' }],
        'apple-2xl': ['calc(24px * var(--interface-scale))', { lineHeight: 'calc(32px * var(--interface-scale))', letterSpacing: 'calc(-0.50px * var(--interface-scale))' }],
        'apple-3xl': ['calc(32px * var(--interface-scale))', { lineHeight: 'calc(40px * var(--interface-scale))', letterSpacing: 'calc(-0.60px * var(--interface-scale))' }],
        'apple-4xl': ['calc(48px * var(--interface-scale))', { lineHeight: 'calc(56px * var(--interface-scale))', letterSpacing: 'calc(-0.80px * var(--interface-scale))' }],
      },
    }
  },
  plugins: []
}
