"use client";

import { useState } from "react";
import { registry } from "@/components/intents/registry";
import { findClauses } from "@/lib/clauses";
import { activeIntent, type DecideMemory, decide, initialMemory, pairOf } from "@/lib/decide";
import type { CardIntent } from "@/lib/jev/types";
import { type GatedSignals, gateSignals, neutralGated } from "@/lib/signals";
import { useIntent } from "./useIntent";

type Half = { mem: DecideMemory; gated: GatedSignals };
type HalfState = Half & { thinking: boolean };

/** One half of the line, with its own calm state and signal bands (the same as the single card). */
function useHalf(text: string): HalfState {
  const { result, resultText, status } = useIntent(text);
  const [half, setHalf] = useState<Half>({ mem: initialMemory, gated: neutralGated });
  const [seen, setSeen] = useState(result);
  if (seen !== result) {
    setSeen(result);
    const mem = decide(half.mem, result, resultText);
    const next = activeIntent(mem.ui);
    const prev = activeIntent(half.mem.ui) === next ? half.gated : neutralGated;
    setHalf({ mem, gated: next ? gateSignals(prev, result, registry[next].signals) : neutralGated });
  }
  return { ...half, thinking: status === "thinking" };
}

/** `at`: where the card's half starts in the line (its end is `at + text.length`). */
export type PairCard = { intent: CardIntent; text: string; at: number; ghost: boolean; signals: GatedSignals };

/**
 * Two cards from one line (`cards`, null for one). Each half is classified like a line of its own
 * (cached, so a first half you already typed is free). With no join, both halves are ""
 * and nothing is asked. `thinking`: a half is still being classified.
 */
export function usePair(text: string): { cards: [PairCard, PairCard] | null; thinking: boolean } {
  const clauses = findClauses(text);
  const first = useHalf(clauses?.first ?? "");
  const second = useHalf(clauses?.second ?? "");
  const pair = clauses && pairOf(first.mem.ui, second.mem.ui);
  const thinking = first.thinking || second.thinking;
  const cards: [PairCard, PairCard] | null = clauses && pair
    ? [
        { intent: pair[0], text: clauses.first, at: clauses.firstAt, ghost: first.mem.ui.kind === "ghost", signals: first.gated },
        { intent: pair[1], text: clauses.second, at: clauses.secondAt, ghost: second.mem.ui.kind === "ghost", signals: second.gated },
      ]
    : null;
  return { cards, thinking };
}
