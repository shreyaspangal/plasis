"use client";

import { type RefObject, useState } from "react";
import { applySuggestion, type Suggestion } from "@/lib/parse/common";
import { dismiss, liveDismissed, noneDismissed, pickSuggestion } from "@/lib/suggestions";

/** "Did you mean?" for the card in the shell: the current offer, plus accept and deny. */
export function useSuggestion({
  suggest,
  text,
  draftId,
  setText,
  inputRef,
}: {
  /** The committed card's suggester; undefined on ghosts and on cards without one. */
  suggest: ((text: string) => Suggestion[]) | undefined;
  text: string;
  draftId: number;
  setText: (text: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [stored, setStored] = useState(() => noneDismissed(draftId));
  // Forgotten during render (like Shapeshift's result fold), so a stale "no" never shows for a frame.
  const dismissed = liveDismissed(stored, text, draftId);
  if (dismissed !== stored) setStored(dismissed);
  const suggestion = suggest ? pickSuggestion(suggest(text), dismissed) : null;

  // Accepting rewrites the text ("high" → "high priority"), so the parser then reads it for certain.
  const accept = () => {
    if (!suggestion) return;
    setText(applySuggestion(text, suggestion));
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };
  const deny = () => {
    if (suggestion) setStored(dismiss(dismissed, suggestion.id));
  };

  return { suggestion, accept, deny };
}
