import { describe, expect, test } from "bun:test";
import { parseEvent } from "@/lib/parse/event";
import { parseReminder } from "@/lib/parse/reminder";
import { parseTodo } from "@/lib/parse/todo";
import { parseTimer, formatClock } from "@/lib/parse/timer";
import { parseHabit } from "@/lib/parse/habit";
import { parseColor } from "@/lib/parse/color";
import { parseSplit } from "@/lib/parse/split";
import { parseExpense } from "@/lib/parse/expense";
import { parseIssue, suggestIssue } from "@/lib/parse/issue";
import { appendAt, applySuggestion } from "@/lib/parse/common";
import { parseConvert } from "@/lib/parse/convert";
import { evaluate, parseCalc } from "@/lib/parse/calc";
import { parseTravel } from "@/lib/parse/travel";
import { parsePoll } from "@/lib/parse/poll";
import { parseContact } from "@/lib/parse/contact";
import { parseLink } from "@/lib/parse/link";
import { parseNote } from "@/lib/parse/note";
import { shades, hexToOklch, oklchToHex } from "@/lib/color";

// Tuesday 22 Sep 2026, 10:00 local
const REF = new Date(2026, 8, 22, 10, 0);

describe("event", () => {
  test("dinner with priya friday 8pm", () => {
    const e = parseEvent("dinner with priya friday 8pm", REF);
    expect(e.title).toBe("Dinner");
    expect(e.people).toEqual(["Priya"]);
    expect(e.date?.getDay()).toBe(5);
    expect(e.date?.getHours()).toBe(20);
    expect(e.hasTime).toBe(true);
  });
  test("on zoom → link", () => {
    const e = parseEvent("dinner with priya friday 8pm on zoom", REF);
    expect(e.link).toBe("Zoom");
    expect(e.people).toEqual(["Priya"]);
    expect(e.title).toBe("Dinner");
  });
  test("multiple people", () => {
    expect(parseEvent("lunch with rahul and anna tomorrow", REF).people).toEqual(["Rahul", "Anna"]);
  });
  test("partial: no date", () => {
    const e = parseEvent("coffee with sam", REF);
    expect(e.date).toBeNull();
    expect(e.title).toBe("Coffee");
  });
  test("location", () => {
    const e = parseEvent("team sync at blue tokai monday 10am", REF);
    expect(e.location).toBe("Blue Tokai");
    expect(e.title).toBe("Team sync");
  });
  test("empty", () => {
    expect(parseEvent("", REF).title).toBe("");
  });
});

describe("reminder", () => {
  test("remind me to call mom tomorrow", () => {
    const r = parseReminder("remind me to call mom tomorrow", REF);
    expect(r.task).toBe("Call mom");
    expect(r.when?.getDate()).toBe(23);
    expect(r.hasTime).toBe(false);
  });
  test("urgent word stripped", () => {
    expect(parseReminder("remind me to pay rent tomorrow urgent", REF).task).toBe("Pay rent");
  });
  test("with time", () => {
    const r = parseReminder("remind me to stretch at 4pm", REF);
    expect(r.hasTime).toBe(true);
    expect(r.task).toBe("Stretch");
  });
  test("no time", () => {
    expect(parseReminder("remind me to water plants", REF).when).toBeNull();
  });
  test("don't forget", () => {
    expect(parseReminder("don't forget to email ravi", REF).task).toBe("Email ravi");
  });
  test("'before <date>' is a deadline, and the word leaves the task (F-035)", () => {
    const r = parseReminder("remind me to book a table before fri 1pm", REF);
    expect(r.task).toBe("Book a table");
    expect(r.isDeadline).toBe(true);
    expect(r.hasTime).toBe(true);
  });
  test("'before' with no date stays in the task", () => {
    const r = parseReminder("remind me to stretch before bed", REF);
    expect(r.task).toBe("Stretch before bed");
    expect(r.isDeadline).toBe(false);
  });
  test("a plain date is not a deadline", () => {
    expect(parseReminder("remind me to call mom tomorrow", REF).isDeadline).toBe(false);
  });
});

