"use client";

import { useMemo, useState } from "react";
import {
  COMPANY_STAGES, HQ_COUNTRIES_MAIN, HQ_COUNTRIES_OTHER, capitalOriginOf, capitalTypeFor, childIndustries,
  findDomainByExactName, normalizeCustomers, searchDomains, topIndustries, topOf,
  type ClassDomain, type ClassMasters, type ClassificationValue,
} from "@/lib/companies/classification";
import { MAX_BUSINESS_DOMAINS_PER_COMPANY } from "@/lib/companies/businessDomains";

/**
 * ★会社の分類「4つの質問」の入力（2026-10-12 / 柴さんと作ったモックの形）。
 *   企業側（/biz/company の基本情報。下書きに入る）と運営（/admin/companies/[id]）が**同じ部品**を使う。
 * ⚠️ 値は親が持つ（制御コンポーネント）。保存の仕方は呼び出し側が決める。
 * ⚠️ 色で意味を付けない。補足はグレーの文字（バッジにしない）。
 * ⚠️ id（ce-industry / ce-industry-sub / ce-business-domain / ce-capital / ce-stage）は「公開まであと〇つ」から飛ぶ先。変えないこと。
 */
type Props = {
  masters: ClassMasters;
  value: ClassificationValue;
  onChange: (next: ClassificationValue) => void;
  /** 見つからない事業をその場で追加する。渡さなければ「追加する」を出さない */
  onAddDomain?: (name: string, industryId: string) => Promise<ClassDomain | null>;
  disabled?: boolean;
};

const MAX = MAX_BUSINESS_DOMAINS_PER_COMPANY;

