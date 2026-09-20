"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Job } from "@/app/jobs/mockJobData";
import type { Company } from "@/app/companies/mockCompanies";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { Markdown } from "@/components/common/Markdown";
import { ConditionRow } from "@/components/jobs/ConditionRow";
import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";
import { formatSalary, hasSalaryData } from "@/components/jobs/JobListItem";

/**
 * 求人の詳細を、一覧の隣（分割ビューの右ペイン）に出す部品。
 *
 * ── ⚠️★2026-09-17 に「要約」から「ほぼ全文」に変えた ────────────────────────
 * それまでは本文を**最初の段落だけ・3行クランプ**、必須スキルを**上位5件**に切っていた。
 * 結果、ペインの `scrollHeight` が `clientHeight` と**同じ（＝1pxもあふれない）**状態で、
 * 「下にスクロールしても続きが読めない」と読まれていた（実測 2026-09-17: 504 / 504px）。
 * **スクロールの不具合ではなく、出している情報が足りなかった。**
 *
 * ⚠️★**それでも詳細ページ（`JobDetailView`・1,486行）は流用しない。** 流用できない理由が3つある:
 *   ① `ReadingProgress` が `window.scrollY` を見る（ペインの中では永久に 0%）
 *   ② サイドバーが `hidden lg:flex` ＝ **ビューポート基準**なので、700〜900px の
 *      ペインでも「デスクトップ」として出てしまう
 *   ③ `JobMobileStickyBar` が `position: fixed` ＝ ペインの外に出る
 * ここに無いもの（福利厚生・ツール・拠点・在籍者・採用担当者・関連記事）は詳細ページにある。
 *
 * ── ⚠️★守ること ────────────────────────────────────────────────────────────
 * 1. **ビューポート基準のメディアクエリを書かない。** 幅はコンテナで決まるので
 *    `flexWrap` と `minWidth: 0` で組む。
 * 2. **`position: fixed` を置かない。** ペインの外にはみ出す。
 *    ⚠️ **`sticky` は「ペインの中でだけ」使ってよい**（2026-09-17 に緩めた）。
 *       スクロールの器は `.companies-pane`（`overflow-y: auto`）なので、その子に
 *       `sticky; top: 0` を置くと**ペインの中だけで止まる**。ページには影響しない。
 * 3. **データを取りに行かない（presentational）。** 呼び出し側が渡す。
 *    ⚠️ 例外は `BookmarkButton`。あれは自分で取りに行く設計（詳細ページと同じ使い方）。
 * 4. **値が無い項目は見出しごと出さない。**「—」や「0」で埋めない。
 * 5. **ラベルと整形は詳細ページと同じものを使う**（`ConditionRow` / `Markdown` /
 *    `formatSalary`）。ここで定義を書き直さない。割れると同じ求人が2つの顔を持つ。
 */
