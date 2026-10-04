import type { Suggestion } from "@/lib/parse/common";

/** "Did you mean?" ids the user denied, tied to the draft they were denied on. */
export type Dismissed = { draftId: number; ids: ReadonlySet<string> };

export const noneDismissed = (draftId: number): Dismissed => ({ draftId, ids: new Set() });

/**
 * Denials are forgotten once the input is cleared or another card is loaded (a new draft or a
 * reopened item), so a "no" on one card never hides an offer on the next (F-030).
 * Returns the same object while it still holds, so callers can tell nothing changed.
 */
export function liveDismissed(d: Dismissed, text: string, draftId: number): Dismissed {
  if (d.draftId !== draftId) return noneDismissed(draftId);
  if (!text.trim() && d.ids.size) return noneDismissed(draftId);
  return d;
}

export function dismiss(d: Dismissed, id: string): Dismissed {
  return { draftId: d.draftId, ids: new Set(d.ids).add(id) };
}

/** The first offer, by position in the text, that hasn't been denied. */
export function pickSuggestion(offers: Suggestion[], d: Dismissed): Suggestion | null {
  return offers.find((s) => !d.ids.has(s.id)) ?? null;
}
