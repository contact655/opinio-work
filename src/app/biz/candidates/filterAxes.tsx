"use client";

import { useState } from "react";
import { FilterOption } from "@/components/common/FilterDrawer";
import {
  CANDIDATE_EMPLOYMENT_OPTIONS, STANCE_FRESHNESS_BANDS, TENURE_BANDS, countAxisValues,
  type Candidate, type FilterAxis,
} from "@/lib/business/candidates/model";
import type { SavedCandidateFilters } from "@/lib/business/savedSearch";
import { CAREER_STANCES } from "@/lib/constants/careerPreferences";
import { OVERSEAS, PREFECTURE_REGIONS } from "@/lib/utils/location";

/**
 * ★候補者を探すの「軸ごとの描画部品」と「件数」（2026-10-13 / ステップ5の修正）。
 *
 * ⚠️★**「すべてのフィルター」のドロワーと、一次チップのドロップダウンが同じ部品を使う。** 片方にだけ手を入れないこと
 *    （件数・0件の灰色・畳み方がずれる）。チップの器は `components/common/FilterPopoverChip.tsx`、
 *    ドロワーの器は `components/common/FilterDrawer.tsx`。
 * ⚠️★件数は「その軸以外の条件をすべて掛けたあとの人数」。数えるのは `computeAxisCounts` の1つ（中は model.ts の countAxisValues）。
 * ⚠️ 0件は灰色で選べない。選択中のものは0件でも外せる（`FilterOption` の規則）。
 */

export const STANCE_OPTIONS = CAREER_STANCES.filter((o) => o.value !== "no_contact");
export type RoleTree = { id: string; name: string; children: { id: string; name: string }[] }[];
export type AxisCounts = ReturnType<typeof computeAxisCounts>;

/**
 * 軸ごとの件数（値 → 人数）。ドロワー（下書きの条件）と一次チップ（いま効いている条件）が同じ関数で数える。
 * ⚠️ 軸ごとに1回で数える（値ごとに母集団を作り直さない）
 */
export function computeAxisCounts(
  candidates: Candidate[], f: SavedCandidateFilters, now: Date,
  opts: { ageFilter: boolean; activity: boolean; includeHidden: boolean; newSince: string | null },
  roleFilterTree: RoleTree,
) {
  const count = (axis: FilterAxis, patches: Record<string, Partial<SavedCandidateFilters>>) => countAxisValues(candidates, f, axis, patches, now, opts);
  const by = <T,>(vals: readonly T[], key: (v: T) => string, patch: (v: T) => Partial<SavedCandidateFilters>) =>
    Object.fromEntries(vals.map((v) => [key(v), patch(v)]));
  const roleIds = roleFilterTree.flatMap((t) => [t.id, ...t.children.map((c) => c.id)]);
  const prefs = [...PREFECTURE_REGIONS.flatMap((r) => r.prefectures), OVERSEAS];
  return {
    exp: count("expRole", by(roleIds, (id) => id, (id) => ({ expRoleIds: [id] }))),
    desired: count("desiredRole", by(roleIds, (id) => id, (id) => ({ desiredRoleIds: [id] }))),
    stance: count("careerStance", by(STANCE_OPTIONS, (o) => o.value, (o) => ({ careerStances: [o.value] }))),
    tenure: count("tenure", by(TENURE_BANDS, (b) => b.value, (b) => ({ tenureBand: b.value }))),
    pref: count("prefecture", by(prefs, (p) => p, (p) => ({ prefectures: [p] }))),
    touchpoints: count("touchpoints", { on: { hasTouchpoints: true } }).on,
    starred: count("starred", { on: { starredOnly: true } }).on,
    fresh: count("stanceFreshness", by(STANCE_FRESHNESS_BANDS, (b) => b.value, (b) => ({ stanceFreshness: b.value }))),
    emp: count("employmentType", by(CANDIDATE_EMPLOYMENT_OPTIONS, (v) => v, (v) => ({ employmentTypes: [v] }))),
  };
}

