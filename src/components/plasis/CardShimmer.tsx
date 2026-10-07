"use client";

import { motion, useReducedMotion } from "motion/react";
import { tween } from "@/lib/motion";

const bar = "rounded-full bg-secondary";

/** While the first answer is slow (> 400 ms) and no card shows yet: a card-shaped placeholder with a soft shine. */
export function CardShimmer() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: tween.exit }}
      transition={tween.fade}
      className="relative overflow-hidden px-5 pt-1 pb-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex min-h-11 items-center gap-3">
          <div className="size-11 rounded-md bg-secondary" />
          <div className={`${bar} h-3.5 w-20`} />
        </div>
        <div className={`${bar} h-4 w-48`} />
        <div className="flex gap-2">
          <div className={`${bar} h-7 w-20`} />
          <div className={`${bar} h-7 w-24`} />
        </div>
      </div>
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-card/70 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
}
