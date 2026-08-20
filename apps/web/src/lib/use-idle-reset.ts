"use client";

import { useEffect, useRef } from "react";

const DEFAULT_IDLE_RESET_MS = 120_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown"] as const;

/**
 * En mode kiosque, réinitialise automatiquement la démonstration après une
 * période d'inactivité (cahier des charges, section 23).
 */
export function useIdleReset(
  enabled: boolean,
  onReset: () => void,
  idleMs: number = DEFAULT_IDLE_RESET_MS,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function resetTimer() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(onReset, idleMs);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [enabled, onReset, idleMs]);
}
