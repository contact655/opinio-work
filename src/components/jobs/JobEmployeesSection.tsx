import React from "react";
import Link from "next/link";
import type { CompanyEmployee } from "@/lib/supabase/queries";
import { resolveAvatarColor } from "@/lib/jobCategoryColors";
import { MEETING_CTA_BG } from "@/lib/constants/meetingCta";

/**
 * 求人詳細の「現役社員 / OB・OG」セクション（2026-08-30 に求人ページから切り出した）。
 *
 * ── なぜ部品にしたか ────────────────────────────────────────────────────────
 * ⚠️★**「カードが出る側」を一度も描画できないまま出したから。**
 *    公開求人2件はどちらも職種一致する退職者が0名で、実データでは空状態しか踏めない
 *    （該当する1名は `is_test` で除外される）。
 *    → `/dev/preview/employees` で固定データを流し込んで見られるようにした。
 *
 * ⚠️ **ページ内のローカル関数のままだと preview から import できない。**
 *    同じ理由で今後もセクションを足すときは、page.tsx に直接書かず部品にすること。
 *
 * ⚠️ 切り出しただけで**中身は1文字も変えていない**（実HTMLの一致で確認済み）。
 */

/* ⚠️★ここにあった `JOB_AVATAR_COLORS`（5色のグラデーション）は 2026-08-31 に削除した。
      **戻さないこと。**

   ── なぜ消したか ──────────────────────────────────────────────────────────
   同じ人が企業ページと求人ページで**別人のように見えていた。**

   | | 色の決め方 | 見た目 |
   |---|---|---|
   | 企業ページ | `resolveAvatarColor(職種)` | 淡い背景 + 濃い文字 |
   | 求人ページ（旧） | `userId.charCodeAt(0) % 5` | 濃いグラデ + 白文字 |

   ⚠️ 求人ページ側の色は `userId` の先頭文字で決まるだけで、**何も意味していなかった。**
      UUID が 4 / 9 / a / f で始まる **25% のユーザーが紫**（`#6D28D9`）。
      ⚠️ 紫そのものは規約違反ではない（globals.css:「アバターのグラデーションは
         トークンとは無関係」）。問題は**2ページで食い違うこと**のほう。

   ⚠️★**「企業ページ側は職種で色が決まるから意味がある」は誤りだった**（2026-08-31 に訂正）。
      `JOB_CATEGORY_COLORS` の7キーは「2026-05 時点の実値」とコメントされているが、
      **現在の `ow_roles` の親カテゴリ UUID と1つも一致しない。**
      つまり `resolveAvatarColor` は**全員にフォールバック色を返している。**
      ⚠️ 意図した職種別の色は**1人にも出ていない。**（→ `docs/todo.md` / 未決）

   ⚠️ それでも揃える先を企業ページにした。**判定が1箇所になる**ので、
      UUID を直せば両ページが同時に直る。**ここに色表を作り直さないこと。** */

/**
 * 求人詳細の社員カード。
 *
 * ⚠️★**面談CTAはカードの中に置く**（2026-08-30 に変更）。
 *    それまではセクションの末尾に「話を聞く（カジュアル面談）」を1つだけ置いていたが、
 *    **リンクに `?person=` が無く企業宛の申込**だった。人物カードのすぐ下にあるので
 *    「この人と話せる」と誤解される（柴さんの指摘）。
 *    ⚠️ 企業詳細（`CompanyEmployeeSections`）は**元からカードごとに指名付き**。
 *       同じ部品の見た目と挙動を2つ持たないよう、そちらに揃えた。
 *
 * ⚠️ CTA を出す条件は2つとも要る。
 *      ① その人が**面談可**（`ow_company_members` の同意＋掲載）
 *      ② 企業が**受付中**（`accepting_casual_meetings`）
 *    ②が無いと、押した先が「現在受け付けていません」になる。
 */
