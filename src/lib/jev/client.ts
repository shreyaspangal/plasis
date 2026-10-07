import "server-only";
import { APIUserAbortError, TypeSafeClient } from "@typesafe-ai/sdk";
import { questions, QUESTION_COUNT } from "./questions";
import type { Answer, IntentResult } from "./types";

let client: TypeSafeClient | null = null;
let warned = false;

/** A real-looking key: not empty and not a copied placeholder like "sk-..." or "your-key-here". */
export function looksLikeKey(key: string | undefined): key is string {
  const k = key?.trim() ?? "";
  return k.length >= 12 && !/\.\.\.|your|xxx|placeholder|changeme|<|>/i.test(k);
}

/**
 * Where Jev is reached: TypeSafe directly, or Vercel AI Gateway's TypeSafe-compatible API
 * (https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe). A TypeSafe key wins if both are set.
 */
function jevRoute(): { apiKey: string; baseURL?: string; model: string; via: string } | null {
  if (looksLikeKey(process.env.TYPESAFE_API_KEY)) {
    return { apiKey: process.env.TYPESAFE_API_KEY, model: process.env.JEV_MODEL || "jev-latest", via: "TypeSafe" };
  }
  if (looksLikeKey(process.env.AI_GATEWAY_API_KEY)) {
    return {
      apiKey: process.env.AI_GATEWAY_API_KEY,
      baseURL: "https://ai-gateway.vercel.sh/typesafe",
      // JEV_MODEL names a TypeSafe version (jev-1.13.0); the gateway only knows its own id (F-028).
      model: "typesafe-ai/jev",
      via: "AI Gateway",
    };
  }
  return null;
}

/**
 * Offline by default. The online Jev model is used only when a real API key is set,
 * and NEXT_PUBLIC_USE_MOCK=true can still force offline for UI work and demos.
 */
export function classifierMode(): { mode: "online" | "offline"; reason: string } {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return { mode: "offline", reason: "NEXT_PUBLIC_USE_MOCK=true" };
  const route = jevRoute();
  if (!route) return { mode: "offline", reason: "no TYPESAFE_API_KEY or AI_GATEWAY_API_KEY set" };
  return { mode: "online", reason: `using ${route.model} via ${route.via}` };
}

export function warnMockOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.info(`[plasis] Offline classifier (jev-offline): ${reason}. Add a TypeSafe key to .env.local to go online.`);
}

function getClient() {
  if (!client) {
    const route = jevRoute();
    client = new TypeSafeClient({
      apiKey: route?.apiKey,
      baseURL: route?.baseURL,
      defaultModel: route?.model ?? "jev-latest",
      // One fast attempt: a stale answer is worse than falling back to the mock.
      retry: { maxRetries: 0 },
      timeout: 2500,
    });
  }
  return client;
}

function answer<T extends string>(r: { choice: T; confidence: number; probabilities: { readonly [k in T]: number } }): Answer<T> {
  return { value: r.choice, confidence: r.confidence, probabilities: { ...r.probabilities } as Partial<Record<T, number>> };
}

/** One call, every question in parallel. Throws on network / API errors. */
export async function classifyWithJev(text: string, signal?: AbortSignal): Promise<IntentResult> {
  const started = performance.now();
  const res = await getClient().systemOne({ state: { text }, questions }, { signal });
  const latencyMs = Math.round(performance.now() - started);
  const a = res.answers;

  return {
    intent: answer(a.intent),
    readiness: a.readiness.score,
    signals: {
      isQuestion: a.isQuestion.noul,
      recurring: a.recurring.noul,
      urgency: { score: a.urgency.score, confidence: a.urgency.confidence },
      tone: answer(a.tone),
      eventMode: answer(a.eventMode),
      transport: answer(a.transport),
      tripType: answer(a.tripType),
      expenseCategory: answer(a.expenseCategory),
      colorMood: answer(a.colorMood),
      timerKind: answer(a.timerKind),
      issueType: answer(a.issueType),
      hasExplicitOptions: a.hasExplicitOptions.noul,
      isShoppingList: a.isShoppingList.noul,
    },
    latencyMs,
    questionCount: QUESTION_COUNT,
    model: res.model,
    source: "jev",
  };
}

export { APIUserAbortError };