export function JobPane({
  job,
  company,
}: {
  job: Job;
  /** 会社が引けないことがある（`companyMap` に無い）。**その場合は会社の行を出さない** */
  company?: Company;
}) {
  const href = `/jobs/${job.slug ?? job.id}`;

  /* ★別の求人を選んだら、ペインのスクロールを先頭に戻す（2026-09-17）。
     ⚠️★**戻さないと、長い求人を途中まで読んだ位置のまま次の求人が出る**
        （次の求人の「勤務条件」あたりから始まって、何を見ているのか分からなくなる）。
     ⚠️ スクロールの器は**この部品の外**（`.companies-pane` は `CompanySplitLayout` が持つ）。
        だから `closest` で遡って触っている。**器の側に `id` を付けて名指ししない**
        ——あの部品は `/companies` と共有なので、求人のための印を足さない。
     ⚠️ `html { scroll-behavior: smooth }` は効かない（それはルートのスクローラの設定で、
        要素の `scrollTop` 代入は即座に反映される）。 */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pane = rootRef.current?.closest(".companies-pane");
    if (pane) pane.scrollTop = 0;
  }, [job.id]);

  /* ⚠️ 値が無い項目は**要素ごと出さない**（「—」や「0」で埋めない）。 */
  const badges = [job.location, job.work_style, job.employment_type].filter(Boolean) as string[];

  /* ★スキルは全件出す（2026-09-17。上位5件の制限をやめた）。
     ⚠️ ピルは `flexWrap` ＋ ピル側 `overflowWrap` なので、件数が増えても縦に伸びるだけ。 */
  const required = job.required_skills ?? [];
  const preferred = job.preferred_skills ?? [];

  /* ⚠️★応募は `company.application_open` のときだけ（2026-09-17 に揃えた）。
        それまでこのペインだけ**無条件で「応募する」を出していた**が、
        カード（`JobListItem`）も詳細ページ（`JobDetailView`）も宛先の有無で出し分けている。
        宛先が無い求人に送ると、応募しても誰にも届かない。 */
  const applyOpen = !!company?.application_open;

  return (
    /* ⚠️ `gap` を使わない（2026-09-17）。帯のラッパーが**自分の下に不透明な余白**を持つので、
          `gap` と二重になる。間隔はそれぞれの要素が持つ。 */
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>

      {/* ── ★スクロールしても残る帯（2026-09-17）──────────────────────────────
             求人名・企業名・応募・保存**だけ**。

          ⚠️★**ここに年収やバッジを足さないこと。** 帯が高くなるほど、本文を読む面が削れる。
             帯の高さはペインの中で常に失われる高さ。
          ⚠️★**`sticky` はこの帯にだけ。** 器（`.companies-pane`）が `overflow-y: auto` なので
             ペインの中で止まる。`position: fixed` にすると画面に貼り付いてしまう。
          ⚠️★**不透明な背景を外さないこと。** 外すと下の本文が帯の裏に透ける。
          ⚠️ 見出し・CTA が1つしかないので、以前の「CTA はヘッダーの中に置く」という
             約束（末尾に置くと内部スクロールの奥へ落ちる）は**この形で自動的に満たされる**。 */}
      {/* ⚠️★**sticky はこの外側のラッパー（`jp-sticky`）。白いカードではない**（2026-09-17）。
             ラッパーが**ページ背景色**で、下に 16px の余白を持つ。これが無いと、
             スクロールで帯の裏をくぐった中身が**帯のすぐ下に半分だけ露出して横に切れる**
             （柴さんの指摘）。カード自身を sticky にすると、その隙間が透明になる。
          ⚠️ 色は `--bg-tint`。ページ背景と同じものを指すこと。**別の灰色を直書きしない。** */}
      <div className="jp-sticky">
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
        padding: "var(--space-4) var(--space-6)", minWidth: 0,
        display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap",
        boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
      }}>
        {company && (
          <CompanyLogo
            name={company.name}
            logoUrl={company.logo_url}
            logoLetter={company.logo_letter}
            logoGradient={company.gradient}
            size={40}
            borderRadius={10}
            style={{ border: "1px solid #eef0f3", flexShrink: 0 }}
          />
        )}
        {/* ⚠️ `minWidth: 0` を外さないこと。長い求人名が親を押し広げる */}
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <h2 style={{
            margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)", lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}>{job.role}</h2>
          {company && (
            <div style={{ fontSize: 12.5, color: "var(--royal)", fontWeight: 700, marginTop: 2, overflowWrap: "anywhere" }}>
              {company.name}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {applyOpen && (
            <Link href={`${href}/apply`} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: "var(--royal)", color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
            }}>応募する</Link>
          )}
          {/* ⚠️ 状態は自分で取りに行かせる（`initialBookmarked` と `isAuthenticated` は
                 **両方揃って初めて** props 経由になる仕様で、一覧は後者を持っていない）。 */}
          <BookmarkButton targetType="job" targetId={job.id} label={job.role} />
        </div>
      </div>
      </div>{/* jp-sticky end */}

      {/* ── ★ここから下は「1枚の白い面」（2026-09-17）────────────────────────
             それまで区画ごとに白いカードで、ペインの中に**枠付きの箱が22個・
             全幅の白いカードが6枚**積み上がっていた。左レールもカードなので
             画面全体が箱のモザイクになり、読みづらかった（柴さんの指摘）。

          ⚠️★**区画に枠を戻さないこと。** 区切りは `.jp-block + .jp-block` の
             上罫線だけ。CSS は globals.css にある（`/dev/preview/job-pane` にも効かせるため）。
          ⚠️ 帯（上）はこの面の**外**に置いたまま。sticky で止まったときに
             下の内容と地続きだと、どこまでが帯か分からなくなる。 */}
      <div className="jp-sheet">

      {/* ── 年収・勤務地・勤務形態・雇用形態 ── */}
      {(hasSalaryData(job.salary_min, job.salary_max) || badges.length > 0) && (
        <PaneBlock>
          {hasSalaryData(job.salary_min, job.salary_max) && (
            <div style={{
              fontSize: 16, fontWeight: 800,
              color: "var(--success-ink)", fontFamily: "var(--font-inter), var(--font-noto)",
            }}>
              {formatSalary(job.salary_min, job.salary_max)}
            </div>
          )}
          {/* ⚠️ 給与の補足は金額の下に小さく（詳細ページと同じ置き方） */}
          {job.salary_note && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 4 }}>{job.salary_note}</div>
          )}
          {badges.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: hasSalaryData(job.salary_min, job.salary_max) ? "var(--space-3)" : 0 }}>
              {badges.map((b) => (
                <span key={b} style={{
                  fontSize: 12, color: "var(--ink-soft)", background: "var(--bg-tint)",
                  border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "var(--radius-sm)",
                  whiteSpace: "nowrap",
                }}>{b}</span>
              ))}
            </div>
          )}
        </PaneBlock>
      )}

      {/* ── 仕事内容。⚠️★全文（2026-09-17 に3行クランプと「最初の段落だけ」をやめた）──
             ⚠️ `Markdown` で描く。詳細ページと同じ（入力欄が markdown なので合わせてある）。
                素のテキストとして出すと `##` などが記号のまま出る。 */}
      {job.overview && (
        <PaneBlock title="仕事内容">
          {/* ★1行の長さを抑える（2026-09-17）。ペインを 884px にしたとき、本文は
                 **1行 59文字**あった（882px ÷ 15px）。日本語は 35〜45字が目安。
              ⚠️ `em` はこの要素の font-size 基準。**`px` で書かないこと** ——
                 本文の級数を変えたときに一緒に動かない。
              ⚠️ 1280px のときペインは 724px なので、この上限はほとんど効かない
                 （もともと45字程度）。**効くのは広い画面だけ。**
              ⚠️ 制限するのは**散文だけ**。ピル・カード・条件の並びは全幅のままにする
                 （横に並ぶものを狭めると、逆に折り返しが増える）。 */}
          <div style={{ maxWidth: "44em" }}>
            <Markdown>{job.overview}</Markdown>
          </div>
        </PaneBlock>
      )}

      {/* ── メイン業務 ── */}
      {job.main_tasks?.length > 0 && (
        <PaneBlock title="メイン業務">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0 }}>
            {job.main_tasks.map((task, i) => (
              <li key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "10px 12px", borderRadius: 10,
                background: "var(--bg-tint)", border: "1px solid var(--line)",
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)",
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.75, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{task}</span>
              </li>
            ))}
          </ul>
        </PaneBlock>
      )}

      {/* ── 必須スキル / 歓迎スキル。⚠️★全件（上位5件の制限をやめた）──
             ⚠️ 見出しは詳細ページと同じ「必須スキル / 歓迎スキル」。
             ⚠️★色は必須も歓迎も royal。片方だけ変えないこと（2026-08-30 の判断）。 */}
      {(required.length > 0 || preferred.length > 0) && (
        <PaneBlock title="必須スキル / 歓迎スキル">
          {required.length > 0 && <SkillGroup label="必須スキル" items={required} />}
          {preferred.length > 0 && (
            <div style={{ marginTop: required.length > 0 ? "var(--space-4)" : 0 }}>
              <SkillGroup label="歓迎スキル" items={preferred} />
            </div>
          )}
        </PaneBlock>
      )}

      {/* ── 勤務条件。⚠️★`ConditionRow` をそのまま使う（詳細ページと同じラベル・同じ出し分け）。
             ⚠️ 値が無い行は `ConditionRow` 自身が null を返す。ここで分岐を書かないこと。
             ⚠️ 行を足すときは詳細ページと `/dev/preview/job-conditions` にも足す。 */}
      {(job.location || job.work_style || job.employment_type || job.roleLabel || job.work_hours || job.holidays || job.probation_period) && (
        <PaneBlock title="勤務条件">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            <ConditionRow label="勤務地" value={job.location} icon={
              <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>
            } />
            <ConditionRow label="働き方" value={job.work_style} icon={
              <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>
            } />
            <ConditionRow label="雇用形態" value={job.employment_type} icon={
              <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></>
            } />
            <ConditionRow label="職種" value={job.roleLabel} icon={
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            } />
            <ConditionRow label="勤務体系" value={job.work_hours} icon={
              <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>
            } />
            <ConditionRow label="休日・休暇" value={job.holidays} icon={
              <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>
            } />
            <ConditionRow label="試用期間" value={job.probation_period} icon={
              <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>
            } />
          </div>
        </PaneBlock>
      )}

      {/* ── 選考フロー ──
             ⚠️★**`step.step` を出さないこと。** `mapJob` が `String(i + 1)` を入れているだけで、
                左の番号と**まったく同じ数字が2つ並ぶ**（詳細ページで 2026-09-02 に削除した）。 */}
      {job.selection_flow?.length > 0 && (
        <PaneBlock title="選考フロー">
          <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0 }}>
            {job.selection_flow.map((step, i) => (
              <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: i === job.selection_flow.length - 1 ? "var(--success-strong)" : "var(--royal-50)",
                  color: i === job.selection_flow.length - 1 ? "#fff" : "var(--royal)",
                  border: i === job.selection_flow.length - 1 ? "none" : "1px solid var(--royal-100)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)",
                }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{step.name}</div>
                  {step.meta && (
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 2, overflowWrap: "anywhere" }}>{step.meta}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {job.selection_note && (
            <p style={{
              marginTop: 12, marginBottom: 0, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7,
              background: "var(--bg-tint)", padding: "8px 12px", borderRadius: 8,
              borderLeft: "3px solid var(--royal-100)",
            }}>{job.selection_note}</p>
          )}
        </PaneBlock>
      )}

      {/* ── 企業について（1〜2行）＋ 企業ページへのリンク ──
             ⚠️ 見出しは詳細ページと同じ「企業について」。
             ⚠️★**本文は `tagline` の1〜2行だけ。** 会社の説明を全部持ってくると、
                求人の話より会社の話が長いペインになる。深く読む先は企業ページ。
             ⚠️ ページ非公開の企業には飛ばさない（本番で 404 になる。カードと同じ判定）。 */}
      {company && (company.tagline || company.is_published) && (
        <PaneBlock title="企業について">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              logoLetter={company.logo_letter}
              logoGradient={company.gradient}
              size={36}
              borderRadius={8}
              style={{ border: "1px solid #eef0f3", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{company.name}</div>
              {company.tagline && (
                <p style={{
                  margin: "3px 0 0", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7,
                  overflowWrap: "anywhere",
                  display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden",
                }}>{company.tagline}</p>
              )}
              {company.is_published && (
                <Link href={`/companies/${company.slug ?? company.id}`} style={{
                  display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 700,
                  color: "var(--royal)", textDecoration: "none",
                }}>企業ページを見る →</Link>
              )}
            </div>
          </div>
        </PaneBlock>
      )}

      </div>{/* jp-sheet end */}

      {/* ── 末尾の導線。⚠️★**残すこと。** ここに無いもの（福利厚生・ツール・拠点・
             在籍者・採用担当者・関連記事）は詳細ページにしかない。
             ⚠️ 同じタブで開く（`Link`）。`target="_blank"` にしないこと
                ——カード面と挙動が割れる（2026-09-17 に `JobListItem` の「詳細」でも外した）。 */}
      <Link href={href} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        /* ⚠️ ルートの `gap` を外したので、間隔はここが持つ */
        marginTop: "var(--space-4)",
        padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700,
        background: "#fff", color: "var(--royal)", border: "1.5px solid var(--royal-100)",
        textDecoration: "none",
      }}>詳細ページですべて見る →</Link>
    </div>
  );
}

