"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveReport, reopenReport, setHidden } from "./actions";
import {
  MEMBER_REPORT_RESOLUTIONS,
  MEMBER_REPORT_RESOLUTION_NOTE_MAX,
  type MemberReportResolution,
} from "@/lib/constants/memberReports";

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
  /** ★運営が出した結果。未対応なら null（`resolvedAt` と必ず対になる） */
  resolution: MemberReportResolution | null;
  /** ★却下の理由。⚠️ 企業の画面に出る */
  resolutionNote: string | null;
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
  /** 結果を出すフォームを開いている行 */
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<MemberReportResolution | "">("");
  const [note, setNote] = useState("");
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
            /* ⚠️★`data-*` は検証で状態を読むためだけの属性（2026-09-18）。
                  ボタン名（「対応済みにする」）への部分一致で判定すると読み違える。 */
            <div
              key={r.id}
              data-report-id={r.id}
              data-state={open ? "open" : "resolved"}
              data-resolution={r.resolution ?? "none"}
              data-hidden={r.hidden ? "true" : "false"}
              style={{
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
                {/* ★対応済みは結果まで出す（2026-09-18）。「対応済み」だけだと
                       外したのか却下したのかが一覧から読めない。 */}
                {!open && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success-ink)", background: "var(--success-soft)", border: "1px solid #A7F3D0", borderRadius: 4, padding: "1px 6px" }}>
                    {r.resolution === "hidden" ? "対応済み・外した" : r.resolution === "rejected" ? "対応済み・却下" : "対応済み"}
                  </span>
                )}
                {/* ★意図して作れる状態。⚠️ 明示しないと運営が作業状況を見失う */}
                {open && r.hidden && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--warm-ink)", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 4, padding: "1px 6px" }}>
                    外していますが、未対応のままです
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
                {/* ⚠️ 運営が書いた理由。★企業にも同じ文面が出ている */}
                {r.resolutionNote && (
                  <div style={{ marginTop: 4, padding: "6px 10px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, whiteSpace: "pre-wrap", color: "var(--warm-ink)" }}>
                    却下の理由（企業に表示）: {r.resolutionNote}
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

                {open ? (
                  /* ★未対応の行に出す操作は、この2つだけ（2026-09-18 / C-9）。
                     ⚠️★「外す」と「対応済みにする」を分けない。分かれていた頃は
                        **「外したが未対応のまま」が事故で作れた。** */
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setOpenFormId(openFormId === r.id ? null : r.id)}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 6,
                      background: "var(--royal)", color: "#fff", border: "none",
                      cursor: isPending ? "wait" : "pointer",
                    }}
                  >
                    {openFormId === r.id ? "閉じる" : "結果を出す"}
                  </button>
                ) : (
                  <>
                    {/* 判断を後から直す。⚠️ `resolution` も一緒に動く */}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => setHidden(r.id, r.companyId, r.experienceId, !r.hidden))}
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
                      onClick={() => run(() => reopenReport(r.id))}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6,
                        background: "none", color: "var(--ink-soft)",
                        border: "1px solid var(--line)", cursor: isPending ? "wait" : "pointer",
                      }}
                    >
                      未対応に戻す
                    </button>
                  </>
                )}
              </div>

              {/* ★結果を出すフォーム（未対応の行だけ） */}
              {open && openFormId === r.id && (
                <div data-form="resolve" style={{
                  marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-soft)",
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {MEMBER_REPORT_RESOLUTIONS.map((o) => (
                      <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink)", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`resolution-${r.id}`}
                          checked={resolution === o.value}
                          onChange={() => setResolution(o.value)}
                        />
                        {o.action}
                      </label>
                    ))}
                  </div>

                  {/* ★却下のときだけ理由を聞く。⚠️ 文面は企業に出る */}
                  {resolution === "rejected" && (
                    <div>
                      <label htmlFor={`note-${r.id}`} style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>
                        理由（任意・{MEMBER_REPORT_RESOLUTION_NOTE_MAX}文字まで）
                        <strong style={{ color: "var(--warm-ink)" }}>　この内容は企業に表示されます</strong>
                      </label>
                      <textarea
                        id={`note-${r.id}`}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={MEMBER_REPORT_RESOLUTION_NOTE_MAX}
                        rows={2}
                        placeholder="例: 本人に確認したところ、在籍期間の記載に誤りはありませんでした"
                        style={{
                          width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
                          border: "1px solid var(--line)", borderRadius: 6, resize: "vertical",
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      disabled={isPending || resolution === ""}
                      onClick={() => {
                        if (resolution === "") return;
                        run(() => resolveReport(r.id, r.companyId, r.experienceId, resolution, note));
                        setOpenFormId(null); setResolution(""); setNote("");
                      }}
                      style={{
                        fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 6,
                        background: resolution === "" ? "var(--line-soft)" : "var(--royal)",
                        color: resolution === "" ? "var(--ink-mute)" : "#fff",
                        border: "none", cursor: resolution === "" ? "not-allowed" : "pointer",
                      }}
                    >
                      {isPending ? "処理中..." : "確定する"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOpenFormId(null); setResolution(""); setNote(""); }}
                      style={{
                        fontSize: 12, padding: "6px 12px",
                        background: "none", color: "var(--ink-soft)",
                        border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
