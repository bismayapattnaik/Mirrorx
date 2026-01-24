import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const sizes = {
    sm: { icon: 'w-7 h-7', text: 'text-lg' },
    md: { icon: 'w-8 h-8', text: 'text-xl' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl' },
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo Icon - Hanger with X */}
      <svg
        viewBox="0 0 64 64"
        className={sizes[size].icon}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#C5A028" />
          </linearGradient>
          <linearGradient id="logoBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E3A5F" />
            <stop offset="100%" stopColor="#2D5A87" />
          </linearGradient>
        </defs>

        {/* Dark background */}
        <rect width="64" height="64" rx="12" fill="#0A0A0F" />

        {/* Hanger hook */}
        <path
          d="M32 8 C32 8 36 8 36 12 C36 15 33 16 33 16"
          stroke="#B8B8C0"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Hanger body */}
        <path
          d="M18 24 L32 16 L46 24"
          stroke="#B8B8C0"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Circle frame */}
        <circle cx="32" cy="38" r="16" stroke="#B8B8C0" strokeWidth="2" fill="none" />

        {/* X shape - blue ribbon */}
        <path
          d="M22 28 L42 48"
          stroke="url(#logoBlueGrad)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* X shape - gold ribbon */}
        <path
          d="M42 28 L22 48"
          stroke="url(#logoGoldGrad)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Mesh pattern */}
        <path
          d="M38 32 L26 44"
          stroke="#D4AF37"
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeDasharray="2 2"
        />
        <path
          d="M40 34 L28 46"
          stroke="#D4AF37"
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeDasharray="2 2"
        />
      </svg>

      {showText && (
        <span className={cn('font-orbitron font-bold', sizes[size].text)}>
          <span className="text-foreground">Mirror</span>
          <span className="text-gold">X</span>
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('w-8 h-8', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="iconGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#C5A028" />
        </linearGradient>
        <linearGradient id="iconBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E3A5F" />
          <stop offset="100%" stopColor="#2D5A87" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="12" fill="#0A0A0F" />

      <path
        d="M32 8 C32 8 36 8 36 12 C36 15 33 16 33 16"
        stroke="#B8B8C0"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      <path
        d="M18 24 L32 16 L46 24"
        stroke="#B8B8C0"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="32" cy="38" r="16" stroke="#B8B8C0" strokeWidth="2" fill="none" />

      <path d="M22 28 L42 48" stroke="url(#iconBlueGrad)" strokeWidth="6" strokeLinecap="round" />
      <path d="M42 28 L22 48" stroke="url(#iconGoldGrad)" strokeWidth="6" strokeLinecap="round" />

      <path d="M38 32 L26 44" stroke="#D4AF37" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="2 2" />
      <path d="M40 34 L28 46" stroke="#D4AF37" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="2 2" />
    </svg>
  );
}

export default Logo;