describe("todo", () => {
  test("buy milk, eggs, bread and coffee", () => {
    const t = parseTodo("buy milk, eggs, bread and coffee");
    expect(t.items).toEqual(["Milk", "Eggs", "Bread", "Coffee"]);
    expect(t.verb).toBe("buy");
  });
  test("newlines", () => expect(parseTodo("wash car\nfile taxes").items).toEqual(["Wash car", "File taxes"]));
  test("ampersand", () => expect(parseTodo("pens & paper").items).toEqual(["Pens", "Paper"]));
  test("drops empties", () => expect(parseTodo("a,, b ,").items).toEqual(["A", "B"]));
  test("prefix", () => expect(parseTodo("todo: laundry; dishes").items).toEqual(["Laundry", "Dishes"]));
});

describe("timer", () => {
  test("25 min focus", () => expect(parseTimer("25 min focus")).toEqual({ seconds: 1500, label: "Focus" }));
  test("timer 10 minutes", () => expect(parseTimer("timer 10 minutes").seconds).toBe(600));
  test("1h 30m", () => expect(parseTimer("1h 30m").seconds).toBe(5400));
  test("pomodoro", () => expect(parseTimer("pomodoro").seconds).toBe(1500));
  test("no duration", () => expect(parseTimer("stopwatch").seconds).toBeNull());
  test("seconds", () => expect(parseTimer("45 sec plank").seconds).toBe(45));
  test("clock", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(5400)).toBe("1:30:00");
  });
});

describe("habit", () => {
  test("meditate every morning", () => {
    const h = parseHabit("meditate every morning");
    expect(h.title).toBe("Meditate");
    expect(h.days).toHaveLength(7);
    expect(h.label).toBe("Every morning");
  });
  test("gym 3x a week", () => {
    const h = parseHabit("gym 3x a week");
    expect(h.title).toBe("Gym");
    expect(h.perWeek).toBe(3);
    expect(h.days).toEqual([1, 3, 5]);
  });
  test("weekday names", () => expect(parseHabit("run on monday and thursday").days).toEqual([1, 4]));
  test("daily", () => expect(parseHabit("read daily").title).toBe("Read"));
  test("weekdays", () => expect(parseHabit("journal weekdays").days).toEqual([1, 2, 3, 4, 5]));
});

describe("color", () => {
  test("hex 6", () => expect(parseColor("#ff6b35").hex).toBe("#ff6b35"));
  test("hex 3", () => expect(parseColor("#f60").hex).toBe("#ff6600"));
  test("rgb", () => expect(parseColor("rgb(255, 107, 53)").hex).toBe("#ff6b35"));
  test("named, last word wins", () => {
    const c = parseColor("a warm sunset orange");
    expect(c.source).toBe("named");
    expect(c.name).toBe("orange");
  });
  test("minecraft diamond → reference color", () => {
    expect(parseColor("minecraft diamond")).toEqual({ hex: "#4aedd9", name: "minecraft diamond", source: "named" });
  });
  test("reference beats plain name", () => expect(parseColor("tiffany blue").hex).toBe("#0abab5"));
  test("hyphen and spacing variants", () => expect(parseColor("coca-cola red").hex).toBe("#f40009"));
  test("gem", () => expect(parseColor("ruby").name).toBe("ruby"));
  test("evocative word when nothing else", () => expect(parseColor("the color of the ocean").name).toBe("ocean"));
  test("plain name still beats evocative", () => expect(parseColor("a warm sunset orange").name).toBe("orange"));
    test("mood fallback", () => expect(parseColor("something cozy", "warm").source).toBe("mood"));
  test("nothing", () => expect(parseColor("hmm").hex).toBeNull());
  test("oklch round trip and 5 shades", () => {
    const o = hexToOklch("#3b5bdb")!;
    expect(oklchToHex(o)).toBe("#3b5bdb");
    expect(shades("#ff6b35")).toHaveLength(5);
  });
});

describe("split", () => {
  test("split 2400 between 3", () => expect(parseSplit("split 2400 between 3")).toEqual({ total: 2400, people: 3, currency: "₹" }));
  test("dollars", () => expect(parseSplit("split $90 among four").currency).toBe("$"));
  test("names", () => expect(parseSplit("split 900 between me, rahul and priya").people).toBe(3));
  test("ways", () => expect(parseSplit("1,200 4 ways").total).toBe(1200));
  test("partial", () => expect(parseSplit("split 500")).toEqual({ total: 500, people: null, currency: "₹" }));
});

