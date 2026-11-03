import Link from "next/link";
import Image from "next/image";
import type { PathsRowView, PathsStartView, PathsView } from "@/lib/paths/server";
import { DMButton } from "@/components/profile/DMButton";
import PathsStartPicker from "./PathsStartPicker";

/**
 * ★「行き先」の本体（起点を選ぶ欄・集計・広げる提案・個人カード）。/paths と /dev/preview/paths が同じ部品を使う。
 * ⚠️ view.cards が null（未ログイン）のときは個人カードを出さない。人数も出さない。
 */
function startText(s: PathsStartView): string {
  return [s.role?.name, s.industry?.name, s.company?.name].filter(Boolean).join(" × ");
}

function startHref(s: PathsStartView): string {
  const q = new URLSearchParams();
  if (s.role) q.set("role", s.role.slug);
  if (s.industry) q.set("industry", s.industry.slug);
  if (s.company) q.set("company", s.company.slug);
  return `/paths?${q.toString()}`;
}

function Rows({ title, rows }: { title: string; rows: PathsRowView[] }) {
  if (rows.length === 0) return null;
  return (
    <div data-state="paths-dim">
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-mute)", margin: "0 0 8px" }}>{title}</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {rows.map((r) => (
          <li key={r.label} data-state="paths-row" style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, minWidth: 0 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>
              {r.href ? <Link href={r.href} style={{ color: "var(--royal)", textDecoration: "none" }}>{r.label}</Link> : r.label}
            </span>
            <span style={{ flexShrink: 0, color: "var(--ink-soft)", fontWeight: 600 }}>{r.count}人</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PathsResult({ view }: { view: PathsView | null }) {
  return (
    <>
      {!view ? (
        <p data-state="paths-error" style={{ color: "var(--ink-soft)" }}>読み込めませんでした。時間をおいてもう一度お試しください。</p>
      ) : (
        <>
          <PathsStartPicker
            options={view.options}
            selected={{ role: view.start?.role?.slug ?? null, industry: view.start?.industry?.slug ?? null, company: view.start?.company?.slug ?? null }}
            autoStartLabel={view.autoStart && view.start ? startText(view.start) : null}
          />

          {!view.start ? (
            <p data-state="paths-empty-start" style={{ marginTop: 24, color: "var(--ink-soft)", fontSize: 14 }}>
              職種・業界・会社のどれかを選ぶと、そこから次に進んだ人の動きが出ます。
            </p>
          ) : (
            <>
              <section data-state="paths-summary" style={{ marginTop: 24, padding: 20, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>「{startText(view.start)}」から次に進んだ人</h2>
                {view.summary && view.summary.moverCount !== null && (
                  <p data-state="paths-basis" style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ink-mute)" }}>{view.summary.moverCount}人の動きから</p>
                )}
                {view.summary && (view.summary.company.length + view.summary.role.length + view.summary.industry.length) > 0 ? (
                  <div className="paths-dims" style={{ display: "grid", gap: 20 }}>
                    <Rows title="次の会社" rows={view.summary.company} />
                    <Rows title="次の職種" rows={view.summary.role} />
                    <Rows title="次の業界" rows={view.summary.industry} />
                  </div>
                ) : (
                  <div data-state="paths-few">
                    <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-soft)" }}>
                      まだ集計に出せるほどの動きがありません（5人以上の動きがあるものだけを出しています）。
                    </p>
                    {view.wider.length > 0 && (
                      <p data-state="paths-wider" style={{ margin: "12px 0 0", fontSize: 14 }}>
                        広げて見る：{" "}
                        {view.wider.map((w, i) => (
                          <span key={startHref(w)}>
                            {i > 0 && "／"}
                            <Link href={startHref(w)} style={{ color: "var(--royal)" }}>{startText(w)}</Link>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}
              </section>

              <section data-state="paths-cards" style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>この経歴から進んだ人</h2>
                {view.cards === null ? (
                  <p data-state="paths-cards-login" style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                    <Link href={`/auth?next=${encodeURIComponent(startHref(view.start))}`} style={{ color: "var(--royal)" }}>ログイン</Link>
                    すると、この人たちの経歴が見られます。
                  </p>
                ) : view.cards.length === 0 ? (
                  <p data-state="paths-cards-none" style={{ fontSize: 14, color: "var(--ink-soft)" }}>まだいません。</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {view.cards.map((c) => (
                      <li key={c.userId} data-state="paths-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}>
                        <Link href={`/u/${c.userId}`} style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
                          {c.avatarUrl ? (
                            <Image src={c.avatarUrl} alt="" width={44} height={44} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: c.gradient, color: "#fff", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 17 }}>{c.initial}</span>
                          )}
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                            <span title={`以前: ${c.fromLabel} → ${c.toIsCurrent ? "現在" : "次"}: ${c.toLabel}`} style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              以前: {c.fromLabel} → {c.toIsCurrent ? "現在" : "次"}: {c.toLabel}
                            </span>
                          </span>
                        </Link>
                        {/* ★ボタンを出すかは DMButton が /api/talk/availability（talkButtonVisible）で決める。話せる設定の人だけ「話を聞く」 */}
                        <DMButton targetUserId={c.userId} targetName={c.name} label="メッセージ" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
      <style>{`
        @media (min-width: 768px) { .paths-dims { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      `}</style>
    </>
  );
}
