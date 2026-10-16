'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AI_FILL_FIELDS, AI_FILL_FIELD_KEYS, REMOTE_CHOICES, BENEFITS_MAX,
  buildAiFillPrompt, resolveRemoteChoice, type AiFillFieldKey,
} from '@/lib/admin/aiFill/fields';
import { parseAiFillAnswer, splitList, isNoneAnswer } from '@/lib/admin/aiFill/parse';
import { normalizeBenefits } from '@/lib/companies/benefits';
import type { AiFillData, AiFillDomain } from '@/lib/admin/aiFill/load';

/**
 * ★運営の「AIで埋める」（2026-10-15）。
 *   ① 質問文をコピー → 運営が自分の AI に貼る
 *   ② AI の答えを貼り戻す → **ブラウザの中だけ**で読み取る（LLM は使わない）
 *   ③ 確認表（今の値／AIの答え／出典）でチェックした項目だけ反映する
 *
 * ⚠️★貼り付けた文章はサーバーに送らない・保存しない。送るのはチェックした値と出典 URL だけ。
 * ⚠️ チェックの既定: 今の値が空→オン／今の値あり→オフ／不明→押せない／出典なし→「出典なし」を出してオフ
 */

type Row = {
  key: AiFillFieldKey;
  label: string;
  state: 'missing' | 'unknown' | 'ok' | 'needs_choice';
  url: string | null;
  /** 反映する値（API に送る形） */
  value: unknown;
  /** 確認表に出す AI の答え */
  display: string;
  /** 事業領域で名前が引けなかった語（要選択） */
  unresolved?: string[];
  note?: string;
};

function remoteLabel(v: string | null) {
  return v ? REMOTE_CHOICES.find((c) => c.value === v)?.label ?? v : null;
}

function currentText(key: AiFillFieldKey, d: AiFillData): string | null {
  const c = d.current;
  if (key === 'remote_work_status') return remoteLabel(c.remote_work_status);
  if (key === 'benefits') {
    const b = normalizeBenefits(c.benefits);
    return b ? b.map((x) => (x.detail ? `${x.name}（${x.detail}）` : x.name)).join('、') : null;
  }
  return c.secondaryDomains.length ? c.secondaryDomains.map((x) => x.name).join('、') : null;
}

