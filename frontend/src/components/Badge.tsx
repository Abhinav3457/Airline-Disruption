import type { ReactNode } from 'react';

type BadgeTone =
  | 'neutral'
  | 'ok'
  | 'warn'
  | 'bad'
  | 'escalate'
  | 'accent';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-ops-800 text-ops-muted border-ops-line',
  ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warn: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  bad: 'bg-red-500/10 text-red-400 border-red-500/30',
  escalate: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  accent: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

/** Small status chip for tiers, booking states, decision outcomes. */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
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
  if (tier === 'Platinum') return 'escalate';
  if (tier === 'Gold') return 'warn';
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
  if (status === 'eligible' || status === 'partially_eligible') return 'ok';
  if (status === 'ineligible') return 'bad';
  return 'accent';
}