describe("expense", () => {
  test("spent 450 on uber", () => expect(parseExpense("spent 450 on uber")).toMatchObject({ amount: 450, item: "Uber" }));
  test("rs prefix", () => expect(parseExpense("paid rs. 1,299 for headphones").amount).toBe(1299));
  test("at", () => expect(parseExpense("120 at starbucks").item).toBe("Starbucks"));
  test("no amount", () => expect(parseExpense("spent on lunch").amount).toBeNull());
  test("k suffix", () => expect(parseExpense("spent 2k on groceries").amount).toBe(2000));
});

describe("convert", () => {
  test("5 miles in km", () => {
    const c = parseConvert("5 miles in km");
    expect(c.from).toBe("mi");
    expect(c.to).toBe("km");
    expect(c.result).toBeCloseTo(8.047, 2);
  });
  test("72f to c", () => expect(parseConvert("72f to c").result).toBeCloseTo(22.22, 1));
  test("kg to lbs", () => expect(parseConvert("10 kg to lbs").result).toBeCloseTo(22.05, 1));
  test("partial with default target", () => expect(parseConvert("100 km").to).toBe("mi"));
  test("degrees phrasing", () => expect(parseConvert("30 degrees c in f").result).toBeCloseTo(86, 1));
  test("nothing", () => expect(parseConvert("hello").value).toBeNull());
});

describe("calc", () => {
  test("18% of 3450", () => expect(parseCalc("18% of 3450").result).toBeCloseTo(621));
  test("(120+80)*3", () => expect(parseCalc("(120+80)*3").result).toBe(600));
  test("precedence", () => expect(evaluate("2+3*4^2")).toBe(50));
  test("right assoc power", () => expect(evaluate("2^3^2")).toBe(512));
  test("unary minus", () => expect(evaluate("-3+5")).toBe(2));
  test("x and ÷", () => expect(parseCalc("12 x 4 ÷ 2").result).toBe(24));
  test("invalid", () => expect(parseCalc("(1+").result).toBeNull());
  test("percent off", () => expect(parseCalc("20% off 1500").result).toBe(1200));
});

describe("travel", () => {
  test("flight to goa next weekend", () => {
    const t = parseTravel("flight to goa next weekend", REF);
    expect(t.destination).toBe("Goa");
    expect(t.start?.getDay()).toBe(6);
    expect(t.end?.getDay()).toBe(0);
  });
  test("range", () => {
    const t = parseTravel("trip to tokyo 12-15 oct", REF);
    expect(t.destination).toBe("Tokyo");
    expect(t.start?.getDate()).toBe(12);
    expect(t.end?.getDate()).toBe(15);
  });
  test("origin", () => {
    const t = parseTravel("train from mumbai to pune tomorrow", REF);
    expect(t.origin).toBe("Mumbai");
    expect(t.destination).toBe("Pune");
  });
  test("multi-word", () => expect(parseTravel("trip to new york", REF).destination).toBe("New York"));
  test("no destination", () => expect(parseTravel("flight", REF).destination).toBeNull());
});

describe("poll", () => {
  test("pizza or burgers for friday?", () => {
    const p = parsePoll("pizza or burgers for friday?");
    expect(p.options).toEqual(["Pizza", "Burgers"]);
    expect(p.title).toBe("Pizza or burgers for friday?");
  });
  test("stem from question words", () => {
    const p = parsePoll("should we get pizza or burgers");
    expect(p.options).toEqual(["Pizza", "Burgers"]);
    expect(p.title).toBe("Should we get?");
  });
  test("colon stem", () => {
    const p = parsePoll("lunch: thai, sushi or tacos");
    expect(p.title).toBe("Lunch?");
    expect(p.options).toEqual(["Thai", "Sushi", "Tacos"]);
  });
  test("vs", () => expect(parsePoll("tabs vs spaces").options).toEqual(["Tabs", "Spaces"]));
  test("no options", () => expect(parsePoll("pizza").options).toEqual([]));
});

describe("contact", () => {
  test("rahul 98200 12345 rahul@mail.com", () => {
    const c = parseContact("rahul 98200 12345 rahul@mail.com");
    expect(c).toEqual({ name: "Rahul", phone: "98200 12345", email: "rahul@mail.com", initials: "R" });
  });
  test("+91", () => expect(parseContact("anna sharma +91 98765 43210").phone).toBe("+91 98765 43210"));
  test("initials", () => expect(parseContact("anna sharma a@b.co").initials).toBe("AS"));
  test("email only", () => expect(parseContact("sam@x.io").name).toBe(""));
  test("save prefix", () => expect(parseContact("save priya 9820012345").name).toBe("Priya"));
});

