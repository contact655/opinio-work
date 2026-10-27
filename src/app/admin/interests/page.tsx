import Link from "next/link";
import { loadInterestWaiting } from "@/lib/admin/interestWaiting";
import { viewerIsAdmin } from "@/lib/auth/adminPageGuard";
import { INTEREST_PENDING_VALID_DAYS, INTEREST_TREND_MIN } from "@/lib/interest/constants";

/* ⚠️ 運営の作業一覧。キャッシュに載せない */
export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "話を聞きたい人（担当者の登録待ち） | OPINIO 運営" } };

/**
 * ★「話を聞いてみたい」を押したのに、担当者がまだいない企業（2026-10-27 / 話を聞きたい人 フェーズ1a）。
 *   数え方は lib/admin/interestWaiting.ts の1か所。
 * ⚠️★この画面に名前・ひとことを出さない。企業に伝えてよいのは「人数の幅」と「業界・職種の大分類（3人以上の項目）」だけ。
 * ⚠️ 担当者が登録されると、押してから90日以内の人には自動で届く（本人にも知らせる）。運営が取り次ぐ必要はない。
 */
export default async function AdminInterestsPage() {
  /* ★運営権限をページ本体でも確かめる。DB を引く前に返す（lib/auth/adminPageGuard.ts）。消さないこと */
  if (!(await viewerIsAdmin())) return null;
  const rows = await loadInterestWaiting();
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>
        話を聞きたい人（担当者の登録待ち）
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        「話を聞いてみたい」が押されたのに、答えられる担当者がまだいない企業です。
        担当者が登録されると、押してから{INTEREST_PENDING_VALID_DAYS}日以内の人の名前とプロフィールが自動で届きます。
        <br />
        ⚠️ 企業に伝えてよいのは<strong>人数の幅</strong>と<strong>業界・職種の大分類の傾向（{INTEREST_TREND_MIN}人以上の項目）</strong>だけです。名前やひとことは伝えないでください。
      </p>

      {rows === null ? (
        <p data-state="interests-failed" style={{ fontSize: 13, color: "var(--error-ink)" }}>
          取得できませんでした（0社という意味ではありません）。
        </p>
      ) : rows.length === 0 ? (
        <p data-state="interests-empty" style={{ fontSize: 13, color: "var(--ink-mute)" }}>いまはありません。</p>
      ) : (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          {rows.map((r) => (
            <div key={r.companyId} data-state="interests-row" style={{
              display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
              padding: "12px 16px", borderBottom: "1px solid var(--line-soft)",
            }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <Link href={`/companies/${r.slug ?? r.companyId}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
                  {r.name}
                </Link>
                {r.isTest && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--ink-mute)" }}>（検証用の企業）</span>}
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                  最初に押された日: {fmtDate(r.firstAt)}
                  {r.staleCount > 0 && <span style={{ marginLeft: 8 }}>（{INTEREST_PENDING_VALID_DAYS}日を過ぎた {r.staleCount}人は届けません）</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", minWidth: 120 }}>
                押した人数 <strong data-state="interests-count" style={{ color: "var(--ink)" }}>{r.count}</strong>人
              </div>
              <div style={{ flex: "1 1 260px", minWidth: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>企業に伝えてよいこと</div>
                <div>人数: {r.band ?? "—"}</div>
                <div>業界: {r.industries.length ? r.industries.join("・") : `—（${INTEREST_TREND_MIN}人以上の項目なし）`}</div>
                <div>職種: {r.roles.length ? r.roles.join("・") : `—（${INTEREST_TREND_MIN}人以上の項目なし）`}</div>
              </div>
              <div style={{ fontSize: 12 }}>
                <Link href={`/admin/companies/${r.companyId}`} style={{ color: "var(--ink-soft)", textDecoration: "none" }}>
                  企業の管理 →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
