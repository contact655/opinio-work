"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

type Options = {
  delayMs?: number;
  savedResetMs?: number;
  onSave?: () => Promise<void>;
};

export function useAutoSave(options: Options = {}) {
  const { delayMs = 700, savedResetMs = 2000, onSave } = options;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  // Ref で最新の onSave を保持する。trigger の useCallback 依存から外すことで
  // form が変わるたびに debounce タイマーがリセットされることを防ぐ。
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  const trigger = useCallback(() => {
    setSaveState("saving");
    clearTimeout(debounceTimer.current);
    clearTimeout(resetTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const fn = onSaveRef.current;
      if (!fn) {
        // onSave が未指定の場合はタイマーのみ（後方互換）
        setSaveState("saved");
        resetTimer.current = setTimeout(() => setSaveState("idle"), savedResetMs);
        return;
      }
      try {
        await fn();
        setSaveState("saved");
        resetTimer.current = setTimeout(() => setSaveState("idle"), savedResetMs);
      } catch {
        setSaveState("error");
        resetTimer.current = setTimeout(() => setSaveState("idle"), 4000);
      }
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
