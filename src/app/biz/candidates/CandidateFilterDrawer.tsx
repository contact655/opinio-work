"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { FilterDrawer, FilterDrawerSection, FilterOption } from "@/components/common/FilterDrawer";
import {
  ACTIVITY_FILTER_OPTIONS, AGE_FILTER_OPTIONS, CANDIDATE_EMPLOYMENT_OPTIONS, STANCE_FRESHNESS_BANDS,
  filterCandidates, isNewSince, type Candidate,
} from "@/lib/business/candidates/model";
import { EMPTY_SAVED_FILTERS, type SavedCandidateFilters } from "@/lib/business/savedSearch";
import { residenceKey } from "@/lib/utils/location";
import { ResidenceOptions, RoleTreeOptions, StanceOptions, TenureOptions, computeAxisCounts, type RoleTree } from "./filterAxes";

/**
 * ★候補者を探すの「すべてのフィルター」（2026-10-13 / ステップ5）。
 *
 * ⚠️★**部品（ドロワーの枠・選択肢の行）は `components/common/FilterDrawer.tsx`**。ここは候補者固有の軸だけ。
 * ⚠️★**件数は「その軸以外の条件をすべて掛けたあとの人数」**（ECサイトの絞り込みと同じ）。
 *    `filterCandidates(…, { skipAxis })` で母集団を作り、その軸の値を1つずつ `AXIS_FILTERS` に通して数える。
 *    ⚠️ **件数のために条件を書き写さないこと**（選んだ結果と件数が食い違う）。
 * ⚠️★件数は**下書き**の条件で数える（開いてから選んだものも反映する）。ブラウザ側だけで数える（API は増やさない）。
 * ⚠️ 検索窓（q）・新着だけ（保存した条件）はいつも掛かる（一覧と同じ母集団にする）。
 * ⚠️ 年齢・最近の利用はスイッチが有効なときだけ出す（件数は出さない）。
 */

/** ドロワーに出す条件の数（「すべてのフィルター（N）」）。⚠️ 検索窓と並び替えは数えない */
export function drawerFilterCount(f: SavedCandidateFilters, opts: { ageFilter: boolean; activity: boolean }): number {
  return [
    f.expRoleIds.length > 0, f.desiredRoleIds.length > 0, f.careerStances.length > 0, !!f.tenureBand,
    f.prefectures.length > 0, f.starredOnly, !!f.stanceFreshness, f.employmentTypes.length > 0,
    opts.ageFilter && (f.ageMin > 0 || f.ageMax > 0), opts.activity && !!f.activity,
  ].filter(Boolean).length;
}


export function CandidateFilterDrawer({
  open, onClose, applied, onApply, candidates, newSince, ageFilterEnabled, activityEnabled, roleFilterTree, returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  /** いま一覧に効いている条件。開くたびに下書きの初期値になる */
  applied: SavedCandidateFilters;
  /** 「結果を表示」で下書きを渡す */
  onApply: (f: SavedCandidateFilters) => void;
  /** ★を重ねた候補者（一覧と同じもの） */
  candidates: Candidate[];
  newSince: string | null;
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
  /* ⚠️ 開いている間だけ数える（閉じているときは数えない）。数え方は filterAxes.ts の computeAxisCounts（一次チップと同じ） */
  const counts = useMemo(() => {
    if (!open) return null;
    const o = { ageFilter: ageFilterEnabled, activity: activityEnabled, newSince };
    let all = filterCandidates(candidates, draft, now, o);
    if (newSince) all = all.filter((c) => isNewSince(c, newSince));
    return { ...computeAxisCounts(candidates, draft, now, o, roleFilterTree), result: all.length };
  }, [open, draft, candidates, newSince, ageFilterEnabled, activityEnabled, roleFilterTree, now]);

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
        <StanceOptions selected={draft.careerStances} counts={counts.stance} onToggle={(v) => toggleIn("careerStances", v)} />
      </FilterDrawerSection>

      <FilterDrawerSection title="社会人年数" state="fdr-tenure">
        <TenureOptions name="fdr-tenure" value={draft.tenureBand} counts={counts.tenure} onChange={(v) => set("tenureBand", v)} />
        {unknownTenure > 0 && <p className="fdr-note">職歴が未登録の {unknownTenure} 名は年数を算出できないため、そのまま含みます（件数にも含みます）。</p>}
      </FilterDrawerSection>

      <FilterDrawerSection title="居住地" state="fdr-residence">
        <ResidenceOptions selected={draft.prefectures} counts={counts.pref} regionCounts={counts.region} onChange={(next) => set("prefectures", next)} />
        {droppedNoResidence > 0 && <p className="fdr-note">居住地が未登録・非公開の {droppedNoResidence} 名は、居住地で絞ると含みません。</p>}
      </FilterDrawerSection>

      {/* ⚠️「合うところあり」は 2026-10-28 に外した（柴さんの指示） */}
      <FilterDrawerSection title="気になる" state="fdr-flags">
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
