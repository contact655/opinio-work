import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";

/**
 * ★/jobs の一番上の「あなたの希望に合う募集」（2026-10-20 / 柴さんの要望。LinkedIn の「設定に基づく求人」を参考にした）。
 *
 * ⚠️ 2026-09-09 に「あなたへのおすすめ」を一番下へ移した経緯がある（上に置くと検索結果が押されるため）。
 *    今回は柴さんの判断で上に戻したので、**最大3件の行にして縦に伸ばさない**。件数を増やさないこと。
 *
 * 状態は3つ（ログイン中だけ。未ログインには出さない）:
 *   no_settings … 希望が1つも無い → 希望の入力へ案内
 *   empty       … 希望はあるが合う募集が0件 → 「まだありません」＋希望の編集
 *   list        … 合う募集がある
 * ⚠️ 0件を他の募集で埋めない（CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 * ⚠️ 「出たらお知らせします」と書かない。知らせる仕組みは無い。
 * ⚠️ 部品は表示だけ。データは JobsClient が /api/jobseeker/recommendations から渡す（見本は /dev/preview/jobs-for-you）。
 */
export type JobsForYouItem = {
  id: string;
  href: string;
  title: string;
  companyName: string;
  logoUrl: string | null;
  logoLetter?: string | null;
  logoGradient?: string | null;
  location: string | null;
  /** 合う理由（scoreJob の理由文）。無ければ出さない */
  reason: string | null;
  /** その会社で働いている、あなたのつながり（相互フォロー・本人の同意あり）の人数。0 なら出さない */
  connections: number;
};

export type JobsForYouState =
  | { kind: "no_settings" }
  | { kind: "empty"; summary: string }
  /** ⚠️ 最大3件。「すべて表示」は付けない（合う募集だけを並べたページがまだ無い。行き先の無いリンクを作らない） */
  | { kind: "list"; summary: string; items: JobsForYouItem[] };

const EDIT_HREF = "/mypage#intent";

export function JobsForYouPanel({ state }: { state: JobsForYouState }) {
  return (
    <section data-state={`jobs-for-you-${state.kind}`} aria-labelledby="jobs-for-you-title" className="jfy-panel">
      <style>{`
        .jfy-panel { background: #fff; border: 1px solid var(--line); border-radius: 14px; margin: 0 0 18px; overflow: hidden; }
        .jfy-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px 12px; }
        .jfy-title { font-size: 16px; font-weight: 800; color: var(--ink); margin: 0; }
        .jfy-sub { font-size: 12.5px; color: var(--ink-soft); margin: 3px 0 0; line-height: 1.6; overflow-wrap: anywhere; }
        .jfy-edit { flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: inline-flex; align-items: center; justify-content: center; color: var(--ink); background: #fff; }
        .jfy-edit:hover { border-color: var(--royal); color: var(--royal); }
        .jfy-list { list-style: none; margin: 0; padding: 0; }
        .jfy-row { display: flex; gap: 12px; padding: 12px 18px; border-top: 1px solid var(--line); text-decoration: none; color: inherit; }
        .jfy-row:hover { background: var(--bg-tint); }
        .jfy-row:hover .jfy-job { color: var(--royal); }
        .jfy-body { min-width: 0; flex: 1; }
        .jfy-job { font-size: 14.5px; font-weight: 700; color: var(--ink); line-height: 1.45; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .jfy-co { font-size: 13px; color: var(--ink); margin-top: 2px; }
        .jfy-loc { font-size: 12.5px; color: var(--ink-soft); margin-top: 1px; }
        .jfy-reason { font-size: 12px; color: var(--success-ink); margin-top: 4px; font-weight: 600; }
        .jfy-conn { font-size: 12px; color: var(--ink-soft); margin-top: 3px; }
        .jfy-empty { padding: 0 18px 16px; font-size: 13px; color: var(--ink-soft); line-height: 1.7; }
        .jfy-empty a { color: var(--royal); font-weight: 600; }
        @media (max-width: 640px) {
          .jfy-panel { border-radius: 12px; }
          .jfy-head { padding: 14px 14px 10px; }
          .jfy-row { padding: 12px 14px; }
          .jfy-empty { padding: 0 14px 14px; }
        }
      `}</style>

      <div className="jfy-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id="jobs-for-you-title" className="jfy-title">あなたの希望に合う募集</h2>
          {state.kind !== "no_settings" && <p className="jfy-sub">{state.summary}</p>}
        </div>
        {state.kind !== "no_settings" && (
          <Link href={EDIT_HREF} className="jfy-edit btn-fixed-size" aria-label="希望を編集する" title="希望を編集する">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </Link>
        )}
      </div>

      {state.kind === "no_settings" && (
        <p className="jfy-empty">
          希望する職種や働き方を入れると、合う募集をここに出します。<Link href={EDIT_HREF}>希望を入れる →</Link>
        </p>
      )}

      {state.kind === "empty" && (
        <p className="jfy-empty">
          いまの希望に合う募集はまだありません。<Link href={EDIT_HREF}>希望を見直す →</Link>
        </p>
      )}

      {state.kind === "list" && (
        <>
          <ul className="jfy-list">
            {state.items.slice(0, 3).map((it) => (
              <li key={it.id}>
                <Link href={it.href} className="jfy-row">
                  <CompanyLogo name={it.companyName} logoUrl={it.logoUrl} logoLetter={it.logoLetter ?? undefined} logoGradient={it.logoGradient ?? undefined} size={44} borderRadius={10} />
                  <div className="jfy-body">
                    <div className="jfy-job" title={it.title}>{it.title}</div>
                    <div className="jfy-co">{it.companyName}</div>
                    {it.location && <div className="jfy-loc">{it.location}</div>}
                    {it.reason && <div className="jfy-reason">✓ {it.reason}</div>}
                    {it.connections > 0 && <div className="jfy-conn">つながりが{it.connections}人働いています</div>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
