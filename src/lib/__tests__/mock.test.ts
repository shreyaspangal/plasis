import { describe, expect, test } from "bun:test";
import { mockClassify, MOCK_QUESTION_COUNT } from "@/lib/jev/mock";
import { QUESTION_COUNT } from "@/lib/jev/questions";
import { rawState } from "@/lib/decide";
import { INTENT_KEYS, intentResultSchema } from "@/lib/jev/types";

const EXAMPLES: [string, string][] = [
  ["dinner with priya friday 8pm", "event"],
  ["remind me to call mom tomorrow", "reminder"],
  ["buy milk, eggs, bread and coffee", "todo"],
  ["25 min focus", "timer"],
  ["timer 10 minutes", "timer"],
  ["meditate every morning", "habit"],
  ["gym 3x a week", "habit"],
  ["#ff6b35", "color"],
  ["a warm sunset orange", "color"],
  ["minecraft diamond", "color"],
  ["tiffany blue", "color"],
  ["discord blurple", "color"],
  ["the color of the ocean", "color"],
  ["split 2400 between 3", "split"],
  ["spent 450 on uber", "expense"],
  ["5 miles in km", "convert"],
  ["72f to c", "convert"],
  ["18% of 3450", "calc"],
  ["(120+80)*3", "calc"],
  ["flight to goa next weekend", "travel"],
  ["pizza or burgers for friday?", "poll"],
  ["rahul 98200 12345 rahul@mail.com", "contact"],
  ["https://vercel.com/blog check later", "link"],
  ["i keep thinking about how quiet the city felt this morning", "note"],
  ["days until christmas", "countdown"],
  ["how many days till my birthday on dec 12", "countdown"],
  ["3pm pst in ist", "timezone"],
  ["what time is it in tokyo", "timezone"],
  ["roll 2d6", "random"],
  ["flip a coin", "random"],
  ["random number 1-100", "random"],
  ["read 12 books this year, 4 done", "goal"],
  ["4 of 10 workouts", "goal"],
  ["bug checkout broken on safari @riya p1 by friday", "issue"],
  ["checkout broken on safari high priority @sara", "issue"],
  ["fix login redirect loop", "issue"],
  ["story: users can export reports as pdf", "issue"],
  ["i have an issue with the login page", "issue"],
  ["update the readme cc @sam", "issue"],
  ["cab to client site 640 billable", "expense"],
  ["lunch with client 1200 reimbursable", "expense"],
  ["typo on the pricing page", "issue"],
  ["signup button does nothing on android", "issue"],
  ["add dark mode to the dashboard", "issue"],
];

describe("mock classifier", () => {
  test("question count matches schema", () => expect(MOCK_QUESTION_COUNT).toBe(QUESTION_COUNT));
  for (const [text, intent] of EXAMPLES) {
    test(`${text} → ${intent} (committed)`, () => {
      const r = mockClassify(text);
      expect(intentResultSchema.parse(r)).toBeTruthy();
      expect(r.intent.value).toBe(intent as never);
      expect(rawState(r)).toEqual({ kind: "committed", intent } as never);
    });
  }
  // Guards F-003: a card with no offline rules compiles and passes every other test.
  test("every card type has an offline example", () => {
    const covered = new Set(EXAMPLES.map(([, intent]) => intent));
    expect(INTENT_KEYS.filter((k) => k !== "none" && !covered.has(k))).toEqual([]);
  });
  test.each([
    ["remind me to fix checkout friday", "reminder"],
    ["fix checkout, update readme, deploy", "todo"],
  ])("issue boundary: %s → %s", (text, intent) => expect(mockClassify(text).intent.value).toBe(intent as never));
  test.each(["fix", "@riya", "asap", "slow morning today"])("not an issue: %s", (text) =>
    expect(mockClassify(text).intent.value).not.toBe("issue"),
  );
  test("an email address is not an issue mention", () => expect(mockClassify("email riya@acme.com about the api").intent.value).not.toBe("issue"));
  test.each([
    ["bug checkout broken on safari", "bug"],
    ["fix login redirect loop", "bug"],
    ["story: users can export reports as pdf", "story"],
    ["update the readme cc @sam", "task"],
    ["look into the checkout thing @sam", "unspecified"],
    ["typo on the pricing page", "bug"],
    ["add csv export for invoices @neha p2", "story"],
    ["users can't upload files over 5mb", "bug"],
  ])("issueType: %s → %s", (text, type) => expect(mockClassify(text).signals.issueType.value).toBe(type as never));
  test("short text → none", () => expect(mockClassify("a").intent.value).toBe("none"));
  test("on zoom → video_call", () => expect(mockClassify("dinner with priya friday 8pm on zoom").signals.eventMode.value).toBe("video_call"));
  test("urgent → high urgency", () => expect(mockClassify("remind me to pay rent tomorrow urgent").signals.urgency.score).toBeGreaterThan(1.2));
});
