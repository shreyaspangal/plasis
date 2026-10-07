/**
 * Two-intent lines (Phase 2, Checkpoint 6): does each classifier, with our split rule, give the outcome we want?
 * Dev-time only: calls the real Jev API with the key in .env.local, so it costs a little.
 *
 *   bun --conditions=react-server scripts/measure-pairs.ts
 */
import { findClauses } from "@/lib/clauses";
import { pairOf, rawState } from "@/lib/decide";
import { classifierMode, classifyWithJev } from "@/lib/jev/client";
import { mockClassify } from "@/lib/jev/mock";
import type { IntentResult } from "@/lib/jev/types";
import { PAIR_SAMPLES } from "./samples";

const mode = classifierMode();
if (mode.mode !== "online") {
  console.error(`Jev is offline (${mode.reason}). Set TYPESAFE_API_KEY or AI_GATEWAY_API_KEY in .env.local.`);
  process.exit(1);
}

const label = (r: IntentResult) => `${r.intent.value} ${r.intent.confidence.toFixed(2)}`;
/** What the shell would show: the same rule as usePair (one shot, no hysteresis). */
const outcome = (a: IntentResult, b: IntentResult) => {
  const p = pairOf(rawState(a), rawState(b));
  return p ? `two (${p.join("+")})` : "one";
};

async function run([text, expect]: (typeof PAIR_SAMPLES)[number]) {
  const c = findClauses(text);
  if (!c) return { text, expect, offline: "one", jev: "one", halves: "no join" };
  const m = [mockClassify(c.first), mockClassify(c.second)] as const;
  try {
    const j = await Promise.all([classifyWithJev(c.first), classifyWithJev(c.second)]);
    return { text, expect, offline: outcome(...m), jev: outcome(...j), halves: `offline ${label(m[0])} / ${label(m[1])} · Jev ${label(j[0])} / ${label(j[1])}` };
  } catch (e) {
    return { text, expect, offline: outcome(...m), jev: "error", halves: e instanceof Error ? e.message : String(e) };
  }
}

// 5 lines at a time (≤ 10 calls), well under the 40 requests/second limit.
const rows: Awaited<ReturnType<typeof run>>[] = [];
for (let i = 0; i < PAIR_SAMPLES.length; i += 5) rows.push(...(await Promise.all(PAIR_SAMPLES.slice(i, i + 5).map(run))));

const right = (got: string, expect: string) => got.startsWith(expect);
console.log(`\nJev ${mode.reason} · ${rows.length} lines\n`);
console.log(`Offline ${rows.filter((r) => right(r.offline, r.expect)).length}/${rows.length} · Jev ${rows.filter((r) => right(r.jev, r.expect)).length}/${rows.length} correct\n`);
console.log("| Line | Want | Offline | Jev | Halves |");
console.log("|---|---|---|---|---|");
for (const r of rows.filter((r) => !right(r.offline, r.expect) || !right(r.jev, r.expect))) {
  console.log(`| ${r.text} | ${r.expect} | ${r.offline} | ${r.jev} | ${r.halves} |`);
}
