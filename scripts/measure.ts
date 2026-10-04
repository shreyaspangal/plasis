/**
 * Measure how often the offline scorer agrees with Jev (Phase 1, Checkpoint 7).
 * Dev-time only: calls the real Jev API with the key in .env.local, so it costs a little.
 *
 *   bun --conditions=react-server scripts/measure.ts [--out file.json]
 */
import { classifierMode, classifyWithJev } from "@/lib/jev/client";
import { mockClassify } from "@/lib/jev/mock";
import { SAMPLES } from "./samples";

const mode = classifierMode();
if (mode.mode !== "online") {
  console.error(`Jev is offline (${mode.reason}). Set TYPESAFE_API_KEY or AI_GATEWAY_API_KEY in .env.local.`);
  process.exit(1);
}

type Row = { group: string; text: string; jev: string; jevConf: number; mock: string; mockConf: number; jevType: string; mockType: string; ms: number; error?: string };

async function run(group: string, text: string): Promise<Row> {
  const mock = mockClassify(text);
  const base = { group, text, mock: mock.intent.value, mockConf: mock.intent.confidence, mockType: mock.signals.issueType.value };
  try {
    const jev = await classifyWithJev(text);
    return { ...base, jev: jev.intent.value, jevConf: jev.intent.confidence, jevType: jev.signals.issueType.value, ms: jev.latencyMs };
  } catch (e) {
    return { ...base, jev: "error", jevConf: 0, jevType: "-", ms: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

// A few at a time: well under the 40 requests/second limit.
const jobs = Object.entries(SAMPLES).flatMap(([group, texts]) => texts.map((t) => () => run(group, t)));
const rows: Row[] = [];
for (let i = 0; i < jobs.length; i += 5) rows.push(...(await Promise.all(jobs.slice(i, i + 5).map((j) => j()))));

const ok = rows.filter((r) => !r.error);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "-");
console.log(`\nJev ${mode.reason} · ${rows.length} sentences · ${rows.length - ok.length} errors\n`);
console.log("| Group | Card agreement | issueType agreement (both issue) |");
console.log("|---|---|---|");
for (const group of [...Object.keys(SAMPLES), "all"]) {
  const g = group === "all" ? ok : ok.filter((r) => r.group === group);
  const both = g.filter((r) => r.jev === "issue" && r.mock === "issue");
  console.log(`| ${group} | ${g.filter((r) => r.jev === r.mock).length}/${g.length} (${pct(g.filter((r) => r.jev === r.mock).length, g.length)}) | ${both.filter((r) => r.jevType === r.mockType).length}/${both.length} |`);
}

const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
console.log(`\nJev latency: median ${ms[Math.floor(ms.length / 2)]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms, max ${ms.at(-1)} ms`);

console.log("\nDisagreements (card):\n");
console.log("| Group | Sentence | Jev | Offline |");
console.log("|---|---|---|---|");
for (const r of ok.filter((r) => r.jev !== r.mock)) {
  console.log(`| ${r.group} | ${r.text} | ${r.jev} ${r.jevConf.toFixed(2)} | ${r.mock} ${r.mockConf.toFixed(2)} |`);
}
for (const r of rows.filter((r) => r.error)) console.log(`\nERROR ${r.text}: ${r.error}`);

const out = process.argv.indexOf("--out");
if (out !== -1) await Bun.write(process.argv[out + 1], JSON.stringify(rows, null, 2));
