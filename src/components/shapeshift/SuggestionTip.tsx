"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { Kbd } from "@/components/ui/kbd";
import { tween } from "@/lib/motion";
import type { Suggestion } from "@/lib/parse/common";

/** Same type settings as the main input, so the mirror measures exactly what's on screen. */
const INPUT_TYPE = "text-[22px] leading-8 font-[450] tracking-[-0.01em] whitespace-pre";

/**
 * Grammarly-style "Did you mean?": highlights the word inside the input and floats a tooltip under it.
 * An <input> can't style part of its text, so an invisible mirror measures where the word sits,
 * and positions are written straight to the DOM on every scroll, keystroke and resize.
 */
export function SuggestionTip({
  inputRef,
  text,
  suggestion,
  onAccept,
  onDeny,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  text: string;
  suggestion: Suggestion;
  onAccept: () => void;
  onDeny: () => void;
}) {
  const reduce = useReducedMotion();
  const prefix = useRef<HTMLSpanElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const box = input?.offsetParent as HTMLElement | null;
    if (!input || !box) return;
    const place = () => {
      if (!prefix.current || !word.current || !mark.current || !tip.current) return;
      const left = input.offsetLeft + prefix.current.offsetWidth - input.scrollLeft;
      const width = word.current.offsetWidth;
      // Hidden while the word is scrolled out of the visible part of the input.
      const visible = left + width > input.offsetLeft && left < input.offsetLeft + input.clientWidth;
      Object.assign(mark.current.style, {
        left: `${left}px`,
        width: `${width}px`,
        top: `${input.offsetTop}px`,
        height: `${input.offsetHeight}px`,
      });
      const tipLeft = Math.max(8, Math.min(left - 12, box.clientWidth - tip.current.offsetWidth - 8));
      Object.assign(tip.current.style, { left: `${tipLeft}px`, top: `${input.offsetTop + input.offsetHeight + 8}px` });
      mark.current.style.visibility = tip.current.style.visibility = visible ? "visible" : "hidden";
    };
    // The browser updates scrollLeft after key events, so measure on the next frame.
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    const events = ["scroll", "keydown", "keyup", "click", "select"] as const;
    events.forEach((e) => input.addEventListener(e, schedule));
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      events.forEach((e) => input.removeEventListener(e, schedule));
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [inputRef, text, suggestion]);

  return (
    <>
      {/* Mirror: never visible, only measured. */}
      <span aria-hidden className={`invisible absolute top-0 left-0 ${INPUT_TYPE}`}>
        <span ref={prefix}>{text.slice(0, suggestion.start)}</span>
        <span ref={word}>{text.slice(suggestion.start, suggestion.end)}</span>
      </span>

      {/* Highlight behind the word (the input sits above it with a transparent background). */}
      <div ref={mark} aria-hidden className="border-brand bg-brand/10 pointer-events-none absolute z-0 rounded-sm border-b-2" />

      <div ref={tip} className="absolute z-20">
        <motion.div
          role="dialog"
          aria-label="Did you mean?"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={tween.fade}
          className="border-border bg-popover text-popover-foreground flex w-max max-w-[300px] flex-col gap-2 rounded-xl border p-3 shadow-[var(--shadow-float)]"
        >
          <p className="text-muted-foreground text-[12px] leading-4 font-medium">Did you mean?</p>
          <p aria-live="polite" className="flex items-center gap-1.5 text-[15px] leading-5">
            <span className="text-muted-foreground decoration-muted-foreground/60 line-through">{suggestion.from}</span>
            <ArrowRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
            <span className="font-medium">{suggestion.to}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onAccept}
              className="bg-foreground text-background focus-visible:outline-ring inline-flex h-7 items-center gap-1.5 rounded-full ps-3 pe-1.5 text-[13px] font-medium transition-[scale,opacity] duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.96]"
            >
              Accept <Kbd className="bg-background/15 text-background">Tab</Kbd>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDeny}
              className="text-ink-2 hover:bg-secondary focus-visible:outline-ring inline-flex h-7 items-center gap-1.5 rounded-full ps-3 pe-1.5 text-[13px] font-medium transition-[scale,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.96]"
            >
              Deny <Kbd>Esc</Kbd>
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