/** 職種の名前（チップの「経験職種: 営業 +2」）。⚠️ 並びは木の順（選んだ順ではない） */
export function roleChipLabel(label: string, tree: RoleTree, selected: string[]): string {
  const names = tree.flatMap((t) => [t, ...t.children]).filter((r) => selected.includes(r.id)).map((r) => r.name);
  if (names.length === 0) return label;
  return `${label}: ${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ""}`;
}

/**
 * 職種の木（大分類＋子）。★上部に検索窓。子は ▸ で開く。選択中の子がある大分類は最初から開く。
 * ★0名の大分類（選択中・選択中の子を持つものを除く）は「0名の職種（n）を表示」に畳む（2026-10-13 / 柴さんの指示）。
 * ⚠️ 検索中は畳まない（0名でも名前で探したものは見せる。灰色で選べない）
 * ⚠️ 開閉のボタンは label の外に置く（label の中にボタンを入れると、押したときにチェックも切り替わる）
 */
export function RoleTreeOptions({ tree, selected, counts, onToggle, stateKey }: {
  tree: RoleTree; selected: string[]; counts: Record<string, number>; onToggle: (id: string) => void; stateKey: string;
}) {
  const [openIds, setOpenIds] = useState<string[]>(() => tree.filter((t) => t.children.some((c) => selected.includes(c.id))).map((t) => t.id));
  const [query, setQuery] = useState("");
  const [showZero, setShowZero] = useState(false);
  const q = query.trim().toLowerCase();
  const hasSel = (t: RoleTree[number]) => selected.includes(t.id) || t.children.some((c) => selected.includes(c.id));
  const live = (t: RoleTree[number]) => (counts[t.id] ?? 0) > 0 || hasSel(t);

  const row = (t: RoleTree[number], kids: RoleTree[number]["children"], forceOpen: boolean) => {
    const isOpen = forceOpen || openIds.includes(t.id);
    return (
      <div key={t.id} data-role-top={t.id}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FilterOption label={t.name} count={counts[t.id] ?? 0} checked={selected.includes(t.id)} onChange={() => onToggle(t.id)} state={`opt-${stateKey}-${t.id}`} />
          </div>
          {kids.length > 0 && !forceOpen && (
            <button type="button" className="btn-fixed-size" aria-expanded={isOpen} aria-label={`${t.name}の内訳を${isOpen ? "閉じる" : "開く"}`}
              onClick={() => setOpenIds((o) => (o.includes(t.id) ? o.filter((x) => x !== t.id) : [...o, t.id]))}
              style={{ flexShrink: 0, width: 28, height: 28, border: "none", background: "none", color: "var(--ink-mute)", cursor: "pointer", fontSize: 12, borderRadius: 6 }}>
              {isOpen ? "▾" : "▸"}
            </button>
          )}
        </div>
        {isOpen && kids.map((c) => (
          <div key={c.id} style={{ paddingRight: forceOpen ? 0 : 32 }}>
            <FilterOption child label={c.name} count={counts[c.id] ?? 0} checked={selected.includes(c.id)} onChange={() => onToggle(c.id)} state={`opt-${stateKey}-${c.id}`} />
          </div>
        ))}
      </div>
    );
  };

  /* 検索中: 名前が当たった大分類（子は全部）と、当たった子（親の下に） */
  if (q) {
    const hits = tree.map((t) => {
      const topHit = t.name.toLowerCase().includes(q);
      const kids = topHit ? t.children : t.children.filter((c) => c.name.toLowerCase().includes(q));
      return { t, kids, show: topHit || kids.length > 0 };
    }).filter((h) => h.show);
    return (
      <div data-state={`role-tree-${stateKey}`}>
        <RoleSearch value={query} onChange={setQuery} stateKey={stateKey} />
        {hits.length === 0 && <p className="fdr-note" style={{ marginTop: 0 }}>「{query.trim()}」に当たる職種はありません。</p>}
        {hits.map((h) => row(h.t, h.kids, true))}
      </div>
    );
  }

  const shown = tree.filter(live);
  const zero = tree.filter((t) => !live(t));
  return (
    <div data-state={`role-tree-${stateKey}`}>
      <RoleSearch value={query} onChange={setQuery} stateKey={stateKey} />
      {shown.length === 0 && <p className="fdr-note" style={{ marginTop: 0 }}>いまの条件で該当する職種はありません。</p>}
      {shown.map((t) => row(t, t.children, false))}
      {zero.length > 0 && (
        <>
          <button type="button" className="fdr-more" aria-expanded={showZero} onClick={() => setShowZero((v) => !v)} data-state={`role-zero-toggle-${stateKey}`}>
            {showZero ? "0名の職種を隠す" : `0名の職種（${zero.length}）を表示`}
          </button>
          {showZero && <div data-state={`role-zero-list-${stateKey}`}>{zero.map((t) => row(t, t.children, false))}</div>}
        </>
      )}
    </div>
  );
}

