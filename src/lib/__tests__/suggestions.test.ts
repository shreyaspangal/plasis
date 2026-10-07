import { describe, expect, test } from "bun:test";
import { suggestIssue } from "@/lib/parse/issue";
import { applySuggestion, type Suggestion } from "@/lib/parse/common";
import { findClauses } from "@/lib/clauses";
import type { CardIntent } from "@/lib/jev/types";
import { dismiss, liveDismissed, noneDismissed, pairOffers, pickSuggestion } from "@/lib/suggestions";

const offer = (id: string, start: number): Suggestion => ({ id, start, end: start + 4, from: "high", to: "high priority" });
const OFFERS = [offer("assignee:riya", 10), offer("priority:high", 20)];

describe("suggestions", () => {
  test("first offer that wasn't denied", () => {
    const d = dismiss(noneDismissed(1), "assignee:riya");
    expect(pickSuggestion(OFFERS, noneDismissed(1))?.id).toBe("assignee:riya");
    expect(pickSuggestion(OFFERS, d)?.id).toBe("priority:high");
    expect(pickSuggestion(OFFERS, dismiss(d, "priority:high"))).toBeNull();
  });
  test("a denial holds while typing on the same card", () => {
    const d = dismiss(noneDismissed(1), "priority:high");
    expect(liveDismissed(d, "fix login high", 1)).toBe(d);
  });
  test.each(["", "   "])("clearing the input forgets denials: %j", (text) => {
    const d = dismiss(noneDismissed(1), "priority:high");
    expect(liveDismissed(d, text, 1).ids.size).toBe(0);
  });
  test("another card forgets denials, even with text in the input (F-030)", () => {
    const d = dismiss(noneDismissed(1), "priority:high");
    const next = liveDismissed(d, "checkout broken @riya high", 2);
    expect(next).toEqual(noneDismissed(2));
    expect(pickSuggestion(OFFERS.slice(1), next)?.id).toBe("priority:high");
  });
  test("nothing to forget returns the same object, so the hook doesn't re-render", () => {
    const d = noneDismissed(1);
    expect(liveDismissed(d, "", 1)).toBe(d);
  });
});

describe("pairOffers: a two-card line", () => {
  const REF = new Date(2026, 9, 6, 10, 0);
  const suggestFor = (k: CardIntent) => (k === "issue" ? suggestIssue : undefined);
  /** Cards as the shell sees them, with the intents given (the classifier's job). */
  const offersFor = (line: string, intents: [CardIntent, CardIntent], ghost: [boolean, boolean] = [false, false]) => {
    const c = findClauses(line)!;
    return pairOffers(
      [
        { intent: intents[0], text: c.first, at: c.firstAt, ghost: ghost[0] },
        { intent: intents[1], text: c.second, at: c.secondAt, ghost: ghost[1] },
      ],
      suggestFor,
      REF,
    );
  };

  test("reminder second: the deadline is offered on its last word", () => {
    const line = "lunch with sam friday 1pm and remind me to book a table";
    const [o] = offersFor(line, ["event", "reminder"]);
    expect([o.from, o.to]).toEqual(["table", "table before friday 1pm"]);
    expect(applySuggestion(line, o)).toBe("lunch with sam friday 1pm and remind me to book a table before friday 1pm");
  });
  test("reminder first: accepting writes into its own half", () => {
    const line = "remind me to book a table; lunch with sam friday 1pm";
    const [o] = offersFor(line, ["reminder", "event"]);
    expect(applySuggestion(line, o)).toBe("remind me to book a table before friday 1pm; lunch with sam friday 1pm");
  });
  test("no offer: the reminder has its own date, the other card has none, or the reminder is a ghost", () => {
    expect(offersFor("lunch friday 1pm and remind me to call at 11am", ["event", "reminder"])).toEqual([]);
    expect(offersFor("split the uber 600 and remind me to collect it", ["split", "reminder"])).toEqual([]);
    expect(offersFor("lunch friday 1pm and remind me to book a table", ["event", "reminder"], [false, true])).toEqual([]);
  });
  test("issue + reminder: both offers, in line order, positions shifted", () => {
    const line = "remind me to check it; bug login broken by friday @riya high";
    const offers = offersFor(line, ["reminder", "issue"]);
    expect(offers.map((o) => o.id)).toEqual(["deadline:before friday", "priority:high"]);
    expect(line.slice(offers[1].start, offers[1].end)).toBe("high");
  });
});
