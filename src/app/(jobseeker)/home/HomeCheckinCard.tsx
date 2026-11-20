"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JoinCheckinModal } from "@/components/profile/editor/JoinCheckinModal";
import { CHECKIN_PRIVACY_NOTE, checkpointOf, type CheckpointKey } from "@/lib/joinCheckin/constants";

/**
 * ★ホームの「入社後のふり返り」（入社3か月・1年。2026-11-20）。
 *   在籍中の会社について、いま聞くべき時点があるときだけ出す（判定はサーバー。lib/joinCheckin/server.ts の currentCheckinPrompt）。
 * ⚠️ 入社の決め手のカードが出ているときは出さない（page.tsx。1画面に聞くカードを2つ並べない）。
 * ★答えて保存したら、モーダルを閉じた時点でカードを消す（再読み込みを待たない。HomeDecisionCard と同じ）。
 *   「今回は答えない」を押したときも閉じた時点で消える（その時点はもう聞かない）。
 */
export default function HomeCheckinCard({ experienceId, companyName, checkpoint }: {
  experienceId: string; companyName: string; checkpoint: CheckpointKey;
}) {
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const router = useRouter();
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
          onSaved={() => setFinished(true)}
          onClose={() => { setOpen(false); setFinished(true); router.refresh(); }}
        />
      )}
    </section>
  );
}
