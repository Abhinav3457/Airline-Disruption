/**
 * Small formatting helpers shared across pages.
 * All formatting is deterministic and dependency-free.
 */

/** '23 Sep 2026' style date for ISO date strings. */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** ISO timestamp -> '23 Sep 2026, 14:05' style local timestamp. */
export function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 'SK-204' -> 'SK204' form kept as-is; label 'Return' passes through. */
export function formatFlightLabel(flight: string): string {
  return flight;
}

/** Human label for snake_case action ids, e.g. 'issue_meal_voucher' -> 'Issue meal voucher'. */
export function humanizeActionId(actionId: string): string {
  return actionId
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Title-cased intent, e.g. 'hotel_request' -> 'Hotel Request'. */
export function humanizeIntent(intent: string): string {
  return humanizeActionId(intent);
}
