import Link from "next/link";
import { SCOUT_EMAIL_UNDELIVERED_NOTICE } from "@/lib/constants/scoutEmail";

/**
 * スカウト履歴の一覧（2026-09-22 に page.tsx から切り出した）。
 * ⚠️ 切り出したのは `/dev/preview/scouts` で見るため。本番はスカウトが0件で、行が1つも描かれない。
 * ⚠️ サーバー部品（"use client" を付けない）。DB は読まない。行は呼び出し側が組む。
 */
export type ScoutRow = {
  id: string;
  status: string;
  sentAt: string;
  repliedAt: string | null;
  conversationId: string | null;
  message: string;
  jobTitle: string | null;
  jobId: string | null;
  candidate: { id: string; name: string; avatar_color: string | null } | null;
  emailUndelivered: boolean;
};

/* ★色が付くのは「興味あり」だけ（2026-09-22）。それまで「未読」も同じ青で、正反対の状態が同じ色だった。
   ★「未読／既読」は**相手（候補者）が**読んだかどうか。自分が読んだかに読めたので「相手が」を付けた。
   ⚠️ 緑にしない（緑はお金の条件だけ） */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  sent:       { label: "相手が未読", color: "var(--ink-soft)", bg: "#fff",            border: "var(--line)" },
  read:       { label: "相手が既読", color: "var(--ink-soft)", bg: "var(--bg-tint)",  border: "var(--line)" },
  interested: { label: "興味あり",   color: "var(--royal)",    bg: "var(--royal-50)", border: "var(--royal-100)" },
  declined:   { label: "辞退",       color: "var(--ink-mute)", bg: "#F1F5F9",         border: "var(--line)" },
};

/** 年つきの日付（2026年9月22日）。スカウトは年をまたいで残るので年を省かない */
function formatJaDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tokyo" });
}

export function ScoutList({ rows: visibleRows }: { rows: ScoutRow[] }) {
  return (
    /* ★1枚の枠に行を並べる（2026-09-22）。他の /biz の一覧と同じ読み方。
                ⚠️ 左の色帯は外した（バッジと同じことを2回言っていた） */
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            <style>{`
              .sc-preview { font-size: 13px; color: var(--ink-soft); line-height: 1.7; margin: 0;
                overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
              .sc-msg:has(details[open]) .sc-preview { display: none; }
              .sc-msg summary { list-style: none; cursor: pointer; }
              .sc-msg summary::-webkit-details-marker { display: none; }
              .sc-msg details[open] .sc-when-closed { display: none; }
              .sc-msg details:not([open]) .sc-when-open { display: none; }
            `}</style>
            {visibleRows.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, padding: "24px 22px" }}>この条件のスカウトはありません。</p>
            )}
            {visibleRows.map((row, idx) => {
              const st = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.sent;
              return (
                <div key={row.id} style={{
                  padding: "18px 22px",
                  borderTop: idx === 0 ? "none" : "1px solid var(--line-soft)",
                  display: "flex", alignItems: "flex-start", gap: 16,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: row.candidate?.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700, color: "#fff",
                  }}>
                    {row.candidate?.name?.[0] ?? "?"}
                  </div>

                  {/* Main */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {/* ⚠️ 引けない人（退会など）を「候補者」とぼかさず、表示できないことをそのまま書く */}
                        {row.candidate?.name ?? "表示できない候補者"}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100,
                        background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                      }}>
                        {st.label}
                      </span>
                      {row.jobTitle && (
                        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                          求人: {row.jobTitle}
                        </span>
                      )}
                    </div>

                    {/* ★送った本文を全文で読めるようにした（2026-09-22。それまで2行で切れたまま） */}
                    {/* ⚠️ 短い本文には「全文を見る」を出さない（押しても何も増えない）。目安は2行ぶん */}
                    {row.message.length > 90 || row.message.includes("\n") ? (
                    <div className="sc-msg" style={{ margin: "0 0 10px" }}>
                      {/* ⚠️ 2行で切る指定は CSS 側（.sc-preview）に置く。インラインに display を書くと
                             開いたときに隠す :has() の規則が負ける（2026-09-22 に実際に負けた） */}
                      <p className="sc-preview">
                        {row.message}
                      </p>
                      <details>
                        <summary style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", marginTop: 4 }}>
                          <span className="sc-when-closed">全文を見る</span>
                          <span className="sc-when-open">閉じる</span>
                        </summary>
                        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                          {row.message}
                        </p>
                      </details>
                    </div>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 10px" }}>{row.message}</p>
                    )}

                    {/* ★メールで通知できなかったとき（2026-09-10）。
                           ⚠️★**括弧の中を消さないこと。** 無いと「候補者に何も届いていない」と読まれ、
                              `/biz/candidates` から二重に送られる。**実際にはアプリ内に届いている。**
                           ⚠️ `skipped` ではここに来ない（上の `emailUndelivered` を参照）。 */}
                    {row.emailUndelivered && (
                      <p style={{
                        fontSize: 11, color: "var(--warm-ink)", background: "#FFFBEB",
                        border: "1px solid #FDE68A", borderRadius: 8,
                        padding: "6px 10px", margin: "0 0 10px",
                      }}>
                        {SCOUT_EMAIL_UNDELIVERED_NOTICE}
                      </p>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                        送信 {formatJaDate(row.sentAt)}
                        {row.repliedAt && <>・返答 {formatJaDate(row.repliedAt)}</>}
                      </span>
                      {row.candidate && (
                        <Link
                          href={`/u/${row.candidate.id}`}
                          target="_blank"
                          style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}
                        >
                          プロフィールを見る →
                        </Link>
                      )}
                      {row.conversationId && (
                        <Link
                          href={`/biz/conversations/${row.conversationId}`}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 6,
                            background: "var(--royal-50)", color: "var(--royal)",
                            border: "1px solid var(--royal-100)", textDecoration: "none",
                          }}
                        >
                          会話を見る →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
  );
}