function RoleSearch({ value, onChange, stateKey }: { value: string; onChange: (v: string) => void; stateKey: string }) {
  return (
    <input type="search" className="fdr-search" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder="職種名で探す" aria-label="職種名で探す" data-state={`role-search-${stateKey}`} />
  );
}

/**
 * 居住地。★件数のある地域（と選択中）を上に、0件の都道府県は「0名の都道府県（n）を表示」に畳む（2026-10-13）。
 * ⚠️ 0件は灰色で選べない（選択中のものは上に出るので外せる）。
 */
export function ResidenceOptions({ selected, counts, onToggle }: { selected: string[]; counts: Record<string, number>; onToggle: (p: string) => void }) {
  const [showZero, setShowZero] = useState(false);
  const regions = [...PREFECTURE_REGIONS, { region: "海外", prefectures: [OVERSEAS] as readonly string[] }];
  const visible = (p: string) => (counts[p] ?? 0) > 0 || selected.includes(p);
  const shown = regions.map((r) => ({ region: r.region, prefs: r.prefectures.filter(visible) })).filter((r) => r.prefs.length > 0);
  const zero = regions.flatMap((r) => r.prefectures.filter((p) => !visible(p)));
  return (
    <div data-state="residence-options">
      {shown.length === 0 && <p className="fdr-note" style={{ marginTop: 0 }}>いまの条件で該当する居住地はありません。</p>}
      {shown.map((r) => (
        <div key={r.region} data-region={r.region}>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 6 }}>{r.region}</div>
          {r.prefs.map((p) => <FilterOption key={p} label={p} count={counts[p] ?? 0} checked={selected.includes(p)} onChange={() => onToggle(p)} state={`opt-pref-${p}`} />)}
        </div>
      ))}
      {zero.length > 0 && (
        <>
          <button type="button" className="fdr-more" aria-expanded={showZero} onClick={() => setShowZero((v) => !v)} data-state="residence-zero-toggle">
            {showZero ? "0名の都道府県を隠す" : `0名の都道府県（${zero.length}）を表示`}
          </button>
          {showZero && (
            <div data-state="residence-zero-list" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 12 }}>
              {zero.map((p) => <FilterOption key={p} label={p} count={0} checked={false} onChange={() => onToggle(p)} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 転職への意向（複数選択は OR） */
export function StanceOptions({ selected, counts, onToggle }: { selected: string[]; counts: Record<string, number>; onToggle: (v: string) => void }) {
  return (
    <div data-state="stance-options">
      {STANCE_OPTIONS.map((o) => (
        <FilterOption key={o.value} label={o.label} count={counts[o.value] ?? 0} checked={selected.includes(o.value)}
          onChange={() => onToggle(o.value)} state={`opt-stance-${o.value}`} />
      ))}
    </div>
  );
}

/** 社会人年数（1つだけ）。⚠️ 職歴が未登録の人は年数を算出できず、どの帯でも落とさない（件数にも含む） */
export function TenureOptions({ value, counts, onChange, name }: { value: string; counts: Record<string, number>; onChange: (v: string) => void; name: string }) {
  return (
    <div data-state="tenure-options">
      <FilterOption type="radio" name={name} label="指定しない" checked={!value} onChange={() => onChange("")} />
      {TENURE_BANDS.map((b) => (
        <FilterOption key={b.value} type="radio" name={name} label={b.label} count={counts[b.value] ?? 0}
          checked={value === b.value} onChange={() => onChange(b.value)} state={`opt-tenure-${b.value}`} />
      ))}
    </div>
  );
}