describe("link", () => {
  test("https://vercel.com/blog check later", () => {
    const l = parseLink("https://vercel.com/blog check later");
    expect(l.domain).toBe("vercel.com");
    expect(l.monogram).toBe("V");
    expect(l.note).toBe("Check later");
  });
  test("www", () => expect(parseLink("www.example.org").domain).toBe("example.org"));
  test("bare domain", () => expect(parseLink("read linear.app/method").url).toBe("https://linear.app/method"));
  test("trailing punctuation", () => expect(parseLink("see https://a.dev/x.").url).toBe("https://a.dev/x"));
  test("no url", () => expect(parseLink("nothing here").url).toBeNull());
});

describe("note", () => {
  test("single line", () => expect(parseNote("thinking about moving to a smaller place").title).toBe("Thinking about moving to a smaller place"));
  test("multi line", () => expect(parseNote("idea\nbuild a thing")).toEqual({ title: "Idea", body: "build a thing" }));
  test("sentences", () => expect(parseNote("Big day today. Shipped the thing and it went well").body).toBe("Shipped the thing and it went well"));
  test("empty", () => expect(parseNote("").title).toBe(""));
  test("trims", () => expect(parseNote("  hello   world ").title).toBe("Hello world"));
});

import { parseCountdown } from "@/lib/parse/countdown";
import { dayShift, formatIn, parseTimezone, wallTimeToInstant } from "@/lib/parse/timezone";
import { parseRandom, rollRandom } from "@/lib/parse/random";
import { parseGoal } from "@/lib/parse/goal";

describe("countdown", () => {
  test("days until christmas", () => expect(parseCountdown("days until christmas", REF)).toMatchObject({ title: "Christmas", days: 94 }));
  test("holiday already passed rolls to next year", () => expect(parseCountdown("halloween", new Date(2026, 10, 5)).date?.getFullYear()).toBe(2027));
  test("dated event", () => {
    const c = parseCountdown("how many days till my birthday on dec 12", REF);
    expect(c.days).toBe(81);
    expect(c.title).toBe("My birthday");
  });
  test("tomorrow", () => expect(parseCountdown("countdown to launch tomorrow", REF).days).toBe(1));
  test("nothing", () => expect(parseCountdown("countdown", REF).days).toBeNull());
});

describe("timezone", () => {
  const at = new Date(Date.UTC(2026, 0, 15, 12, 0)); // January: no DST in the US
  test("3pm pst in ist", () => {
    const tz = parseTimezone("3pm pst in ist", at);
    expect(tz.from.tz).toBe("America/Los_Angeles");
    expect(tz.to?.tz).toBe("Asia/Kolkata");
    expect(formatIn("America/Los_Angeles", tz.instant!)).toBe("3:00 PM");
    expect(formatIn("Asia/Kolkata", tz.instant!)).toBe("4:30 AM");
    expect(dayShift("America/Los_Angeles", "Asia/Kolkata", tz.instant!)).toBe(1);
  });
  test("time in tokyo is now, local → tokyo", () => {
    const tz = parseTimezone("what time is it in tokyo", at);
    expect(tz.isNow).toBe(true);
    expect(tz.to?.label).toBe("Tokyo");
  });
  test("single zone after a time is the source", () => expect(parseTimezone("9am london", at).from.label).toBe("London"));
  test("24h clock", () => expect(formatIn("Europe/Paris", parseTimezone("14:30 paris to new york", at).instant!)).toBe("2:30 PM"));
  test("DST-aware wall time", () => {
    const summer = new Date(Date.UTC(2026, 6, 1, 12));
    expect(formatIn("America/New_York", wallTimeToInstant("America/New_York", 9, 0, summer))).toBe("9:00 AM");
  });
});

