"use client";

import { useState } from "react";
import { findClauses } from "@/lib/clauses";
import { type DecideMemory, decide, initialMemory, pairOf } from "@/lib/decide";
import type { CardIntent } from "@/lib/jev/types";
import { useIntent } from "./useIntent";

/** One half of the line, with its own calm state (the same hysteresis as the single card). */
function useHalf(text: string): DecideMemory {
  const { result, resultText } = useIntent(text);
  const [mem, setMem] = useState(initialMemory);
  const [seen, setSeen] = useState(result);
  if (seen !== result) {
    setSeen(result);
    setMem(decide(mem, result, resultText));
  }
  return mem;
}

export type PairCard = { intent: CardIntent; text: string };

/**
 * Two cards from one line, or null for one. Each half is classified like a line of its own
 * (cached, so a first half you already typed is free). With no join, both halves are ""
 * and nothing is asked.
 */
export function usePair(text: string): [PairCard, PairCard] | null {
  const clauses = findClauses(text);
  const first = useHalf(clauses?.first ?? "");
  const second = useHalf(clauses?.second ?? "");
  const pair = clauses && pairOf(first.ui, second.ui);
  return clauses && pair
    ? [
        { intent: pair[0], text: clauses.first },
        { intent: pair[1], text: clauses.second },
      ]
    : null;
}
