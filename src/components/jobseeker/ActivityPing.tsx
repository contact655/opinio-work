"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ★「最後に利用した日」を1日1回だけ記録する（2026-10-12）。求職者側のレイアウトに置く。
 * ⚠️ ログインしていなければ何もしない（`getSession()` はクッキーを読むだけでネットワークに出ない）。
 * ⚠️ 同じ日に何度も呼ばないよう、この端末で今日送ったかを localStorage に持つ（壊れていても API 側が1日1回に抑える）。
 */
const KEY = "ow_activity_ping";

export function ActivityPing() {
  useEffect(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
    try { if (localStorage.getItem(KEY) === today) return; } catch { /* 読めなくても送る（API が1日1回に抑える） */ }
    let alive = true;
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!alive || !session) return;
      fetch("/api/jobseeker/activity", { method: "POST" })
        .then((r) => { if (r.ok) { try { localStorage.setItem(KEY, today); } catch { /* 書けなくてもよい */ } } })
        .catch(() => { /* 失敗しても画面には出さない */ });
    });
    return () => { alive = false; };
  }, []);
  return null;
}
