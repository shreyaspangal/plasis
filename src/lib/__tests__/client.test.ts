import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
const { classifierMode, looksLikeKey } = await import("@/lib/jev/client");

describe("API key detection", () => {
  test("empty or missing → offline", () => {
    expect(looksLikeKey(undefined)).toBe(false);
    expect(looksLikeKey("")).toBe(false);
    expect(looksLikeKey("   ")).toBe(false);
  });
  test("copied placeholders → offline", () => {
    expect(looksLikeKey("sk-...")).toBe(false);
    expect(looksLikeKey("your-api-key-here")).toBe(false);
    expect(looksLikeKey("<TYPESAFE_API_KEY>")).toBe(false);
  });
  test("a real-looking key → online", () => {
    expect(looksLikeKey("sk-live-8f2c1a9b7d6e5f40")).toBe(true);
  });
});

describe("Jev route (F-028)", () => {
  const KEY = "sk-live-8f2c1a9b7d6e5f40";
  const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    Object.assign(process.env, env);
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    try {
      fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  const base = { NEXT_PUBLIC_USE_MOCK: undefined, TYPESAFE_API_KEY: undefined, AI_GATEWAY_API_KEY: undefined, JEV_MODEL: "jev-1.13.0" };
  test("gateway ignores JEV_MODEL", () =>
    withEnv({ ...base, AI_GATEWAY_API_KEY: KEY }, () => expect(classifierMode().reason).toBe("using typesafe-ai/jev via AI Gateway")));
  test("TypeSafe keeps JEV_MODEL and wins over the gateway", () =>
    withEnv({ ...base, TYPESAFE_API_KEY: KEY, AI_GATEWAY_API_KEY: KEY }, () =>
      expect(classifierMode().reason).toBe("using jev-1.13.0 via TypeSafe"),
    ));
});
