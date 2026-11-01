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
        divider: 'hsl(var(--divider))',
        dialogBorder: 'hsl(var(--dialog-border))',
        pressed: 'hsl(var(--pressed))'
      },
      // Voxt 圆角刻度（定值见 global.css 三级区）：面板/对话框 16 / 卡片 12 / 控件 10 / 小件 8,6,4
      borderRadius: {
        xs: 'var(--radius-xs)',
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
      /*
       * 字族：显式声明中文字族，否则 Windows 下中文落到宋体，与 UI 明显割裂。
       * 等宽用于路径/命令/日志/配置/端口/版本号/ID。
       */
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      /*
       * 字号刻度：每档都带行高（定值见 global.css 三级区）。
       * 禁止在业务代码里写 text-[10px] 这类任意值——它只设 font-size，
       * 行高会继承父级，导致纵向节奏错乱。缺档就补 token。
       */
      fontSize: {
        '3xs': ['var(--text-3xs)', 'var(--lh-3xs)'],
        '2xs': ['var(--text-2xs)', 'var(--lh-2xs)'],
        xs: ['var(--text-xs)', 'var(--lh-xs)'],
        sm: ['var(--text-sm)', 'var(--lh-sm)'],
        md: ['var(--text-md)', 'var(--lh-md)'],
        base: ['var(--text-base)', 'var(--lh-base)'],
        lg: ['var(--text-lg)', 'var(--lh-lg)'],
        xl: ['var(--text-xl)', 'var(--lh-xl)'],
        '2xl': ['var(--text-2xl)', 'var(--lh-2xl)'],
        '3xl': ['var(--text-3xl)', 'var(--lh-3xl)']
      },
      // 动效时长四档：100 按下 / 150 悬停焦点 / 250 浮层与面板 / 400 大范围布局
      transitionDuration: {
        250: '250ms',
        400: 'var(--dur-4)'
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)'
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
