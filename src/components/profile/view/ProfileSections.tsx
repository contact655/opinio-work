"use client";

/**
 * 公開プロフィール `/u/[id]` の各セクション。
 *
 * ⚠️ **`/u/[id]/page.tsx` から切り出しただけ**（2026-08-16）。JSX は1文字も変えていない。
 *    変えたのは「ローカル変数を props で受け取る」ことだけ。
 *
 * ⚠️ ★**同じ見た目を2箇所に書かないための置き場**。`/mypage` のプロフィールは
 *    ここを使って公開プロフィールと同じ体裁にする。**片方だけ直る状態を作らない。**
 *
 * ⚠️ データ取得は呼び出し側（page.tsx）に残す。ここは**受け取って描くだけ**にする。
 */

import Link from "next/link";
/* ⚠️ 定数は**素のモジュール**に置く。ここ（"use client"）から export すると、
      サーバーコンポーネントが `PLATFORM_META[x].color` とドットで読めず 500 になる。 */
import { PLATFORM_META, ARTICLE_TYPE_LABEL } from "@/lib/profile/platformMeta";
/* 言語の習熟度ラベル（2026-08-24）。⚠️ 生の値（`native` 等）を画面に出さない */
import { languageProficiencyLabel } from "@/lib/constants/languageProficiency";
import { SKILL_CATEGORIES } from "@/lib/constants/skills";
import type { AutoSkill } from "@/lib/profile/autoSkills";
import { PostCard } from "@/components/profile/PostCard";
import { CollapsibleList } from "@/app/(jobseeker)/companies/[id]/CollapsibleList";
/* ⚠️ `SocialIcon.tsx` は `"use client"` を**持たない**素のモジュール。
      サーバーコンポーネントからも `SOCIAL_META[x].label` と読めるので、
      `platformMeta.ts` のような移動は要らない（2026-08-16 に確認）。 */
import { SocialIcon, SOCIAL_META, SNS_PLATFORMS, type SocialPlatform } from "@/components/SocialIcon";
/* ⚠️ 行の操作（鉛筆・ゴミ箱）は `MergedTimeline` とも共有する。ここには置かない */
import { type RowActions, RowActionButtons, SectionManageLink, SectionShowAll, sectionAddBtn, emptyAddBtn, PlusIcon, PencilIcon } from "./RowActions";
export type { RowActions };

/* ── 行の型。⚠️ page.tsx の `as Array<{...}>` と同じ形にすること ────────────── */

export type AchievementRow = {
  id: string; title: string;
  /* ⚠️ **DB は integer**（`ow_user_achievements.value`）。`/u/[id]` は文字列として
        受けていたが、`/mypage` は数値で持っている。描画は `a.value ?? "—"` の
        埋め込みだけで、どちらでも同じ文字列になる。**型をどちらかに寄せない**
        （寄せると片方でキャストが要り、そこで null の扱いを間違える）。 */
  value: string | number | null;
  unit: string | null;
  description: string | null; period_start: string | null; period_end: string | null; sort_order: number;
};
export type AwardRow = {
  id: string; title: string; issuer: string | null; awarded_at: string | null;
  description: string | null; sort_order: number;
};
export type CertificationRow = {
  id: string; name: string; issuer: string | null; issued_at: string | null;
  credential_id: string | null; credential_url: string | null; sort_order: number;
};
export type LanguageRow = {
  id: string; name: string; proficiency: string | null; sort_order: number;
};

/**
 * 標準スキル（2026-08-27）。⚠️ 形は `recordTypes.ts` の `UserSkill` と揃えること。
 * ⚠️ 表示名も区分も**マスタ（`ow_skills`）が持つ**。この行に自由入力の名前は無い。
 */
export type UserSkillRow = {
  id: string;
  skill_id: string;
  skill: { id: string; label: string; category: string } | null;
};
export type MediaAppearanceRow = {
  id: string; title: string; media_name: string | null; url: string | null;
  thumbnail_url: string | null; appeared_at: string | null; description: string | null; sort_order: number;
};
export type ContentLinkRow = {
  id: string; url: string; platform: string | null;
  title: string | null; description: string | null;
  thumbnail_url: string | null; sort_order: number;
};
export type FeaturedArticleRow = {
  id: string; slug: string; title: string; subtitle: string | null;
  type: string; eyecatch_gradient: string | null; read_min: number | null;
  published_at: string | null;
};




// ─── ProfileAboutSection ───────────────────────────────────────────────────────────
/**
 * セクション見出しの「和文タイトル ＋ ラテン副題」（2026-08-29）。
 *
 * ── なぜ部品にしたか ────────────────────────────────────────────────────────
 * **10箇所が同じ2つの span を書き写していた。** 1箇所直しても他が残る。
 *
 * ── ★`baseline` にする理由 ─────────────────────────────────────────────────
 * 和文タイトル(15px セリフ)とラテン副題(12px サンセリフ)は**文字の大きさも書体も
 * 違う**ので、`alignItems: center`（箱の中心で揃える）だと**ベースラインがずれる。**
 * 実測で**ラテン側が 4px 浮いていた**（6節すべて同じ差）。揃えるのは文字の足元。
 *
 * ⚠️ **外側の行は `center` のまま。** あちらには罫線（高さ1px）と操作ボタンが乗っており、
 *    `baseline` にすると**ベースラインを持たない要素の下端**が文字の足元に合わさって
 *    位置が変わる。だから**この2つだけを内側で包む。**
 * ⚠️ 見出しどうしの間隔（gap:10）は**この内側**が持つ。外側の gap は
 *    「見出しの塊 ↔ 罫線・ボタン」の間隔になる。
 */
export function SectionTitle({ title, latin }: { title: string; latin?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
      {/* ⚠️★`title` に `whiteSpace: "nowrap"` を付けないこと（2026-08-31 に外した）。
             呼び出しの大半は「職歴」「スキル」など短い固定文だが、`/u/[id]` の1箇所だけ
             **会社名から組み立てた可変長**（`${会社名}の募集中の求人`）を渡している。
             セールスフォース・ジャパンで **297px** になり、`body { overflow-x: hidden }` が
             **画面幅346px 未満で末尾を切り落としていた**（320px で 26px ぶん・実測）。
          ⚠️ `document.documentElement.scrollWidth` では見つからない。
             body の overflow-x が隠すので**横スクロールは出ない**
             （.claude/rules/ui-debugging.md「横はみ出し」）。
          ⚠️ `latin` 側の nowrap は残す。あれは CAREER / SKILLS のような短い固定文で、
             途中で折り返ると読めなくなる。 */}
      <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
        {title}
      </span>
      {latin && (
        <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {latin}
        </span>
      )}
    </span>
  );
}

