"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleResolved, setHidden } from "./actions";

export type MemberReportRow = {
  id: string;
  companyId: string;
  companyName: string | null;
  companySlug: string | null;
  companyIsTest: boolean;
  experienceId: string;
  userId: string | null;
  userName: string | null;
  userIsTest: boolean;
  roleTitle: string | null;
  isCurrent: boolean | null;
  startedAt: string | null;
  endedAt: string | null;
  reasonLabel: string | null;
  note: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  /** いま企業ページから外れているか（`ow_company_hidden_experiences`） */
  hidden: boolean;
};

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

function period(startedAt: string | null, endedAt: string | null, isCurrent: boolean | null): string | null {
  if (!startedAt) return null;
  const s = startedAt.slice(0, 7).replace("-", ".");
  if (isCurrent) return `${s} 〜 現在`;
  return `${s} 〜 ${endedAt ? endedAt.slice(0, 7).replace("-", ".") : ""}`;
}

const TestTag = () => (
  <span style={{
    fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
    background: "var(--line-soft)", border: "1px solid var(--line)",
    borderRadius: 4, padding: "1px 6px",
  }}>
    検証用
  </span>
);

export function ReportsClient({ rows }: { rows: MemberReportRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      /* ⚠️ 失敗を黙って捨てない。0行更新も `mutateOne` がエラーにして返す。 */
      if (!r.ok) { setError(r.error ?? "操作に失敗しました。"); return; }
      router.refresh();
    });
  };

  if (rows.length === 0) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--bg-tint)", border: "1px dashed var(--line)", borderRadius: 12 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>報告はありません</div>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "6px 0 0" }}>0件が正常な状態です。</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div role="alert" style={{
          marginBottom: 16, padding: "10px 14px", background: "#FEF2F2",
          border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#B91C1C",
        }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const open = r.resolvedAt === null;
          return (
            <div key={r.id} style={{
              padding: "14px 16px", borderRadius: 10, background: "#fff",
              border: `1px solid ${open ? "#FDE68A" : "var(--line)"}`,
              opacity: open ? 1 : 0.7,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                  {r.userName ?? "（経歴が削除されています）"}
                </span>
                {r.userIsTest && <TestTag />}
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  ／ {r.companyName ?? "（企業不明）"}
                </span>
                {r.companyIsTest && <TestTag />}
                {r.hidden && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "var(--warm-ink)",
                    background: "#FEF3C7", border: "1px solid #FDE68A",
                    borderRadius: 4, padding: "1px 6px",
                  }}>
                    企業ページから非表示中
                  </span>
                )}
                {!open && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success-ink)", background: "var(--success-soft)", border: "1px solid #A7F3D0", borderRadius: 4, padding: "1px 6px" }}>
                    対応済み
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 8 }}>
                <div>
                  報告: <strong style={{ color: "var(--ink)" }}>{r.reasonLabel ?? "（不明な種別）"}</strong>
                  <span style={{ color: "var(--ink-mute)" }}>　{daysAgo(r.reportedAt)}日前</span>
                </div>
                {/* ⚠️ 職歴・期間が取れないのは「経歴が消えた」ということ。行ごと出さない */}
                {(r.roleTitle || period(r.startedAt, r.endedAt, r.isCurrent)) && (
                  <div style={{ color: "var(--ink-mute)" }}>
                    {[r.roleTitle, period(r.startedAt, r.endedAt, r.isCurrent)].filter(Boolean).join(" ・ ")}
                  </div>
                )}
                {r.note && (
                  <div style={{ marginTop: 4, padding: "6px 10px", background: "var(--bg-tint)", borderRadius: 6, whiteSpace: "pre-wrap" }}>
                    {r.note}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {r.userId && (
                  <Link href={`/u/${r.userId}`} target="_blank" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                    本人のプロフィール →
                  </Link>
                )}
                {r.companySlug && (
                  <Link href={`/companies/${r.companySlug}`} target="_blank" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                    企業ページ →
                  </Link>
                )}

                <span style={{ flex: 1 }} />

                {/* ★企業ページから外す / 戻す。⚠️ 対応済みにするのとは別の操作 */}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => setHidden(r.companyId, r.experienceId, !r.hidden))}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6,
                    cursor: isPending ? "wait" : "pointer",
                    background: r.hidden ? "#fff" : "var(--error, #B91C1C)",
                    color: r.hidden ? "var(--success-ink)" : "#fff",
                    border: r.hidden ? "1px solid #A7F3D0" : "none",
                  }}
                >
                  {r.hidden ? "企業ページに戻す" : "企業ページから外す"}
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => toggleResolved(r.id, open))}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6,
                    background: "none", color: "var(--ink-soft)",
                    border: "1px solid var(--line)", cursor: isPending ? "wait" : "pointer",
                  }}
                >
                  {open ? "対応済みにする" : "未対応に戻す"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
