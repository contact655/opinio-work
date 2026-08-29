import { createAdminClient } from "@/lib/supabase/admin";
import CoverageClient, { type CoverageRow, type AddressSource } from "./CoverageClient";
import { COVERAGE_COLUMNS } from "./columns";
import type { CompanySourceKind } from "@/lib/constants/companySources";

/**
 * 企業データの充填状況一覧（運営の作業管理用）。
 *
 * ⚠️ **スコア化しない。** ✓ と件数だけ。
 *    「開示スコア」を名乗る計算は既に4つあり（CLAUDE.md 参照）、5つ目を作らない。
 *    `lib/utils/disclosureScore.ts` は企業向けの開示度で、目的が違う。
 *
 * ⚠️ 読み取りはサーバー + createAdminClient。ブラウザ側クライアントは使わない
 *    （`ow_companies` には運営ポリシーがあるが、他テーブルには無い。形を揃える）。
 *
 * ⚠️ **`filterListedCompanies` を使わないのは意図的**（2026-08-12）。
 *    `lib/companies/visibility.ts` は「求職者向けディレクトリに出すか」の判定で、
 *    ここは**運営の作業管理画面**。目的が違う。
 *    ディレクトリ非掲載（`listing_status='draft'`）の企業こそデータを埋める対象なので、
 *    掲載の可否ではなく `is_published`（＝詳細ページが存在する企業）で拾う。
 *    ここを `filterListedCompanies` に変えると、**埋めるべき企業が一覧から消える。**
 *
 * ⚠️ /admin/layout.tsx が cookies() を呼ぶのでこのページは自動的に動的。
 */
/* ⚠️ `absolute` を使う。素の `title` だと「… | OPINIO Admin | OPINIO」になる */
export const metadata = { title: { absolute: "充填状況 | OPINIO Admin" } };

/** 値が「埋まっている」か。空配列・空文字・空JSONは埋まっていない扱い */
function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return true;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return Boolean(v);
}

export default async function CoveragePage() {
  const supabase = createAdminClient();

  const cols = ["id", "slug", "name", "brand_name", "is_test", ...COVERAGE_COLUMNS.map((c) => c.key)].join(", ");
  /* ⚠️ 検証用の企業は一覧から外すが、**件数は必ず出す**（2026-08-12）。
        完全に消すと「見えていないだけ」を自分で作ることになる。
        ow_jobs で「テスト」タブを残したのと同じ考え方。 */
  const { data, error } = await supabase
    .from("ow_companies")
    .select(cols)
    .eq("is_published", true)
    .order("name", { ascending: true });

  /* ⚠️ error を握り潰さない。空配列で「0件」を装うと、
        取得失敗と本当に0件の区別がつかなくなる。 */
  if (error) {
    console.error("[admin/companies/coverage]", error.message);
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>充填状況</h1>
        <div role="alert" style={{
          marginTop: 16, background: "#FEE2E2", border: "1px solid #FCA5A5",
          borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#991B1B",
        }}>
          企業の取得に失敗しました: {error.message}
        </div>
      </div>
    );
  }

  /* ★本社所在地の出典（`ow_company_data_sources`）。
        ⚠️ **この表を読む画面はここが最初**（2026-08-30）。作った当日に読み手を付けている。
           読む主体が無いまま置くと、`ow_match_scores`（書き込むコードが存在しないまま
           残っている）と同じ死蔵になる。
        ⚠️ **運営専用の表**（RLS 有効・ポリシー0本・anon/authenticated に GRANT 無し）。
           admin クライアント以外から読まないこと。
        ⚠️ error を握り潰さない。失敗したら「出典なし」ではなく**判定できない**と出す
           （CLAUDE.md「403 は『0件』として静かに素通りする」）。 */
  const { data: srcData, error: srcError } = await supabase
    .from("ow_company_data_sources")
    .select("company_id, source_kind, source_url, verified_at")
    .eq("field", "headquarters_address");
  if (srcError) console.error("[admin/companies/coverage] sources:", srcError.message);

  const sourceById = new Map<string, AddressSource>();
  for (const r of srcData ?? []) {
    sourceById.set(r.company_id as string, {
      kind: r.source_kind as CompanySourceKind,
      url: (r.source_url as string | null) ?? null,
      verifiedAt: r.verified_at as string,
    });
  }

  const all = (data ?? []) as unknown as Record<string, unknown>[];
  const testCount = all.filter((c) => c.is_test === true).length;

  const rows: CoverageRow[] = all
    .filter((c) => c.is_test !== true)
    .map((c) => {
    const filled: Record<string, boolean> = {};
    for (const col of COVERAGE_COLUMNS) filled[col.key] = isFilled(c[col.key]);
    return {
      id: c.id as string,
      slug: (c.slug as string | null) ?? null,
      name: (c.brand_name as string | null)?.trim() || (c.name as string),
      filled,
      filledCount: Object.values(filled).filter(Boolean).length,
      /* ⚠️ 住所が入っているのに出典が無い ＝ **今日以降に足されて記録し忘れた**行。
            それが読めるように、埋まっているかどうかとは別に持つ。 */
      addressSource: sourceById.get(c.id as string) ?? null,
    };
  });

  return <CoverageClient rows={rows} testCount={testCount} sourcesUnavailable={!!srcError} />;
}