/** 自己紹介。⚠️ 空のときは本人にだけ「書きましょう」のカードを出す（元の挙動のまま） */
export function ProfileAboutSection({ aboutMe, viewerIsOwner, onEdit }: {
  aboutMe: string | null;
  viewerIsOwner: boolean;
  /** ★本人の編集用（`/mypage`）。渡さなければ `/u/[id]` の DOM は1バイトも変わらない */
  onEdit?: () => void;
}) {
  return (
    <>
      {aboutMe ? (
        <section id="about" style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "24px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
            <SectionTitle title="自己紹介" latin="ABOUT" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {onEdit && (
              <button type="button" className="tap-target tap-target-end" onClick={onEdit} aria-label="自己紹介を編集" title="自己紹介を編集" style={sectionAddBtn}>
                <PencilIcon />
              </button>
            )}
          </div>
          <div style={{ paddingLeft: 20, borderLeft: "3px solid var(--accent)" }}>
            <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
              {aboutMe}
            </p>
          </div>
        </section>
      ) : viewerIsOwner ? (
        <section style={{
          background: "var(--bg-tint)", border: "1.5px dashed var(--line)",
          borderRadius: 14, padding: "28px", marginBottom: 20,
          textAlign: "center",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 10 }}>
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", margin: "0 0 12px" }}>
            自己紹介を書いて、あなたのことを伝えましょう
          </p>
          {onEdit ? (
            <button type="button" onClick={onEdit} className="tap-min-h" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: "var(--royal)", color: "#fff", cursor: "pointer",
              fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "inherit",
            }}>
              自己紹介を書く →
            </button>
          ) : (
            <Link href="/mypage" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 8,
              background: "var(--royal)", color: "#fff",
              fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
            }}>
              プロフィールを編集する →
            </Link>
          )}
        </section>
      ) : null}

    </>
  );
}

// ─── ProfileAchievementsSection ───────────────────────────────────────────────────────────
export function ProfileAchievementsSection({ achievements, actions, showAll }: {
  achievements: AchievementRow[];
  /** ★本人の編集用。渡さなければ他人が見る DOM と1バイトも変わらない */
  actions?: RowActions;
  /** ★上限で切ったときの「すべて表示」（2026-08-17 / フェーズ3）。渡さなければ描かない */
  showAll?: { href: string; hiddenCount: number; label: string };
}) {
  const hasActions = !!(actions?.onEditRow || actions?.onDeleteRow || actions?.onAdd);
  return (
    <>
      {(achievements.length > 0 || hasActions) && (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <SectionTitle title="数値実績" latin="ACHIEVEMENTS" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {/* ⚠️ 0件のときは出さない。空状態が同じ入口を本文に出しており、
                   同じカードに追加の入口が2つ並ぶため（ルール⑧・2026-08-24）。 */}
            {actions?.onAdd && achievements.length > 0 && (
              <button type="button" className="tap-target" onClick={actions.onAdd} style={sectionAddBtn}>
                <PlusIcon />追加
              </button>
            )}
            {actions?.manageHref && (
              <SectionManageLink href={actions.manageHref} label={actions.manageLabel ?? "編集"} />
            )}
          </div>

          {/* 0件で本人のときだけ。`/u/[id]` ではセクションごと出ない */}
          {achievements.length === 0 && hasActions && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              まだ数値実績を登録していません。
              {actions?.onAdd && (
                <button type="button" onClick={actions.onAdd} style={emptyAddBtn}>
                  数値実績を追加する
                </button>
              )}
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
            {achievements.map((a) => (
              <div key={a.id} style={{
                textAlign: "center", padding: "18px 12px 14px",
                border: "1.5px solid var(--royal-100)", borderRadius: 12,
                background: "linear-gradient(160deg, var(--royal-50) 0%, #fff 100%)",
                position: "relative", overflow: "hidden",
              }}>
                {/* subtle arc decoration */}
                <div style={{
                  position: "absolute", top: -20, right: -20,
                  width: 60, height: 60, borderRadius: "50%",
                  background: "var(--royal-100)", opacity: 0.4,
                }} />
                <div style={{
                  fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 800, color: "var(--royal)",
                  lineHeight: 1, marginBottom: 6,
                  fontSize: a.value != null && String(a.value).length > 4 ? 22 : 30,
                }}>
                  {a.value ?? "—"}
                  {a.unit && (
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginLeft: 2, opacity: 0.8 }}>
                      {a.unit}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.4, fontWeight: 600, position: "relative" }}>
                  {a.title}
                </div>
                {(a.period_start || a.period_end) && (
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 5, fontFamily: "var(--font-inter), var(--font-noto)", position: "relative" }}>
                    {a.period_start ? a.period_start.slice(0, 7) : ""}
                    {a.period_end ? ` 〜 ${a.period_end.slice(0, 7)}` : a.period_start ? " 〜" : ""}
                  </div>
                )}
                {/* ⚠️ カード型なので右端ではなく**下端**に置く。
                       `actions` が無ければ描かない＝他人の DOM は不変。 */}
                {(actions?.onEditRow || actions?.onDeleteRow) && (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 6, position: "relative" }}>
                    <RowActionButtons id={a.id} label={a.title} actions={actions} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {achievements.filter((a) => a.description).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: 14 }}>
              {achievements.filter((a) => a.description).map((a) => (
                <div key={a.id + "_d"} style={{
                  padding: "10px 14px", borderRadius: 8,
                  background: "var(--bg-tint)", border: "1px solid var(--line)",
                  fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.7,
                }}>
                  <span style={{ fontWeight: 700, color: "var(--ink)", marginRight: 6 }}>{a.title}:</span>
                  {a.description}
                </div>
              ))}
            </div>
          )}
          {showAll && showAll.hiddenCount > 0 && (
            <SectionShowAll href={showAll.href} label={showAll.label} hiddenCount={showAll.hiddenCount} />
          )}
        </section>
      )}
    </>
  );
}

