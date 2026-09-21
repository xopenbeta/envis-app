/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        content1: {
          DEFAULT: 'hsl(var(--content1))',
          foreground: 'hsl(var(--content1-foreground))'
        },
        content2: {
          DEFAULT: 'hsl(var(--content2))',
          foreground: 'hsl(var(--content2-foreground))'
        },
        content3: {
          DEFAULT: 'hsl(var(--content3))',
          foreground: 'hsl(var(--content3-foreground))'
        },
        content4: {
          DEFAULT: 'hsl(var(--content4))',
          foreground: 'hsl(var(--content4-foreground))'
        },
        default: {
          DEFAULT: 'hsl(var(--default))',
          foreground: 'hsl(var(--default-foreground))'
        },
        muted: {
          foreground: 'hsl(var(--muted-foreground))'
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))'
        },
        focus: 'hsl(var(--focus))',
        overlay: 'hsl(var(--overlay))',
        divider: 'hsl(var(--divider))'
      },
      // Voxt 圆角刻度（定值见 global.css 三级区）：面板/对话框 16 / 卡片 12 / 控件 10 / 小件 8,6
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)'
      },
      // 全应用唯一阴影，仅用于真正浮出的层（菜单/弹层/对话框/提示条），页面内表面一律无阴影
      boxShadow: {
        pop: 'var(--shadow-pop)'
      },
      backdropBlur: {
        pop: '20px'
      },
      // macOS 原生基准字号
      fontSize: {
        sm: ['13px', '20px']
      },
      transitionDuration: {
        250: '250ms'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
