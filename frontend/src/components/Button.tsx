import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. Default: 'primary'. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-ops-accent text-white hover:bg-blue-500 focus-visible:outline-blue-400',
  secondary:
    'bg-ops-800 text-ops-text border border-ops-line hover:bg-ops-700 focus-visible:outline-ops-muted',
  ghost:
    'bg-transparent text-ops-muted hover:text-ops-text hover:bg-ops-800 focus-visible:outline-ops-muted',
  danger:
    'bg-ops-bad text-white hover:bg-red-500 focus-visible:outline-red-400',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

/** Standard dashboard button. Disabled state is shared across variants. */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
