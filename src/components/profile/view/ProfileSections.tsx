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

/* ── ★本人だけに出す操作の口（2026-08-16 / 2-2 で決めた型）──────────────────
      `MergedTimeline` の `viewerIsOwner` に揃える。**2-3〜2-6 でも同じ形を使う。**

      ⚠️ **渡さなければ DOM は1バイトも変わらない。** 他人が見る `/u/[id]` の
         HTML を変えないための約束。ラップ用の `<div>` も、渡されたときだけ足す。
      ⚠️ 見た目（鉛筆・ゴミ箱の形と大きさ）は `RowActions` が1箇所で持つ。
         セクションごとに描き直さない。 */
export type RowActions = {
  /** 行の鉛筆。渡さなければ鉛筆を出さない */
  onEditRow?: (id: string) => void;
  /** 行のゴミ箱。渡さなければ削除を出さない */
  onDeleteRow?: (id: string) => void;
  /** 見出しの「追加」。★`/mypage` では同じページなのでリンクではなくボタンにする */
  onAdd?: () => void;
};

/** 行の右端に出す鉛筆とゴミ箱。⚠️ `<a>` の**外**に置くこと（アンカーの入れ子は不正） */
function RowActionButtons({ id, label, actions }: { id: string; label: string; actions: RowActions }) {
  if (!actions.onEditRow && !actions.onDeleteRow) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      {actions.onEditRow && (
        <button
          type="button" className="btn-fixed-size"
          onClick={() => actions.onEditRow!(id)}
          aria-label={`${label} を編集`} title="編集"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 6 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      )}
      {actions.onDeleteRow && (
        <button
          type="button" className="btn-fixed-size"
          onClick={() => actions.onDeleteRow!(id)}
          aria-label={`${label} を削除`} title="削除"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 6 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── 行の型。⚠️ page.tsx の `as Array<{...}>` と同じ形にすること ────────────── */

export type AchievementRow = {
  id: string; title: string; value: string | null; unit: string | null;
  description: string | null; period_start: string | null; period_end: string | null; sort_order: number;
};
export type AwardRow = {
  id: string; title: string; issuer: string | null; awarded_at: string | null;
  description: string | null; sort_order: number;
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
export function ProfileAboutSection({ aboutMe, viewerIsOwner }: { aboutMe: string | null; viewerIsOwner: boolean }) {
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
          <Link href="/mypage" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 18px", borderRadius: 8,
            background: "var(--royal)", color: "#fff",
            fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
          }}>
            プロフィールを編集する →
          </Link>
        </section>
      ) : null}

    </>
  );
}

// ─── ProfileAchievementsSection ───────────────────────────────────────────────────────────
export function ProfileAchievementsSection({ achievements }: { achievements: AchievementRow[] }) {
  return (
    <>
      {achievements.length > 0 && (
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
          </div>
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
                  fontSize: a.value && a.value.length > 4 ? 22 : 30,
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
        </section>
      )}
    </>
  );
}

// ─── ProfileAwardsSection ───────────────────────────────────────────────────────────
export function ProfileAwardsSection({ awards }: { awards: AwardRow[] }) {
  return (
    <>
      {awards.length > 0 && (
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
          </div>
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
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ─── ProfileMediaSection ───────────────────────────────────────────────────────────
export function ProfileMediaSection({ mediaAppearances, actions }: {
  mediaAppearances: MediaAppearanceRow[];
  /** ★本人の編集用。**渡さなければ他人が見る DOM と1バイトも変わらない**（2-2 と同じ型） */
  actions?: RowActions;
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
              <button type="button" onClick={actions.onAdd} style={{
                fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--royal)",
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 4, padding: 0,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                追加
              </button>
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
export function ProfileContentLinksSection({ contentLinks, viewerIsOwner, actions }: {
  contentLinks: ContentLinkRow[];
  viewerIsOwner: boolean;
  /** ★本人の編集用。**渡さなければ他人が見る DOM と1バイトも変わらない** */
  actions?: RowActions;
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
              <button type="button" onClick={actions.onAdd} style={{
                fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--royal)",
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 4, padding: 0,
              }}>
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
