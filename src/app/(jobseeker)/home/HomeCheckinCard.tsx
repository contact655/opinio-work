"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JoinCheckinModal } from "@/components/profile/editor/JoinCheckinModal";
import { CHECKIN_POPUP_STORAGE_PREFIX, CHECKIN_PRIVACY_NOTE, checkpointOf, shouldAutoOpenCheckin, type CheckpointKey } from "@/lib/joinCheckin/constants";

/**
 * ★ホームの「入社後のふり返り」（入社3か月・1年。2026-11-20）。
 *   在籍中の会社について、いま聞くべき時点があるときだけ出す（判定はサーバー。lib/joinCheckin/server.ts の currentCheckinPrompt）。
 * ⚠️ 入社の決め手のカードが出ているときは出さない（page.tsx。1画面に聞くカードを2つ並べない）。
 * ★答えて保存したら、モーダルを閉じた時点でカードを消す（再読み込みを待たない。HomeDecisionCard と同じ）。
 *   「今回は答えない」を押したときも閉じた時点で消える（その時点はもう聞かない）。
 * ★ホームを開いたら画面の中央に自動で出す（2026-11-20 / 柴さんの指示）。× で閉じたら7日は自動では出さない
 *   （CHECKIN_POPUP_SNOOZE_DAYS。記録は端末の localStorage）。カードは残るので「ふり返る」からは開ける。
 * ⚠️ autoOpen=false のとき（転職意欲の「変わりありませんか？」を出す日）は自動で開かない。ポップアップを2つ重ねない。
 * ⚠️ localStorage はマウント後の effect で読む（初期化子で読むとサーバーの HTML と食い違う）。
 */
export default function HomeCheckinCard({ experienceId, companyName, checkpoint, autoOpen = true }: {
  experienceId: string; companyName: string; checkpoint: CheckpointKey; autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const savedRef = useRef(false);
  const router = useRouter();
  const storageKey = `${CHECKIN_POPUP_STORAGE_PREFIX}${experienceId}:${checkpoint}`;

  useEffect(() => {
    if (!autoOpen) return;
    let closedAtMs: number | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      closedAtMs = raw === null ? null : Number(raw);
    } catch { /* 読めなければ記録なしとして扱う */ }
    if (shouldAutoOpenCheckin({ closedAtMs, nowMs: Date.now() })) setOpen(true);
  }, [autoOpen, storageKey]);

  function handleClose() {
    /* ★保存せずに閉じた（× または「今回は答えない」）ときだけ、自動で出さない期間を記録する */
    if (!savedRef.current) {
      try { window.localStorage.setItem(storageKey, String(Date.now())); } catch { /* 書けなくても閉じる */ }
    }
    setOpen(false);
    setFinished(true);
    router.refresh();
  }
  if (finished && !open) return null;
  const cp = checkpointOf(checkpoint);
  return (
    <section data-state="home-checkin" className="home-box">
      <h2 className="home-h2">{companyName}に入って{cp.key === "3m" ? "3か月" : "1年"}。いまの職場はどうですか？</h2>
      <p className="home-lead">約1分。答えると、あなたが合う職場の傾向がわかります。{CHECKIN_PRIVACY_NOTE}。</p>
      <button type="button" onClick={() => setOpen(true)} data-action="home-checkin-open"
        style={{ marginTop: 12, padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
        ふり返る
      </button>
      {open && (
        <JoinCheckinModal
          open
          experienceId={experienceId}
          companyName={companyName}
          checkpoint={checkpoint}
          onSaved={() => { savedRef.current = true; setFinished(true); }}
          onClose={handleClose}
        />
      )}
    </section>
  );
}