export function CompanyAiFillTab({ companyId, data }: { companyId: string; data: AiFillData | null }) {
  const [pasted, setPasted] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const applied = useSearchParams().get('applied');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(applied ? { text: `${applied} 項目を反映しました。企業ページにも反映されています。` } : null);

  const prompt = useMemo(() => data ? buildAiFillPrompt({
    companyName: data.companyName, url: data.url,
    primaryDomainName: data.current.primaryDomain?.name ?? null,
    domainChoices: data.domainChoices.map((d) => d.name),
  }) : '', [data]);

  if (!data) {
    return <p className="text-sm text-red-600">読み込みに失敗しました。再読み込みしてください。</p>;
  }
  const d = data;

  const byName = new Map(d.allDomains.map((x) => [x.name, x]));

  function readAnswer() {
    const { found, missing } = parseAiFillAnswer(pasted, AI_FILL_FIELD_KEYS);
    const out: Row[] = [];
    for (const f of AI_FILL_FIELDS) {
      const p = found[f.key];
      if (!p) { out.push({ key: f.key, label: f.label, state: 'missing', url: null, value: null, display: '' }); continue; }
      if (p.unknown) { out.push({ key: f.key, label: f.label, state: 'unknown', url: p.url, value: null, display: '不明' }); continue; }
      if (f.key === 'remote_work_status') {
        const v = resolveRemoteChoice(p.raw);
        out.push(v
          ? { key: f.key, label: f.label, state: 'ok', url: p.url, value: v, display: remoteLabel(v) ?? v }
          : { key: f.key, label: f.label, state: 'needs_choice', url: p.url, value: null, display: p.raw, note: '選択肢に無い答え' });
      } else if (f.key === 'benefits') {
        const list = splitList(p.raw);
        const cut = list.slice(0, BENEFITS_MAX);
        out.push({ key: f.key, label: f.label, state: cut.length ? 'ok' : 'unknown', url: p.url, value: cut,
          display: cut.map((x) => (x.detail ? `${x.name}（${x.detail}）` : x.name)).join('、'),
          note: list.length > BENEFITS_MAX ? `${list.length}件のうち先頭${BENEFITS_MAX}件だけ` : `${cut.length}件` });
      } else {
        if (isNoneAnswer(p.raw)) {
          out.push({ key: f.key, label: f.label, state: 'needs_choice', url: p.url, value: null, display: '該当なし', unresolved: [], note: '下の一覧から選べます' });
          continue;
        }
        const names = splitList(p.raw).map((x) => x.name);
        const hits: AiFillDomain[] = []; const miss: string[] = [];
        for (const n of names) { const h = byName.get(n); if (h) hits.push(h); else miss.push(n); }
        const primary = d.current.primaryDomain?.id;
        const ids = Array.from(new Set(hits.map((h) => h.id))).filter((id) => id !== primary).slice(0, 2);
        /* ⚠️ 主と同じものは従に入れない。黙って外さず、外したことを出す */
        const dropped = hits.filter((h) => h.id === primary).map((h) => h.name);
        const notes = [
          miss.length ? `一覧に無い名前：${miss.join('、')}` : '',
          dropped.length ? `「${dropped.join('、')}」は主の事業領域なので外しました` : '',
        ].filter(Boolean);
        out.push({ key: f.key, label: f.label, state: miss.length || ids.length === 0 ? 'needs_choice' : 'ok', url: p.url, value: ids,
          display: names.join('、'), unresolved: miss, note: notes.length ? notes.join(' ／ ') : undefined });
      }
    }
    const init: Record<string, boolean> = {};
    for (const r of out) {
      const empty = currentText(r.key, d) === null;
      init[r.key] = r.state === 'ok' && empty && !!r.url;
    }
    setRows(out); setChecked(init); setPicks({}); setMsg(null);
    void missing;
  }

  /** 要選択のとき運営が選んだ値で value を決める */
  function finalValue(r: Row): unknown {
    if (r.key === 'remote_work_status' && r.state === 'needs_choice') return picks[r.key] || null;
    if (r.key === 'business_domains_secondary') {
      const base = Array.isArray(r.value) ? (r.value as string[]) : [];
      const extra = [picks[`${r.key}_1`], picks[`${r.key}_2`]].filter(Boolean) as string[];
      const ids = Array.from(new Set([...base, ...extra])).filter((id) => id !== d.current.primaryDomain?.id).slice(0, 2);
      return ids.length ? ids : null;
    }
    return r.value;
  }
  function canCheck(r: Row) {
    if (r.state === 'missing' || r.state === 'unknown') return false;
    const v = finalValue(r);
    return v !== null && !(Array.isArray(v) && v.length === 0);
  }

  async function apply() {
    if (!rows) return;
    const items = rows.filter((r) => checked[r.key] && canCheck(r)).map((r) => ({ field: r.key, value: finalValue(r), source_url: r.url }));
    if (items.length === 0) { setMsg({ text: '反映する項目にチェックを入れてください。', error: true }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/ai-fill`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ text: j.error ?? '反映に失敗しました。', error: true }); return; }
      setPasted('');
      /* ⚠️ 他のタブ（分類）の state も古くなるので、ページごと読み直す */
      window.location.assign(`/admin/companies/${companyId}?tab=ai_fill&applied=${items.length}`);
    } finally { setBusy(false); }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
  const sel = 'border border-gray-300 rounded px-2 py-1 text-sm max-w-full';

  return (
    <div className="space-y-6">
      <section className="bg-white border rounded-lg p-5">
        <h3 className="font-semibold mb-1">① 質問文をコピーして、自分の AI に貼る</h3>
        <p className="text-xs text-gray-500 mb-3">対象は空いていることが多い3項目だけです（勤務形態・福利厚生・事業領域の従）。</p>
        <textarea readOnly value={prompt} className="w-full h-48 border rounded p-2 text-xs font-mono bg-gray-50" />
        <button type="button" className="mt-2 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          onClick={async () => { try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setMsg({ text: 'コピーできませんでした。手で選択してコピーしてください。', error: true }); } }}>
          {copied ? 'コピーしました' : '質問文をコピー'}
        </button>
      </section>

      {/* ★各項目の最終更新と出典。確認表を開かなくても見えるように常に出す */}
      <section className="bg-white border rounded-lg p-5" data-state="ai-fill-last-changes">
        <h3 className="font-semibold mb-2">いまの値と最終更新</h3>
        <table className="w-full text-sm">
          <tbody>
            {AI_FILL_FIELDS.map((f) => {
              const last = d.lastChanges[f.key];
              const cur = currentText(f.key, d);
              return (
                <tr key={f.key} className="border-t align-top">
                  <td className="py-2 w-36 font-medium">{f.label}</td>
                  <td className="py-2 break-words">{cur ?? <span className="text-gray-400">空</span>}</td>
                  <td className="py-2 w-64 text-xs text-gray-500 break-all">
                    {last ? (
                      <>
                        {d.operatorCreated.includes(f.key) && (
                          <div><span className="inline-block mb-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">運営がAIで作成・企業未確認</span></div>
                        )}
                        {fmt(last.changedAt)}{last.changedByName ? `・${last.changedByName}` : ''}
                        {last.sourceUrl
                          ? <div><a href={last.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{last.sourceUrl}</a></div>
                          : <div>出典なし</div>}
                      </>
                    ) : <span className="text-gray-400">このタブからの更新なし</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="bg-white border rounded-lg p-5">
        <h3 className="font-semibold mb-1">② AI の答えを貼り付ける</h3>
        <p className="text-xs text-gray-500 mb-3">貼り付けた文章は保存されません。読み取りはこの画面の中だけで行います。</p>
        <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} className="w-full h-40 border rounded p-2 text-sm" placeholder="[remote_work_status] … | https://…" />
        <button type="button" disabled={!pasted.trim()} onClick={readAnswer}
          className="mt-2 px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-40">読み取る</button>
      </section>

      {rows && (
        <section className="bg-white border rounded-lg p-5" data-state="ai-fill-confirm">
          <h3 className="font-semibold mb-1">③ 確認して反映する</h3>
          <p className="text-xs text-gray-500 mb-3">
            {AI_FILL_FIELDS.length}項目のうち {rows.filter((r) => r.state !== 'missing').length} 項目を読み取りました。
            今の値がある項目は、チェックを入れたときだけ上書きします。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 w-10">反映</th><th className="py-2 w-32">項目</th><th className="py-2">今の値</th><th className="py-2">AI の答え</th><th className="py-2 w-40">出典</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cur = currentText(r.key, d);
                  const last = d.lastChanges[r.key];
                  const ok = canCheck(r);
                  return (
                    <tr key={r.key} className="border-b align-top" data-field={r.key} data-row-state={r.state}>
                      <td className="py-2">
                        <input type="checkbox" aria-label={`${r.label}を反映する`} disabled={!ok}
                          checked={!!checked[r.key] && ok} onChange={(e) => setChecked((c) => ({ ...c, [r.key]: e.target.checked }))} />
                      </td>
                      <td className="py-2 font-medium">{r.label}</td>
                      <td className="py-2 text-gray-700 break-words">
                        {cur ?? <span className="text-gray-400">空</span>}
                        {last && <div className="text-[11px] text-gray-400 mt-1">最終更新 {fmt(last.changedAt)}{last.changedByName ? `・${last.changedByName}` : ''}</div>}
                      </td>
                      <td className="py-2 break-words">
                        {r.state === 'missing' && <span className="text-gray-400">読み取れませんでした</span>}
                        {r.state === 'unknown' && <span className="text-gray-400">不明（値なし）</span>}
                        {(r.state === 'ok' || r.state === 'needs_choice') && <span>{r.display}</span>}
                        {r.state === 'needs_choice' && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">要選択</span>}
                        {r.note && <div className="text-[11px] text-gray-500 mt-1">{r.note}</div>}
                        {r.state === 'needs_choice' && r.key === 'remote_work_status' && (
                          <div className="mt-1"><select className={sel} value={picks[r.key] ?? ''} onChange={(e) => setPicks((p) => ({ ...p, [r.key]: e.target.value }))}>
                            <option value="">選んでください</option>
                            {REMOTE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select></div>
                        )}
                        {r.key === 'business_domains_secondary' && (r.state === 'needs_choice' || r.state === 'ok') && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {[1, 2].map((n) => (
                              <select key={n} className={sel} value={picks[`${r.key}_${n}`] ?? ''} onChange={(e) => setPicks((p) => ({ ...p, [`${r.key}_${n}`]: e.target.value }))}>
                                <option value="">{n === 1 ? '一覧から選ぶ' : '（2つ目）'}</option>
                                {d.allDomains.filter((x) => x.id !== d.current.primaryDomain?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                              </select>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-xs break-all">
                        {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{r.url}</a>
                          : r.state === 'missing' || r.state === 'unknown' ? null : <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">出典なし</span>}
                        {last?.sourceUrl && <div className="text-[11px] text-gray-400 mt-1">前回の出典：{last.sourceUrl}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" disabled={busy} onClick={apply} className="px-4 py-2 text-sm rounded bg-blue-600 text-white disabled:opacity-40">
              {busy ? '反映中…' : 'チェックした項目を反映する'}
            </button>
            {msg && <span className={`text-sm ${msg.error ? 'text-red-600' : 'text-gray-700'}`}>{msg.text}</span>}
          </div>
        </section>
      )}

      {!rows && msg && <p className={`text-sm ${msg.error ? 'text-red-600' : 'text-gray-700'}`}>{msg.text}</p>}
    </div>
  );
}