// ─── ProfileAwardsSection ───────────────────────────────────────────────────────────
export function ProfileAwardsSection({ awards, actions, showAll }: {
  awards: AwardRow[];
  /** ★本人の編集用。渡さなければ他人が見る DOM と1バイトも変わらない */
  actions?: RowActions;
  /** ★上限で切ったときの「すべて表示」（2026-08-17 / フェーズ3）。渡さなければ描かない */
  showAll?: { href: string; hiddenCount: number; label: string };
}) {
  const hasActions = !!(actions?.onEditRow || actions?.onDeleteRow || actions?.onAdd);
  return (
    <>
      {(awards.length > 0 || hasActions) && (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <SectionTitle title="受賞・表彰" latin="AWARDS" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {/* ⚠️ 0件のときは出さない（2026-08-24）。他のセクションは元からそうしており、
                   ここだけ「0件」と出ていた。空であることは本文の空状態が伝えている。 */}
            {awards.length > 0 && (
              <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                {awards.length}件
              </span>
            )}
            {/* ⚠️ 0件のときは出さない。空状態が同じ入口を本文に出しており、
                   同じカードに追加の入口が2つ並ぶため（ルール⑧・2026-08-24）。 */}
            {actions?.onAdd && awards.length > 0 && (
              <button type="button" className="tap-target" onClick={actions.onAdd} style={sectionAddBtn}>
                <PlusIcon />追加
              </button>
            )}
            {actions?.manageHref && (
              <SectionManageLink href={actions.manageHref} label={actions.manageLabel ?? "編集"} />
            )}
          </div>

          {awards.length === 0 && hasActions && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              まだ受賞・表彰を登録していません。
              {actions?.onAdd && (
                <button type="button" onClick={actions.onAdd} style={emptyAddBtn}>
                  受賞・表彰を追加する
                </button>
              )}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            {awards.map((award, i) => (
              <div key={award.id} style={{
                display: "flex", gap: 14, padding: "14px 0",
                borderTop: i > 0 ? "1px solid var(--line)" : "none",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(217,119,6,0.25)",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, marginBottom: 4 }}>
                    {award.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    {award.issuer && (
                      <span style={{
                        fontSize: 12, fontWeight: 500, color: "var(--ink-soft)",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                        {award.issuer}
                      </span>
                    )}
                    {award.awarded_at && (
                      <span style={{
                        fontSize: "var(--text-xs)", color: "var(--ink-mute)",
                        fontFamily: "var(--font-inter), var(--font-noto)",
                        background: "var(--bg-tint)", border: "1px solid var(--line)",
                        padding: "1px 7px", borderRadius: 100,
                      }}>
                        {award.awarded_at.slice(0, 7)}
                      </span>
                    )}
                  </div>
                  {award.description && (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", margin: "6px 0 0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {award.description}
                    </p>
                  )}
                </div>
                {/* ⚠️ 行の右端。`actions` が無ければ描かない＝他人の DOM は不変 */}
                {(actions?.onEditRow || actions?.onDeleteRow) && (
                  <RowActionButtons id={award.id} label={award.title} actions={actions} />
                )}
              </div>
            ))}
          </div>
          {showAll && showAll.hiddenCount > 0 && (
            <SectionShowAll href={showAll.href} label={showAll.label} hiddenCount={showAll.hiddenCount} />
          )}
        </section>
      )}
    </>
  );
}

// ─── ProfileCertificationsSection ──────────────────────────────────────────────────
/**
 * 資格（2026-08-24）。LinkedIn の「資格」に合わせた5項目。
 *
 *   名称 / 発行団体 / 発行日 / 認定番号 / 認証URL
 *
 * ⚠️ **置き場所は学歴の下**（柴さんの指示。LinkedIn と同じ並び）。
 * ⚠️ **0件なら出さない。** `actions` を渡した本人だけ、空状態と追加導線が出る
 *    （受賞・表彰と同じ条件式にしてある）。
 * ⚠️ 発行日は**年月まで**しか出さない。DB は date だが日は意味を持たない
 *    （API が `YYYY-MM-01` に正規化して入れている）。
 */
function formatIssuedAt(iso: string): string {
  /* ⚠️ `new Date()` を通さない。タイムゾーンで1日ずれて「12月」が「11月」になる。
        文字列のまま切り出す。 */
  const [y, m] = iso.split("-");
  return `${y}年${Number(m)}月`;
}

export function ProfileCertificationsSection({ certifications, actions, showAll }: {
  certifications: CertificationRow[];
  /** ★本人の編集用。渡さなければ他人が見る DOM と1バイトも変わらない */
  actions?: RowActions;
  /** ★上限で切ったときの「すべて表示」。渡さなければ描かない */
  showAll?: { href: string; hiddenCount: number; label: string };
}) {
  const hasActions = !!(actions?.onEditRow || actions?.onDeleteRow || actions?.onAdd);
  return (
    <>
      {(certifications.length > 0 || hasActions) && (
        <section id="certifications" style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <SectionTitle title="資格" latin="CERTIFICATIONS" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {certifications.length > 0 && (
              <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                {certifications.length}件
              </span>
            )}
            {/* ⚠️ 0件のときは出さない。空状態が同じ入口を本文に出しており、
                   同じカードに追加の入口が2つ並ぶため（ルール⑧・2026-08-24）。 */}
            {actions?.onAdd && certifications.length > 0 && (
              <button type="button" className="tap-target" onClick={actions.onAdd} style={sectionAddBtn}>
                <PlusIcon />追加
              </button>
            )}
            {actions?.manageHref && (
              <SectionManageLink href={actions.manageHref} label={actions.manageLabel ?? "編集"} />
            )}
          </div>

          {certifications.length === 0 && hasActions && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              まだ資格を登録していません。
              {actions?.onAdd && (
                <button type="button" onClick={actions.onAdd} style={emptyAddBtn}>
                  資格を追加する
                </button>
              )}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            {certifications.map((cert, i) => (
              <div key={cert.id} style={{
                display: "flex", gap: 14, padding: "14px 0",
                borderTop: i > 0 ? "1px solid var(--line)" : "none",
              }}>
                {/* ⚠️ 色を増やさない。オレンジはカジュアル面談専用、緑は金銭的にプラスの条件、
                       紫と黄色背景は使わない（`.claude/skills/ui-conventions/SKILL.md`）。
                       ここは濃紺（--royal）の面に白のアイコンで置く。 */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: "var(--royal)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, marginBottom: 4 }}>
                    {cert.name}
                  </div>
                  {cert.issuer && (
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                      {cert.issuer}
                    </div>
                  )}
                  {/* ⚠️ 値が無い項目は**行ごと出さない**。「—」も空欄も置かない
                         （CLAUDE.md「値が無いことを、ある値に置き換えない」）。 */}
                  {cert.issued_at && (
                    <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, marginTop: 2 }}>
                      発行日: {formatIssuedAt(cert.issued_at)}
                    </div>
                  )}
                  {cert.credential_id && (
                    <div style={{
                      fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7,
                      /* ⚠️ 認定番号は長い英数字が入る。`minWidth: 0` の中で折り返させる
                             （`overflow-wrap: anywhere` が無いと親を押し広げる） */
                      overflowWrap: "anywhere",
                    }}>
                      認定番号: {cert.credential_id}
                    </div>
                  )}
                  {cert.credential_url && (
                    <a
                      href={cert.credential_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        marginTop: 8, padding: "6px 14px", borderRadius: 100,
                        border: "1.5px solid var(--line)", background: "#fff",
                        color: "var(--ink-soft)", fontSize: 12, fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      認証情報を表示
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
                {/* ⚠️ 行の右端。`actions` が無ければ描かない＝他人の DOM は不変 */}
                {(actions?.onEditRow || actions?.onDeleteRow) && (
                  <RowActionButtons id={cert.id} label={cert.name} actions={actions} />
                )}
              </div>
            ))}
          </div>
          {showAll && showAll.hiddenCount > 0 && (
            <SectionShowAll href={showAll.href} label={showAll.label} hiddenCount={showAll.hiddenCount} />
          )}
        </section>
      )}
    </>
  );
}

// ─── ProfileLanguagesSection ───────────────────────────────────────────────────────
/**
 * 言語（2026-08-24）。LinkedIn の「言語」に合わせた2項目。
 *
 *   言語名 / 習熟度
 *
 * ⚠️ **置き場所は資格の下**（柴さんの指示。LinkedIn と同じ並び）。
 * ⚠️ **話せる言語**であって、プログラミング言語（`lib/techStack.ts` の「言語」）ではない。
 * ⚠️ **0件なら出さない。** `actions` を渡した本人だけ、空状態と追加導線が出る
 *    （資格・受賞と同じ条件式にしてある）。
 * ⚠️ 習熟度が未選択なら**行ごと出さない**。「初級」や「—」で埋めない。
 * ⚠️ ラベルは `languageProficiencyLabel` を通す。**生の値（`native` 等）を出さない。**
 */
export function ProfileLanguagesSection({ languages, actions, showAll }: {
  languages: LanguageRow[];
  /** ★本人の編集用。渡さなければ他人が見る DOM と1バイトも変わらない */
  actions?: RowActions;
  /** ★上限で切ったときの「すべて表示」。渡さなければ描かない */
  showAll?: { href: string; hiddenCount: number; label: string };
}) {
  const hasActions = !!(actions?.onEditRow || actions?.onDeleteRow || actions?.onAdd);
  return (
    <>
      {(languages.length > 0 || hasActions) && (
        <section id="languages" style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <SectionTitle title="言語" latin="LANGUAGES" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {languages.length > 0 && (
              <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                {languages.length}件
              </span>
            )}
            {/* ⚠️ 0件のときは出さない。空状態が同じ入口を本文に出しており、
                   同じカードに追加の入口が2つ並ぶため（ルール⑧・2026-08-24）。 */}
            {actions?.onAdd && languages.length > 0 && (
              <button type="button" className="tap-target" onClick={actions.onAdd} style={sectionAddBtn}>
                <PlusIcon />追加
              </button>
            )}
            {actions?.manageHref && (
              <SectionManageLink href={actions.manageHref} label={actions.manageLabel ?? "編集"} />
            )}
          </div>

          {languages.length === 0 && hasActions && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              まだ言語を登録していません。
              {actions?.onAdd && (
                <button type="button" onClick={actions.onAdd} style={emptyAddBtn}>
                  言語を追加する
                </button>
              )}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            {languages.map((lang, i) => {
              /* ⚠️ 知らない値は null が返る。生の値を画面に出さない */
              const level = languageProficiencyLabel(lang.proficiency);
              return (
                <div key={lang.id} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 0",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                }}>
                  {/* ⚠️ 色を増やさない。資格と同じ濃紺の面に白のアイコン
                         （オレンジはカジュアル面談専用・緑は金銭的にプラスの条件）。 */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: "var(--royal)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="10" /><path d="M2 12h20" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, overflowWrap: "anywhere" }}>
                      {lang.name}
                    </div>
                    {/* ⚠️ 値が無い項目は**行ごと出さない**（CLAUDE.md
                           「値が無いことを、ある値に置き換えない」）。 */}
                    {level && (
                      <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 2 }}>
                        {level}
                      </div>
                    )}
                  </div>
                  {/* ⚠️ 行の右端。`actions` が無ければ描かない＝他人の DOM は不変 */}
                  {(actions?.onEditRow || actions?.onDeleteRow) && (
                    <RowActionButtons id={lang.id} label={lang.name} actions={actions} />
                  )}
                </div>
              );
            })}
          </div>
          {showAll && showAll.hiddenCount > 0 && (
            <SectionShowAll href={showAll.href} label={showAll.label} hiddenCount={showAll.hiddenCount} />
          )}
        </section>
      )}
    </>
  );
}

// ─── ProfileSkillsSection ──────────────────────────────────────────────────────────
/**
 * 標準スキル（2026-08-27）。作りは `ProfileLanguagesSection` と同じ。
 *
 * ⚠️ **置き場所は学歴の下**（柴さんの指示）。⚠️ **その差し込みはまだ入っていない。**
 *    `/mypage` のカード（`ProfileTab.tsx`）と `/u/[id]` への表示は
 *    別セッションがそれらのファイルを触っているため保留。→ docs/todo.md
 * ⚠️ **0件なら出さない。** `actions` を渡した本人だけ、空状態と追加導線が出る
 *    （資格・言語と同じ条件式にしてある）。
 * ⚠️ **区分ごとにまとめて出す。** 15個まで並ぶので、平らに並べると読めない。
 *    区分名は `skillCategoryLabel` を通す（**生の値（`product` 等）を出さない**）。
 * ⚠️ 年数や習熟度は**持たない**。ここに「3年」などを足さないこと。
 */
export function ProfileSkillsSection({ skills, autoSkills = [], actions, showAll }: {
  skills: UserSkillRow[];
  /** ★職歴から自動で出すスキル（2026-08-29）。`lib/profile/autoSkills.ts` が作る。
   *  ⚠️ **保存されていない値**なので、削除ボタンは出さない（消す手段は職歴を直すこと）。
   *  ⚠️ 手動スキルと**見た目で区別しない**（案A・柴さんの判断）。区分の見出しだけ分ける。 */
  autoSkills?: AutoSkill[];
  /** ★本人の編集用。渡さなければ他人が見る DOM と1バイトも変わらない */
  actions?: RowActions;
  /** ★上限で切ったときの「すべて表示」。渡さなければ描かない */
  showAll?: { href: string; hiddenCount: number; label: string };
}) {
  const hasActions = !!(actions?.onEditRow || actions?.onDeleteRow || actions?.onAdd);
  /* 区分ごとに束ねる。⚠️ マスタに無い区分の行は落とさず「その他」に寄せない
        ——`skill` が null なのは参照先が消えたときだけで、そのときは行ごと出さない。 */
  /* ⚠️ 並び順は `SKILL_CATEGORIES` の並びそのもの。ここで sort しない
        （`skillCategoryRank` は**値**を取る関数で、ラベルを渡すと全件が同じ順位になり、
         「並べ替えているつもりの何もしないコード」になる）。 */
  /* ★自動値は「職種」「業界」という**別の区分**として先に出す（2026-08-29）。
        `ow_skills.category`（product / method / sales_domain）とは語彙が違うので混ぜない。
     ⚠️ `sales_domain` の見出しは **「売り先の業界」**（在籍した業界とは別物）。
        修飾語が付いているので、こちらは素の「業界」でよい。
        ⚠️ **`sales_domain` の見出しを「業界」に短縮しないこと。** 短縮した瞬間に
           同じ画面へ「業界」が2つ並び、どちらが在籍先か分からなくなる。 */
  const autoGroups = [
    { label: "職種", rows: autoSkills.filter((a) => a.kind === "role") },
    { label: "業界", rows: autoSkills.filter((a) => a.kind === "domain") },
  ].filter((g) => g.rows.length > 0);

  const groups = SKILL_CATEGORIES
    .map((c) => ({ label: c.label, rows: skills.filter((s) => s.skill?.category === c.value) }))
    .filter((g) => g.rows.length > 0);
  /* ⚠️ 件数は**自動値も数える**。数えないと「3件」と出ているのに5個並ぶ。 */
  const totalCount = skills.length + autoSkills.length;
  return (
    <>
      {(totalCount > 0 || hasActions) && (
        <section id="skills" style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <SectionTitle title="スキル" latin="SKILLS" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {totalCount > 0 && (
              <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                {totalCount}件
              </span>
            )}
            {/* ⚠️ 0件のときは出さない。空状態が同じ入口を本文に出しており、
                   同じカードに追加の入口が2つ並ぶため（ルール⑧）。 */}
            {actions?.onAdd && totalCount > 0 && (
              <button type="button" className="tap-target" onClick={actions.onAdd} style={sectionAddBtn}>
                <PlusIcon />追加
              </button>
            )}
            {actions?.manageHref && (
              <SectionManageLink href={actions.manageHref} label={actions.manageLabel ?? "編集"} />
            )}
          </div>

          {/* ⚠️ 空のときは**1行だけ**。説明を足さないこと（柴さんの指示） */}
          {totalCount === 0 && hasActions && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              まだスキルを登録していません。
              {actions?.onAdd && (
                <button type="button" onClick={actions.onAdd} style={emptyAddBtn}>
                  スキルを追加する
                </button>
              )}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* ★自動値。⚠️ **削除ボタンを出さない**（保存されていないので消せない）。
                   見た目は手動スキルと同じチップにする（案A）。 */}
            {autoGroups.map((g) => (
              <div key={g.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {g.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {g.rows.map((a) => (
                    <span key={`${a.kind}:${a.label}`} style={{
                      /* ⚠️ `center` にしない（2026-08-29）。名前(13px) と年数(12px) は
                            **文字の大きさが違う**ので、箱の中心で揃えると
                            **ベースラインがずれて年数だけ下がって見える。**
                            揃えるのは文字の足元（baseline）。 */
                      display: "inline-flex", alignItems: "baseline", gap: 6,
                      padding: "6px 12px", borderRadius: 100,
                      background: "var(--royal-50)", color: "var(--royal)",
                      border: "1px solid var(--royal-100)",
                      fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      {a.label}
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)" }}>{a.band}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {groups.map((g) => (
              <div key={g.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {g.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {g.rows.map((row) => (
                    /* ⚠️ 色を増やさない。neutral 固定
                           （オレンジはカジュアル面談専用・緑は金銭的にプラスの条件）。 */
                    <span key={row.id} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 100,
                      background: "var(--royal-50)", color: "var(--royal)",
                      border: "1px solid var(--royal-100)",
                      fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      {row.skill?.label}
                      {/* ⚠️ 行の操作。`actions` が無ければ描かない＝他人の DOM は不変 */}
                      {actions?.onDeleteRow && (
                        <button
                          type="button"
                          onClick={() => actions.onDeleteRow?.(row.id)}
                          aria-label={`${row.skill?.label ?? "スキル"} を削除`}
                          style={{
                            border: "none", background: "none", padding: 0, cursor: "pointer",
                            color: "var(--ink-mute)", fontSize: 14, lineHeight: 1, fontFamily: "inherit",
                          }}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {showAll && showAll.hiddenCount > 0 && (
            <SectionShowAll href={showAll.href} label={showAll.label} hiddenCount={showAll.hiddenCount} />
          )}
        </section>
      )}
    </>
  );
}

// ─── ProfileMediaSection ───────────────────────────────────────────────────────────
export function ProfileMediaSection({ mediaAppearances, actions, showAll }: {
  mediaAppearances: MediaAppearanceRow[];
  /** ★本人の編集用。**渡さなければ他人が見る DOM と1バイトも変わらない**（2-2 と同じ型） */
  actions?: RowActions;
  /** ★上限で切ったときの「すべて表示」（2026-08-17 / フェーズ3）。渡さなければ描かない */
  showAll?: { href: string; hiddenCount: number; label: string };
}) {
  const hasActions = !!(actions?.onEditRow || actions?.onDeleteRow || actions?.onAdd);
  return (
    <>
      {(mediaAppearances.length > 0 || hasActions) && (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <SectionTitle title="メディア掲載" latin="MEDIA" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {/* ⚠️ 本人のときだけ。`/u/[id]` は `actions` を渡さないので出ない＝DOM 不変 */}
            {/* ⚠️ 0件のときは出さない。空状態が同じ入口を本文に出しており、
                   同じカードに追加の入口が2つ並ぶため（ルール⑧・2026-08-24）。 */}
            {actions?.onAdd && mediaAppearances.length > 0 && (
              /* ⚠️ `sectionAddBtn` を直書きで複製していた（2026-08-16 に統合）。
                    複製のせいで、当たり判定を広げる `.tap-target` がこの2箇所
                    （メディア掲載・発信コンテンツ）にだけ効かなかった。 */
              <button type="button" className="tap-target" onClick={actions.onAdd} style={sectionAddBtn}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                追加
              </button>
            )}
            {actions?.manageHref && (
              <SectionManageLink href={actions.manageHref} label={actions.manageLabel ?? "編集"} />
            )}
          </div>

          {/* 0件で本人のときだけ（`/u/[id]` では起きない。`/mypage` の空状態） */}
          {mediaAppearances.length === 0 && hasActions && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              まだメディア掲載を登録していません。
              {actions?.onAdd && (
                <button type="button" onClick={actions.onAdd} style={{
                  background: "none", border: "none", padding: 0, marginLeft: 6, cursor: "pointer",
                  fontSize: 13, fontWeight: 600, color: "var(--royal)", fontFamily: "inherit",
                  textDecoration: "underline", textUnderlineOffset: 2,
                }}>
                  メディア掲載を追加する
                </button>
              )}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mediaAppearances.map((m) => {
              const inner = (
                <>
                  {/* Thumbnail or placeholder */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 8, flexShrink: 0,
                    background: m.thumbnail_url ? undefined : "linear-gradient(135deg, #334155, #6b7280)",
                    overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {m.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      {m.media_name && (
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                          background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)",
                        }}>
                          {m.media_name}
                        </span>
                      )}
                      {m.appeared_at && (
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                          {m.appeared_at.slice(0, 7)}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: "var(--text-sm)", fontWeight: 600, color: m.url ? "var(--royal)" : "var(--ink)", lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {m.title}
                    </div>
                    {m.description && (
                      <div style={{
                        fontSize: "var(--text-xs)", color: "var(--ink-mute)", marginTop: 3, lineHeight: 1.5,
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                      }}>
                        {m.description}
                      </div>
                    )}
                  </div>
                  {m.url && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  )}
                </>
              );
              /* ⚠️ 鉛筆・ゴミ箱は `<a>` の**外**。`actions` が無ければラップごと出さない */
              const row = m.url ? (
                <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                  padding: "12px", borderRadius: 10,
                  border: "1px solid var(--line)", background: "var(--bg-tint)",
                  textDecoration: "none", transition: "border-color 0.15s",
                }}>
                  {inner}
                </a>
              ) : (
                <div key={m.id} style={{
                  display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                  padding: "12px", borderRadius: 10,
                  border: "1px solid var(--line)", background: "var(--bg-tint)",
                }}>
                  {inner}
                </div>
              );
              if (!actions?.onEditRow && !actions?.onDeleteRow) return row;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>{row}</div>
                  <RowActionButtons id={m.id} label={m.title} actions={actions} />
                </div>
              );
            })}
          </div>
          {showAll && showAll.hiddenCount > 0 && (
            <SectionShowAll href={showAll.href} label={showAll.label} hiddenCount={showAll.hiddenCount} />
          )}
        </section>
      )}

    </>
  );
}

// ─── ProfileArticlesSection ───────────────────────────────────────────────────────────
export function ProfileArticlesSection({ featuredArticles }: { featuredArticles: FeaturedArticleRow[] }) {
  return (
    <>
      {featuredArticles.length > 0 && (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <SectionTitle title="OPINIO掲載記事" latin="FEATURED" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {featuredArticles.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                style={{ textDecoration: "none", display: "flex", gap: 14, alignItems: "flex-start",
                  padding: "12px", borderRadius: 10, border: "1px solid var(--line)",
                  background: "var(--bg-tint)", transition: "border-color 0.15s",
                }}
              >
                {/* Eyecatch gradient strip */}
                <div style={{
                  width: 56, height: 56, borderRadius: 8, flexShrink: 0,
                  background: article.eyecatch_gradient ?? "linear-gradient(135deg, var(--royal), var(--accent))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {article.type && ARTICLE_TYPE_LABEL[article.type] && (
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                        background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
                      }}>
                        {ARTICLE_TYPE_LABEL[article.type]}
                      </span>
                    )}
                    {article.read_min && (
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                        {article.read_min}分で読める
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", lineHeight: 1.5,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {article.title}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}


    </>
  );
}

// ─── ProfileContentLinksSection ───────────────────────────────────────────────────────────
export function ProfileContentLinksSection({ contentLinks, viewerIsOwner, actions, showAll }: {
  contentLinks: ContentLinkRow[];
  viewerIsOwner: boolean;
  /** ★本人の編集用。**渡さなければ他人が見る DOM と1バイトも変わらない** */
  actions?: RowActions;
  /** ★上限で切ったときの「すべて表示」（2026-08-17 / フェーズ3）。渡さなければ描かない */
  showAll?: { href: string; hiddenCount: number; label: string };
}) {
  return (
    <>
      {(contentLinks.length > 0 || viewerIsOwner) && (
        <section id="content" style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
            <SectionTitle title="発信コンテンツ" latin="CONTENT" />
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {/* ⚠️ `/mypage` では同じページなので**リンクにしない**（押しても何も起きない）。
                   `onAdd` が渡されたときだけボタンにする。 */}
            {/* ⚠️ 0件のときは出さない。空状態が同じ入口を本文に出しており、
                   同じカードに追加の入口が2つ並ぶため（ルール⑧・2026-08-24）。 */}
            {viewerIsOwner && contentLinks.length > 0 && (actions?.onAdd ? (
              /* ⚠️ `sectionAddBtn` を直書きで複製していた（2026-08-16 に統合）。
                    複製のせいで、当たり判定を広げる `.tap-target` がこの2箇所
                    （メディア掲載・発信コンテンツ）にだけ効かなかった。 */
              <button type="button" className="tap-target" onClick={actions.onAdd} style={sectionAddBtn}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                追加
              </button>
            ) : (
              <Link href="/mypage" style={{
                fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--royal)",
                textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                追加
              </Link>
            ))}
            {actions?.manageHref && (
              <SectionManageLink href={actions.manageHref} label={actions.manageLabel ?? "編集"} />
            )}
          </div>

          {contentLinks.length === 0 && viewerIsOwner && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: "var(--space-2)" }}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "0 0 10px" }}>
                note・Zenn・YouTube等の発信URLを登録しましょう
              </p>
              {actions?.onAdd ? (
                <button type="button" onClick={actions.onAdd} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 16px", borderRadius: 8,
                  background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                  color: "var(--royal)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>
                  コンテンツを追加する →
                </button>
              ) : (
                <Link href="/mypage" style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 16px", borderRadius: 8,
                  background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                  color: "var(--royal)", fontSize: 12, fontWeight: 600, textDecoration: "none",
                }}>
                  コンテンツを追加する →
                </Link>
              )}
            </div>
          )}

          {/* 横並びリスト（LinkedIn Featured 風） */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {contentLinks.map((link) => {
              const meta = PLATFORM_META[link.platform ?? "other"] ?? PLATFORM_META.other;
              /* ⚠️ 鉛筆・ゴミ箱は `<a>` の**外**に置く（アンカーの入れ子は不正で、
                    クリックも取り合いになる）。`actions` が無いときは
                    ラップ用の `<div>` ごと出さない＝他人の DOM は変わらない。 */
              const row = (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-content-card"
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    borderRadius: 12,
                    border: "1px solid var(--line)",
                    background: "#fff",
                    textDecoration: "none",
                    padding: "12px 14px",
                    transition: "box-shadow 0.15s, transform 0.15s",
                    boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
                    minWidth: 0,
                  }}
                >
                  {/* サムネイル or プラットフォームカラーアイコン */}
                  <div style={{
                    width: 64, height: 64, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                    background: link.thumbnail_url
                      ? undefined
                      : `linear-gradient(135deg, ${meta.color}18 0%, ${meta.color}38 100%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {link.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={link.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    )}
                  </div>

                  {/* テキスト情報 */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* プラットフォームバッジ */}
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                      background: meta.bg, color: meta.color,
                      marginBottom: 5,
                    }}>
                      {meta.label}
                    </span>
                    {/* タイトル */}
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {link.title || link.url}
                    </div>
                    {/* 説明 */}
                    {link.description && (
                      <div style={{
                        fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.5, marginTop: 3,
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                      }}>
                        {link.description}
                      </div>
                    )}
                  </div>

                  {/* 外部リンクアイコン */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              );
              if (!actions?.onEditRow && !actions?.onDeleteRow) return row;
              return (
                <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>{row}</div>
                  <RowActionButtons id={link.id} label={link.title || link.url} actions={actions} />
                </div>
              );
            })}
          </div>
          {showAll && showAll.hiddenCount > 0 && (
            <SectionShowAll href={showAll.href} label={showAll.label} hiddenCount={showAll.hiddenCount} />
          )}
        </section>
      )}


    </>
  );
}

// ─── ProfileSocialLinks ───────────────────────────────────────────────────────

/**
 * SNS アイコン列。`/u/[id]` ではヘッダーの中（フォロー数の下）に出る。
 *
 * ⚠️ **並び順は `SNS_PLATFORMS` が持つ。** 呼び出し側で並べ替えないこと。
 * ⚠️ 空文字のキーは出さない（`{"x": ""}` が残っていた時期の名残。値の truthy で見る）。
 * ⚠️ 0件のときは**何も描かない**（`/u/[id]` の挙動）。本人向けの空状態は
 *    呼び出し側（`/mypage`）が出す。
 */
export function ProfileSocialLinks({ socialLinks }: { socialLinks: Partial<Record<string, string>> | null | undefined }) {
  const links = socialLinks ?? {};
  const activeSocials = SNS_PLATFORMS.filter((k) => links[k] && links[k]!.trim() !== "");
  if (activeSocials.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
      {activeSocials.map((platform) => {
        const url = links[platform]!;
        const label = SOCIAL_META[platform].label;
        return (
          <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
            aria-label={label} title={label} className="sns-icon-link">
            <SocialIcon platform={platform as SocialPlatform} variant="display" />
          </a>
        );
      })}
    </div>
  );
}

/**
 * 職歴・学歴の枠と見出し（2026-08-16 / 2-6 で `u/[id]/page.tsx` から切り出した）。
 *
 * ⚠️ **`/u/[id]` に「職歴」「学歴」の見出しは元からあった。** 2-5 のコメントで
 *    「公開プロフィールに見出しが無い」と書いたのは誤りで、正しくは
 *    **切り出していなかった**だけ。`page.tsx` に直接書かれていた。
 *
 * ⚠️ 中身（年表）は `MergedTimeline` が描く。ここは枠・見出し・アンカーだけ。
 * ⚠️ `onAdd` を渡さなければ DOM は `page.tsx` にあったものと1バイトも変わらない。
 */
export function ProfileTimelineSection({ id, title, latin, onAdd, addLabel, manageHref, manageLabel, emptyUsesPencil = false, children }: {
  /** アンカー（`#career` / `#education`）。ページ内ナビが指す */
  id: string;
  title: string;
  /** 見出しの右に出すラテン副題（CAREER / EDUCATION）。他のセクションと形を揃えるためのもの */
  latin?: string;
  /** ★本人の編集用。見出しの「＋」。渡さなければ描かない */
  onAdd?: () => void;
  addLabel?: string;
  /** ★本人の編集用。見出しの「✎」→ 一覧ページ（2026-08-17 / フェーズ3）。
      ⚠️ 行ごとの鉛筆はここでは出さない。**1件ずつ触るのは一覧ページの仕事**。 */
  manageHref?: string;
  manageLabel?: string;
  /** ★0件のとき、見出しのアイコンを**鉛筆1つ**にする（2026-08-17）。
      押すと `onAdd`（追加モーダル）が開く。
      ⚠️ 0件で ＋、1件以上で ✎ だと**同じ見出し行の記号が状態で入れ替わる**。
         「転職の希望」ボックスは常に ✎ なので、そこと揃わない。
      ⚠️ 一覧ページへは送らない。行が無いので空の画面に着くだけ。 */
  emptyUsesPencil?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, padding: "24px 28px", marginBottom: 20,
      boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
    }}>
      {/* ⚠★見出しは**他のセクションと同じ形**にすること（2026-08-29）。
             以前はここだけ **Inter の 16px・ラテン副題なし**で、同じページに
             書体もサイズも違う見出しが並んでいた。
             他11節は「Noto Serif 15px ＋ Inter のラテン副題 ＋ 罫線」。 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <SectionTitle title={title} latin={latin} />
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        {onAdd && (
          <button type="button" className="tap-target" onClick={onAdd} aria-label={addLabel ?? `${title}を追加`} title={addLabel ?? `${title}を追加`} style={sectionAddBtn}>
            {emptyUsesPencil ? <PencilIcon /> : <PlusIcon />}
          </button>
        )}
        {manageHref && (
          <Link href={manageHref} className="tap-target tap-target-end" aria-label={manageLabel ?? `${title}を編集`} title={manageLabel ?? `${title}を編集`} style={sectionAddBtn}>
            <PencilIcon />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** プロフィール内の抜粋で出す最大件数。⚠️ フィードタブは全件なので、ここだけ */
const ACTIVITY_PREVIEW_LIMIT = 3;

type ActivityPost = {
  id: string; content: string; image_url: string | null; created_at: string;
  likes: { count: number }[];
};

/**
 * アクティビティ（その人の投稿）。**自己紹介と職歴の間**に1つだけ置く。
 *
 * ⚠️ ★`/u/[id]/page.tsx` から**ここへ移した**（2026-08-25）。`/mypage` の
 *    プロフィールにも同じものを出すため。**JSX は1文字も変えていない。**
 *    投稿フォームは足していない——`composer` を渡した側だけが持つ。
 *
 * ⚠️ **0件でも消さない。** 「まだ投稿していません」と書く。
 *    消すと「投稿していない」のか「置き場所が無い」のかを読み手が区別できない
 *    （それが 2026-08-23 の出発点）。
 * ⚠️ 本人向けの投稿導線はこのページに置かない（2026-08-16/17 の判断）。
 *    投稿は `/mypage` のアクティビティから行う。空状態でも促さない。
 *
 * ── ★上位タブ（プロフィール / フィード）は 2026-08-23 に外した ──────────────
 * 同じ投稿を「抜粋」と「全件」の2箇所に出しており、**アクティビティがあれば足りる**
 * （柴さんの判断）。全件はこのセクションの中で展開する。
 *
 * ⚠️ **タブを戻さないこと。** 戻すと同じ投稿が1ページに2度出る形に戻る。
 * ⚠️ 取得は `.limit(6)` なので「すべて」も最大6件。展開しても長くなりすぎない。
 */
export function ActivitySection({
  posts, likedPostIds, viewerIsOwner, displayName, composer,
}: {
  posts: ActivityPost[];
  /* ⚠️ **配列で受ける。`Set` にしないこと**（2026-08-25）。この部品は
        `"use client"` なので、サーバーコンポーネントから渡る props は
        RSC 境界を越える。React 18 の直列化に `Set` を通す確証が無く、
        しかも**投稿0件だと一度も読まれない**ので、動いて見えても検証にならない。 */
  likedPostIds: string[];
  viewerIsOwner: boolean;
  displayName: string;
  /** ★本人の投稿フォーム（2026-08-25）。`/mypage` だけが渡す。
      ⚠️ `/u/[id]` には渡さない。公開プロフィールに投稿導線は置かない
         （2026-08-16/17 の判断）。**ここで `viewerIsOwner` から生やさないこと。** */
  composer?: React.ReactNode;
}) {
  return (
    <section id="activity" style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, padding: "22px 28px", marginBottom: 20,
      boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <SectionTitle title="アクティビティ" latin="ACTIVITY" />
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        {posts.length > 0 && (
          <span style={{ fontSize: 12, fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 600, color: "var(--ink-mute)" }}>
            {posts.length}件
          </span>
        )}
      </div>

      {composer && <div style={{ marginBottom: posts.length > 0 ? 18 : 14 }}>{composer}</div>}

      {posts.length === 0 ? (
        <>
          {/* ⚠️ 本人が見ているときは三人称にしない（2026-08-25）。
                 `/mypage` に出すようになって「テスト三郎さんはまだ投稿していません」と
                 自分に向かって言う形になった。**訪問者と本人で文を分ける。** */}
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.8 }}>
            {viewerIsOwner ? "まだ投稿していません" : `${displayName}さんはまだ投稿していません`}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
            {viewerIsOwner
              ? "ここに、あなたの最近の投稿が表示されます。"
              : `ここには、${displayName}さんの最近の投稿が表示されます。`}
          </p>
        </>
      ) : (
        /* ⚠️ カードはサーバー側で全件作り、表示件数の判断だけをクライアントに渡す
               （`CollapsibleList` の使い方）。`PostCard` はクライアント部品なので
               ここで配列にしておけば境界を越えられる。 */
        <CollapsibleList
          items={posts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                id: post.id,
                content: post.content,
                image_url: post.image_url,
                created_at: post.created_at,
                likeCount: post.likes[0]?.count ?? 0,
                isLiked: likedPostIds.includes(post.id),
                isOwner: viewerIsOwner,
              }}
            />
          ))}
          limit={ACTIVITY_PREVIEW_LIMIT}
          labelCollapsed={`投稿をすべて見る（残り ${posts.length - ACTIVITY_PREVIEW_LIMIT} 件）`}
          containerStyle={{ display: "flex", flexDirection: "column", gap: 12 }}
          fade
        />
      )}
    </section>
  );
}
