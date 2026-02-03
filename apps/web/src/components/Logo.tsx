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
      {/* MirrorX Logo Image */}
      <img
        src="/logo.png"
        alt="MirrorX Logo"
        className={cn(sizes[size].icon, 'object-contain')}
      />
      {showText && (
        <span className={cn('font-orbitron font-bold', sizes[size].text)}>
          <span className="text-foreground">Mirror</span>
          <span className="text-emerald-500">X</span>
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="MirrorX"
      className={cn('w-8 h-8 object-contain', className)}
    />
  );
}

export default Logo;
