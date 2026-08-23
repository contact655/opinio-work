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
            <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
              自己紹介
            </span>
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
            <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
              数値実績
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              ACHIEVEMENTS
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {actions?.onAdd && (
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
                  fontFamily: "Inter, sans-serif", fontWeight: 800, color: "var(--royal)",
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
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 5, fontFamily: "Inter, sans-serif", position: "relative" }}>
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
            <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
              受賞・表彰
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              AWARDS
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
              {awards.length}件
            </span>
            {actions?.onAdd && (
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
                        fontFamily: "Inter, sans-serif",
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
            <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
              資格
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              CERTIFICATIONS
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {certifications.length > 0 && (
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                {certifications.length}件
              </span>
            )}
            {actions?.onAdd && (
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
            <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
              メディア掲載
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              MEDIA
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {/* ⚠️ 本人のときだけ。`/u/[id]` は `actions` を渡さないので出ない＝DOM 不変 */}
            {actions?.onAdd && (
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
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
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
            <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
              OPINIO掲載記事
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              FEATURED
            </span>
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
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
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
            <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
              発信コンテンツ
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              CONTENT
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {/* ⚠️ `/mypage` では同じページなので**リンクにしない**（押しても何も起きない）。
                   `onAdd` が渡されたときだけボタンにする。 */}
            {viewerIsOwner && (actions?.onAdd ? (
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
export function ProfileTimelineSection({ id, title, onAdd, addLabel, manageHref, manageLabel, emptyUsesPencil = false, children }: {
  /** アンカー（`#career` / `#education`）。ページ内ナビが指す */
  id: string;
  title: string;
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
          {title}
        </span>
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
