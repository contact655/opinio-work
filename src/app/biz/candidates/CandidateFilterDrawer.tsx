"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { FilterDrawer, FilterDrawerSection, FilterOption } from "@/components/common/FilterDrawer";
import {
  ACTIVITY_FILTER_OPTIONS, AGE_FILTER_OPTIONS, CANDIDATE_EMPLOYMENT_OPTIONS, countAxisValues, STANCE_FRESHNESS_BANDS, TENURE_BANDS,
  filterCandidates, isNewSince, type Candidate, type FilterAxis,
} from "@/lib/business/candidates/model";
import { EMPTY_SAVED_FILTERS, type SavedCandidateFilters } from "@/lib/business/savedSearch";
import { CAREER_STANCES } from "@/lib/constants/careerPreferences";
import { OVERSEAS, PREFECTURE_REGIONS, residenceKey } from "@/lib/utils/location";

/**
 * ★候補者を探すの「すべてのフィルター」（2026-10-13 / ステップ5）。
 *
 * ⚠️★**部品（ドロワーの枠・選択肢の行）は `components/common/FilterDrawer.tsx`**。ここは候補者固有の軸だけ。
 * ⚠️★**件数は「その軸以外の条件をすべて掛けたあとの人数」**（ECサイトの絞り込みと同じ）。
 *    `filterCandidates(…, { skipAxis })` で母集団を作り、その軸の値を1つずつ `AXIS_FILTERS` に通して数える。
 *    ⚠️ **件数のために条件を書き写さないこと**（選んだ結果と件数が食い違う）。
 * ⚠️★件数は**下書き**の条件で数える（開いてから選んだものも反映する）。ブラウザ側だけで数える（API は増やさない）。
 * ⚠️ 検索窓（q）・新着だけ（保存した条件）・見送った人を表示するか、はいつも掛かる（一覧と同じ母集団にする）。
 * ⚠️ 年齢・最近の利用はスイッチが有効なときだけ出す（件数は出さない）。
 */

/** ドロワーに出す条件の数（「すべてのフィルター（N）」）。⚠️ 検索窓と並び替えは数えない */
export function drawerFilterCount(f: SavedCandidateFilters, opts: { ageFilter: boolean; activity: boolean }): number {
  return [
    f.expRoleIds.length > 0, f.desiredRoleIds.length > 0, f.careerStances.length > 0, !!f.tenureBand,
    f.prefectures.length > 0, f.hasTouchpoints, f.starredOnly, !!f.stanceFreshness, f.employmentTypes.length > 0,
    opts.ageFilter && (f.ageMin > 0 || f.ageMax > 0), opts.activity && !!f.activity,
  ].filter(Boolean).length;
}

const STANCE_OPTIONS = CAREER_STANCES.filter((o) => o.value !== "no_contact");
type RoleTree = { id: string; name: string; children: { id: string; name: string }[] }[];

