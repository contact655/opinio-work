"use client";

import { useEffect, useState } from "react";
import { HIRING_SETTING_HREF } from "@/lib/nextManager/constants";

type Row = { kind: "admin" | "self"; removed: boolean; companyName: string; isHiring: boolean };

/**
 * ★マイページから「採用中のマネージャー」の設定への入口（2026-11-19 / 柴さんの指示）。
 *   切り替え本体は /mypage/settings の HiringManagerSection だけ。ここは状態を出して送るだけ。
 *   ⚠️ 採用中にできる会社が無い人（担当者でも在籍中の会社も無い）・読み込みに失敗したときは何も描かない。
 *   ⚠️ 置き場所は画面幅ごとに1つ（パソコンは右の列・スマホは職歴の欄の下。variant で見た目だけ変える）。
 */
export function HiringEntryCard({ variant, className }: { variant: "rail" | "inline"; className?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/jobseeker/hiring", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { rows: Row[] }) => { if (alive) setRows(d.rows ?? []); })
      .catch((e) => { console.error("[HiringEntryCard]", e instanceof Error ? e.message : e); });
    return () => { alive = false; };
  }, []);

  if (!rows) return null;
  const hiring = rows.filter((r) => r.isHiring);
  const available = rows.filter((r) => !r.removed);
  if (hiring.length === 0 && available.length === 0) return null;

  const title = hiring.length > 0 ? "採用中のマネージャー" : "チームの仲間を探していますか？";
  const body = hiring.length > 0
    ? `${hiring.map((r) => r.companyName).join("・")}で採用中です。内容を変える・やめる →`
    : `${available[0].companyName}${available.length > 1 ? "など" : ""}で「採用中」にすると、ユーザー一覧で探している人に見つかります →`;

  const inline = variant === "inline";
  return (
    <a href={HIRING_SETTING_HREF} data-state={hiring.length > 0 ? "hiring-entry-on" : "hiring-entry-off"} className={className}
      style={{
        /* ⚠️ display をインラインに書かない。書くとスマホだけ出す .mypage-mobile-only（display: none）に勝つ。
              パソコン（rail）は右の列が縦並びの grid なので block 扱いになる */
        textDecoration: "none", color: "var(--ink)", background: "#fff",
        border: "1px solid var(--line)", borderRadius: 10,
        padding: inline ? "12px 14px" : "14px 16px", marginTop: inline ? 10 : undefined,
      }}>
      <span style={{ display: "block", fontSize: inline ? 14 : 15, fontWeight: 700 }}>{title}</span>
      <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2, lineHeight: 1.7, overflowWrap: "anywhere" }}>{body}</span>
    </a>
  );
}
