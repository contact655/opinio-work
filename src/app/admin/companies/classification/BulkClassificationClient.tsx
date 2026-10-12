"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COMPANY_STAGES, HQ_COUNTRIES_MAIN, HQ_COUNTRIES_OTHER, childIndustries, topIndustries, type ClassIndustry } from "@/lib/companies/classification";
import { bulkSetHqCountry, bulkSetIndustry, bulkSetStage, type BulkResult } from "./actions";

export type BulkRow = {
  id: string; name: string; listed: boolean;
  industry: string | null; industryCandidate: string | null; topOnly: boolean;
  stage: string | null; stageCandidate: string | null;
  foreign: boolean; hq: string | null;
};

const LABELS: Record<string, string> = { "top-only": "大分類だけ", "no-stage": "事業ステージが空", "no-hq": "外資系で本社の国が空", all: "すべて" };

export function BulkClassificationClient({ rows, filter, counts, industries }: {
  rows: BulkRow[]; filter: string; counts: Record<string, number>; industries: ClassIndustry[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [industryId, setIndustryId] = useState("");
  const [stage, setStage] = useState("");
  const [hq, setHq] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const run = (fn: () => Promise<BulkResult>) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? `${r.count}社に付けました。` : r.error);
    if (r.ok) { setSel(new Set()); router.refresh(); }
  });
  const ids = Array.from(sel);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(LABELS).map((k) => (
          <Link key={k} href={`/admin/companies/classification?f=${k}`} aria-current={filter === k ? "page" : undefined}
            className={`px-3 py-1.5 rounded-full border text-sm ${filter === k ? "border-blue-700 text-blue-700 font-semibold" : "border-gray-300 text-gray-700"}`}>
            {LABELS[k]}（{counts[k]}）
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4 p-3 border border-gray-200 rounded-lg bg-white">
        <span className="text-sm text-gray-600">選択 {ids.length}社に</span>
        <label className="text-sm">業種（小分類）
          <select className="block border rounded px-2 py-1 text-sm" value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
            <option value="">選ぶ</option>
            {topIndustries(industries).map((t) => (
              <optgroup key={t.id} label={t.name}>
                {childIndustries(industries, t.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <button type="button" disabled={pending || !industryId || ids.length === 0} onClick={() => run(() => bulkSetIndustry(ids, industryId))}
          className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm disabled:opacity-40">付ける</button>
        <label className="text-sm">事業ステージ
          <select className="block border rounded px-2 py-1 text-sm" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">選ぶ</option>
            {COMPANY_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" disabled={pending || !stage || ids.length === 0} onClick={() => run(() => bulkSetStage(ids, stage))}
          className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm disabled:opacity-40">付ける</button>
        <label className="text-sm">本社の国（外資系だけ）
          <select className="block border rounded px-2 py-1 text-sm" value={hq} onChange={(e) => setHq(e.target.value)}>
            <option value="">選ぶ</option>
            {[...HQ_COUNTRIES_MAIN, ...HQ_COUNTRIES_OTHER].map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </label>
        <button type="button" disabled={pending || !hq || ids.length === 0} onClick={() => run(() => bulkSetHqCountry(ids, hq))}
          className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm disabled:opacity-40">付ける</button>
        {msg && <span role="status" className="text-sm text-gray-700">{msg}</span>}
      </div>

      <table className="w-full text-sm bg-white border border-gray-200 rounded-lg">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="p-2"><input type="checkbox" aria-label="すべて選ぶ" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
            <th className="p-2">会社</th><th className="p-2">業種</th><th className="p-2">事業ステージ</th><th className="p-2">本社の国</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 align-top">
              <td className="p-2"><input type="checkbox" aria-label={`${r.name}を選ぶ`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td className="p-2">
                <Link href={`/admin/companies/${r.id}?tab=classification`} className="text-blue-700">{r.name}</Link>
                {r.listed && <span className="ml-2 text-xs text-gray-500">掲載中</span>}
              </td>
              <td className="p-2">{r.industry ?? "—"}{r.industryCandidate && <span className="block text-xs text-gray-500">候補: {r.industryCandidate}</span>}</td>
              <td className="p-2">{r.stage ?? "—"}{r.stageCandidate && <span className="block text-xs text-gray-500">候補: {r.stageCandidate}</span>}</td>
              <td className="p-2">{r.foreign ? (r.hq ?? "—") : <span className="text-gray-400">日系・未設定</span>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-gray-500">該当する会社はありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