export function CandidateFilterDrawer({
  open, onClose, applied, onApply, candidates, newSince, includeHidden, ageFilterEnabled, activityEnabled, roleFilterTree, returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  /** いま一覧に効いている条件。開くたびに下書きの初期値になる */
  applied: SavedCandidateFilters;
  /** 「結果を表示」で下書きを渡す */
  onApply: (f: SavedCandidateFilters) => void;
  /** ★・見送りを重ねた候補者（一覧と同じもの） */
  candidates: Candidate[];
  newSince: string | null;
  includeHidden: boolean;
  ageFilterEnabled: boolean;
  activityEnabled: boolean;
  roleFilterTree: RoleTree;
  returnFocusRef: RefObject<HTMLElement>;
}) {
  const [draft, setDraft] = useState<SavedCandidateFilters>(applied);
  /* 開くたびに、いま効いている条件から始める（閉じたら下書きは捨てる＝次に開くときに上書きされる） */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setDraft(applied); }, [open]);
  const set = <K extends keyof SavedCandidateFilters>(k: K, v: SavedCandidateFilters[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleIn = (k: "expRoleIds" | "desiredRoleIds" | "careerStances" | "prefectures" | "employmentTypes", v: string) =>
    setDraft((d) => ({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] }));

  /* ── 件数 ───────────────────────────────────────────────────────── */
  const now = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const opts = { ageFilter: ageFilterEnabled, activity: activityEnabled, includeHidden };
  const base = (f: SavedCandidateFilters, skipAxis?: FilterAxis) => {
    const l = filterCandidates(candidates, f, now, { ...opts, skipAxis });
    return newSince ? l.filter((c) => isNewSince(c, newSince)) : l;
  };
  /** 軸ごとに、値 → 人数（その軸以外を掛けた母集団で数える。model.ts の countAxisValues。一次チップの居住地と同じ関数）。
   *  ⚠️ 軸ごとに1回で数える（値ごとに母集団を作り直さない） */
  const countAxis = (axis: FilterAxis, patches: Record<string, Partial<SavedCandidateFilters>>) =>
    countAxisValues(candidates, draft, axis, patches, now, { ...opts, newSince });
  /* ⚠️ 開いている間だけ数える（閉じているときは数えない） */
  const counts = useMemo(() => {
    if (!open) return null;
    const roleIds = roleFilterTree.flatMap((t) => [t.id, ...t.children.map((c) => c.id)]);
    const prefs = [...PREFECTURE_REGIONS.flatMap((r) => r.prefectures), OVERSEAS];
    const by = <T,>(vals: readonly T[], key: (v: T) => string, patch: (v: T) => Partial<SavedCandidateFilters>) =>
      Object.fromEntries(vals.map((v) => [key(v), patch(v)]));
    return {
      exp: countAxis("expRole", by(roleIds, (id) => id, (id) => ({ expRoleIds: [id] }))),
      desired: countAxis("desiredRole", by(roleIds, (id) => id, (id) => ({ desiredRoleIds: [id] }))),
      stance: countAxis("careerStance", by(STANCE_OPTIONS, (o) => o.value, (o) => ({ careerStances: [o.value] }))),
      tenure: countAxis("tenure", by(TENURE_BANDS, (b) => b.value, (b) => ({ tenureBand: b.value }))),
      pref: countAxis("prefecture", by(prefs, (p) => p, (p) => ({ prefectures: [p] }))),
      touchpoints: countAxis("touchpoints", { on: { hasTouchpoints: true } }).on,
      starred: countAxis("starred", { on: { starredOnly: true } }).on,
      fresh: countAxis("stanceFreshness", by(STANCE_FRESHNESS_BANDS, (b) => b.value, (b) => ({ stanceFreshness: b.value }))),
      emp: countAxis("employmentType", by(CANDIDATE_EMPLOYMENT_OPTIONS, (v) => v, (v) => ({ employmentTypes: [v] }))),
      result: base(draft).filter((c) => includeHidden || c.hidden !== true).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, candidates, newSince, includeHidden, ageFilterEnabled, activityEnabled, roleFilterTree, now]);

  /* ── 落ちる人の注記（一覧の詳細検索にあったもの。下書きの条件で数える） ── */
  const pop = useMemo(() => (open ? (newSince ? candidates.filter((c) => isNewSince(c, newSince)) : candidates) : []), [open, candidates, newSince]);
  const droppedNoStanceTs = draft.stanceFreshness ? pop.filter((c) => !c.careerStanceUpdatedAt).length : 0;
  const droppedNoAge = ageFilterEnabled && (draft.ageMin > 0 || draft.ageMax > 0) ? pop.filter((c) => c.age == null).length : 0;
  const droppedNoActivity = activityEnabled && draft.activity ? pop.filter((c) => c.activity == null).length : 0;
  const unknownTenure = draft.tenureBand ? pop.filter((c) => c.tenureMonths == null).length : 0;
  const droppedNoResidence = draft.prefectures.length > 0 ? pop.filter((c) => !residenceKey(c.location)).length : 0;

  if (!counts) return null;

  return (
    <FilterDrawer
      open={open} onClose={onClose} title="すべてのフィルター" returnFocusRef={returnFocusRef}
      /* ⚠️ 「すべてクリア」は下書きのドロワーの軸だけ。検索窓（q）と並び替えは残す（ドロワーに無いものを黙って消さない） */
      onClearAll={() => setDraft({ ...EMPTY_SAVED_FILTERS, q: draft.q, sort: draft.sort })}
      onApply={() => { onApply(draft); onClose(); }}
      applyLabel={`結果を表示（${counts.result}名）`}
    >
      <FilterDrawerSection title="経験職種" state="fdr-exp-role">
        <RoleTreeOptions tree={roleFilterTree} selected={draft.expRoleIds} counts={counts.exp} onToggle={(id) => toggleIn("expRoleIds", id)} stateKey="exp" />
      </FilterDrawerSection>

      <FilterDrawerSection title="希望職種" state="fdr-desired-role">
        <RoleTreeOptions tree={roleFilterTree} selected={draft.desiredRoleIds} counts={counts.desired} onToggle={(id) => toggleIn("desiredRoleIds", id)} stateKey="desired" />
      </FilterDrawerSection>

      <FilterDrawerSection title="転職への意向" state="fdr-stance">
        {STANCE_OPTIONS.map((o) => (
          <FilterOption key={o.value} label={o.label} count={counts.stance[o.value]} checked={draft.careerStances.includes(o.value)}
            onChange={() => toggleIn("careerStances", o.value)} state={`opt-stance-${o.value}`} />
        ))}
      </FilterDrawerSection>

      <FilterDrawerSection title="社会人年数" state="fdr-tenure">
        <FilterOption type="radio" name="fdr-tenure" label="指定しない" checked={!draft.tenureBand} onChange={() => set("tenureBand", "")} />
        {TENURE_BANDS.map((b) => (
          <FilterOption key={b.value} type="radio" name="fdr-tenure" label={b.label} count={counts.tenure[b.value]}
            checked={draft.tenureBand === b.value} onChange={() => set("tenureBand", b.value)} state={`opt-tenure-${b.value}`} />
        ))}
        {unknownTenure > 0 && <p className="fdr-note">職歴が未登録の {unknownTenure} 名は年数を算出できないため、そのまま含みます（件数にも含みます）。</p>}
      </FilterDrawerSection>

      <FilterDrawerSection title="居住地" state="fdr-residence">
        <ResidenceOptions selected={draft.prefectures} counts={counts.pref} onToggle={(p) => toggleIn("prefectures", p)} />
        {droppedNoResidence > 0 && <p className="fdr-note">居住地が未登録・非公開の {droppedNoResidence} 名は、居住地で絞ると含みません。</p>}
      </FilterDrawerSection>

      <FilterDrawerSection title="合うところ・気になる" state="fdr-flags">
        <FilterOption label="合うところあり" count={counts.touchpoints} checked={draft.hasTouchpoints}
          onChange={() => set("hasTouchpoints", !draft.hasTouchpoints)} state="opt-touchpoints" />
        <FilterOption label="気になる（★を付けた方）" count={counts.starred} checked={draft.starredOnly}
          onChange={() => set("starredOnly", !draft.starredOnly)} state="opt-starred" />
      </FilterDrawerSection>

      <FilterDrawerSection title="意向を更新した時期" state="fdr-fresh">
        <FilterOption type="radio" name="fdr-fresh" label="指定しない" checked={!draft.stanceFreshness} onChange={() => set("stanceFreshness", "")} />
        {STANCE_FRESHNESS_BANDS.map((b) => (
          <FilterOption key={b.value} type="radio" name="fdr-fresh" label={b.label} count={counts.fresh[b.value]}
            checked={draft.stanceFreshness === b.value} onChange={() => set("stanceFreshness", b.value)} state={`opt-fresh-${b.value}`} />
        ))}
        {droppedNoStanceTs > 0 && (
          <p className="fdr-note">更新日時が記録されていない {droppedNoStanceTs} 名は含みません。この記録は 2026-09-19 から取り始めたため、それ以前に答えた方は対象外です。</p>
        )}
      </FilterDrawerSection>

      <FilterDrawerSection title="雇用形態（現職）" state="fdr-employment">
        {CANDIDATE_EMPLOYMENT_OPTIONS.map((v) => (
          <FilterOption key={v} label={v} count={counts.emp[v]} checked={draft.employmentTypes.includes(v)}
            onChange={() => toggleIn("employmentTypes", v)} state={`opt-emp-${v}`} />
        ))}
      </FilterDrawerSection>

      {/* ★年齢（下限・上限）。⚠️ CANDIDATE_AGE_FILTER_ENABLED のときだけ（本番は無効）。件数は出さない */}
      {ageFilterEnabled && (
        <FilterDrawerSection title="年齢" state="fdr-age">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <select aria-label="年齢（下限）" value={draft.ageMin || ""} onChange={(e) => set("ageMin", Number(e.target.value) || 0)} style={selectStyle}>
              <option value="">下限なし</option>
              {AGE_FILTER_OPTIONS.filter((a) => !draft.ageMax || a <= draft.ageMax).map((a) => <option key={a} value={a}>{a}歳以上</option>)}
            </select>
            <span aria-hidden="true">〜</span>
            <select aria-label="年齢（上限）" value={draft.ageMax || ""} onChange={(e) => set("ageMax", Number(e.target.value) || 0)} style={selectStyle}>
              <option value="">上限なし</option>
              {AGE_FILTER_OPTIONS.filter((a) => !draft.ageMin || a >= draft.ageMin).map((a) => <option key={a} value={a}>{a}歳以下</option>)}
            </select>
          </div>
          {droppedNoAge > 0 && <p className="fdr-note">生年月日が未登録の {droppedNoAge} 名は含みません。</p>}
        </FilterDrawerSection>
      )}

      {/* ★最近の利用。⚠️ CANDIDATE_ACTIVITY_ENABLED のときだけ（本番は無効）。件数は出さない */}
      {activityEnabled && (
        <FilterDrawerSection title="最近の利用" state="fdr-activity">
          <FilterOption type="radio" name="fdr-activity" label="指定しない" checked={!draft.activity} onChange={() => set("activity", "")} />
          {ACTIVITY_FILTER_OPTIONS.map((o) => (
            <FilterOption key={o.value} type="radio" name="fdr-activity" label={o.label} checked={draft.activity === o.value} onChange={() => set("activity", o.value)} />
          ))}
          {droppedNoActivity > 0 && <p className="fdr-note">利用の記録が無い {droppedNoActivity} 名は含みません。この記録は 2026-10-12 から取り始めました。</p>}
        </FilterDrawerSection>
      )}
    </FilterDrawer>
  );
}

const selectStyle: React.CSSProperties = { height: 34, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: "var(--ink)", background: "#fff" };

/**
 * 職種の木（大分類＋子）。子は ▸ で開く。⚠️ 選択中の子がある大分類は最初から開く。
 * ⚠️ 開閉のボタンは label の外に置く（label の中にボタンを入れると、押したときにチェックも切り替わる）
 */
function RoleTreeOptions({ tree, selected, counts, onToggle, stateKey }: {
  tree: RoleTree; selected: string[]; counts: Record<string, number>; onToggle: (id: string) => void; stateKey: string;
}) {
  const [openIds, setOpenIds] = useState<string[]>(() => tree.filter((t) => t.children.some((c) => selected.includes(c.id))).map((t) => t.id));
  return (
    <div>
      {tree.map((t) => {
        const isOpen = openIds.includes(t.id);
        return (
          <div key={t.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FilterOption label={t.name} count={counts[t.id]} checked={selected.includes(t.id)} onChange={() => onToggle(t.id)} state={`opt-${stateKey}-${t.id}`} />
              </div>
              {t.children.length > 0 && (
                <button type="button" className="btn-fixed-size" aria-expanded={isOpen} aria-label={`${t.name}の内訳を${isOpen ? "閉じる" : "開く"}`}
                  onClick={() => setOpenIds((o) => (o.includes(t.id) ? o.filter((x) => x !== t.id) : [...o, t.id]))}
                  style={{ flexShrink: 0, width: 28, height: 28, border: "none", background: "none", color: "var(--ink-mute)", cursor: "pointer", fontSize: 12, borderRadius: 6 }}>
                  {isOpen ? "▾" : "▸"}
                </button>
              )}
            </div>
            {isOpen && t.children.map((c) => (
              <div key={c.id} style={{ paddingRight: 32 }}>
                <FilterOption child label={c.name} count={counts[c.id]} checked={selected.includes(c.id)} onChange={() => onToggle(c.id)} state={`opt-${stateKey}-${c.id}`} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 居住地。★件数のある地域（と選択中）を上に、0件の都道府県は「ほかの都道府県」に折りたたむ（2026-10-13）。
 * ⚠️ 0件は灰色で選べない（選択中のものは上に出るので外せる）。
 */
function ResidenceOptions({ selected, counts, onToggle }: { selected: string[]; counts: Record<string, number>; onToggle: (p: string) => void }) {
  const [showZero, setShowZero] = useState(false);
  const regions = [...PREFECTURE_REGIONS, { region: "海外", prefectures: [OVERSEAS] as readonly string[] }];
  const visible = (p: string) => (counts[p] ?? 0) > 0 || selected.includes(p);
  const shown = regions.map((r) => ({ region: r.region, prefs: r.prefectures.filter(visible) })).filter((r) => r.prefs.length > 0);
  const zero = regions.flatMap((r) => r.prefectures.filter((p) => !visible(p)));
  return (
    <div>
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