describe("random", () => {
  test("2d6", () => expect(parseRandom("roll 2d6")).toEqual({ kind: "dice", count: 2, sides: 6 }));
  test("a die", () => expect(parseRandom("roll a die")).toEqual({ kind: "dice", count: 1, sides: 6 }));
  test("coin", () => expect(parseRandom("flip a coin")).toEqual({ kind: "coin" }));
  test("range", () => expect(parseRandom("random number 1-100")).toEqual({ kind: "number", min: 1, max: 100 }));
  test("pick", () => expect(parseRandom("pick one: tacos, sushi or pizza")).toEqual({ kind: "pick", options: ["Tacos", "Sushi", "Pizza"] }));
  test("rolls stay in range", () => {
    const rolls = Array.from({ length: 200 }, () => Number(rollRandom({ kind: "dice", count: 1, sides: 6 })[0]));
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...rolls)).toBeLessThanOrEqual(6);
  });
});

describe("goal", () => {
  test("read 12 books this year, 4 done", () => expect(parseGoal("read 12 books this year, 4 done")).toMatchObject({ current: 4, target: 12, unit: "books" }));
  test("x of y", () => expect(parseGoal("4 of 10 workouts")).toMatchObject({ current: 4, target: 10 }));
  test("slash", () => expect(parseGoal("pages 120/300")).toMatchObject({ current: 120, target: 300 }));
  test("money with k", () => expect(parseGoal("save 50k for a trip, saved 12k")).toMatchObject({ current: 12000, target: 50000 }));
  test("no target", () => expect(parseGoal("learn piano").target).toBeNull());
});

describe("misspelled tomorrow (shared findDate)", () => {
  test.each(["tommorow", "tomorow", "tommorrow", "2moro"])("%s", (w) => {
    const r = parseReminder(`remind me to call mom ${w}`, REF);
    expect(r.when?.getDate()).toBe(23);
    expect(r.task).toBe("Call mom");
    expect(parseEvent(`dinner with priya ${w} 8pm`, REF).date?.getDate()).toBe(23);
  });
  test("words that only look similar are not dates", () => {
    expect(parseReminder("remind me to buy tomatoes", REF).when).toBeNull();
  });
});

describe("issue", () => {
  test("full sentence: peels date, mentions, priority and type word", () => {
    const i = parseIssue("bug checkout broken on safari @riya cc @sam high priority by friday", REF);
    expect(i.summary).toBe("Checkout broken on safari");
    expect(i.assignee).toBe("Riya");
    expect(i.collaborators).toEqual(["Sam"]);
    expect(i.priority).toBe("high");
    expect(i.due?.getDay()).toBe(5);
    expect(i.hasTime).toBe(false);
  });
  test("an email address is not a mention", () => {
    const i = parseIssue("email riya@acme.com about the api", REF);
    expect(i.assignee).toBeNull();
    expect(i.summary).toBe("Email riya@acme.com about the api");
  });
  test("p1 is a priority and 1pm is a time", () => {
    const i = parseIssue("p1 typo in footer today at 1pm", REF);
    expect(i.priority).toBe("high");
    expect(i.due?.getHours()).toBe(13);
    expect(i.summary).toBe("Typo in footer");
  });
  test.each([
    ["p0 crash", "high"],
    ["p2 crash", "medium"],
    ["p4 crash", "low"],
    ["priority: low crash", "low"],
    ["crash normal priority", "medium"],
    ["urgent crash", "high"],
  ] as const)("explicit priority: %s", (text, level) => {
    const i = parseIssue(text, REF);
    expect(i.priority).toBe(level);
    expect(i.summary).toBe("Crash");
  });
  test("a bare high is not a priority", () => {
    const i = parseIssue("memory usage high on server", REF);
    expect(i.priority).toBeNull();
    expect(i.summary).toBe("Memory usage high on server");
  });
  test.each([
    ["login broken since monday", "Login broken since monday"],
    ["login broken from monday", "Login broken from monday"],
    ["code freeze from monday to friday", "Code freeze from monday to friday"],
    ["crash after monday deploy", "Crash after monday deploy"],
    ["errors from yesterday's deploy", "Errors from yesterday's deploy"],
    ["checkout crashed yesterday", "Checkout crashed yesterday"],
  ])("not a due date: %s", (text, summary) => {
    const i = parseIssue(text, REF);
    expect(i.due).toBeNull();
    expect(i.summary).toBe(summary);
  });
  test("today still counts as due, even after chrono's noon", () => {
    const evening = new Date(2026, 8, 22, 18, 0);
    expect(parseIssue("ship hotfix today", evening).due?.getDate()).toBe(22);
  });
  test("from elsewhere in the sentence doesn't block a due date", () => {
    expect(parseIssue("move from staging to prod by friday", REF).due?.getDay()).toBe(5);
  });
  test("cc only: collaborators but no assignee", () => {
    const i = parseIssue("update readme cc @sam @jo", REF);
    expect(i.assignee).toBeNull();
    expect(i.collaborators).toEqual(["Sam", "Jo"]);
  });
  test("two mentions before cc: first assigns, the rest collaborate, no duplicates", () => {
    const i = parseIssue("fix login @riya @sam cc @riya", REF);
    expect(i.assignee).toBe("Riya");
    expect(i.collaborators).toEqual(["Sam"]);
  });
  test("your sentence: typo'd date, connectors peeled with date and priority", () => {
    const i = parseIssue("chekout broken on safari @sharon and fix it by tommorow as its high priority", REF);
    expect(i.due?.getDate()).toBe(23);
    expect(i.priority).toBe("high");
    expect(i.assignee).toBe("Sharon");
    expect(i.summary).toBe("Chekout broken on safari and fix it");
  });
  test.each([
    ["fix login by friday asap", "Fix login"],
    ["as it's high priority, fix checkout today", "Fix checkout"],
    ["update readme due by monday", "Update readme"],
  ])("no connector leaks: %s", (text, summary) => expect(parseIssue(text, REF).summary).toBe(summary));
  test("type word with a colon is stripped", () => {
    expect(parseIssue("story: users can export reports as pdf", REF).summary).toBe("Users can export reports as pdf");
  });
});

