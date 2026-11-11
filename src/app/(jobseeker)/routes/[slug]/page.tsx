import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getRoutePage } from "@/lib/careerRoutes/server";
import { ROUTE_INSIDE_NOTE, ROUTE_VERIFIED_NOTE, routeTitle } from "@/lib/constants/careerRoutes";
import { RouteHostCard, RouteHostGrid } from "@/components/careerRoutes/RouteHostCard";

/**
 * ★転職ルートのページ（2026-11-11 / 柴さんの決定）。「あなたと同じ転職をした人に聞ける」。
 *
 * ⚠️ /paths（行き先の集計）とは別の画面。あちらは職歴から自動で集計し、こちらは運営が経歴を確かめた人だけを実名で並べる。
 * ⚠️ 未ログインでも開ける（middleware の needsAuth に入れない）。並ぶのは公開範囲が「公開」の人だけ。
 * ⚠️ 掲載の判定は lib/constants/careerRoutes.ts の hostBlockers。ここに条件を書かない。
 * ⚠️ ルートが無い・非公開なら 404。公開されていても掲載できる人が0人なら「準備中です」だけを出し、検索エンジンに載せない。
 * ⚠️ 表は anon に権限が無いので、読み込みは admin クライアント（lib/careerRoutes/server.ts）。承認がすぐ出るよう動的に描く。
 */
export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

/* メタデータと本体で同じ読み込みを2回しない */
const load = cache(getRoutePage);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = await load(params.slug);
  if (!page?.route) return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  const title = routeTitle(page.route);
  if (page.hosts.length === 0) return { title: { absolute: `${title} | OPINIO` }, robots: { index: false, follow: false } };
  return {
    title: { absolute: `${title}の転職をした人に聞く | OPINIO` },
    description: `${title}の転職を経験した人に、1対1で相談できます。${ROUTE_VERIFIED_NOTE}`,
  };
}

export default async function RoutePage({ params }: Params) {
  const page = await load(params.slug);
  if (!page) {
    /* ⚠️ 読み込みの失敗を「準備中」や 404 に見せない */
    return (
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 16px 64px" }}>
        <p data-state="route-error" style={{ color: "var(--ink-soft)" }}>読み込めませんでした。時間をおいてもう一度お試しください。</p>
      </main>
    );
  }
  if (!page.route) notFound();
  const { route, hosts } = page;

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 16px 64px", boxSizing: "border-box" }}>
      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "var(--ink-mute)" }}>転職ルート</p>
      <h1 data-state="route-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--ink)", lineHeight: 1.4, overflowWrap: "anywhere" }}>
        <span>{route.fromLabel}</span>
        <span aria-label="から" style={{ color: "var(--royal)", margin: "0 8px" }}>→</span>
        <span>{route.toLabel}</span>
      </h1>

      {hosts.length === 0 ? (
        <p data-state="route-preparing" style={{ marginTop: 24, padding: "20px 16px", borderRadius: 12, background: "var(--bg-tint)", color: "var(--ink-soft)", fontSize: 15, textAlign: "center" }}>
          準備中です
        </p>
      ) : (
        <>
          <p style={{ margin: "10px 0 24px", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            この転職を経験した人に、1対1で相談できます。{ROUTE_INSIDE_NOTE}
          </p>
          <RouteHostGrid>
            {hosts.map((h) => (
              <RouteHostCard key={h.hostId} host={h} fromLabel={route.fromLabel} toLabel={route.toLabel} />
            ))}
          </RouteHostGrid>
          <p data-state="route-verified-note" style={{ margin: "28px 0 0", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            {ROUTE_VERIFIED_NOTE}
          </p>
        </>
      )}
    </main>
  );
}
