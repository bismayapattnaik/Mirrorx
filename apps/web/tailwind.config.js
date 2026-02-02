/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // MirrorX Dark Theme - Green Accent
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // Primary - Emerald Green
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },

        // Secondary - Deep Surface
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },

        // Accent - Brand Green
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        // Brand Green Palette
        brand: {
          DEFAULT: '#22c55e',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          muted: '#16a34a',
        },

        // Dark Background
        dark: {
          DEFAULT: '#050505',
          50: '#f5f5f5',
          100: '#e5e5e5',
          200: '#d4d4d4',
          300: '#a3a3a3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#262626',
          800: '#171717',
          900: '#0a0a0a',
          950: '#050505',
        },

        // Charcoal (Surfaces/Cards)
        charcoal: {
          DEFAULT: '#0a0a0a',
          light: '#141414',
          dark: '#050505',
          surface: '#0f0f0f',
        },

        // Legacy mapping for compatibility
        midnight: '#050505',
        obsidian: '#050505',

        // Gold (replaced with green, kept for compatibility)
        gold: {
          DEFAULT: '#22c55e',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          muted: '#16a34a',
        },

        // Stroke color
        stroke: '#1f1f1f',

        // UI States
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: '#22c55e',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#F59E0B',
          foreground: '#000000',
        },
        error: {
          DEFAULT: '#FF4D4D',
          foreground: '#FFFFFF',
        },

        // Card & Input
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        // Border & Ring
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },

      fontFamily: {
        // New Premium Typography
        sans: ['Inter', 'sans-serif'],
        pixel: ['Pixelify Sans', 'monospace'],
        // Legacy (backward compatibility)
        inter: ['Inter', 'sans-serif'],
        orbitron: ['Inter', 'sans-serif'],
        rajdhani: ['Inter', 'sans-serif'],
        sora: ['Inter', 'sans-serif'],
      },

      fontSize: {
        'hero': ['48px', { lineHeight: '1.1', fontWeight: '500' }],
        'section': ['36px', { lineHeight: '1.2', fontWeight: '500' }],
        'card-title': ['24px', { lineHeight: '1.3', fontWeight: '500' }],
        'body': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },

      borderRadius: {
        'premium': '14px',
        'xl': '16px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'card': '16px',
        'button': '9999px',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'scanning-line': {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        'scan': {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 200%' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(34, 197, 94, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.6s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        shimmer: 'shimmer 2s infinite linear',
        pulse: 'pulse 2s infinite',
        spin: 'spin 1s linear infinite',
        'scanning-line': 'scanning-line 2s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
        ticker: 'ticker 30s linear infinite',
        glow: 'glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
      },

      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'brand-gradient-hover': 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
        'gold-gradient': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'gold-gradient-hover': 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
        'midnight-gradient': 'linear-gradient(180deg, #050505 0%, #0a0a0a 100%)',
        'card-gradient': 'linear-gradient(145deg, #0f0f0f 0%, #0a0a0a 100%)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.1), transparent)',
        'dither': 'radial-gradient(#000 1px, transparent 0)',
      },

      boxShadow: {
        'brand-sm': '0 2px 8px rgba(34, 197, 94, 0.15)',
        'brand-md': '0 4px 16px rgba(34, 197, 94, 0.2)',
        'brand-lg': '0 8px 32px rgba(34, 197, 94, 0.25)',
        'brand-glow': '0 0 20px rgba(34, 197, 94, 0.4)',
        'gold-sm': '0 2px 8px rgba(34, 197, 94, 0.15)',
        'gold-md': '0 4px 16px rgba(34, 197, 94, 0.2)',
        'gold-lg': '0 8px 32px rgba(34, 197, 94, 0.25)',
        'gold-glow': '0 0 20px rgba(34, 197, 94, 0.4)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(34, 197, 94, 0.3)',
      },

      spacing: {
        'section': '80px',
      },

      maxWidth: {
        'container': '1400px',
      },

      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