export function ClassificationEditor({ masters, value, onChange, onAddDomain, disabled = false }: Props) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  /* 追加した事業（マスタの読み込み後に足されたもの）をこの画面の中で覚える */
  const [extraDomains, setExtraDomains] = useState<ClassDomain[]>([]);
  const domains = useMemo(() => {
    const ids = new Set(masters.domains.map((d) => d.id));
    return [...masters.domains, ...extraDomains.filter((d) => !ids.has(d.id))];
  }, [masters.domains, extraDomains]);

  const tops = topIndustries(masters.industries);
  const top = topOf(masters.industries, value.industryId);
  const subs = top ? childIndustries(masters.industries, top.id) : [];
  const selectedSub = masters.industries.find((i) => i.id === value.industryId && i.parent_id) ?? null;
  const industryName = (id: string | null) => masters.industries.find((i) => i.id === id)?.name ?? "";

  const set = (patch: Partial<ClassificationValue>) => onChange({ ...value, ...patch });

  // ── ② 事業 ─────────────────────────────────────────────────────────
  const selected = value.domainIds.map((id) => domains.find((d) => d.id === id)).filter((d): d is ClassDomain => !!d);
  const ordered = [...selected].sort((a, b) => (a.id === value.primaryDomainId ? -1 : b.id === value.primaryDomainId ? 1 : 0));
  const atLimit = value.domainIds.length >= MAX;
  function addDomain(id: string) {
    if (value.domainIds.includes(id) || atLimit) return;
    const ids = [...value.domainIds, id];
    /* 最初の1件は自動で主にする（主を選ばせるためだけに一往復増やさない） */
    set({ domainIds: ids, primaryDomainId: value.primaryDomainId ?? id });
    setQuery("");
  }
  function removeDomain(id: string) {
    const ids = value.domainIds.filter((x) => x !== id);
    set({ domainIds: ids, primaryDomainId: value.primaryDomainId === id ? (ids[0] ?? null) : value.primaryDomainId });
  }
  const results = query.trim() ? searchDomains(domains, query) : [];
  const exact = query.trim() ? findDomainByExactName(domains, query.trim()) : null;
  const mains = top ? domains.filter((d) => d.display_kind === "main" && d.industry_id === top.id && d.status === "active")
    .sort((a, b) => a.display_order - b.display_order) : [];

  async function handleAdd() {
    if (!onAddDomain || adding || atLimit) return;
    setAdding(true);
    setAddError(null);
    try {
      const d = await onAddDomain(query.trim(), value.industryId);
      if (!d) { setAddError("追加できませんでした。時間をおいてもう一度お試しください。"); return; }
      setExtraDomains((prev) => [...prev.filter((x) => x.id !== d.id), d]);
      addDomain(d.id);
    } finally {
      setAdding(false);
    }
  }

  // ── ④ お客さま ─────────────────────────────────────────────────────
  function toggleCustomer(id: string) {
    const has = value.customerIndustryIds.includes(id);
    /* ★業界を問わないを選んでいても外さない（2026-10-18）。そのときは「とくに多い業界」の意味になる */
    set({ customerIndustryIds: has ? value.customerIndustryIds.filter((x) => x !== id) : [...value.customerIndustryIds, id] });
  }
  function toggleAll() {
    const c = normalizeCustomers({ industryIds: value.customerIndustryIds, servesConsumers: value.servesConsumers, allIndustries: !value.customerAllIndustries });
    set({ customerIndustryIds: c.industryIds, servesConsumers: c.servesConsumers, customerAllIndustries: c.allIndustries });
  }

  const origin = capitalOriginOf(value.capitalType);

  return (
    <div className="clsf">
      <style>{`
        .clsf { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
        .clsf-q { min-width: 0; }
        .clsf-qt { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: var(--ink); }
        .clsf-hint { margin: 0 0 10px; font-size: 12px; color: var(--ink-mute); line-height: 1.7; }
        .clsf-row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
        .clsf-select { width: 100%; min-width: 0; padding: 9px 10px; font-size: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink); }
        .clsf-sel { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .clsf-selrow { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; min-width: 0; }
        .clsf-star { flex-shrink: 0; width: 28px; height: 28px; border: 0; background: none; cursor: pointer; font-size: 16px; color: var(--ink-faint, #c4c4c4); }
        .clsf-star[aria-pressed=true] { color: var(--royal); }
        .clsf-name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .clsf-sub { flex-shrink: 1; min-width: 0; font-size: 12px; color: var(--ink-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .clsf-nm { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .clsf-x { flex-shrink: 0; width: 28px; height: 28px; border: 0; background: none; cursor: pointer; font-size: 15px; color: var(--ink-mute); }
        .clsf-input { width: 100%; min-width: 0; padding: 9px 12px; font-size: 14px; border: 1px solid var(--line); border-radius: 8px; box-sizing: border-box; }
        .clsf-results { margin-top: 6px; border: 1px solid var(--line); border-radius: 8px; background: #fff; max-height: 260px; overflow-y: auto; }
        .clsf-result { display: flex; align-items: baseline; gap: 8px; width: 100%; padding: 8px 12px; border: 0; border-bottom: 1px solid var(--line-soft, #f1f1f1); background: none; text-align: left; cursor: pointer; font-size: 13.5px; color: var(--ink); min-width: 0; }
        .clsf-result:disabled { cursor: default; color: var(--ink-mute); }
        .clsf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .clsf-chip { padding: 6px 12px; border: 1px solid var(--line); border-radius: 100px; background: #fff; font-size: 13px; color: var(--ink); cursor: pointer; }
        .clsf-chip[aria-pressed=true] { border-color: var(--royal); color: var(--royal); font-weight: 600; background: var(--royal-50, #f2f5fb); }
        .clsf-chip:disabled { cursor: default; opacity: 0.5; }
        .clsf-note { margin: 8px 0 0; font-size: 12px; color: var(--ink-mute); line-height: 1.7; }
        .clsf-radio { display: flex; gap: 8px; flex-wrap: wrap; }
        .clsf-stages { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; } /* ★2026-10-18: 2列固定から、幅に合わせて並べる形へ（縦に長かった） */
        .clsf-card { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: #fff; cursor: pointer; min-width: 0; }
        .clsf-card[data-on=true] { border-color: var(--royal); }
        .clsf-card-t { font-size: 13.5px; font-weight: 600; color: var(--ink); }
        .clsf-card-d { font-size: 12px; color: var(--ink-mute); line-height: 1.5; }
        @media (max-width: 560px) {
          .clsf-row2 { grid-template-columns: minmax(0, 1fr); }
          /* ★スマホでは事業ステージを1つの枠の中の行にする（2026-10-19。8枚のカードで約600pxあった） */
          .clsf-stages { gap: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
          .clsf-card { border: 0; border-radius: 0; border-top: 1px solid var(--line-soft, #f1f1f1); padding: 8px 12px; line-height: 1.4; }
          .clsf-card:first-child { border-top: 0; }
          .clsf-card[data-on=true] { background: var(--royal-50, #f2f5fb); }
          .clsf-card-d { line-height: 1.4; }
        }
      `}</style>

      {/* ① 業種 */}
      <section className="clsf-q">
        <p className="clsf-qt">① どんな業種の会社ですか？（1つ）</p>
        <p className="clsf-hint">いちばん売上が大きい事業の業種を選んでください。</p>
        <div className="clsf-row2">
          <select id="ce-industry" className="clsf-select" aria-label="業種（大分類）" disabled={disabled}
            value={top?.id ?? ""} onChange={(e) => set({ industryId: e.target.value })}>
            <option value="">大分類を選ぶ</option>
            {tops.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select id="ce-industry-sub" className="clsf-select" aria-label="業種（小分類）" disabled={disabled || !top || subs.length === 0}
            value={selectedSub?.id ?? ""} onChange={(e) => set({ industryId: e.target.value || (top?.id ?? "") })}>
            <option value="">{top ? "小分類を選ぶ" : "先に大分類を選んでください"}</option>
            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </section>

      {/* ② 事業 */}
      <section className="clsf-q">
        <p className="clsf-qt">② 具体的にどんな事業をしていますか？（最大{MAX}つ・★が主な事業）</p>
        {ordered.length > 0 && (
          <div className="clsf-sel" data-state="selected-domains">
            {ordered.map((d) => {
              const primary = d.id === value.primaryDomainId;
              return (
                <div key={d.id} className="clsf-selrow">
                  <button type="button" className="clsf-star btn-fixed-size" aria-pressed={primary} disabled={disabled}
                    aria-label={primary ? `${d.name}（主な事業）` : `${d.name}を主な事業にする`}
                    onClick={() => set({ primaryDomainId: d.id })}>{primary ? "★" : "☆"}</button>
                  {/* ⚠️ 業種は名前の下の行に出す（同じ行だと 375px で名前が切れる） */}
                  <span className="clsf-nm">
                    <span className="clsf-name" title={d.name}>{d.name}</span>
                    <span className="clsf-sub">{d.status === "pending" ? "確認待ち" : industryName(d.industry_id)}</span>
                  </span>
                  <button type="button" className="clsf-x btn-fixed-size" aria-label={`${d.name}を外す`} disabled={disabled}
                    onClick={() => removeDomain(d.id)}>×</button>
                </div>
              );
            })}
          </div>
        )}
        <input id="ce-business-domain" className="clsf-input" type="search" value={query} disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setAddError(null); }}
          placeholder="事業やサービスの名前で探す（例：会計ソフト、決済、半導体、家事代行）" aria-label="事業を探す" />
        {query.trim() !== "" && (
          <div className="clsf-results" role="listbox" aria-label="事業の候補">
            {results.map((d) => {
              const on = value.domainIds.includes(d.id);
              return (
                <button key={d.id} type="button" role="option" aria-selected={on} className="clsf-result"
                  disabled={disabled || on || atLimit} onClick={() => addDomain(d.id)}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <span className="clsf-sub">{d.status === "pending" ? "確認待ち" : industryName(d.industry_id)}{on ? "・選択中" : ""}</span>
                </button>
              );
            })}
            {!exact && onAddDomain && (
              <button type="button" className="clsf-result" disabled={disabled || adding || atLimit} onClick={handleAdd} data-state="add-domain">
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>＋「{query.trim()}」を新しい事業として追加する</span>
              </button>
            )}
            {results.length === 0 && !onAddDomain && <p className="clsf-note" style={{ padding: "0 12px 8px" }}>見つかりませんでした。</p>}
          </div>
        )}
        {query.trim() !== "" && !exact && onAddDomain && (
          <p className="clsf-note">見つからないときはそのまま追加できます。運営が確認して、近い分類にまとめます。</p>
        )}
        {addError && <p className="clsf-note" role="alert" style={{ color: "var(--ink)" }}>{addError}</p>}
        {query.trim() === "" && (
          <>
            {top && mains.length > 0 && (
              <>
                <p className="clsf-hint" style={{ margin: "12px 0 6px" }}>「{top.name}」の主な事業</p>
                <div className="clsf-chips">
                  {mains.map((d) => {
                    const on = value.domainIds.includes(d.id);
                    return (
                      <button key={d.id} type="button" className="clsf-chip" aria-pressed={on} disabled={disabled || (!on && atLimit)}
                        onClick={() => (on ? removeDomain(d.id) : addDomain(d.id))}>{d.name}</button>
                    );
                  })}
                </div>
              </>
            )}
            <p className="clsf-note">ここにない事業や、ほかの業種の事業は、上の検索から選べます。</p>
          </>
        )}
        <p className="clsf-note" data-state="domain-count">
          {atLimit
            ? `${MAX}つまで選べます。入れ替えるときは × で外してください。`
            : `あと${MAX - value.domainIds.length}つ選べます。★を押すと主な事業を変えられます。`}
        </p>
      </section>

      {/* ③ 会社のタイプ */}
      <section className="clsf-q">
        <p className="clsf-qt">③ 会社のタイプを教えてください</p>
        <p className="clsf-hint" style={{ marginBottom: 6 }}>資本</p>
        <div className="clsf-radio" id="ce-capital" role="radiogroup" aria-label="資本">
          {(["domestic", "foreign"] as const).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={origin === o} className="clsf-chip" aria-pressed={origin === o} disabled={disabled}
              onClick={() => set({ capitalType: capitalTypeFor(o, value.capitalType), hqCountry: o === "foreign" ? value.hqCountry : "" })}>
              {o === "domestic" ? "日系" : "外資系"}
            </button>
          ))}
        </div>
        {origin === "foreign" && (
          <div style={{ marginTop: 10, maxWidth: 320 }}>
            <label htmlFor="ce-hq" className="clsf-hint" style={{ display: "block", marginBottom: 4 }}>本社の国</label>
            <select id="ce-hq" className="clsf-select" value={value.hqCountry} disabled={disabled} onChange={(e) => set({ hqCountry: e.target.value })}>
              <option value="">選んでください</option>
              {HQ_COUNTRIES_MAIN.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              <optgroup label="その他">
                {HQ_COUNTRIES_OTHER.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </optgroup>
            </select>
          </div>
        )}
        <p className="clsf-hint" style={{ margin: "14px 0 6px" }}>事業ステージ</p>
        <div className="clsf-stages" id="ce-stage" role="radiogroup" aria-label="事業ステージ">
          {COMPANY_STAGES.map((s) => {
            const on = value.companyStage === s.value;
            return (
              <label key={s.value} className="clsf-card" data-on={on}>
                <input type="radio" name="ce-stage" value={s.value} checked={on} disabled={disabled}
                  onChange={() => set({ companyStage: s.value })} style={{ marginTop: 3 }} />
                <span style={{ minWidth: 0 }}>
                  <span className="clsf-card-t">{s.label}</span><br />
                  <span className="clsf-card-d">{s.desc}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* ④ お客さま */}
      <section className="clsf-q">
        <p className="clsf-qt">④ 主なお客さまはどの業界ですか？（任意・いくつでも）</p>
        <div className="clsf-chips" aria-label="お客さまの業界">
          {tops.map((t) => (
            <button key={t.id} type="button" className="clsf-chip" aria-pressed={value.customerIndustryIds.includes(t.id)} disabled={disabled}
              onClick={() => toggleCustomer(t.id)}>{t.name}</button>
          ))}
          <button type="button" className="clsf-chip" aria-pressed={value.servesConsumers} disabled={disabled}
            onClick={() => set({ servesConsumers: !value.servesConsumers, customerAllIndustries: false })}>個人のお客さま</button>
          <button type="button" className="clsf-chip" aria-pressed={value.customerAllIndustries} disabled={disabled} onClick={toggleAll}>業界を問わない</button>
        </div>
        {value.customerAllIndustries && (
          <p data-state="customers-all-hint" style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.6 }}>
            業界を問わない場合も、とくにお客さまが多い業界を選べます。選んだ業界の経験がある候補者に「合うところ」として表示されます。
          </p>
        )}
      </section>
    </div>
  );
}