/**
 * ペインの1区画。**枠も背景も持たない。** 外側の1枚の面（`jp-sheet`）の中に並ぶ。
 *
 * ⚠️★**ここに border / borderRadius / background を足さないこと**（2026-09-17）。
 *    以前は区画ごとに白いカードだった。その結果ペインの中に
 *    **枠付きの箱が22個・全幅の白いカードが6枚**積み上がり、
 *    「グレーの面 → 白いカード → グレーの小箱」の**3重の入れ子**になっていた。
 *    区切りは**上の罫線だけ**（呼び出し側が2つ目以降に付ける）。
 *
 * ⚠️ 見出しが無ければ `title` を渡さない（空の見出し行を作らない）。
 */
function PaneBlock({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    /* ⚠️★区切りの罫線は CSS の `.jp-block + .jp-block`（globals.css）。
          **ここで `borderTop` を出し分けないこと** ——区画は条件付きで消えるので、
          「何番目か」を JS で数えると欠けた日にずれる。隣接セレクタなら自動で合う。 */
    <section className="jp-block">
      {title && (
        <h3 style={{
          margin: "0 0 var(--space-3)", fontSize: 13.5, fontWeight: 800, color: "var(--ink)",
        }}>{title}</h3>
      )}
      {children}
    </section>
  );
}

/** スキルのピル群。⚠️ 必須も歓迎も同じ royal。区別は見出しの文言に任せる（2026-08-30 の判断）。 */
function SkillGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--royal)", letterSpacing: "0.05em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((s, i) => (
          <span key={`${s}-${i}`} style={{
            fontSize: 12.5, color: "var(--ink-soft)", background: "var(--bg-tint)",
            border: "1px solid var(--line)", padding: "4px 10px", borderRadius: "var(--radius-sm)",
            lineHeight: 1.6, overflowWrap: "anywhere",
          }}>{s}</span>
        ))}
      </div>
    </div>
  );
}
