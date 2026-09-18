import { Loader2 } from 'lucide-react';

interface LoadingProps {
  label?: string;
  /** Full-area centered loader (default) vs inline row. */
  inline?: boolean;
}

/** Spinner + optional label. The only animated element in the app. */
export function Loading({ label, inline = false }: LoadingProps) {
  const content = (
    <>
      <Loader2 className="h-4 w-4 animate-spin text-ops-accent" aria-hidden />
      {label ? <span className="text-sm text-ops-muted">{label}</span> : null}
    </>
  );

  if (inline) {
    return <div className="flex items-center gap-2 py-1">{content}</div>;
  }
  return (
    <div className="flex items-center justify-center gap-2 py-10">
      {content}
    </div>
  );
}

/** Skeleton block for card grids while data loads. */
export function LoadingCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-ops-line bg-ops-850 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="mb-2 h-3 rounded bg-ops-800 last:mb-0"
          style={{ width: `${90 - index * 15}%` }}
        />
      ))}
    </div>
  );
}