export function JobEmployeeCard({ emp, companyId, casualBase }: {
  emp: CompanyEmployee;
  companyId: string;
  /** `/companies/{id}/casual-meeting`。受付停止・非公開企業では null */
  casualBase: string | null;
}) {
  /* ⚠️ 企業ページの社員カードと**同じ関数**を使う。色は職種で決まる（上のコメント）。 */
  const color = resolveAvatarColor(emp.roleParentId, emp.roleCategoryId);
  const initial = emp.avatarInitial ?? emp.name.charAt(0);
  void companyId;

  const card = (
    <a
      href={`/u/${emp.userId}`}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 12,
        border: "1px solid var(--line)",
        background: "#fff",
        textDecoration: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      className="job-emp-card"
    >
      <div style={{
        width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
        background: emp.avatarUrl ? undefined : color.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 18,
        color: color.text, overflow: "hidden", border: "2px solid var(--line)",
      }}>
        {emp.avatarUrl ? (
          <img src={emp.avatarUrl} alt={emp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : initial}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</div>
        {emp.roleTitle && (
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.roleTitle}</div>
        )}
        {emp.catchphrase && (
          <div style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{emp.catchphrase}</div>
        )}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
    </a>
  );

  if (!casualBase) return card;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
      padding: "12px 14px", borderRadius: 12,
      /* ⚠️ 面のオレンジで塗らない。面談であることはバッジとリンクが示す
            （企業詳細の同じカードと同じ判断）。 */
      background: "#fff", border: "1px solid #FED7AA",
    }}>
      {card}
      <Link
        /* ★`person` は `ow_users.id`。API 側で「その企業に在籍中かつ掲載中の面談対応者」を
              検証してから記録する（`POST /api/casual-meetings`）。URL の値をそのまま信じない。 */
        href={`${casualBase}?person=${emp.userId}`}
        style={{
          display: "block", textAlign: "center", padding: "8px 16px",
          background: MEETING_CTA_BG,
          color: "#fff", borderRadius: 8,
          fontSize: 12, fontWeight: 700, textDecoration: "none",
        }}
      >
        {emp.name.split(/[\s　]/)[0]}さんに話を聞く →
      </Link>
    </div>
  );
}

/**
 * 現役社員・OB/OG のセクション。
 *
 * ⚠️★**このページで2回使う**（2026-08-30）。
 *    ① 職種一致（この職種の現役メンバー / この職種を経験したOB/OG）
 *    ② 会社全体から①を差し引いた残り（この会社の他の現役社員 / OB・OG）
 *    **同じ人を2回出さないよう、②は呼び出し側で差集合にしてから渡す。**
 *
 * ⚠️ 見出しは props で受ける。既定は①の文言なので、②では必ず渡すこと。
 *    渡し忘れると同じ見出しが2つ並び、読み手が違いを判断できない。
 */
