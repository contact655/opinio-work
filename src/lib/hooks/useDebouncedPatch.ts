// useDebouncedPatch — 汎用デバウンス保存フック
// ν-8 段階6-1 コミット B で patchBasicInfo / patchSocialLinks を統合
//
// 使い方:
//   const { patch, status } = useDebouncedPatch({ endpoint: "/api/jobseeker/profile" });
//   patch({ name: "新しい名前" });  // 700ms デバウンスで PUT 送信
//
// 複数フィールドを短時間で変更した場合はペイロードをマージして 1 回の PUT で送信する。

import { useCallback, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type UseDebouncedPatchOptions = {
  /** 送信先エンドポイント（例: "/api/jobseeker/profile"） */
  endpoint: string;
  /** デバウンス遅延 ms（デフォルト: 700） */
  delay?: number;
  /** saved 表示後に idle に戻るまでの ms（デフォルト: 2000） */
  resetDelay?: number;
};

export function useDebouncedPatch(options: UseDebouncedPatchOptions) {
  const { endpoint, delay = 700, resetDelay = 2000 } = options;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 複数回 patch() が呼ばれた場合のペイロード蓄積領域
  const pendingRef = useRef<Record<string, unknown>>({});

  const patch = useCallback(
    (payload: Record<string, unknown>) => {
      // ペイロードをマージ（同一キーは後勝ち）
      Object.assign(pendingRef.current, payload);

      // 既存タイマーをキャンセルして再スタート
      if (timerRef.current)  clearTimeout(timerRef.current);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      setStatus("saving");

      timerRef.current = setTimeout(async () => {
        const toSend = { ...pendingRef.current };
        pendingRef.current = {};

        try {
          const res = await fetch(endpoint, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toSend),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setStatus("saved");
          resetTimer.current = setTimeout(() => setStatus("idle"), resetDelay);
        } catch (e) {
          setStatus("error");
          console.error(`[useDebouncedPatch] PUT ${endpoint} failed:`, e);
        }
      }, delay);
    },
    [endpoint, delay, resetDelay]
  );

  return { patch, status } as const;
}
