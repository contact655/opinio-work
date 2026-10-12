"use client";

import { useCallback, useState } from "react";
import { PaneThread, type PaneThreadPage } from "@/components/approaches/PaneThread";
import type { ThreadMessage } from "@/lib/conversations/companyThread";

/**
 * ★右欄のメッセージ欄（PaneThread）を固定データで動かす（2026-10-12）。
 *   上の「さらに前のやり取りを表示（n件）」を押すと、10通ずつ（少し待ってから）上に足す。
 * ⚠️ DB を読まない。30通をこの中で作り、上へスクロールしたら 10通ずつ（少し待ってから）返す。
 */
const PAGE = 10;
const company = { id: "p-co", role: "company_admin", user_id: "u-co", user: { name: "柴久人" } };
const candidate = { id: "p-ca", role: "candidate", user_id: "u-ca", user: { name: "鈴木 鉄平" } };

function makeMessages(n: number): ThreadMessage[] {
  const start = new Date("2026-10-01T01:00:00Z").getTime();
  return Array.from({ length: n }, (_, i) => {
    const mine = i % 2 === 0;
    /* 3通ごとに日付が変わる（区切りの確認用）。長い文も混ぜる */
    const at = new Date(start + Math.floor(i / 3) * 86400000 + (i % 3) * 3600000).toISOString();
    const body = i === 0
      ? "（1通目）フィールドセールスの経験と、立ち上げ期の組織での動き方に惹かれてご連絡しました。"
      : i % 7 === 0 ? `${i + 1}通目。少し長めの文です。来週の水曜か木曜の午後であれば、30分ほどお時間をいただけますでしょうか。オンラインでも対面でも構いません。`
      : `${i + 1}通目のメッセージです。`;
    const p = mine ? company : candidate;
    return { id: `m${String(i + 1).padStart(2, "0")}`, body, kind: "text", payload: null, sent_at: at, sender_participant_id: p.id, participant: p };
  });
}

export function PaneThreadDemo({ total, height }: { total: number; height: number }) {
  const all = makeMessages(total);
  const page = (end: number): PaneThreadPage => ({
    conv: { id: "demo" }, isParticipant: true, messagesFailed: false, approachFirst: null, replyNote: null,
    total: all.length, messages: all.slice(Math.max(0, end - PAGE), end), hasMore: end > PAGE, firstAt: all[0]?.sent_at ?? null,
  });
  const [initial] = useState(() => page(all.length));
  const loadOlder = useCallback(async (before: string) => {
    await new Promise((r) => setTimeout(r, 500));
    const end = all.findIndex((m) => m.id === before);
    return end < 0 ? null : page(end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    /* ★右欄と同じく、外側の箱（overflow: auto）がスクロールする。PaneThread 自身は入れ子のスクロールを持たない（2026-10-12） */
    <div data-state="dev-pane-thread" style={{ maxWidth: 560, maxHeight: height, overflowY: "auto", padding: "4px 20px 20px", border: "1px dashed var(--line)", background: "#fff" }}>
      <PaneThread initial={initial} loadOlder={loadOlder}
        footer={<div style={{ padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--ink-mute)" }}>（ここに返信欄）</div>} />
    </div>
  );
}
