"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type SaveState = "idle" | "saving" | "saved";

type Options = {
  delayMs?: number;
  savedResetMs?: number;
};

export function useAutoSave(options: Options = {}) {
  const { delayMs = 700, savedResetMs = 2000 } = options;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  const trigger = useCallback(() => {
    setSaveState("saving");
    clearTimeout(debounceTimer.current);
    clearTimeout(resetTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSaveState("saved");
      resetTimer.current = setTimeout(() => {
        setSaveState("idle");
      }, savedResetMs);
    }, delayMs);
  }, [delayMs, savedResetMs]);

  useEffect(() => {
    return () => {
      clearTimeout(debounceTimer.current);
      clearTimeout(resetTimer.current);
    };
  }, []);

  return { saveState, trigger };
}
