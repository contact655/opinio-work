"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CareerTurnModal } from "@/components/profile/editor/CareerTurnModal";

/**
 * ★ホームの「振り返りの1問目」（状態 B。2026-10-27 / 柴さんの決定 7）。
 *   直近の会社の転機（3問）を、マイページと同じモーダルで答えてもらう。保存したらホームを読み直す（状態が変わるため）
 */
export default function HomeTurnCard({ experienceId, companyName }: { experienceId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <section data-state="home-turn" className="home-box">
      <h2 className="home-h2">{companyName}を選んだ決め手は？</h2>
      <p className="home-lead">
        3つの質問に答えると、あなたに合う会社の理由が、あなたの選び方に合わせて変わります。回答は公開されず、会社にも伝わりません。
      </p>
      <button type="button" onClick={() => setOpen(true)} data-action="home-turn-open"
        style={{ marginTop: 12, padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
        答える
      </button>
      <CareerTurnModal
        open={open}
        experienceId={experienceId}
        companyName={companyName}
        onNext={null}
        /* ⚠️ 保存では読み直さない。読み直すと状態が C/D に変わってこのカードごと消え、
              モーダルの続き（任意の段・傾向）が出ないまま閉じる（2026-10-27 に踏んだ）。閉じたときに読み直す */
        onSaved={() => {}}
        onClose={() => { setOpen(false); router.refresh(); }}
      />
    </section>
  );
}
