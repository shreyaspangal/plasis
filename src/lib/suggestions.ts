import { borrowDate } from "@/lib/clauses";
import type { CardIntent } from "@/lib/jev/types";
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

type OfferCard = { intent: CardIntent; text: string; at: number; ghost: boolean };

/**
 * "Did you mean?" offers for a two-card line, in whole-line positions and in order (the first owns Tab):
 * each committed card's own offers, plus a dateless reminder's deadline borrowed from the other card,
 * offered on its last word ("table" → "table before friday 1pm") and never set on its own (F-037).
 */
export function pairOffers(
  cards: [OfferCard, OfferCard],
  suggestFor: (intent: CardIntent) => ((text: string) => Suggestion[]) | undefined,
  ref?: Date,
): Suggestion[] {
  return cards
    .flatMap((c, i) => {
      if (c.ghost) return []; // like the single card: no offers on a faded preview
      const shift = (s: Suggestion) => ({ ...s, start: s.start + c.at, end: s.end + c.at });
      const own = (suggestFor(c.intent)?.(c.text) ?? []).map(shift);
      if (c.intent !== "reminder") return own;
      const added = borrowDate(c.text, cards[i ? 0 : 1].text, ref).slice(c.text.length);
      const last = c.text.match(/\S+$/);
      if (!added || !last) return own;
      return [...own, shift({ id: `deadline:${added.trim()}`, start: last.index!, end: c.text.length, from: last[0], to: last[0] + added })];
    })
    .sort((a, b) => a.start - b.start);
}
