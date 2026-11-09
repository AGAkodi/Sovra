import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'quiet' | 'destructive' | 'danger-fill';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brass text-brass-ink hover:bg-brass-light shadow-button-top',
  secondary: 'bg-raised text-fg border border-line hover:bg-raised-hover',
  quiet: 'text-fg-2 hover:text-fg hover:bg-raised',
  destructive: 'bg-raised text-negative border border-line hover:bg-raised-hover',
  'danger-fill': 'bg-negative text-white hover:bg-negative/90',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-caption gap-1.5',
  md: 'h-9 px-4 text-body gap-2',
  lg: 'h-11 px-5 text-body gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', busy, icon, className = '', children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center rounded-control font-medium whitespace-nowrap
        transition-[background-color,color,transform,opacity] duration-hover ease-vault active:scale-[0.98]
        disabled:opacity-40 disabled:pointer-events-none ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : icon}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
