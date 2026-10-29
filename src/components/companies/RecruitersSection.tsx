import Link from "next/link";
import type { CompanyRecruiter } from "@/lib/supabase/queries";
import { MEETING_CTA_BG, MEETING_CTA_FG, MEETING_CTA_SHADOW_RGB } from "@/lib/constants/meetingCta";
import { AV_GRADIENTS } from "@/app/(jobseeker)/companies/[id]/avatarGradients";

/**
 * 「採用担当者」セクション。
 *
 * ⚠️★**企業詳細と求人詳細の両方から使う**（2026-09-03 に切り出した）。
 *    切り出す前は `companies/[id]/page.tsx` の中にあり、求人詳細に同じものを足すと
 *    実装が2つに割れるところだった。**片方だけ直る形を作らない。**
 *    → `LocationsCapitalSection` と同じ形。
 *
 * ⚠️ 見出し（`SecTitle`）は**呼び出し側から渡す**。企業詳細と求人詳細で
 *    それぞれ別の `SecTitle` を持っているため、ここで固定しない。
 *
 * ⚠️★**グリッドは `.employee-grid` を借りない。** あのクラスの CSS は
 *    `companies/[id]/CompanyEmployeeSections.tsx` の中で定義されており、
 *    **求人詳細ではそのコンポーネントが描画されない**ので規則が存在しない。
 *    借りると求人ページでだけカードが**縦1列に落ちる**（エラーにならないので気づけない）。
 *    自前の `.recruiter-grid` を持つ。列数・breakpoint は `.employee-grid` と同じ（3 / 2 / 1）。
 *
 * ⚠️ このスタイルタグの中に山括弧と二重引用符を書かないこと
 *    （サーバーだけが実体参照へ変換し hydration error になる）。
 *
 * ★`meetingHref`（2026-10-29）: カジュアル面談の申込先。**申し込めない企業では null を渡す。**
 *    ⚠️ 判定は呼び出し側の `accepting_casual_meetings`（`isCasualMeetingOpen` で宛先・担当者まで見た値）。
 *       ここで判定しない。
 *    ⚠️ null のときは「申し込むと連絡が届きます」の一文も出さない。それまでは条件なしで出ており、
 *       面談を受け付けていない企業（COIN など）にも「申し込める」と読める文だけが出ていた。
 *    ⚠️ ボタンは 1023px 以下だけ（`lg:hidden`）。1024px 以上は右の列に同じ入口がある。
 *
 * ★`closedCta`（2026-10-29 / 柴さんの判断）: 面談を受け付けない企業での出し方。
 *    担当者名だけを出すと「連絡できそうで、できない」状態になるため、
 *      - 中身を渡す … 「募集に応募すると、上記担当者に届きます」＋募集への導線（企業詳細で募集があるとき）
 *      - null       … カードごと出さない（企業詳細で募集が0件のとき）
 *      - 省略       … 担当者名だけ（求人詳細。求人そのものが応募の入口なので足さない）
 */
export function RecruitersSection({
  recruiters,
  title,
  meetingHref,
  closedCta,
}: {
  recruiters: CompanyRecruiter[];
  title: React.ReactNode;
  meetingHref: string | null;
  closedCta?: { note: string; href: string; label: string } | null;
}) {
  if (recruiters.length === 0) return null;
  if (!meetingHref && closedCta === null) return null;

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{
        padding: "var(--space-6) var(--cd-pad-x, 32px) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        {title}
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        <style>{`
          .recruiter-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
          }
          @media (max-width: 1023px) {
            .recruiter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 767px) {
            .recruiter-grid { grid-template-columns: minmax(0, 1fr); }
          }
        `}</style>
        <div className="recruiter-grid">
          {recruiters.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "var(--space-4)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "#fff",
                alignItems: "center",
              }}
            >
              {/* アバター 48px circular */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: r.avatar_color ?? AV_GRADIENTS[i % AV_GRADIENTS.length],
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-inter), var(--font-noto)",
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
              >
                {r.avatar_initial}
              </div>
              {/* ⚠️ minWidth: 0 が要る。無いと flex item が min-content まで広がり ellipsis が効かない。 */}
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* 1行目: 名前 */}
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}
                </div>
                {/* 2行目: 部門 › 職種 */}
                {(r.department || r.role_title) && (
                  <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[r.department, r.role_title].filter(Boolean).join(" › ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {meetingHref && (
        <>
        {/* ★担当者名のすぐ下・カード幅いっぱい（2026-10-29 / 柴さんの指示）。
               ⚠️ display をインラインに書かない（lg:hidden が効かなくなる） */}
        <div className="lg:hidden" style={{ marginTop: "var(--space-4)" }}>
          <Link
            href={meetingHref}
            data-state="recruiter-meeting-cta"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 16px", borderRadius: 10,
              fontSize: 14, fontWeight: 700, textDecoration: "none",
              background: MEETING_CTA_BG, color: MEETING_CTA_FG,
              boxShadow: `0 3px 12px rgba(${MEETING_CTA_SHADOW_RGB},0.35)`,
            }}
          >
            カジュアル面談を申し込む
          </Link>
        </div>
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg-tint)",
            borderRadius: 8,
            fontSize: "var(--text-xs)",
            color: "var(--ink-soft)",
            lineHeight: 1.7,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          カジュアル面談を申し込むと、上記担当者から連絡が届きます。
        </div>
        </>
        )}

        {/* ★面談を受け付けない企業では募集への導線（2026-10-29）。ボタンは 1023px 以下だけ */}
        {!meetingHref && closedCta && (
        <>
        <div className="lg:hidden" style={{ marginTop: "var(--space-4)" }}>
          <a
            href={closedCta.href}
            data-state="recruiter-jobs-cta"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 16px", borderRadius: 10,
              fontSize: 14, fontWeight: 700, textDecoration: "none",
              background: "var(--royal)", color: "#fff",
            }}
          >
            {closedCta.label}
          </a>
        </div>
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg-tint)",
            borderRadius: 8,
            fontSize: "var(--text-xs)",
            color: "var(--ink-soft)",
            lineHeight: 1.7,
          }}
        >
          {closedCta.note}
        </div>
        </>
        )}
      </div>
    </section>
  );
}