export function JobEmployeesSection({
  current,
  alumni,
  companyId,
  casualHref,
  talkableIds,
  currentTitle,
  alumniTitle,
  currentSubtitle,
  alwaysShowAlumni = false,
}: {
  current: CompanyEmployee[];
  alumni: CompanyEmployee[];
  companyId: string;
  /** 非公開企業・受付停止では null。飛べない導線を置かないため CTA ごと出さない */
  casualHref: string | null;
  /** 面談可の `ow_users.id`。⚠️ ここに居る人だけ指名CTAを出す */
  talkableIds: Set<string>;
  /** 既定「この職種の現役メンバー」。会社全体を出すときは必ず渡す */
  currentTitle?: string;
  /** 既定「この職種のOB・OG」 */
  alumniTitle?: string;
  /** 見出しの下に出す1行。関係を説明したいときだけ渡す */
  currentSubtitle?: string;
  /**
   * OB・OG を**0件でも枠ごと出す**（2026-08-30 / 柴さん）。
   *
   * ⚠️★**「無い」ことを見せるための表示。** この職種を経験して退職した人が
   *    まだ登録されていない、という事実をそのまま出す。
   *    ⚠️ 埋め合わせに会社全体のOB・OGを出さないこと。**それが元の実装で、
   *       求人と関係のない職種の人が「OB・OG」として並んでいた。**
   * ⚠️ 現役メンバー側には効かない。0件のときは今までどおり枠ごと出さない
   *    （現役が居ないことは求人ページで強調する情報ではない）。
   */
  alwaysShowAlumni?: boolean;
}) {
  if (current.length === 0 && alumni.length === 0 && !alwaysShowAlumni) return null;

  return (
    <>
      <style>{`
        .job-emp-card:hover { border-color: var(--royal-100) !important; box-shadow: 0 2px 8px rgba(0,35,102,0.08) !important; }
      `}</style>

      {/* 現役社員 */}
      {current.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, /* ⚠️ 18px。**`SecTitle`（10箇所）と同じ大きさに揃える**（2026-08-30）。
                     `var(--text-lg)` は 20px で、ここだけ他のセクション見出しより
                     大きくなっていた。SecTitle を使わず手で組んでいる見出しが3つあり、
                     3つとも 20px だった。⚠️ 見出しを新しく足すときは SecTitle を使うこと。 */
                fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--royal-50)", color: "var(--royal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </span>
              {currentTitle ?? "この職種の現役メンバー"}
            </div>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{current.length}名</span>
          </div>
          {/* ⚠️ 会社全体のセクションでだけ出す1行。**上の職種一致セクションとの違い**を
                 説明する。見出しだけだと「なぜ2つあるのか」が伝わらない。 */}
          {currentSubtitle && (
            <p style={{
              margin: "0 0 var(--space-3)", fontSize: 12, lineHeight: 1.7,
              color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)",
            }}>
              {currentSubtitle}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--space-2)" }}>
            {current.map((emp) => <JobEmployeeCard key={emp.userId} emp={emp} companyId={companyId}
              casualBase={casualHref && talkableIds.has(emp.userId) ? casualHref : null} />)}
          </div>
          {/* ⚠️★セクション末尾の一括CTA「話を聞く（カジュアル面談）」は削除した（2026-08-30）。
                 **リンクに `?person=` が無く企業宛の申込**だったのに、人物カードのすぐ下に
                 あるため「この人と話せる」と誤解される（柴さんの指摘）。
              ⚠️ **代わりにカードごとに指名付きCTAを出す**（`JobEmployeeCard`）。
                 企業詳細は元からその形で、同じ部品の挙動を2つ持たないために揃えた。
              ⚠️ 複数人いるときに1つの一括CTAを置くと、**誰を指名するか決められない**。
                 これが「指名なし」になっていた根本の理由。**戻さないこと。** */}
        </section>
      )}

      {/* OB/OG */}
      {(alumni.length > 0 || alwaysShowAlumni) && (
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, /* ⚠️ 18px。**`SecTitle`（10箇所）と同じ大きさに揃える**（2026-08-30）。
                     `var(--text-lg)` は 20px で、ここだけ他のセクション見出しより
                     大きくなっていた。SecTitle を使わず手で組んでいる見出しが3つあり、
                     3つとも 20px だった。⚠️ 見出しを新しく足すときは SecTitle を使うこと。 */
                fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>
              {/* ⚠️★紫をやめた（2026-08-30）。`.claude/skills/ui-conventions`「色の役割」は
                     **紫は使わない**と定めており、`SecTitle` からも 2026-08-29 に
                     purple を削除している（「戻さないこと」と書いてある）。
                     ここは SecTitle を使わず手で組んでいたため、削除から漏れていた。
                  ⚠️ **企業詳細の「OB・OG社員」は SecTitle の既定色（royal）**。揃える。
                  ⚠️ アイコンも人型に変える。**地図ピンは「拠点」の意味**で、
                     同じページの「拠点・資本関係」と同じ絵だった。 */}
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--royal-50)", color: "var(--royal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              {alumniTitle ?? "この職種のOB・OG"}
            </div>
            {/* ⚠️ 0件のときは件数を出さない。「0名」は**居ないこと**ではなく
                   **数えた結果0人だった**ように読める（CLAUDE.md「0件を読むときは、
                   起きなかった0か起こせなかった0かを分ける」）。 */}
            {alumni.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{alumni.length}名</span>
            )}
          </div>
          {alumni.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--space-2)" }}>
              {/* ⚠️ OB/OG には指名CTAを出さない。**退職者に「話を聞く」導線は出さない**
                      （企業詳細も現役社員にしか出していない）。 */}
              {alumni.map((emp) => <JobEmployeeCard key={emp.userId} emp={emp} companyId={companyId} casualBase={null} />)}
            </div>
          ) : (
            /* ⚠️★空状態。**「まだ居ない」を、それ以外の何かで埋めない。**
                  以前はここに会社全体のOB・OGを出していたが、求人の職種と関係の無い人が
                  「OB・OG」として並ぶため、読み手には区別が付かなかった。 */
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "14px 16px", borderRadius: 10,
              background: "var(--bg-tint)", border: "1px solid var(--line)",
              fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              この職種を経験して退職された方は、まだ登録されていません。
            </div>
          )}
        </section>
      )}
    </>
  );
}
