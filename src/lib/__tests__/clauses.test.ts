import { describe, expect, test } from "bun:test";
import { borrowDate, findClauses } from "@/lib/clauses";

const cuts = (text: string, first: string, second: string) =>
  test(text, () => expect(findClauses(text)).toMatchObject({ first, second }));
const keeps = (text: string) => test(text, () => expect(findClauses(text)).toBeNull());

describe("cuts at a join", () => {
  // A reminder trigger stays with its request; pure joins are dropped.
  cuts("lunch with sam friday 1pm and remind me to book a table", "lunch with sam friday 1pm", "remind me to book a table");
  cuts("split the uber 600 and remind me to collect it", "split the uber 600", "remind me to collect it");
  cuts("coffee with riya at 4; remind me to bring the deck", "coffee with riya at 4", "remind me to bring the deck");
  cuts("lunch friday and don’t forget to book", "lunch friday", "don’t forget to book"); // curly apostrophe, F-033
  cuts("lunch friday and also book a table", "lunch friday", "book a table");
  cuts("buy milk; eggs; bread", "buy milk", "eggs; bread"); // only the first join cuts
});

test("each half knows where it starts in the line", () => {
  expect(findClauses("lunch friday 1pm and remind me to book a table")).toEqual({
    first: "lunch friday 1pm",
    second: "remind me to book a table",
    firstAt: 0,
    secondAt: 21,
  });
});

describe("cuts, but the classifier decides (Checkpoint 3)", () => {
  cuts("idea: a todo app that guesses the type. maybe later", "idea: a todo app that guesses the type", "maybe later");
  cuts("remind me to call mom and then go to the gym", "remind me to call mom", "go to the gym");
  cuts("flight to goa then train to pune", "flight to goa", "train to pune"); // same card twice → one card
});

describe("never cuts", () => {
  keeps("lunch with sam and riya friday");
  keeps("buy milk and eggs and bread");
  keeps("split 900 between me and sam");
  keeps("chekout broken on safari @sharon and fix it by tommorow");
  keeps("lunch with sam friday 1pm and remind"); // still typing
  keeps("then call mom"); // nothing before the join
  keeps("call mom tomorrow. "); // nothing after it
  keeps("lunch at 5 p.m. with sam");
  keeps("meet dr. rao friday");
  keeps("save x.com/a;b for later"); // no space after ";"
});

describe("borrowDate: a reminder half with no date", () => {
  const REF = new Date(2026, 9, 6, 10, 0);
  test("borrows its sibling's date as a deadline", () => {
    expect(borrowDate("remind me to book a table", "lunch with sam friday 1pm", REF)).toBe("remind me to book a table before friday 1pm");
  });
  test("drops a leading 'on'", () => {
    expect(borrowDate("remind me to prep slides", "standup on monday at 10", REF)).toBe("remind me to prep slides before monday at 10");
  });
  test("keeps its own date", () => {
    expect(borrowDate("remind me to call at 6", "lunch friday", REF)).toBe("remind me to call at 6");
  });
  test("nothing to borrow", () => {
    expect(borrowDate("remind me to collect it", "split the uber 600", REF)).toBe("remind me to collect it");
  });
});
