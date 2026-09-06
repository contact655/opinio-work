"use client";

import { SearchAllLink } from "@/components/jobseeker/SearchAllLink";
import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Job } from "@/app/jobs/mockJobData";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { getVisibleRoles } from "@/lib/constants/roleTracks";
import type { BusinessDomainFacet } from "@/lib/companies/businessDomainsCached";
import { JOB_EMPLOYMENT_TYPES } from "@/lib/constants/careerOptions";
import { availablePhaseOptions, phaseMatches } from "@/lib/constants/phase";
/**
 * 勤務形態フィルタの語。**DB の値ではなく「表示ラベルへの部分一致で使う語」。**
 * 求人側のラベルは フルリモート可 / ハイブリッド / 原則出社 の3種で、
 * `t.includes(語)` で当てている（絞り込みは下の workStyleSet のところ）。
 *
 * ⚠️ 2026-08-08 に「リモート可」を落とした。
 *    「フルリモート可」にしか当たらず、「フルリモート」と**絞れる集合が完全に同じ**で、
 *    選択肢が2つある意味が無かった。
 * ⚠️ デスクトップのピルとモバイルのシートが同じこの定数を見る。片方に直書きしない。
 */
const WORK_STYLE_FILTERS = ["フルリモート", "ハイブリッド", "出社"] as const;

/**
 * 複数選択ピルのラベル。選択が無ければ項目名、1つなら値、複数なら「値 +N」。
 *
 * ⚠️ 新しい意匠を作らないため、既存のピルと同じ1行テキストに収める。
 * ⚠️ **同じピル行で表示ルールを2つ持たない。** 複数選択のピルはすべてこれを使う
 *    （2026-08-08 にフェーズピルもここへ寄せた。それまでフェーズだけ
 *      「最初に一致した1つ」を出す形で、2つ選んでも1つに見えていた）。
 *
 * @param labels 値と表示名が違うとき（フェーズの listed → 上場 など）に渡す
 */
function pillLabel(selected: Set<string>, fallback: string, labels?: Record<string, string>): string {
  if (selected.size === 0) return fallback;
  const order = labels ? Object.keys(labels).filter((k) => selected.has(k)) : Array.from(selected);
  const first = labels ? (labels[order[0]] ?? order[0]) : order[0];
  return selected.size === 1 ? first : `${first} +${selected.size - 1}`;
}


const SALARY_PILL_TIERS = [
  { value: "400",  label: "400万〜" },
  { value: "500",  label: "500万〜" },
  { value: "600",  label: "600万〜" },
  { value: "700",  label: "700万〜" },
  { value: "800",  label: "800万〜" },
  { value: "1000", label: "1000万〜" },
  { value: "1200", label: "1200万〜" },
  { value: "1500", label: "1500万〜" },
] as const;
import type { Company } from "@/app/companies/mockCompanies";
import { extractPrefecture, PREFECTURE_FILTER_GROUPS } from "@/lib/utils/location";
import { parseEmployeeCount } from "@/lib/utils/employeeCount";
import { fmtMan } from "@/lib/utils/salary";
import { JobListItem, hasSalaryData } from "@/components/jobs/JobListItem";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────


/* ⚠️ formatSalary / hasSalaryData / JobListItem は 2026-08-31 に
      `@/components/jobs/JobListItem` へ移した（`/dev/preview/job-cards` から見るため）。 */






/* ─── 職種の色分けは廃止した（2026-08-30）────────────────────────────────────
   ⚠️★**戻さないこと。** 以前は職種ごとに9通りの色を割り当てていた
      （エンジニア青 / デザイン・プロダクト・PdM **紫** / 営業・CS **緑** /
        マーケティング **黄色背景** / コーポレート緑 / 経営赤）。

   ① `.claude/skills/ui-conventions`「色の役割」が禁じている色を3つ含んでいた
      —— **紫は使わない** / **黄色背景は使わない** / **緑は金銭的にプラスの条件のみ**。
   ② **凡例が無い。** 「デザインが紫」に意味は無く、読み手は解釈できない。
   ③ ★**選択状態の見た目が9通りある**のが一番まずい。ここの色は
      「その職種が何であるか」ではなく「**その絞り込みが効いている**」を表しており、
      1つの意味に9つの見た目を与えていた（規約の「1つの色が2つ以上の意味を持たない」の逆）。

   ⚠️ 職種を色で見分けたくなったら、**色ではなく文言・順序・件数**で示すこと。
      `--royal` は globals.css で「ヘッダー・CTA・**アクティブ**」と定義されている色で、
      絞り込みの選択状態はこれ1つに揃える。
   ─────────────────────────────────────────────────────────────────────────── */

/** 絞り込みの選択状態。**職種によらず常に同じ**（上のコメントを読むこと）。 */
const ACTIVE_FILTER = { color: "var(--royal)", bg: "var(--royal-50)" } as const;





// ─── マッチ理由テキスト（フィルター文脈ベース）────────────────────────────────

function computeMatchReason(
  job: Job,
  filters: { category: string; dept: string; salary: string; prefecture: string; q: string },
  parentRoles: { id: string; name: string }[],
): string | null {
  const { category, dept, prefecture, q } = filters;
  // 職種カテゴリフィルター
  if (category) {
    const roleName = parentRoles.find((r) => r.id === category)?.name;
    if (roleName) return `「${roleName}」職種での絞り込み結果`;
  }
  // 旧 dept フィルター
  if (!category && dept && (job.dept?.includes(dept) || dept.includes(job.dept ?? ""))) {
    return `「${dept}」職種での絞り込み結果`;
  }
  // 年収フィルター — ラベル非表示
  // 勤務地フィルター
  if (prefecture && job.location?.includes(prefecture)) {
    return `${prefecture}勤務の募集`;
  }
  // キーワード検索
  if (q.trim().length >= 1) return `「${q.trim()}」の検索結果`;
  return null;
}

// ─── LinkedIn 型縦リスト行 ────────────────────────────────────────────────────




// ─── Desktop Sidebar Filters ──────────────────────────────────────────────────

