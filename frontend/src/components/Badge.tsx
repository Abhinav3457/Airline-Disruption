import type { ReactNode } from 'react';

export type BadgeTone =
  | 'neutral'
  | 'ok'
  | 'warn'
  | 'bad'
  | 'escalate'
  | 'accent'
  | 'cyan'
  | 'platinum'
  | 'gold';

interface BadgeProps {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, { container: string; dot: string }> = {
  neutral: {
    container: 'bg-slate-800/80 text-slate-300 border-slate-700/60 shadow-sm',
    dot: 'bg-slate-400',
  },
  ok: {
    container: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_-3px_rgba(16,185,129,0.3)]',
    dot: 'bg-emerald-400',
  },
  warn: {
    container: 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_-3px_rgba(245,158,11,0.3)]',
    dot: 'bg-amber-400',
  },
  bad: {
    container: 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_12px_-3px_rgba(244,63,94,0.3)]',
    dot: 'bg-rose-400',
  },
  escalate: {
    container: 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-[0_0_12px_-3px_rgba(168,85,247,0.3)]',
    dot: 'bg-purple-400',
  },
  accent: {
    container: 'bg-sky-500/15 text-sky-300 border-sky-500/30 shadow-[0_0_12px_-3px_rgba(56,189,248,0.3)]',
    dot: 'bg-sky-400',
  },
  cyan: {
    container: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_-3px_rgba(6,182,212,0.3)]',
    dot: 'bg-cyan-400',
  },
  platinum: {
    container: 'bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-sky-500/20 text-indigo-200 border-indigo-400/40 shadow-[0_0_14px_-2px_rgba(99,102,241,0.4)]',
    dot: 'bg-indigo-400',
  },
  gold: {
    container: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-200 border-amber-400/40 shadow-[0_0_14px_-2px_rgba(245,158,11,0.4)]',
    dot: 'bg-amber-400',
  },
};

/** Small status chip for tiers, booking states, decision outcomes with optional glowing beacon. */
export function Badge({
  tone = 'neutral',
  size = 'sm',
  pulse = false,
  className = '',
  children,
}: BadgeProps) {
  const current = TONE_CLASSES[tone] ?? TONE_CLASSES.neutral;
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap backdrop-blur-sm transition-all duration-200 ${sizeClasses} ${current.container} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${current.dot} ${
          pulse ? 'animate-ping' : ''
        }`}
        aria-hidden
      />
      {children}
    </span>
  );
}

/** Map a booking status to its badge tone. */
export function bookingStatusTone(
  status: 'Cancelled' | 'Delayed' | 'Unaffected'
): BadgeTone {
  if (status === 'Cancelled') return 'bad';
  if (status === 'Delayed') return 'warn';
  return 'ok';
}

/** Map a loyalty tier to its badge tone. */
export function loyaltyTone(tier: 'Silver' | 'Gold' | 'Platinum'): BadgeTone {
  if (tier === 'Platinum') return 'platinum';
  if (tier === 'Gold') return 'gold';
  return 'neutral';
}

/** Map a decision status to its badge tone. */
export function decisionTone(
  status:
    | 'eligible'
    | 'partially_eligible'
    | 'ineligible'
    | 'escalation_required'
    | 'clarification_required'
): BadgeTone {
  if (status === 'escalation_required') return 'escalate';
  if (status === 'eligible') return 'ok';
  if (status === 'partially_eligible') return 'warn';
  if (status === 'ineligible') return 'bad';
  return 'accent';
}

