import Link from "next/link";
import { SectionTitle } from "@/components/profile/view/ProfileSections";
import { ROUTE_INSIDE_NOTE, routeTalkTagLabel, routeTitle, type RouteTalkTag } from "@/lib/constants/careerRoutes";
import { RouteConsultButton } from "@/components/careerRoutes/RouteConsultButton";

export type ProfileRouteItem = {
  route: { slug: string; fromLabel: string; toLabel: string };
  movedYear: number | null;
  talkTags: RouteTalkTag[];
  message: string | null;
};

/**
 * ★プロフィール（/u/[id]）の「転職ルート」（2026-11-11）。経験者として掲載されている人だけに出す（呼び出し側が0件なら描かない）。
 *   「話せること」「本人のひとこと」と、相談の入口。たどってきた道は既存の「職歴」欄が持つ。
 * ⚠️ 相談のボタンは本人以外が見ているときだけ（DMButton も自分には出さない）。企業向けの右欄（embed）には出さない。
 */
export function ProfileRoutesSection({ items, user, showConsult }: {
  items: ProfileRouteItem[];
  user: { id: string; name: string };
  showConsult: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section id="routes" data-state="profile-routes" className="pf-card pf-card-roomy">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
        <SectionTitle title="転職ルート" latin="ROUTES" />
        <div className="pf-rule" />
      </div>
      <div style={{ display: "grid", gap: 20 }}>
        {items.map((it) => (
          <div key={it.route.slug} style={{ display: "grid", gap: 10, minWidth: 0 }}>
            <Link href={`/routes/${encodeURIComponent(it.route.slug)}`} style={{ fontSize: 16, fontWeight: 700, color: "var(--royal)", textDecoration: "none", overflowWrap: "anywhere", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
              {routeTitle(it.route)}
              {it.movedYear != null && <span style={{ marginLeft: 6, fontSize: 13, fontWeight: 500, color: "var(--ink-mute)" }}>（{it.movedYear}年に転職）</span>}
            </Link>
            {it.talkTags.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginBottom: 6 }}>話せること</div>
                <ul style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
                  {it.talkTags.map((t) => (
                    <li key={t} style={{ padding: "4px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {routeTalkTagLabel(t)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {it.message && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginBottom: 6 }}>本人のひとこと</div>
                <p style={{ margin: 0, paddingLeft: 12, borderLeft: "3px solid var(--line)", fontSize: 14, color: "var(--ink)", lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {it.message}
                </p>
              </div>
            )}
            {showConsult && (
              <div style={{ maxWidth: 320 }}>
                <RouteConsultButton targetUserId={user.id} targetName={user.name} fromLabel={it.route.fromLabel} toLabel={it.route.toLabel} />
              </div>
            )}
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>{ROUTE_INSIDE_NOTE}</p>
      </div>
    </section>
  );
}
