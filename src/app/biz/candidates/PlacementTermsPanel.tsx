"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TERMS_VERSION } from "@/lib/constants/terms";

/**
 * 人材紹介利用規約（成功報酬）への同意パネル。
 *
 * ⚠️ **掲載の同意とは別に、使うときに取る**（2026-08-14 に規約を2本へ分割）。
 *    掲載だけしたい企業に成功報酬の同意まで求めない、という判断による。
 * ⚠️ ここで出し分けるだけでは足りない。**API 側（POST /api/biz/scouts）でも
 *    同じ判定をすること。** 画面を隠すだけでは直接叩けてしまう。
 */
export function PlacementTermsPanel({ companyId }: { companyId: string }) {
  const [checked, setChecked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const agree = () => {
    if (!checked || isPending) return;
    startTransition(async () => {
      await fetch("/api/biz/terms-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        /* ⚠️ 版はハードコードしない。規約を改定したら termsAgreement.ts の
              TERMS_VERSION だけを直せば、両方の同意経路に反映される。 */
        body: JSON.stringify({ companyId, termsType: "placement", termsVersion: TERMS_VERSION }),
      });
      router.refresh();
    });
  };

  return (
    <div style={{
      marginBottom: 20, padding: "20px 24px",
      background: "var(--warm-soft)", border: "1px solid #FDE68A", borderRadius: 12,
    }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
        人材紹介利用規約への同意
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 14px" }}>
        スカウトの送信には{" "}
        <a href="/terms/placement" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 600 }}>
          人材紹介利用規約
        </a>
        （成功報酬・採用決定の報告など）への同意が必要です。
        <br />
        企業情報の掲載だけであれば、この同意は不要です。
      </p>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 14 }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer" }} />
        <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>
          <a href="/terms/placement" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>人材紹介利用規約</a>
          の全文を読み、内容に同意します。
        </span>
      </label>
      <button
        type="button"
        onClick={agree}
        disabled={!checked || isPending}
        className="btn-fixed-size"
        style={{
          background: checked ? "var(--royal)" : "var(--line)",
          color: checked ? "#fff" : "var(--ink-mute)",
          border: "none", borderRadius: 8, padding: "10px 20px",
          fontSize: 14, fontWeight: 600, cursor: checked ? "pointer" : "not-allowed",
        }}
      >
        {isPending ? "記録中..." : "同意して続ける"}
      </button>
    </div>
  );
}
