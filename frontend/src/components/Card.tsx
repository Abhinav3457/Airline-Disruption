import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'none';
  hoverEffect?: boolean;
  children: ReactNode;
}

const GLOW_CLASSES: Record<NonNullable<CardProps['glow']>, string> = {
  none: 'border-slate-800/80 bg-slate-900/70 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]',
  cyan: 'border-sky-500/30 bg-slate-900/80 shadow-[0_0_25px_-5px_rgba(56,189,248,0.15),0_8px_30px_-4px_rgba(0,0,0,0.6)]',
  emerald: 'border-emerald-500/30 bg-slate-900/80 shadow-[0_0_25px_-5px_rgba(16,185,129,0.15),0_8px_30px_-4px_rgba(0,0,0,0.6)]',
  amber: 'border-amber-500/30 bg-slate-900/80 shadow-[0_0_25px_-5px_rgba(245,158,11,0.15),0_8px_30px_-4px_rgba(0,0,0,0.6)]',
  rose: 'border-rose-500/30 bg-slate-900/80 shadow-[0_0_25px_-5px_rgba(244,63,94,0.15),0_8px_30px_-4px_rgba(0,0,0,0.6)]',
  purple: 'border-purple-500/30 bg-slate-900/80 shadow-[0_0_25px_-5px_rgba(168,85,247,0.15),0_8px_30px_-4px_rgba(0,0,0,0.6)]',
};

/** High-tech glassmorphic panel with subtle specular borders and elevation depth. */
export function Card({
  glow = 'none',
  hoverEffect = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border backdrop-blur-xl transition-all duration-200 ${
        GLOW_CLASSES[glow]
      } ${
        hoverEffect ? 'hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-lg' : ''
      } ${className}`}
      {...rest}
    >
      {/* Specular top highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden
      />
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  /** Optional right-aligned meta (badges, counts). */
  meta?: ReactNode;
  className?: string;
}

export function CardHeader({ title, icon, meta, className = '' }: CardHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5 sm:px-5 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-sky-400">
            {icon}
          </span>
        ) : null}
        <h3 className="text-sm font-semibold tracking-wide text-slate-100 truncate">
          {title}
        </h3>
      </div>
      {meta ? (
        <div className="text-xs font-medium text-slate-400 shrink-0 ml-2">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

export function CardBody({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`px-4 py-3.5 sm:px-5 ${className}`}>{children}</div>;
}

