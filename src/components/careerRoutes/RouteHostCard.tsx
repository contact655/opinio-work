"use client";

import Link from "next/link";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { routeTalkTagLabel, type RouteTalkTag } from "@/lib/constants/careerRoutes";
import { RouteConsultButton } from "@/components/careerRoutes/RouteConsultButton";

export type RouteHostCardData = {
  userId: string;
  profileKey: string;
  name: string;
  avatarUrl: string | null;
  currentCompany: string | null;
  currentRole: string | null;
  isCurrent: boolean;
  movedYear: number | null;
  talkTags: RouteTalkTag[];
  message: string | null;
};

/**
 * ★転職ルートの経験者のカード（2026-11-11）。/routes/[slug] と見本（/dev/preview/routes）が使う。
 * ⚠️ 個別の「確認済み」バッジはつけない（ページの下に1度だけ書く）。相談した人による評価も出さない。
 * ⚠️ 名前・写真はプロフィールへのリンク。相談のボタンはリンクの外に置く（押し分けられるように）。
 */
export function RouteHostCard({ host, fromLabel, toLabel, sample = false }: {
  host: RouteHostCardData;
  fromLabel: string;
  toLabel: string;
  /** 見本では相談のボタンを押せない形にする（DB を読まない） */
  sample?: boolean;
}) {
  const href = `/u/${encodeURIComponent(host.profileKey)}`;
  const nowLine = [host.currentCompany, host.currentRole].filter(Boolean).join(" ");
  const moveTo = host.currentRole ?? toLabel;
  return (
    <article data-state="route-host" className="route-host">
      <Link href={href} className="route-host-head" style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "inherit", minWidth: 0, minHeight: 44 }}>
        <PersonAvatar name={host.name} url={host.avatarUrl} size={56} colorByName />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, overflowWrap: "anywhere" }}>{host.name}</div>
          {nowLine && (
            <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5, overflowWrap: "anywhere" }}>
              {host.isCurrent ? "" : "以前: "}{nowLine}
            </div>
          )}
        </div>
      </Link>

      <p data-state="route-host-move" style={{ margin: 0, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.6, overflowWrap: "anywhere" }}>
        {fromLabel} → {moveTo}
        {host.movedYear != null && <span style={{ color: "var(--ink-mute)" }}>（{host.movedYear}年に転職）</span>}
      </p>

      {host.talkTags.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginBottom: 6 }}>話せること</div>
          <ul style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
            {host.talkTags.map((t) => (
              <li key={t} style={{ padding: "4px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                {routeTalkTagLabel(t)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {host.message && (
        <p style={{ margin: 0, paddingLeft: 12, borderLeft: "3px solid var(--line)", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {host.message}
        </p>
      )}

      <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
        {sample ? (
          <div data-action="dm-block" style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700 }}>
            相談を申し込む
          </div>
        ) : (
          <RouteConsultButton targetUserId={host.userId} targetName={host.name} fromLabel={fromLabel} toLabel={toLabel} />
        )}
        <Link href={href} style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1px solid var(--line)", color: "var(--ink)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          プロフィールを見る
        </Link>
      </div>
    </article>
  );
}

/** カードの並び（1列〜2列）。⚠️ <style> の中に不等号・アンパサンドを書かない（描き直しの不一致になる） */
export function RouteHostGrid({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .route-host-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .route-host { display: flex; flex-direction: column; gap: 12px; padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: #fff; min-width: 0; }
        @media (min-width: 768px) { .route-host-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>
      <div className="route-host-grid">{children}</div>
    </>
  );
}
