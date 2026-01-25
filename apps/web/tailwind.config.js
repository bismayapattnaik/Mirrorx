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
        // MirrorX Premium Design System
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // Primary - Royal Indigo (Premium accent)
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },

        // Secondary - Deep Surface
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },

        // Accent - Champagne Gold (Luxury)
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        // Premium Gold Palette
        gold: {
          DEFAULT: '#D6B46A',
          50: '#FBF8F0',
          100: '#F5EDD8',
          200: '#EBDBB1',
          300: '#E0C88A',
          400: '#D6B46A',
          500: '#C9A144',
          600: '#A7832D',
          700: '#7E6322',
          800: '#554317',
          900: '#2C220B',
          muted: '#A6842E',
        },

        // Royal Indigo (Primary actions)
        indigo: {
          DEFAULT: '#5B4BFF',
          50: '#F5F4FF',
          100: '#ECEAFF',
          200: '#D9D5FF',
          300: '#B8AFFF',
          400: '#9789FF',
          500: '#5B4BFF',
          600: '#4A3AE6',
          700: '#3829CC',
          800: '#271AB3',
          900: '#150C99',
        },

        // Obsidian Night (Primary background)
        obsidian: {
          DEFAULT: '#0B0F1A',
          50: '#E8E9EC',
          100: '#B9BCC6',
          200: '#8A8FA0',
          300: '#5B627A',
          400: '#2C3554',
          500: '#0B0F1A',
          600: '#090C15',
          700: '#070910',
          800: '#05060B',
          900: '#020306',
        },

        // Deep Charcoal (Surface/cards)
        charcoal: {
          DEFAULT: '#121826',
          light: '#1A2133',
          dark: '#0A0E18',
          surface: '#181E2E',
        },

        // Midnight (Legacy - maps to obsidian)
        midnight: '#0B0F1A',

        // Ivory (Text)
        ivory: {
          DEFAULT: '#F5F2EA',
          muted: '#B8B4A8',
        },

        // Stroke color
        stroke: '#263043',

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
          DEFAULT: '#2ECC71',
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
        // Premium Typography
        sora: ['Sora', 'sans-serif'],          // Headings
        inter: ['Inter', 'sans-serif'],        // Body
        // Legacy (backward compatibility)
        orbitron: ['Orbitron', 'Sora', 'sans-serif'],
        rajdhani: ['Rajdhani', 'Inter', 'sans-serif'],
      },

      fontSize: {
        'hero': ['48px', { lineHeight: '1.1', fontWeight: '700' }],
        'section': ['36px', { lineHeight: '1.2', fontWeight: '600' }],
        'card-title': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },

      borderRadius: {
        // Premium rounded corners
        'premium': '14px',
        'xl': '16px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'card': '14px',
        'button': '10px',
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
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(212, 175, 55, 0.6)' },
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
        ticker: 'ticker 30s linear infinite',
        glow: 'glow 2s ease-in-out infinite',
      },

      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #B8941F 100%)',
        'gold-gradient-hover': 'linear-gradient(135deg, #E5C158 0%, #D4AF37 100%)',
        'midnight-gradient': 'linear-gradient(180deg, #02040a 0%, #0a0f1a 100%)',
        'card-gradient': 'linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.1), transparent)',
      },

      boxShadow: {
        'gold-sm': '0 2px 8px rgba(212, 175, 55, 0.15)',
        'gold-md': '0 4px 16px rgba(212, 175, 55, 0.2)',
        'gold-lg': '0 8px 32px rgba(212, 175, 55, 0.25)',
        'gold-glow': '0 0 20px rgba(212, 175, 55, 0.4)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(212, 175, 55, 0.3)',
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
