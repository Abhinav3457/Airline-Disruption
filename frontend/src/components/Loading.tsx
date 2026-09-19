import { Compass, Loader2 } from 'lucide-react';

interface LoadingProps {
  label?: string;
  /** Full-area centered loader (default) vs inline row. */
  inline?: boolean;
}

/** High-tech aviation loading indicator with glowing pulse. */
export function Loading({ label, inline = false }: LoadingProps) {
  const content = (
    <>
      <div className="relative flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-sky-400" aria-hidden />
        <span className="absolute h-6 w-6 animate-ping rounded-full bg-sky-400/20" />
      </div>
      {label ? (
        <span className="text-xs font-medium tracking-wide text-slate-300">
          {label}
        </span>
      ) : null}
    </>
  );

  if (inline) {
    return <div className="flex items-center gap-2.5 py-1">{content}</div>;
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 shadow-[0_0_20px_-3px_rgba(56,189,248,0.25)]">
        <Compass className="h-5 w-5 animate-spin text-sky-400 [animation-duration:3s]" />
      </div>
      {label ? (
        <span className="text-xs font-medium tracking-wider text-slate-400 uppercase">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/** Skeleton block for card grids with animated shimmer pulse. */
export function LoadingCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="mb-2.5 h-3.5 rounded-md bg-slate-800/80 last:mb-0"
          style={{ width: `${92 - index * 18}%` }}
        />
      ))}
    </div>
  );
}

