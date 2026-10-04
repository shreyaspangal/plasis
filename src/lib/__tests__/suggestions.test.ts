import { describe, expect, test } from "bun:test";
import type { Suggestion } from "@/lib/parse/common";
import { dismiss, liveDismissed, noneDismissed, pickSuggestion } from "@/lib/suggestions";

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
