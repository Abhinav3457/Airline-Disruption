import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-500/40 text-emerald-400',
  error: 'border-red-500/40 text-red-400',
  info: 'border-blue-500/40 text-blue-400',
};

function KindIcon({ kind }: { kind: ToastKind }) {
  if (kind === 'success') return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (kind === 'error') return <XCircle className="h-4 w-4" aria-hidden />;
  return <Info className="h-4 w-4" aria-hidden />;
}

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

/** Fixed bottom-right stack. State comes from the ToastProvider. */
export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-2 rounded-lg border bg-ops-900 px-3 py-2.5 text-sm shadow-lg ${KIND_STYLES[toast.kind]}`}
        >
          <KindIcon kind={toast.kind} />
          <span className="flex-1 text-ops-text">{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            className="text-ops-faint transition-colors hover:text-ops-text"
            onClick={() => onDismiss(toast.id)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
