import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  /** Backend error code when available. */
  code?: string;
  onRetry?: () => void;
}

/** Inline error panel with optional retry — used by every data page. */
export function ErrorState({ message, code, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-4">
      <div className="flex items-center gap-2 text-sm text-red-400">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span>
          {message}
          {code ? (
            <span className="ml-2 text-xs text-ops-faint">({code})</span>
          ) : null}
        </span>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
