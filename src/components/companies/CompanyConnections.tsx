"use client";

import { useEffect, useState } from "react";
import { AVATAR_COLOR } from "@/lib/avatarColor";
import { useCompanyViewerState } from "@/lib/companies/useCompanyViewerState";

/**
 * ★企業ページの「この会社に、あなたのつながりがいます（N人）」（2026-10-16 / フェーズ3）。
 *
 * ⚠️★企業ページは ISR。**閲覧者ごとの中身はここでクライアントから取る**
 *    （`GET /api/jobseeker/companies/[id]/connections`。ログイン必須・キャッシュなし）。
 * ⚠️ 未ログインでは API を叩かない（`useCompanyViewerState` の authenticated を見てから）。
 * ⚠️ 0人・未ログイン・取得失敗のときは**何も出さない**（枠も出さない）。
 * ⚠️★「話を聞ける」「面談OK」とは書かない（2026-10-16 に撤去した意味づけ）。出すのは事実だけ。
 */

export type ConnectionView = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarInitial: string;
};

export function CompanyConnections({ companyId }: { companyId: string }) {
  const viewer = useCompanyViewerState(companyId);
  const [list, setList] = useState<ConnectionView[] | null>(null);

  useEffect(() => {
    if (!viewer.ready || !viewer.authenticated) return;
    let alive = true;
    fetch(`/api/jobseeker/companies/${companyId}/connections`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { connections?: ConnectionView[] }) => { if (alive) setList(d.connections ?? []); })
      .catch((e) => { console.error("[CompanyConnections]", (e as Error).message); });
    return () => { alive = false; };
  }, [companyId, viewer.ready, viewer.authenticated]);

  if (!list || list.length === 0) return null;
  return <CompanyConnectionsView connections={list} />;
}

/** 表示だけ（`/dev/preview/connections` からも使う）。0人なら何も出さない */
export function CompanyConnectionsView({ connections }: { connections: ConnectionView[] }) {
  if (connections.length === 0) return null;
  return (
    <section className="company-connections" data-connections-count={connections.length}
      style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg-tint, #F7F9FC)", marginBottom: 24 }}>
      <style>{`
        .company-connections { padding: 16px 18px; }
        .company-connections-list { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 10px 0 0; padding: 0; list-style: none; }
        .company-connections-item { min-width: 0; max-width: 100%; }
        .company-connections-link { display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; color: var(--ink); text-decoration: none; }
        .company-connections-link:hover .company-connections-name { text-decoration: underline; }
        .company-connections-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
      `}</style>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
        この会社に、あなたのつながりがいます（{connections.length}人）
      </h2>
      <ul className="company-connections-list">
        {connections.map((c) => (
          <li key={c.userId} className="company-connections-item">
            <a href={`/u/${c.userId}`} className="company-connections-link" title={c.name}>
              <span aria-hidden="true" style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: AVATAR_COLOR.bg, color: AVATAR_COLOR.text, fontSize: 13, fontWeight: 700,
              }}>
                {c.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.avatarUrl} alt="" width={32} height={32} style={{ width: 32, height: 32, objectFit: "cover" }} />
                  : c.avatarInitial}
              </span>
              <span className="company-connections-name">{c.name}</span>
            </a>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "10px 0 0", lineHeight: 1.6 }}>
        相互フォローしている人のうち、この会社に在籍中で、表示を許可した人だけが出ます。あなたにだけ見えています。
      </p>
    </section>
  );
}
