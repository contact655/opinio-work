import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPathsView } from "@/lib/paths/server";
import { PrevCareerSummary } from "@/components/people/PrevCareerSummary";
import { pathsHref, peopleSearchFromPaths } from "@/lib/people/prevCareer";
import PathsStartPicker from "./PathsStartPicker";

/**
 * ★未ログイン向けの「行き先」（2026-11-03 / 柴さんの指示で戻した）。同じ経歴の人が次にどこへ進んだかの**集計だけ**。
 *
 * ⚠️★人のカード（名前・顔）は出さない。getPathsView に viewer を渡さない（cards が null になる）。
 * ⚠️ 集計の各行と人数は5人以上だけ（lib/paths/server.ts）。
 * ⚠️ ログイン中の人は middleware が /people?prev_…（前の経歴）へ送る。ここの redirect はクッキーが無いのにログインしていた場合の保険
 *    （このフォルダに loading.tsx を置かないこと。置くと redirect が 200 になる）。
 * ⚠️ noindex のまま。ナビには出していない（ホーム・企業・募集・ユーザー・記事の5つ）。
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "行き先 | OPINIO" },
  description: "同じ経歴の人が、次にどんな会社・職種・業界へ進んだかを、5人以上の動きから見られます。",
  robots: { index: false, follow: false },
};

type Search = { role?: string; industry?: string; company?: string };

export default async function PathsPage({ searchParams }: { searchParams?: Search }) {
  const sp = searchParams ?? {};
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(`/people${peopleSearchFromPaths({ get: (k) => (sp as Record<string, string | undefined>)[k] ?? null })}`);

  const view = await getPathsView({ role: sp.role, industry: sp.industry, company: sp.company }, null);
  const loginHref = view?.start ? `/auth?next=${encodeURIComponent(pathsHref(view.start))}` : "/auth?next=%2Fpaths";

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 16px 64px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", color: "var(--ink)" }}>行き先</h1>
      <p style={{ margin: "0 0 20px", color: "var(--ink-soft)", fontSize: 14 }}>
        同じ経歴の人が、次にどんな会社・職種・業界へ進んだか。集計は5人以上の動きがあるものだけを出しています。
      </p>

      {!view ? (
        <p data-state="paths-error" style={{ color: "var(--ink-soft)" }}>読み込めませんでした。時間をおいてもう一度お試しください。</p>
      ) : (
        <>
          <PathsStartPicker
            options={view.options}
            selected={{ role: view.start?.role?.slug ?? null, industry: view.start?.industry?.slug ?? null, company: view.start?.company?.slug ?? null }}
          />
          {view.start ? (
            <div style={{ marginTop: 24 }}>
              <PrevCareerSummary view={view} variant="guest" />
            </div>
          ) : (
            <p data-state="paths-empty-start" style={{ marginTop: 24, color: "var(--ink-soft)", fontSize: 14 }}>
              職種・業界・会社のどれかを選ぶと、そこから次に進んだ人の動きが出ます。
            </p>
          )}
          <p data-state="paths-login-note" style={{ margin: "8px 0 0", padding: "14px 16px", borderRadius: 12, background: "var(--royal-50)", fontSize: 14, color: "var(--ink)", lineHeight: 1.7 }}>
            <Link href={loginHref} style={{ color: "var(--royal)", fontWeight: 700 }}>ログイン</Link>
            すると、この経歴の人のプロフィールも見られます。
          </p>
        </>
      )}
    </main>
  );
}
