import React from "react";
import type { CompanyEmployee } from "@/lib/supabase/queries";
import { AVATAR_COLOR } from "@/lib/avatarColor";
import { JobPeopleCards, JOB_PEOPLE_CSS } from "@/components/jobs/JobPeopleCards";

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
   | 企業ページ | `AVATAR_COLOR`（全員同じ） | 淡い背景 + 濃い文字 |
   | 求人ページ（旧） | `userId.charCodeAt(0) % 5` | 濃いグラデ + 白文字 |

   ⚠️ 求人ページ側の色は `userId` の先頭文字で決まるだけで、**何も意味していなかった。**
      UUID が 4 / 9 / a / f で始まる **25% のユーザーが紫**（`#6D28D9`）。
      ⚠️ 紫そのものは規約違反ではない（globals.css:「アバターのグラデーションは
         トークンとは無関係」）。問題は**2ページで食い違うこと**のほう。

   ⚠️★**「企業ページ側は職種で色が決まるから意味がある」は誤りだった**（2026-08-31 に訂正）。
      色表の7キーが現在の `ow_roles` と1つも一致しておらず、**職種別の色は1人にも出ていなかった。**
      ✅ **2026-09-02 に表ごと畳んで1色に確定させた**（`lib/avatarColor.ts` の `AVATAR_COLOR`）。
         凡例が無い色分けは持たない、という判断。**ここに色表を作り直さないこと。** */

/**
 * 求人詳細の社員カード。
 *
 * ⚠️★カードの「◯◯さんに話を聞く →」（`?person=` の指名）は 2026-10-16 に撤去した（面談OKの撤去）。
 *    カードはプロフィールへのリンクだけ。
 */
export function JobEmployeeCard({ emp, companyId }: {
  emp: CompanyEmployee;
  companyId: string;
}) {
  /* ⚠️ 企業ページの社員カードと**同じ関数**を使う。色は職種で決まる（上のコメント）。 */
  const color = AVATAR_COLOR;
  const initial = emp.avatarInitial ?? emp.name.charAt(0);
  void companyId;

  /* ★2026-10-17: 企業ページの社員一覧（`PersonRow`）と同じ行の形にした（柴さんの指摘「見づらい」）。
        それまでは1人ずつ枠付きのカードで、スマホでは1人 72px の箱が縦に並び、外側の枠と二重になっていた。
     ⚠️ 見た目は globals.css の .person-list / .person-row（企業ページと共有）。ここに style を書き戻さないこと */
  return (
    <div className="person-row">
      <a href={`/u/${emp.userId}`} className="person-row-main">
        <div className="person-row-avatar" style={{ background: emp.avatarUrl ? undefined : color.bg, color: color.text }}>
          {emp.avatarUrl ? (
            <img src={emp.avatarUrl} alt={emp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initial}
        </div>
        <div className="person-row-text">
          <div className="person-row-head"><span className="person-row-name">{emp.name}</span></div>
          {emp.roleTitle && <div className="person-row-title">{emp.roleTitle}</div>}
          {emp.catchphrase && <div className="person-row-sub">{emp.catchphrase}</div>}
        </div>
        <svg className="person-row-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><path d="M9 18l6-6-6-6"/></svg>
      </a>
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
  /* ⚠️ カードにしてから使っていない（2026-10-20）。呼び出し側を変えないため受け口は残す */
  companyId: _companyId,
  currentTitle,
  alumniTitle,
  currentSubtitle,
  alwaysShowAlumni = false,
}: {
  current: CompanyEmployee[];
  alumni: CompanyEmployee[];
  companyId: string;
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
      {/* ⚠️ カードの見た目（JobPeopleCards）。同じページで2回描かれるが中身は同じなので害は無い */}
      <style>{JOB_PEOPLE_CSS}</style>

      {/* 現役社員 */}
      {current.length > 0 && (
        <section className="person-section-body" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
          {/* ★件数は見出しの右端ではなく、見出しのすぐ後ろ（2026-10-17）。右端だと長い見出しが折れ、件数が縦に潰れていた */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
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
          {/* ★2026-10-20（柴さんの指示）: 行の一覧から縦長のカードにした（1〜2人は左寄せ・3人以上は横スクロール）。
                 見本は /dev/preview/job-people。⚠️ 行の形（JobEmployeeCard / .person-list）に戻さないこと */}
          <JobPeopleCards people={current} />
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
        <section className="person-section-body" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
          {/* ★件数は見出しの右端ではなく、見出しのすぐ後ろ（2026-10-17）。右端だと長い見出しが折れ、件数が縦に潰れていた */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
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
            <JobPeopleCards people={alumni} />
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