/*
  デスクトップのサイドバー。**上部のピル行と重複しない条件だけを置く。**

  ── 2026-08-08 に6項目を削除した ────────────────────────────────────────────
  業種 / 年収 / こだわり条件 / 企業ステージ / 業態 / 技術スタック を消し、
  雇用形態は上部のピル行へ移した。理由は2つ。

  ① 上部と二重になっていた。業種・年収・企業ステージは選択肢も URL パラメータも
     上部と同一で、同じものが画面に2つある状態だった。
     「こだわり条件」だけは上部の勤務形態と**値域が違い**（リモート可 が上部に無く、
     上部の 出社 がこちらに無い。単一選択 vs 複数選択）、
     単純な重複ではなかったので上部側を複数選択に変えてから消した。
  ② 業態と技術スタックは**1件も絞れないフィルタ**だった
     （2026-08-07 実測: business_model は product 18件のみ、tech_stack 非空 0件）。
     絞り込みロジックごと消したので、URL パラメータでも到達できない。

  ⚠️ ここに条件を足す前に、**上部のピル行に同じものが無いか**を必ず見ること。
*/
function SidebarFilters({
  parentRoles, category, prefecture,
  setParam, hasFilter, q, onReset,
  roleCounts,
  toggleParam: toggleParamFn,
}: {
  parentRoles: { id: string; name: string }[];
  category: string; prefecture: string;
  setParam: (key: string, value: string) => void;
  hasFilter: boolean; q: string; onReset: () => void;
  roleCounts?: Map<string, number>;
  toggleParam: (key: string, value: string, current: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["prefecture"]));
  const categorySet = useMemo(() => new Set(category ? category.split(",") : []), [category]);


  function toggleSection(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function SectionHeader({ label, sectionKey, hasActive }: { label: string; sectionKey: string; hasActive?: boolean }) {
    const isOpen = !collapsed.has(sectionKey);
    return (
      <button type="button" onClick={() => toggleSection(sectionKey)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: hasActive ? "var(--royal-50)" : "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: hasActive ? "var(--royal)" : "var(--ink)", letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: 6 }}>
          {hasActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />}
          {label}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke={hasActive ? "var(--royal)" : "var(--ink-mute)"} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    );
  }

  function CheckItem({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
    return (
      <label
        onClick={(e) => { e.preventDefault(); onClick(); }}
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 14px", cursor: "pointer", userSelect: "none" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLLabelElement).style.background = "#f8fafc"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.background = "transparent"; }}
      >
        <span style={{
          width: 17, height: 17, borderRadius: 4, border: `2px solid ${active ? "var(--royal)" : "#CBD5E1"}`,
          background: active ? "var(--royal)" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s",
        }}>
          {active && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l2.5 3L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span style={{ fontSize: 13, color: active ? "var(--ink)" : "var(--ink-soft)", fontWeight: active ? 600 : 400, flex: 1 }}>
          {label}
        </span>
        {count !== undefined && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>({count})</span>
        )}
      </label>
    );
  }

  const { business, tech } = getVisibleRoles(parentRoles);
  const sortedRoles = [
    ...business.filter(r => r.name !== "その他"),
    ...tech,
    ...business.filter(r => r.name === "その他"),
  ];

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--line)", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)", display: "flex", flexDirection: "column" }}>

      {/* ── 1. 職種 ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="職種" sectionKey="category" hasActive={categorySet.size > 0} />
        {!collapsed.has("category") && (
          <div style={{ padding: "2px 4px 10px", display: "flex", flexDirection: "column", gap: 1 }}>
            {sortedRoles.map((role) => {
              const isActive = categorySet.has(role.id);
              const rc = ACTIVE_FILTER;
              return (
                <button key={role.id} type="button" onClick={() => toggleParamFn("category", role.id, category)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${isActive ? rc.color : "transparent"}`, background: isActive ? rc.bg : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.1s", width: "100%" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: rc.color, flexShrink: 0, opacity: isActive ? 1 : 0.4 }} />
                  <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? rc.color : "var(--ink)", flex: 1 }}>{role.name}</span>
                  {roleCounts?.get(role.id) ? <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? rc.color : "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)", flexShrink: 0 }}>({roleCounts.get(role.id)})</span> : null}
                  {isActive && <svg style={{ flexShrink: 0 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={rc.color} strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2. 勤務地 ──
             ⚠️ 以前は「実データに2県以上あるときだけ出す」ゲートがあったが、
                都道府県を47件固定にしたので外した（2026-09-06）。
                ピル側には元からこのゲートが無く、**同じ画面で食い違っていた。** */}
      {(
        <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
          <SectionHeader label="勤務地" sectionKey="prefecture" hasActive={!!prefecture} />
          {!collapsed.has("prefecture") && (
            <div style={{ paddingBottom: 8, maxHeight: 180, overflowY: "auto" }}>
              {/* ⚠️ ピルのドロップダウンと**同じ並び**にする。片方だけ直さないこと。 */}
              {PREFECTURE_FILTER_GROUPS.map((g) => (
                <div key={g.group}>
                  <div style={{
                    padding: "8px 16px 2px", fontSize: 11, fontWeight: 700,
                    color: "var(--ink-mute)", letterSpacing: "0.06em",
                  }}>{g.group}</div>
                  {g.prefectures.map((p) => (
                    <CheckItem key={p} label={p} active={prefecture === p}
                      onClick={() => setParam("prefecture", prefecture === p ? "" : p)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── フッター: 検索する ── */}
      <div style={{ padding: "12px 14px", background: "#fff" }}>
        <button
          type="button"
          onClick={() => document.getElementById("jobs-results-top")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 8,
            background: "var(--royal)", color: "#fff",
            border: "none", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.02em",
          }}
        >
          検索する
        </button>
        {(hasFilter || q) && (
          <button type="button" onClick={onReset}
            style={{ display: "block", width: "100%", marginTop: 8, padding: "5px 0", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", textAlign: "center" }}
          >
            検索条件をリセットする
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

export default function JobsClient({
  jobs: allJobs,
  companies,
  parentRoles,
  industryOptions,
  roleAliases = [],
}: {
  jobs: Job[];
  companies: Company[];
  parentRoles: { id: string; name: string }[];
  /** 事業領域の選択肢。⚠️ **マスタが唯一の出どころ。** ここに値を書かない。
   *  ⚠️ 掲載中が1社以上あるものだけをサーバ側が渡す（0件の選択肢を出さない）。 */
  industryOptions: BusinessDomainFacet[];
  /** 検索用の職種辞書（職種名＋別名）。roleIds はその語が指す職種そのものだけ
   *  （祖先は求人側の roleIds に入っている。queries.ts の getRoleAliases 参照） */
  roleAliases?: { alias: string; roleIds: string[] }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /*
    ── 「あなたへのおすすめ」（2026-08-13 にサーバーからここへ移した）──────────

    元はページのサーバーコンポーネントで計算して props で受けていたが、
    そのために `/jobs` 全体が `force-dynamic` になり、**未ログインの訪問者まで
    毎回サーバー関数の起動（コールドスタート 2〜4秒）を負担していた。**
    ページを ISR に載せ、パーソナライズだけをここから取りに行く。

    ⚠️ **未ログインでは fetch しない。** `getSession()` はクッキーを読むだけで
       ネットワークに出ないので、ログアウト中のサーバー往復は 0 のままになる。
       ここで無条件に fetch すると、CDN から返した意味が半分無くなる。

    ⚠️ **API からは求人IDだけ受け取る。** 求人の中身は allJobs に既にあるので、
       オブジェクトを返させると同じデータを2回運ぶことになる。

    ⚠️ **API が返した順序を保つこと。** スコア降順に並んでいる。
       allJobs 側でフィルタし直すと順序が失われる。
  */
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (!session || !active) return;
        const res = await fetch("/api/jobseeker/recommendations");
        if (!res.ok || !active) return;
        const data = (await res.json()) as { jobIds?: string[] };
        if (active) setRecommendedIds(data.jobIds ?? []);
      } catch {
        // おすすめが出ないだけ。求人一覧の表示は妨げない
      }
    })();
    return () => { active = false; };
  }, []);

  const recommendations = useMemo(() => {
    if (recommendedIds.length === 0) return [];
    const byId = new Map(allJobs.map((j) => [j.id, j]));
    return recommendedIds
      .map((id) => byId.get(id))
      .filter((j): j is Job => Boolean(j));
  }, [recommendedIds, allJobs]);

  const category = searchParams.get("category") ?? "";
  const bizOnly = searchParams.get("biz_only") === "1";
  const dept = searchParams.get("dept") ?? "";       // 後方互換 (新規 URL では未使用)
  const work_style = searchParams.get("work_style") ?? "";
  const salary = searchParams.get("salary") ?? "";
  /* ⚠️ 2026-08-06 に salary_max を削除した。指定するUIがサイドバーにもピル行にも
        当時のフィルタシートにも無く、URLを手で書く以外に到達できなかった。
        年収は下限指定（salary・8段階）が自然な軸なのでそちらに一本化する。
        レンジ指定が必要になったら、ピルを「400〜600万」型に作り替えるところから設計すること。 */
  const industry = searchParams.get("industry") ?? "";
  /* ⚠️ 2026-08-06 に industry_id を削除した。当時それを指定できるのはモバイルの
        「詳細条件」だけで、そこをデスクトップと同じ industry（INDUSTRY_GROUPS の
        グループキー）に揃えた結果、到達手段が無くなったため。
        外部から ?industry_id= を作るリンクも存在しない。
        （その「詳細条件」も 2026-08-08 に削除した。業種は上部のピルで指定する）
        ow_industries マスタで絞りたくなったら、まず industry との二本立てをどうするか決めること。 */
  const prefecture = searchParams.get("prefecture") ?? "";
  const empType = searchParams.get("emp_type") ?? "";   // 雇用形態フィルター（カンマ区切り複数可）
  /* 企業で絞る（2026-08-15 実装）。値は **slug 優先・UUID も受理**。
     ⚠️ 2026-08-08 に企業ページの「N件すべての求人を見る」を消したとき、
        コメントに「復活させるなら `/jobs?company=` が筋」と残していたもの。
        それまで `company` は**読まれておらず、200 を返して全社の求人を出していた**
        （記事CTA は 2026-08-04 にこれを理由にリンクごと企業ページへ寄せた）。
     ⚠️ 生成側は `/companies/${slug ?? id}` と同じ綴りにすること。
        リンクを作る箇所を増やすときも slug を優先する（共有URLが読める）。 */
  const companyParam = searchParams.get("company") ?? "";

  /* companyParam → 企業。見つからなければ null。
     ⚠️ **`is_published` を必ず見る。** ここを外すと、運営が取り下げた企業の社名が
        チップに出てしまう（取り下げ＝詳細ページが404、が現在の意味。CLAUDE.md 参照）。
        求人カードの企業名リンクが `company.is_published` を見ているのと同じ理由。
     ⚠️ `companies` は getJobs が **全社**返すので、公開求人0件の企業も解決できる。
        「この企業の公開求人はありません」を社名付きで出せるのはこのため。 */
  const companyFilter = useMemo(() => {
    if (!companyParam) return null;
    const key = companyParam.toLowerCase();
    return companies.find(
      (c) => c.is_published && (c.slug?.toLowerCase() === key || c.id.toLowerCase() === key)
    ) ?? null;
  }, [companyParam, companies]);

  /* 指定されたが解決できなかった。**黙って無視しない**（CLAUDE.md「エラーを握りつぶさない」）。
     404 にはしない — 古い共有リンクで真っ白になるより、全件＋注記のほうが読める。 */
  const companyNotFound = !!companyParam && !companyFilter;

  /** チップ・空状態に出す企業名。求人カードと同じ綴り（brand_name 優先） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyFilterName = companyFilter ? ((companyFilter as any).brand_name ?? companyFilter.name) as string : "";

  // 複数選択用: カンマ区切り文字列 → Set
  const categorySet = useMemo(() => new Set(category ? category.split(",") : []), [category]);
  const workStyleSet = useMemo(() => new Set(work_style ? work_style.split(",") : []), [work_style]);
  const empTypeSet = useMemo(() => new Set(empType ? empType.split(",") : []), [empType]);
  const [sort, setSort] = useState(searchParams.get("sort") ?? "updated");
  // Desktop sidebar detection
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Local-only keyword search
  // LP のヒーロー検索から ?q= で飛んでくるため URL を初期値にする
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [showSuggest, setShowSuggest] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [pillAnchor, setPillAnchor] = useState<{ top: number; left: number } | null>(null);
  const filterPillsRef = useRef<HTMLDivElement>(null);

  // サジェスト / フィルターピル外クリックで閉じる
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
      const target = e.target as Node;
      const inFilterBar = filterPillsRef.current?.contains(target);
      const inDropdown = (target as HTMLElement)?.closest?.(".jobs-pill-menu");
      if (!inFilterBar && !inDropdown) {
        setOpenFilter(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // ⑧ 企業グルーピング toggle（デフォルトON）
  const [groupByCompany, setGroupByCompany] = useState(false);


  // 企業ステージフィルター
  const [companyStage, setCompanyStage] = useState(""); // カンマ区切り複数選択
  const companyStageSet = useMemo(() => new Set(companyStage ? companyStage.split(",") : []), [companyStage]);
  function toggleParam(key: string, value: string, current: string) {
    const set = new Set(current ? current.split(",") : []);
    if (set.has(value)) set.delete(value); else set.add(value);
    setParam(key, Array.from(set).join(","));
  }
  function toggleStage(value: string) {
    const set = new Set(companyStage ? companyStage.split(",") : []);
    if (set.has(value)) set.delete(value); else set.add(value);
    setCompanyStage(Array.from(set).join(","));
  }

  // Which filter chip dropdown is open
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Bookmarks + applied jobs: load in parallel on mount
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  /* ⚠️ 希望職種はサーバーから props で受け取る（desiredRoleIds）。
        ここでクライアントから ow_profiles を引いていたが、**ow_users.id で引いており
        常に0件**で、「あなたの希望職種にマッチ」が一度も出ていなかった（2026-08-07 修正）。
        サーバーで解決すれば空間を取り違えようがない。auth.getUser() もここでは不要になった。 */
  useEffect(() => {
    Promise.all([
      fetch("/api/bookmarks?target_type=job").then((r) => r.ok ? r.json() : { ids: [] }).catch(() => ({ ids: [] })),
      fetch("/api/user/applied-jobs").then((r) => r.ok ? r.json() : { ids: [] }).catch(() => ({ ids: [] })),
    ]).then(([bookmarkData, appliedData]) => {
      if ((bookmarkData as { ids?: string[] }).ids) setBookmarkedIds(new Set((bookmarkData as { ids: string[] }).ids));
      if ((appliedData as { ids?: string[] }).ids) setAppliedJobIds(new Set((appliedData as { ids: string[] }).ids));
    }).catch(() => {});
  }, []);

  // ⑤ "もっと見る" — init from URL param ?show=N, resets when filters change
  const initShow = Math.max(PER_PAGE, parseInt(searchParams.get("show") ?? "0") || PER_PAGE);
  const [displayCount, setDisplayCount] = useState(initShow);

  // Build Map for fast company lookup
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  /* ⚠️ フェーズの選択肢は**実データから作る**（2026-08-08）。
        固定の3段（listed/unicorn/startup）を出していたが、
        公開求人が付いている企業は listed と unicorn だけで、
        「スタートアップ」は必ず0件だった。逆に non_listed は選択肢が無く絞れなかった。 */
  const phaseOptions = useMemo(
    () => availablePhaseOptions(allJobs.map((j) => companyMap.get(j.company_id)?.phase ?? null)),
    [allJobs, companyMap],
  );
  const phaseKeys = useMemo(() => phaseOptions.map((o) => o.value), [phaseOptions]);
  const phaseLabels = useMemo(
    () => Object.fromEntries(phaseOptions.map((o) => [o.value, o.label])),
    [phaseOptions],
  );
  /* companyStage には外資系（foreign）も入っている。フェーズの表示・判定からは外す */
  const phaseSet = useMemo(
    () => new Set(phaseKeys.filter((k) => companyStageSet.has(k))),
    [companyStageSet, phaseKeys],
  );

  // 検索サジェスト: キーワードから求人タイトル・会社名をマッチ
  const suggestions = useMemo(() => {
    const trimmed = q.trim();
    if (trimmed.length < 1) return [];
    const lower = trimmed.toLowerCase();
    const seen = new Set<string>();
    const results: { label: string; sub: string; q: string }[] = [];
    for (const j of allJobs) {
      if (results.length >= 8) break;
      const roleMatch = j.role.toLowerCase().includes(lower);
      const co = companyMap.get(j.company_id);
      const coName = co?.name ?? "";
      const coMatch = coName.toLowerCase().includes(lower);
      if (roleMatch) {
        const key = j.role;
        if (!seen.has(key)) { seen.add(key); results.push({ label: j.role, sub: coName, q: j.role }); }
      } else if (coMatch) {
        const key = `co:${coName}`;
        if (!seen.has(key)) { seen.add(key); results.push({ label: coName, sub: "企業で絞り込む", q: coName }); }
      }
    }
    return results;
  }, [q, allJobs, companyMap]);


  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`/jobs?${params.toString()}`, { scroll: false });
  }

  /* 都道府県は **47件すべて**を出す（柴さんの判断・2026-09-06）。
     ⚠️★**実データから作らないこと。** 以前は求人にある都道府県だけを出しており、
        公開求人が東京都の2件しか無いため**選択肢が「東京都」1つ**になっていた。
        入力欄（職歴・オンボーディング）と同じ見た目に揃えるほうを優先する。
     ⚠️ 分け方も見出しも lib/utils/location.ts の `PREFECTURE_FILTER_GROUPS` が唯一の出どころ。
     ⚠️ この例外は**都道府県だけ**。フェーズ・事業領域には広げないこと。 */

  const searchResult = useMemo(() => {
    let list = [...allJobs];
    let ignoredTerms: string[] = [];

    if (q.trim()) {
      /*
        語ごとに絞り込む（2026-08-03）。

        以前はクエリ全体を1語として includes() していたため、
        「エンタープライズ企業 営業」が丸ごと1つの文字列として扱われ 0件 になっていた。
        /companies?q= 側（lib/search/companies.ts）は既に空白区切りの AND 検索なので、
        そちらに揃える。

        ただし単純な AND だと、こちらで解釈できない語が1つでも混ざると 0件 になる。
        「エンタープライズ企業」は企業規模の言い換えで、今はまだ辞書に無い。
        そこで **どの求人にも当たらなかった語は絞り込みから外す** ことにした。
        結果として「解釈できた語だけを AND する」挙動になる。

          エンタープライズ企業 営業 → 「エンタープライズ企業」は0件なので除外
                                    → 「営業」だけで絞る
          営業 エンジニア           → どちらも当たるので AND（＝セールスエンジニア系）
          ぬるぽ                    → 全語が当たらない → 0件（黙って全件返さない）

        外した語は ignoredTerms に入れ、画面に「絞り込みに使わなかった語」として出す。
        黙って無視すると、入力した条件が効いていないことに気づけないため。
      */
      const words = q.trim().toLowerCase().split(/[\s　]+/).filter(Boolean);

      const jobRoleIds = (j: (typeof list)[number]) =>
        j.roleIds ?? (j.role_category_id ? [j.role_category_id] : []);

      const matchesText = (j: (typeof list)[number], w: string) => {
        const co = companyMap.get(j.company_id);
        return (
          j.role.toLowerCase().includes(w) ||
          (co?.name ?? "").toLowerCase().includes(w) ||
          (co?.brand_name ?? "").toLowerCase().includes(w) ||
          (co?.slug ?? "").toLowerCase().includes(w) ||
          j.highlight.toLowerCase().includes(w)
        );
      };

      /*
        辞書（職種名 ＋ 別名。queries.ts の getRoleAliases）で当てる。1段だけ。

        ⚠️ 段階分けはしない。2026-08-06 まで「第1段=職種そのもの / 第2段=祖先まで」の
           2段構えで、第1段が当たると第2段に落ちない作りだった。
           求人に具体職種を付けた瞬間、「営業」で検索しても営業配下が出なくなった
           （14件 → 8件）。逆に「法人営業」は第1段が0件なので祖先に落ちて営業配下14件を返し、
           子職種で検索したのに祖先の兄弟まで出ていた。どちらの向きにも壊れていた。

        いまは辞書側が職種そのものだけを指し、求人側の roleIds に祖先が入っている。
        「営業」→ 営業 を roleIds に持つ求人＝営業配下すべて。
        「エンタープライズセールス」→ その職種の求人だけ。
        1本の判定で両方成立する。
      */
      const matchByAlias = (w: string, pool: typeof list) => {
        const hits = roleAliases.filter((a) => a.alias.toLowerCase().includes(w));
        if (hits.length === 0) return null;
        const ids = new Set(hits.flatMap((a) => a.roleIds).filter(Boolean));
        const matched = pool.filter((j) => jobRoleIds(j).some((id) => ids.has(id)));
        return matched.length > 0 ? matched : null;
      };

      const ignored: string[] = [];
      for (const w of words) {
        const byText = list.filter((j) => matchesText(j, w));
        const byAlias = matchByAlias(w, list) ?? [];
        // 本文一致と辞書一致の和集合
        const merged = byText.length || byAlias.length
          ? Array.from(new Set([...byText, ...byAlias]))
          : [];

        if (merged.length === 0) {
          ignored.push(w);   // 解釈できなかった語。絞り込みには使わない
          continue;
        }
        list = merged;
      }
      // 全語が解釈できなかったときだけ 0件 にする
      if (ignored.length === words.length) list = [];
      ignoredTerms = ignored;
    }

    // ビジネス職のみフィルタ
    if (bizOnly && !category) {
      const { business } = getVisibleRoles(parentRoles);
      const bizIds = new Set(business.map((r) => r.id));
      list = list.filter((j) => bizIds.has(j.role_category_id ?? ""));
    }

    // ow_roles 親カテゴリフィルタ — 複数選択対応（カンマ区切り）
    if (categorySet.size > 0) list = list.filter((j) => {
      const ids = j.roleIds ?? (j.role_category_id ? [j.role_category_id] : []);
      return ids.some((id) => categorySet.has(id));
    });

    // 旧 dept フィルタ (後方互換、URLに ?dept= が残っている場合)
    if (!category && dept) list = list.filter((j) => j.dept === dept);

    if (workStyleSet.size > 0) {
      list = list.filter(
        (j) =>
          workStyleSet.has(j.work_style) ||
          j.tags.some((t) => Array.from(workStyleSet).some((ws) => t.includes(ws)))
      );
    }

    if (salary) {
      const min = parseInt(salary, 10);
      if (!isNaN(min)) {
        list = list.filter((j) => j.salary_max > 0 && j.salary_max >= min);
      }
    }


    if (industry) {
      /* ⚠️ **事業領域で絞る（2026-08-26）。** `?industry=` の値は事業領域の slug。
            それまでは `industry`(text) と比べていたが、あれは廃止予定で
            新規企業には書かれないため、新しい企業が全業種で出なくなる。
         ⚠️ **主だけでなく全部の事業領域に当てる。** 主だけで絞ると複数持てる意味が無い。 */
      const companyIds = companies
        .filter((c) => (c.business_domains ?? []).some((d) => d.slug === industry))
        .map((c) => c.id);
      list = list.filter((j) => companyIds.includes(j.company_id));
    }


    /* 企業フィルタ（?company=）。他のフィルタと AND で重なる。
       ⚠️ 解決できなかったとき（companyNotFound）は**絞らない**。
          全件＋注記にする判断（2026-08-15）。ここで0件にすると、
          綴り違いの共有リンクが「求人なし」に見えてしまう。 */
    if (companyFilter) {
      list = list.filter((j) => j.company_id === companyFilter.id);
    }

    // 都道府県フィルタ (job.location から抽出した都道府県と完全一致)
    if (prefecture) {
      list = list.filter((j) => extractPrefecture(j.location) === prefecture);
    }

    // 雇用形態フィルタ（複数選択対応）
    // ⚠️ 未設定（null）は**どの雇用形態にも一致させない**（2026-08-07）。
    //    以前は queries.ts が null を "正社員" に倒しており、
    //    雇用形態が入っていない求人が「正社員」で絞ると出てきていた。
    if (empTypeSet.size > 0) {
      list = list.filter((j) => !!j.employment_type && empTypeSet.has(j.employment_type));
    }

    // 企業ステージフィルタ（複数選択対応）
    if (companyStageSet.size > 0) {
      list = list.filter((j) => {
        const co = companyMap.get(j.company_id);
        const rawPhase = co?.phase ?? null;
        const matchesStage = (s: string) => {
          /* ⚠️ 正規表現をやめて写像に寄せた（2026-08-08）。/companies と同じ
                PHASE_FILTER_MAP を見る。旧実装が拾っていた nasdaq|nyse|グロース|プライム は
                実データに0件だったので、失うものは無い（実測済み）。 */
          if (s === "foreign") {
            const nm = co?.name ?? "";
            const url = (co?.url ?? "").toLowerCase();
            if (nm.toLowerCase().includes("japan")) return true;
            if (url && !url.includes(".co.jp") && !url.includes(".jp/") && !url.endsWith(".jp")) return true;
            if (/^[゠-ヿ]/.test(nm)) return true;
            return false;
          }
          return phaseMatches(rawPhase, s);
        };
        return Array.from(companyStageSet).some(matchesStage);
      });
    }


    // ソート
    if (sort === "salary") {
      list = [...list].sort((a, b) => (b.salary_max ?? 0) - (a.salary_max ?? 0));
    } else if (sort === "employees") {
      // 社員数順（多い企業の求人が上位）
      /* ⚠️★**直す前は動いていなかった**（2026-08-28）。`employee_count` は
            **text**（「約200名」など）なのに `?? 0` で受けて `bE - aE` を計算しており、
            文字列同士の引き算で **NaN** になっていた。比較関数が NaN を返すと
            並び順は事実上変わらない。**型が number だと嘘をついていたので気づけなかった。**
         ⚠️ 数が読めない企業は **-1** で末尾へ。0 にすると「社員0名」と同じ扱いになる。 */
      list = [...list].sort((a, b) => {
        const aE = parseEmployeeCount(companyMap.get(a.company_id)?.employee_count) ?? -1;
        const bE = parseEmployeeCount(companyMap.get(b.company_id)?.employee_count) ?? -1;
        return bE - aE;
      });
    } else if (sort === "disclosure") {
      // 開示充実順: 年収+キャッチコピー+説明の充実度スコア
      const score = (j: Job) => {
        let s = 0;
        if (hasSalaryData(j.salary_min, j.salary_max)) s += 3;
        if (j.highlight) s += 2;
        if (j.overview && j.overview.length > 100) s += 1;
        if (j.required_skills && j.required_skills.length > 0) s += 1;
        return s;
      };
      list = [...list].sort((a, b) => score(b) - score(a));
    } else {
      // デフォルト(新着順): 給与記載あり優先、次に更新日
      list = [...list].sort((a, b) => {
        const aHas = hasSalaryData(a.salary_min, a.salary_max) ? 0 : 1;
        const bHas = hasSalaryData(b.salary_min, b.salary_max) ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        return a.updated_days_ago - b.updated_days_ago;
      });
    }

    return { list, ignoredTerms };
  }, [allJobs, q, category, categorySet, dept, work_style, workStyleSet, salary, industry, prefecture, empType, empTypeSet, companyStage, companyStageSet, companyFilter, sort, companies, companyMap, roleAliases]);

  const filtered = searchResult.list;
  const ignoredTerms = searchResult.ignoredTerms;

  // ⑧ グルーピング適用（1社あたり最大3件・更新日新しい順）
  const filteredForDisplay = useMemo(() => {
    if (!groupByCompany) return filtered;
    // 企業ごとにグループ化し、更新日昇順（古い日数=新しい）でソート後、先頭3件を取る
    const byCompany = new Map<string, typeof filtered>();
    for (const j of filtered) {
      const arr = byCompany.get(j.company_id) ?? [];
      arr.push(j);
      byCompany.set(j.company_id, arr);
    }
    byCompany.forEach((arr) => arr.sort((a, b) => a.updated_days_ago - b.updated_days_ago));
    // 企業の出現順（filteredリスト内の初出）を維持して平坦化
    const seenCompanies: string[] = [];
    for (const j of filtered) {
      if (!seenCompanies.includes(j.company_id)) seenCompanies.push(j.company_id);
    }
    return seenCompanies.flatMap((cid) => (byCompany.get(cid) ?? []).slice(0, 3));
  }, [filtered, groupByCompany]);

  // ⑧ グルーピング時に「まとめられた社数」を計算
  const hiddenByGrouping = filtered.length - filteredForDisplay.length;
  // ⑧ 最も多い企業の件数を計算
  const maxPerCompany = useMemo(() => {
    const countMap = new Map<string, number>();
    filtered.forEach((j) => countMap.set(j.company_id, (countMap.get(j.company_id) ?? 0) + 1));
    return Math.max(0, ...Array.from(countMap.values()));
  }, [filtered]);

  // ⑤ reset when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filterKey = [category, dept, work_style, salary, industry, prefecture, empType, sort, q, bizOnly, companyStage].join("|");
  useEffect(() => {
    setDisplayCount(PER_PAGE);
    // Clear ?show from URL when filters change
    const p = new URLSearchParams(window.location.search);
    if (p.has("show")) { p.delete("show"); router.replace(`/jobs?${p.toString()}`, { scroll: false }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const paged = filteredForDisplay.slice(0, displayCount);
  const hasMore = displayCount < filteredForDisplay.length;
  const remainingCount = filteredForDisplay.length - displayCount;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setDisplayCount((c) => c + PER_PAGE); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  /* ⚠️ `companyFilter`（解決できた企業）だけを数える。`companyParam` を入れると、
        綴り違いのときに「絞り込み中」と言いながら全件出ている状態になる。
        解決できなかったことは companyNotFound の注記で別に伝える。 */
  const hasFilter = !!(category || dept || work_style || salary || industry || prefecture || empType || companyStage || bizOnly || companyFilter);


  const roleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of allJobs) {
      const ids = (j as { roleIds?: string[] }).roleIds ?? (j.role_category_id ? [j.role_category_id] : []);
      for (const id of ids) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [allJobs]);



  return (
    <>
      <h1 className="sr-only">IT募集を探す</h1>

      {/* ── 検索バー + フィルターピル（sticky、企業ページと同構造） ── */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          padding: "20px 0 0",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          position: "sticky",
          top: 60,
          zIndex: 30,
        }}
      >
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">

          {/* 検索バー行（企業ページ .csb-bar と同等） */}
          <div ref={filterPillsRef} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 0 14px" }}>

            {/* 検索インプット */}
            <div ref={searchBarRef} style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
              <div role="search" style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#fff", border: "1.5px solid #e6e9ef", borderRadius: 999,
                padding: "0 14px", transition: "border-color 0.15s, box-shadow 0.15s",
              }}
                onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(0,35,102,0.08)"; }}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { (e.currentTarget as HTMLDivElement).style.borderColor = "#e6e9ef"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; } }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="search"
                  aria-label="募集を検索"
                  placeholder="職種・企業名で検索..."
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
                  onFocus={() => setShowSuggest(true)}
                  onKeyDown={(e) => { if (e.key === "Escape") setShowSuggest(false); }}
                  style={{
                    flex: 1, border: "none", outline: "none",
                    fontSize: 13.5, color: "var(--ink)", background: "transparent",
                    padding: "9px 0", minWidth: 0,
                  }}
                />
                {q && (
                  <button type="button" onClick={() => { setQ(""); setShowSuggest(false); }} aria-label="検索をクリア"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2, display: "flex", alignItems: "center", flexShrink: 0 }}
                  >×</button>
                )}
              </div>

              {/* ── 検索サジェスト dropdown ── */}
              {showSuggest && suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                  background: "#fff", border: "1.5px solid var(--line)",
                  borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  zIndex: 200, overflow: "hidden",
                }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setQ(s.q); setShowSuggest(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", padding: "10px 16px",
                        border: "none", background: "transparent",
                        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                        borderBottom: i < suggestions.length - 1 ? "1px solid var(--line-soft)" : "none",
                      }}
                      className="suggest-item"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
                        {s.sub && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sub}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* フィルターピル群（企業ページと同じ位置・同じスタイル） */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" }}>

              {/* フェーズ ピル */}
              <button type="button"
                className={`jobs-pill${phaseSet.size > 0 ? " active" : ""}`}
                style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "phase") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("phase");
                }}
              >
                {pillLabel(phaseSet, "フェーズ", phaseLabels)} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/* 業種 ピル */}
              <button type="button" className={`jobs-pill${industry ? " active" : ""}`} style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "industry") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("industry");
                }}
              >
                {industryOptions.find((d) => d.slug === industry)?.name ?? "事業領域"} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/* 都道府県 ピル */}
              <button type="button" className={`jobs-pill${prefecture ? " active" : ""}`} style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "prefecture") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("prefecture");
                }}
              >
                {prefecture || "都道府県"} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/*
                勤務形態 ピル（複数選択）
                ⚠️ 2026-08-08 に単一選択から複数選択へ変えた。
                   絞り込みロジックは元からカンマ区切りの OR に対応していたが、
                   それを使えるのはサイドバーの「こだわり条件」だけだった。
                   サイドバーを消すにあたり、上部で同じことができるようにした
                   （単一選択のまま消すと「フルリモート または ハイブリッド」が
                    URL 手打ちでしか指定できない死んだフィルタになる）。
              */}
              <button type="button" className={`jobs-pill${workStyleSet.size > 0 ? " active" : ""}`} style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "work_style") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("work_style");
                }}
              >
                {pillLabel(workStyleSet, "勤務形態")} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/*
                雇用形態 ピル（複数選択）
                ⚠️ 2026-08-08 にサイドバーから移してきた。選択肢は careerOptions.ts の
                   JOB_EMPLOYMENT_TYPES。ここに直書きしないこと（DB の CHECK と揃えてある）。
              */}
              <button type="button" className={`jobs-pill${empTypeSet.size > 0 ? " active" : ""}`} style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "empType") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("empType");
                }}
              >
                {pillLabel(empTypeSet, "雇用形態")} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/* 年収 ピル */}
              <button type="button" className={`jobs-pill${salary ? " active" : ""}`} style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "salary") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("salary");
                }}
              >
                {salary ? (SALARY_PILL_TIERS.find(t => t.value === salary)?.label ?? "年収") : "年収"} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/* 外資系 トグルピル */}
              <button type="button"
                className={`jobs-pill${companyStageSet.has("foreign") ? " active" : ""}`}
                onClick={() => toggleStage("foreign")}
                style={{ flexShrink: 0 }}
              >
                外資系{companyStageSet.has("foreign") && <span style={{ fontSize: 12, marginLeft: 3 }}>✕</span>}
              </button>

              {/*
                ⚠️ 2026-08-06 に「面談受付中」ピルを削除した。
                   フィルタピルと並んでいたが実体は並び替え（sort="meeting"）で、
                   面談を受け付ける企業を上に寄せるだけ。掲載中76社が全て
                   accepting_casual_meetings = true なので1件も順番が変わらず、
                   押しても何も起きないのに絞り込めるように見えていた。
                   面談の可否で絞りたくなったら、sort ではなくフィルタとして作ること。
              */}

              {/* ⚠️★**「✕ リセット」は廃止した**（2026-09-06 / 柴さんの判断・`/companies` と揃えた）。
                     絞り込みが1つ付くたびに現れて右端の並びが動くうえ、**すべて個別に外せる**:
                       各ピル → 開いて「すべて」／ 外資系 → もう一度押す（元からトグル）
                       検索文字 → 入力欄の ✕ ／ 職種（サイドバー）→ もう一度押す
                  ⚠️ サイドバーの「検索条件をリセットする」と、0件のときの
                     「すべてリセット」は**残してある**（別の場所・別の役割）。 */}
            </div>
          </div>
        </div>
      </div>

      {/* ── ソートバー ── */}
      <div
        ref={filterBarRef}
        className="jobs-mobile-filterbar"
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }} className="px-5 py-3 md:px-12">

          {/* 解釈できなかった検索語の通知。
              「エンタープライズ企業 営業」のように、こちらで扱えない語が混ざったとき
              その語は絞り込みから外している。黙って外すと、入力した条件が効いていない
              ことに気づけないので明示する。 */}
          {ignoredTerms.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              background: "var(--warm-soft)", border: "1px solid #FDE68A",
              borderRadius: 10, padding: "8px 14px",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warm-ink)" }}>
                {ignoredTerms.map((t) => `「${t}」`).join("")}
                は絞り込みに使えませんでした
              </span>
              {/* 全語が使えなかったときは「残りの語」が存在しないので出さない */}
              {ignoredTerms.length < q.trim().split(/[\s　]+/).filter(Boolean).length && (
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--warm-ink)", opacity: 0.85 }}>
                  残りの語だけで検索しています
                </span>
              )}
            </div>
          )}

          {/* 並び替えバー */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            background: "#fff", borderRadius: 12, border: "1px solid var(--line)",
            padding: "10px 16px", boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
          }}>
            {/* 左: 並び替えピル */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-soft)", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M7 12h10M11 18h2"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>並び替え</span>
              </div>
              <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />
              <div style={{ display: "flex", gap: 6, alignItems: "center", overflowX: "auto", scrollbarWidth: "none" }}>
                {([
                  { value: "updated",     label: "新着順",     icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg> },
                  { value: "salary",      label: "年収順",     icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
                  { value: "employees",   label: "社員数順",   icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                  { value: "disclosure",  label: "開示充実順", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
                ] as const).map((opt) => {
                  const active = sort === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => setSort(opt.value)}
                      className={`jobs-sort-btn${active ? " active" : ""}`}
                    >
                      {active ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> : opt.icon}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 右: グルーピング + 件数 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {maxPerCompany > 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setGroupByCompany(v => !v); setDisplayCount(PER_PAGE); }}
                    className={`jobs-sort-btn${groupByCompany ? " active" : ""}`}
                    title="同一企業の求人を1社あたり3件に絞る"
                  >
                    {groupByCompany ? "✓ " : ""}1社3件まで
                  </button>
                  {groupByCompany && hiddenByGrouping > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#C2410C", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                      {hiddenByGrouping}件非表示
                      <button type="button" onClick={() => setGroupByCompany(false)} style={{ background: "none", border: "none", color: "#C2410C", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" }}>全表示</button>
                    </span>
                  )}
                </>
              )}
              <div style={{ width: 1, height: 20, background: "var(--line)" }} />
              <span aria-live="polite" style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
                <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 16 }}>{filteredForDisplay.length}</strong>
                <span style={{ marginLeft: 2 }}>件</span>
                {(hasFilter || q) && <span style={{ fontSize: 12, color: "var(--success-ink)", marginLeft: 6, fontWeight: 600 }}>絞込中</span>}
              </span>
            </div>
          </div>

          {/* ── 行3 (モバイルのみ): 職種クイックピル ── */}
          <div className="jobs-mobile-role-pills" style={{ display: "none", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
            {parentRoles.slice(0, 10).map((role) => {
              const active = category === role.id;
              const rc = ACTIVE_FILTER;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setParam("category", active ? "" : role.id)}
                  style={{
                    flexShrink: 0, height: 30, padding: "0 12px", borderRadius: 999,
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    border: `1.5px solid ${active ? rc.color : "#e2e8f0"}`,
                    background: active ? rc.bg : "#fff",
                    color: active ? rc.color : "var(--ink-soft)",
                    cursor: "pointer", whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {role.name}
                  {roleCounts.get(role.id) ? <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.7 }}>({roleCounts.get(role.id)})</span> : null}
                </button>
              );
            })}
          </div>

          {/* 企業が解決できなかったときの注記。⚠️ 黙って全件を出さない */}
          {companyNotFound && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2, paddingBottom: 2, alignItems: "center" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0,
                padding: "3px 10px", borderRadius: 100,
                background: "#FEF3C7", border: "1.5px solid #FDE68A",
                color: "var(--warm-ink)", fontSize: 12, fontWeight: 700,
              }}>
                指定された企業が見つかりません。すべての募集を表示しています
              </span>
              <button type="button" onClick={() => setParam("company", "")} style={{
                fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none",
                border: "none", cursor: "pointer", padding: "3px 4px",
                fontFamily: "inherit", textDecoration: "underline",
              }}>
                指定を外す
              </button>
            </div>
          )}

          {/* ⚠️★**「絞り込み中」のサマリー行は廃止した**（2026-09-06 / 柴さんの判断）。
                 職種・勤務形態・年収・雇用形態・地域は、**ピルとサイドバーが
                 選択状態で示している**ので同じことを2箇所に出していた。

              ⚠️★**企業（`?company=`）だけは残す。これにはピルが無い。**
                 企業詳細の「N件すべての求人を見る」と `/u/[id]` の現職リンクから
                 `/jobs?company=<slug>` で来る導線が生きており、消すと
                 **なぜ2件しか出ていないのか画面のどこにも出ず、外す手段も無くなる。**
                 「なくても分かる」が成り立たない唯一の絞り込み。 */}
          {companyFilter && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2, paddingBottom: 2, alignItems: "center" }}>
              <button key="co" type="button" onClick={() => setParam("company", "")} title={companyFilterName} style={{
                display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%",
                padding: "3px 10px", borderRadius: 100,
                background: "var(--royal-50)", border: "1.5px solid var(--royal)",
                color: "var(--royal)", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                {/* ⚠️ minWidth:0 が無いと ellipsis が効かず親を押し広げる（375px で実測済みの罠） */}
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  企業: {companyFilterName}
                </span>
                <span style={{ fontSize: 12, opacity: 0.8, flexShrink: 0 }}>✕</span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Main content */}
      <div style={{ background: "#F5F7FA" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-6 md:px-12 md:py-8"
        >
          <div
            className="jobs-layout"
            style={isDesktop ? { gridTemplateColumns: "260px minmax(0,1fr)" } : undefined}
          >
            {/* ─ Desktop sidebar ─ */}
            <aside className="jobs-sidebar">
              <SidebarFilters
                parentRoles={parentRoles}
                category={category}
                prefecture={prefecture}
                setParam={setParam}
                hasFilter={hasFilter}
                q={q}
                onReset={() => { setQ(""); setCompanyStage(""); router.replace("/jobs"); }}
                roleCounts={roleCounts}
                toggleParam={toggleParam}
              />
            </aside>

            {/* ─ Results column ─ */}
            <main id="jobs-results-top" style={{ minWidth: 0 }}>

          {/* ── パーソナライズ: あなたにおすすめの求人 ── */}
          {!hasFilter && !q && recommendations.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>あなたへのおすすめ</span>
                <span style={{ fontSize: 12, padding: "1px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontWeight: 600 }}>
                  {recommendations.length}件
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {recommendations.slice(0, 6).map((job) => {
                  const recCompany = companyMap.get(job.company_id);
                  return (
                    <a
                      key={job.id}
                      href={`/jobs/${job.slug ?? job.id}`}
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        background: "#fff", color: "var(--ink)",
                        border: "1.5px solid var(--line)",
                        textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 10,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                        transition: "border-color .15s, box-shadow .15s",
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {recCompany && (
                          <CompanyLogo
                            name={recCompany.name}
                            logoUrl={recCompany.logo_url}
                            logoLetter={recCompany.logo_letter}
                            logoGradient={recCompany.gradient}
                            size={36}
                            borderRadius={8}
                          />
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {job.role}
                        </div>
                        {recCompany && (
                          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(recCompany as any).brand_name ?? recCompany.name}
                          </div>
                        )}
                        {(job.salary_min ?? 0) > 0 && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success-ink)", marginTop: 4, fontFamily: "var(--font-inter), var(--font-noto)" }}>
                            {fmtMan(job.salary_min)}
                            {job.salary_max && job.salary_max > job.salary_min! ? `〜${fmtMan(job.salary_max)}` : ""}万円
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
              {recommendations.length > 4 && (
                <div style={{ marginTop: 8, textAlign: "right" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>他 +{recommendations.length - 4}件</span>
                </div>
              )}
            </div>
          )}

          {/* ⚠️ ここにあった「あなたの希望職種にマッチ」セクションは 2026-08-07 に削除した。
                 recommendations.length === 0 のときだけ出るフォールバックだったが、
                 希望職種が1つでも当たれば scoreJob の職種48点だけで MIN_SCORE(30) を
                 超えるため、**「マッチ求人がある＝おすすめも必ずある」**になり
                 条件が永久に成立しなくなった（希望職種の中間テーブル化で scoreJob が
                 正しく動き出したことによる）。復活させるなら、おすすめとは別の切り口で。 */}

          {paged.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 24px", background: "#fff",
              borderRadius: 16, border: "1px solid var(--line)", marginTop: 20,
            }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              {/* ⚠️ 企業で絞っているときは「条件に合う募集が…」では何が起きたか分からない。
                     公開求人を1件も持たない企業は 86/87 社あるので、ここは頻繁に踏まれる。 */}
              <h3 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--ink)", marginBottom: 8, overflowWrap: "anywhere" }}>
                {companyFilter
                  ? `${companyFilterName}の公開中の募集はありません`
                  : "条件に合う募集が見つかりませんでした"}
              </h3>
              {/* 「カジュアル面談で直接聞いてみましょう」は 2026-08-03 に差し替え。
                  面談を前提にした案内はプラットフォーム側の説明では使わない方針。
                  ここは検索結果が0件のときの導線なので、条件を緩めるか企業から辿るかを示す。 */}
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", marginBottom: 20 }}>
                {companyFilter
                  ? "企業ページから会社の情報を見られます"
                  : "条件を緩めるか、企業から探してみてください"}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {/* 企業で絞って0件のときは、その企業のページへ戻れるようにする */}
                {companyFilter && (
                  <Link href={`/companies/${companyFilter.slug ?? companyFilter.id}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 24px", borderRadius: 8, background: "var(--royal)",
                    color: "#fff", fontSize: "var(--text-base)", fontWeight: 600, textDecoration: "none",
                  }}>
                    企業ページを見る
                  </Link>
                )}
                <button type="button" onClick={() => router.replace("/jobs")} style={{
                  padding: "10px 24px", borderRadius: 8, background: "var(--royal)",
                  color: "#fff", border: "none", fontSize: "var(--text-base)", fontWeight: 600, cursor: "pointer",
                }}>
                  すべてリセット
                </button>
                <Link href="/companies" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 8,
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  color: "#fff", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  企業を見る
                </Link>
              </div>
              {/* ★この窓は職種・会社などの絞り込みで、業種は対象外。
                     「IT」のような語は0件が正しいが、行き止まりにしない（2026-08-27）。 */}
              <SearchAllLink q={q} />
            </div>
          ) : (
            <>
              {/* リスト表示（デスクトップ・モバイル共通） */}
              <div className="jobs-list-desktop">
                {(() => {
                  return paged.map((job) => {
                    return (
                      <JobListItem
                        key={job.id}
                        job={job}
                        companyMap={companyMap}
                        initialBookmarked={bookmarkedIds.has(job.id)}
                        isApplied={appliedJobIds.has(job.id)}
                        matchReason={computeMatchReason(job, { category, dept, salary, prefecture, q }, parentRoles)}
                      />
                    );
                  });
                })()}
              </div>
              {/* ⑦ プログレスバー + もっと見るボタン */}
              <div style={{ marginTop: 16, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                    <strong style={{ color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{paged.length}</strong>
                    {" / "}
                    <strong style={{ color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{filteredForDisplay.length}</strong>
                    {" 件表示中"}
                  </span>
                  {hasMore && (
                    <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>残り{remainingCount}件</span>
                  )}
                </div>
                <div style={{ height: 4, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.round(paged.length / Math.max(filteredForDisplay.length, 1) * 100)}%`,
                    background: "linear-gradient(to right, var(--royal), #3B5FD9)",
                    borderRadius: 99,
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => {
                    const next = displayCount + PER_PAGE;
                    setDisplayCount(next);
                    const p = new URLSearchParams(window.location.search);
                    p.set("show", next.toString());
                    router.replace(`/jobs?${p.toString()}`, { scroll: false });
                  }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    margin: "12px auto 0",
                    padding: "12px 32px", borderRadius: 999,
                    border: "1.5px solid var(--royal)",
                    background: "#fff", color: "var(--royal)",
                    fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                    boxShadow: "0 2px 8px rgba(0,35,102,0.1)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--royal)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
                >
                  もっと見る
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              )}
              {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

            </>
          )}
            </main>
          </div>{/* jobs-layout end */}
        </div>
      </div>{/* bg end */}


      <style>{`
        /* ── フィルターピル ── */
        .jobs-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 7px 14px;
          border-radius: 999px; font-size: 13px; font-weight: 500;
          border: 1.5px solid #e2e8f0; background: #fff; color: var(--ink-soft);
          cursor: pointer; white-space: nowrap; font-family: inherit;
          transition: border-color 0.12s, background 0.12s, color 0.12s;
        }
        .jobs-pill:hover { border-color: var(--royal); color: var(--royal); }
        .jobs-pill.active {
          border-color: var(--royal); background: var(--royal-50);
          color: var(--royal); font-weight: 700;
        }
        .jobs-pill-menu {
          position: absolute; top: calc(100% + 6px); left: 0;
          background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px;
          box-shadow: 0 8px 28px rgba(0,35,102,0.13);
          z-index: 120; min-width: 160px; max-height: 300px; overflow-y: auto;
          padding: 6px;
        }
        .jobs-pill-item {
          display: block; width: 100%; text-align: left;
          padding: 8px 12px; border-radius: 8px; border: none;
          background: none; font-size: 13px; color: var(--ink); cursor: pointer;
          font-family: inherit; white-space: nowrap;
          transition: background 0.1s;
        }
        .jobs-pill-item:hover { background: var(--royal-50); }
        .jobs-pill-item.selected { color: var(--royal); font-weight: 700; background: var(--royal-50); }
        /* フェーズは2段階。親を太く、子を字下げして階層を示す（/companies の絞り込みと揃える）。
           ⚠️ 字下げを外すとバケット（スタートアップ）と個別の段（ユニコーン等）が
              同列に見え、2026-09-06 に指摘された形に戻る。 */
        .jobs-pill-item.is-parent { font-weight: 700; }
        /* 都道府県のグループ見出し（よく選ばれる / その他） */
        .jobs-pill-group {
          padding: 8px 12px 2px; font-size: 11px; font-weight: 700;
          color: var(--ink-mute); letter-spacing: 0.06em;
        }
        .jobs-pill-item.is-child { padding-left: 30px; font-size: 12.5px; color: var(--ink-soft); }
        .jobs-sort-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 600;
          cursor: pointer; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft);
          transition: all 0.15s ease; white-space: nowrap; font-family: inherit; flex-shrink: 0;
        }
        .jobs-sort-btn:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        .jobs-sort-btn.active {
          background: var(--royal); border-color: var(--royal); color: #fff;
          font-weight: 700; box-shadow: 0 3px 12px rgba(0,35,102,0.35); transform: scale(1.03);
        }

        /* ── Job card hover ── */
        .job-card-link:hover {
          box-shadow: 0 12px 36px rgba(0,35,102,0.18), 0 2px 8px rgba(0,35,102,0.08) !important;
          transform: translateY(-5px) !important;
        }
        .job-card-link .job-card-cta-overlay {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 20px 16px 14px;
          background: linear-gradient(to top, rgba(0,35,102,0.85) 0%, rgba(0,35,102,0) 100%);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          text-align: right;
          opacity: 0;
          transition: opacity 0.22s ease;
          border-radius: 0 0 18px 18px;
          pointer-events: none;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 4px;
        }
        .job-card-link:hover .job-card-cta-overlay {
          opacity: 1;
        }
        .job-card-link:active {
          box-shadow: 0 4px 12px rgba(15,23,42,0.10) !important;
          transform: translateY(-2px) !important;
          transition-duration: 0.06s !important;
        }
        /* ── 縦リストカードhover ── */
        .job-list-card:hover {
          box-shadow: 0 3px 14px rgba(0,35,102,0.10) !important;
        }
        .job-list-item-link:hover {
          background: var(--royal-50) !important;
        }
        .job-list-item-link:active {
          background: var(--royal-100) !important;
          transition-duration: 0.06s !important;
        }
        .job-search-input:focus {
          box-shadow: 0 0 0 3px rgba(0,35,102,0.12) !important;
        }

        /* ── Default layout (mobile: single column) ── */
        .jobs-layout {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .jobs-sidebar { display: none; }
        /* filter bar: always visible */
        .jobs-mobile-filterbar { display: block; position: sticky; top: 64px; }
        /* 縦リスト: 1カラム — 個別カード方式 */
        .jobs-list-desktop {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* desktop grid mode (旧カードグリッド: 残置) */
        .jobs-grid-desktop {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 1023px) {
          .jobs-grid-desktop { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .jobs-grid-desktop { display: none; }
          .jobs-view-toggle { display: none !important; }
        }

        /* ── Desktop layout (≥1024px): サイドバー + 縦リスト [+ 詳細ペイン] ── */
        @media (min-width: 1024px) {
          .jobs-layout {
            display: grid;
            grid-template-columns: 220px minmax(0, 1fr);
            gap: 24px;
            align-items: start;
          }
          .jobs-sidebar { display: block !important; }
          /* デスクトップでは検索バーの勤務地selectをサイドバーで代替 */
          .jobs-location-select, .jobs-location-separator { display: none !important; }
        }

        @media (max-width: 767px) {
          .job-list-mobile-hide { display: none !important; }
        }
        @media (max-width: 1023px) {
          .jobs-mobile-role-pills { display: flex !important; }
        }

        /* タイトル1行クランプ */
        .job-title-clamp {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block;
          max-width: 100%;
        }

        /* company name hover */
        .company-name-link:hover {
          text-decoration: underline;
        }

        /* 検索サジェスト hover */
        .suggest-item:hover {
          background: var(--royal-50) !important;
        }

        /* 面談CTA hover */
        .job-meeting-cta:hover {
          background: #FED7AA !important;
        }

        /* ボトムシートアニメーション */
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

      `}</style>

      {/* フィルターピル ドロップダウン (position: fixed でoverflow clipを回避) */}
      {openFilter && pillAnchor && (
        <div className="jobs-pill-menu" style={{ position: "fixed", top: pillAnchor.top, left: pillAnchor.left, zIndex: 1200 }}>
          {openFilter === "category" && (
            <>
              <button className={`jobs-pill-item${!category ? " selected" : ""}`} onClick={() => { setParam("category", ""); setOpenFilter(null); }}>すべて</button>
              {parentRoles.map((r) => (
                <button key={r.id} className={`jobs-pill-item${category === r.id ? " selected" : ""}`}
                  onClick={() => { setParam("category", r.id); setOpenFilter(null); }}
                >{r.name}</button>
              ))}
            </>
          )}
          {openFilter === "phase" && (
            <>
              {/* ⚠️ 複数選択。勤務形態・雇用形態と同じく**選んでも閉じない**（2026-08-08）。
                     それまでフェーズだけ1つ選ぶたびに閉じており、複数選ぶのに開き直しが要った。
                  ⚠️ 「すべて」は外資系（foreign）を消さない。別のトグルピルなので残す。 */}
              <button className={`jobs-pill-item${phaseSet.size === 0 ? " selected" : ""}`}
                onClick={() => {
                  /* ⚠️ toggleStage を forEach で回さないこと。companyStage を
                     クロージャから読むので、2つ以上選んでいると最後の1回しか効かない。 */
                  const set = new Set(companyStage ? companyStage.split(",") : []);
                  phaseKeys.forEach((k) => set.delete(k));
                  setCompanyStage(Array.from(set).join(","));
                }}>すべて</button>
              {phaseOptions.map(({ value: key, label, parent }) => (
                <button key={key}
                  className={`jobs-pill-item ${parent ? "is-child" : "is-parent"}${companyStageSet.has(key) ? " selected" : ""}`}
                  onClick={() => toggleStage(key)}>{label}</button>
              ))}
            </>
          )}
          {openFilter === "industry" && (
            <>
              <button className={`jobs-pill-item${!industry ? " selected" : ""}`} onClick={() => { setParam("industry", ""); setOpenFilter(null); }}>すべて</button>
              {industryOptions.map((g) => (
                <button key={g.slug} className={`jobs-pill-item${industry === g.slug ? " selected" : ""}`}
                  onClick={() => { setParam("industry", industry === g.slug ? "" : g.slug); setOpenFilter(null); }}
                >{g.name}</button>
              ))}
            </>
          )}
          {openFilter === "work_style" && (
            <>
              {/* ⚠️ 複数選択。フェーズピルと同じく**選んでも閉じない** */}
              <button className={`jobs-pill-item${workStyleSet.size === 0 ? " selected" : ""}`}
                onClick={() => { setParam("work_style", ""); }}>すべて</button>
              {WORK_STYLE_FILTERS.map((v) => (
                <button key={v} className={`jobs-pill-item${workStyleSet.has(v) ? " selected" : ""}`}
                  onClick={() => toggleParam("work_style", v, work_style)}
                >{v}</button>
              ))}
            </>
          )}
          {openFilter === "salary" && (
            <>
              <button className={`jobs-pill-item${!salary ? " selected" : ""}`} onClick={() => { setParam("salary", ""); setOpenFilter(null); }}>すべて</button>
              {SALARY_PILL_TIERS.map((t) => (
                <button key={t.value} className={`jobs-pill-item${salary === t.value ? " selected" : ""}`}
                  onClick={() => { setParam("salary", t.value); setOpenFilter(null); }}
                >{t.label}</button>
              ))}
            </>
          )}
          {openFilter === "empType" && (
            <>
              {/* ⚠️ 複数選択。選んでも閉じない */}
              <button className={`jobs-pill-item${empTypeSet.size === 0 ? " selected" : ""}`}
                onClick={() => { setParam("emp_type", ""); }}>すべて</button>
              {JOB_EMPLOYMENT_TYPES.map((v) => (
                <button key={v} className={`jobs-pill-item${empTypeSet.has(v) ? " selected" : ""}`}
                  onClick={() => toggleParam("emp_type", v, empType)}
                >{v}</button>
              ))}
            </>
          )}
          {openFilter === "prefecture" && (
            <>
              <button className={`jobs-pill-item${!prefecture ? " selected" : ""}`} onClick={() => { setParam("prefecture", ""); setOpenFilter(null); }}>すべて</button>
              {PREFECTURE_FILTER_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="jobs-pill-group">{g.group}</div>
                  {g.prefectures.map((p) => (
                    <button key={p} className={`jobs-pill-item${prefecture === p ? " selected" : ""}`}
                      onClick={() => { setParam("prefecture", p); setOpenFilter(null); }}
                    >{p}</button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
