import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. Default: 'primary'. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-blue-500 hover:shadow-lg hover:shadow-sky-500/30 border border-sky-400/30 active:scale-[0.98]',
  accent:
    'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-sky-500 hover:shadow-lg hover:shadow-cyan-500/30 border border-cyan-400/30 active:scale-[0.98]',
  secondary:
    'bg-slate-800/90 text-slate-200 border border-slate-700/70 shadow-sm hover:bg-slate-700/80 hover:text-white hover:border-slate-600 active:scale-[0.98]',
  ghost:
    'bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 active:scale-[0.98]',
  danger:
    'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20 hover:from-rose-400 hover:to-red-500 hover:shadow-lg hover:shadow-rose-500/30 border border-rose-400/30 active:scale-[0.98]',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-lg',
  md: 'px-4 py-2 text-sm font-medium rounded-lg',
  lg: 'px-5 py-2.5 text-base font-semibold rounded-xl',
};

/** High-tech interactive dashboard button with micro-motion and glow feedback. */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none cursor-pointer ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

