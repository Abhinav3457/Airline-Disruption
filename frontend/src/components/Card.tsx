import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Matte panel with a subtle border — the base surface of the dashboard. */
export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-ops-line bg-ops-850 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  /** Optional right-aligned meta (badges, counts). */
  meta?: ReactNode;
}

export function CardHeader({ title, meta }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-ops-line px-4 py-3">
      <h3 className="text-sm font-semibold tracking-wide text-ops-text">
        {title}
      </h3>
      {meta ? <div className="text-xs text-ops-muted">{meta}</div> : null}
    </div>
  );
}

export function CardBody({ className = '', children }: CardProps) {
  return <div className={`px-4 py-3 ${className}`}>{children}</div>;
}
