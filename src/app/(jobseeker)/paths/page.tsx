import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPathsView } from "@/lib/paths/server";
import PathsResult from "./PathsResult";

/**
 * ★「行き先」（/paths）——同じ経歴の人が、次にどこへ進んだか（2026-11-04 / 柴さんの承認した計画 docs/plan-career-paths-20261103.md）。
 *
 * ⚠️★決め手の回答は使わない（lib/paths/server.ts）。株式会社エージェントと検証用は集計にも個人カードにも出さない。
 * ⚠️★未ログインには集計だけ。個人カード（名前・顔）は出さない。
 * ⚠️ 集計の各行は5人以上（MIN_AGGREGATE_COUNT）。人数も5人以上のときだけ出す。
 * ⚠️ 個人カードの人数は出さない（集計の下限を回り込まれる）。
 * ⚠️ 起点は URL（?role= / ?industry= / ?company=。slug）。会社と業界は同時に持たない。
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "行き先 | OPINIO" },
  description: "同じ経歴の人が、次にどんな会社・職種・業界へ進んだかを、5人以上の動きから見られます。",
  robots: { index: false, follow: false },
};

export default async function PathsPage({ searchParams }: { searchParams?: { role?: string; industry?: string; company?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let viewer: { owUserId: string; isTest: boolean } | null = null;
  if (user) {
    const { data: me, error } = await createAdminClient().from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
    if (error) console.error("[paths] me:", error.message);
    if (me) viewer = { owUserId: me.id as string, isTest: me.is_test === true };
  }

  const view = await getPathsView({ role: searchParams?.role, industry: searchParams?.industry, company: searchParams?.company }, viewer);

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 16px 64px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", color: "var(--ink)" }}>行き先</h1>
      <p style={{ margin: "0 0 20px", color: "var(--ink-soft)", fontSize: 14 }}>
        同じ経歴の人が、次にどんな会社・職種・業界へ進んだか。集計は5人以上の動きがあるものだけを出しています。
      </p>

      <PathsResult view={view} />
    </main>
  );
}
