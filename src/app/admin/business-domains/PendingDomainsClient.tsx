"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClassIndustry } from "@/lib/companies/classification";
import { adoptDomain, mergeDomain } from "./actions";

export type PendingDomainRow = { id: string; name: string; industryId: string | null; companies: string[] };

function Row({ r, tops, targets }: { r: PendingDomainRow; tops: ClassIndustry[]; targets: { id: string; name: string }[] }) {
  const router = useRouter();
  const [ind, setInd] = useState(r.industryId ?? "");
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const res = await fn();
    setMsg(res.ok ? "反映しました。" : res.error ?? "失敗しました。");
    if (res.ok) router.refresh();
  });
  return (
    <li className="p-4 border border-gray-200 rounded-lg bg-white" data-state="pending-domain">
      <p className="font-semibold">{r.name}</p>
      <p className="text-xs text-gray-500 mb-3">追加した会社: {r.companies.join("、") || "—"}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">業種（大分類）
          <select className="block border rounded px-2 py-1 text-sm" value={ind} onChange={(e) => setInd(e.target.value)}>
            <option value="">選ぶ</option>
            {tops.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={pending || !ind} onClick={() => run(() => adoptDomain(r.id, ind))}
          className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm disabled:opacity-40">そのまま採用する</button>
        <span className="text-sm text-gray-400">または</span>
        <label className="text-sm">まとめ先
          <select className="block border rounded px-2 py-1 text-sm max-w-xs" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">選ぶ</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={pending || !target} onClick={() => run(() => mergeDomain(r.id, target))}
          className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40">既存の事業にまとめる（別名として残す）</button>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-gray-700">{msg}</p>}
    </li>
  );
}

export function PendingDomainsClient({ rows, tops, targets }: { rows: PendingDomainRow[]; tops: ClassIndustry[]; targets: { id: string; name: string }[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">確認待ちの事業はありません。</p>;
  return <ul className="flex flex-col gap-3">{rows.map((r) => <Row key={r.id} r={r} tops={tops} targets={targets} />)}</ul>;
}
