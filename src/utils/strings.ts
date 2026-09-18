/**
 * String normalization helpers for case-insensitive matching.
 */

/** Normalize a PNR for lookup: trim + uppercase ('sk4821x' -> 'SK4821X'). */
export function normalizePnr(pnr: string): string {
  return pnr.trim().toUpperCase();
}

/**
 * Normalize a person name for comparison: trim, collapse inner whitespace,
 * lowercase ('  Priya    nair ' -> 'priya nair').
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