describe("issue suggestions (Did you mean?)", () => {
  const offer = (t: string) => suggestIssue(t).map((x) => `${t.slice(x.start, x.end)}→${x.to}`);
  test("a trailing bare priority word", () => expect(offer("checkout broken on safari @riya high")).toEqual(["high→high priority"]));
  test.each(["memory usage high on server", "crash on login high priority", "priority high", "crash p1 high"])("no nag: %s", (t) =>
    expect(offer(t)).toEqual([]),
  );
  test("a name without @ after assign", () => expect(offer("fix login, assign to riya")).toEqual(["riya→@riya"]));
  test("pronouns are not names", () => expect(offer("assign it to me")).toEqual([]));
  test.each([
    ["fix login, assign to @riya", []],
    ["fix login assigned to @riya high", ["high→high priority"]],
  ])("already a mention, so no name offer (F-026): %s", (t, expected) => expect(offer(t)).toEqual(expected));
  test("accepting rewrites the text and the parser then reads it for certain", () => {
    const t = "fix login, assign to riya high";
    let text = t;
    for (const s of suggestIssue(t).reverse()) text = applySuggestion(text, s); // right to left keeps earlier positions valid
    const i = parseIssue(text, REF);
    expect(text).toBe("fix login, assign to @riya high priority");
    expect(i).toMatchObject({ summary: "Fix login", assignee: "Riya", priority: "high" });
  });
});

describe("expense: billing words aren't part of the item (F-001)", () => {
  test.each([
    ["cab to client site 640 billable", "Cab to client site"],
    ["billable cab to client site 640", "Cab to client site"],
    ["640 cab non-billable", "Cab"],
    ["lunch with client 1200 reimbursable", "Lunch with client"],
    ["paid 300 for parking, billable to acme", "Parking"],
  ])("%s → %s", (text, item) => expect(parseExpense(text).item).toBe(item));
});

describe("appendAt: a card types into its own span of the line", () => {
  test("at the end of the line, like the single card always did", () => {
    expect(appendAt("meditate every morning", 22, " at 7am")).toEqual({ text: "meditate every morning at 7am", caret: 29 });
  });
  test("a trailing '?' stays last", () => {
    expect(appendAt("pizza or burgers? ", 18, " or ")).toEqual({ text: "pizza or burgers or ?", caret: 20 });
  });
  test("a todo in the first half: the text lands before the join", () => {
    expect(appendAt("buy milk; remind me to check it", 8, ", ")).toEqual({ text: "buy milk, ; remind me to check it", caret: 10 });
  });
  test("a poll in the first half keeps its '?'", () => {
    expect(appendAt("pizza or burgers? and remind me to order", 17, " or ").text).toBe("pizza or burgers or ? and remind me to order");
  });
});
