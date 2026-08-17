"use client";

/**
 * 「転職の希望」タブ。
 *
 * ⚠️ 3-B（2026-08-15）で `ProfileEditClient.tsx` から**そのまま移した**。
 *    差分は「移動」と「props の受け渡し」だけで、ロジックは変えていない。
 *
 * ⚠️ このタブは**アンマウントされない**（親が display:none で残す）。
 *    アンマウントすると、保存していない入力がタブを移った瞬間に消える。
 *    「移動しても消えない」ことを前提に、タブ切替の確認ダイアログを外してある。
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { FormSection, FormGroup, CardSaveFooter, inputStyle, selectStyle } from "./formKit";
import type { RoleItem } from "./RecordEditors";
import type { Stint } from "@/components/profile/CareerHistoryEditor";
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";
import {
  DESIRED_WORK_STYLES,
  TRANSFER_TIMINGS,
  DESIRED_PHASES,
  SALARY_MAX_MAN,
  MAX_DESIRED_ROLES,
} from "@/lib/constants/careerPreferences";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import { CheckPillGroup, type CheckPillOption } from "@/components/ui/CheckPillGroup";
import { calcTotalExperience, formatYmLabel } from "@/lib/profile/tenure";
import { hasCareerPreferences } from "@/lib/profile/completion";

/** 希望条件のカード。★保存の単位。ここに無いものはカードとして存在しない */
export type PrefCardKey = "roles" | "location" | "salary" | "phase";
type PrefCardState = { saving: boolean; saved: boolean; error: string | null };

/** 希望条件の保存済みスナップショット。キー名は career-preferences API の body と揃える
    （`savePrefCard` の patch をそのまま重ねられるようにするため）。 */
type SavedPrefs = {
  desired_role_ids: string[];
  desired_work_styles: string[] | null;
  desired_prefectures: string[] | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  transfer_timing: string | null;
  desired_phase: string[] | null;
};

export type ProfilePrefsInput = {
  desired_work_styles: string[] | null;
  desired_prefectures: string[] | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  transfer_timing: string | null;
  desired_phase: string[] | null;
} | null;

export default function WishesTab({
  roles,
  roleAliases = {},
  desiredRoleOptions,
  initialDesiredRoleIds = [],
  initialProfilePrefs = null,
  initialExperiences = [],
  onHasPrefsChange,
  onDirtyChange,
  notifyGlobalSave,
}: {
  roles: RoleItem[];
  roleAliases?: Record<string, string[]>;
  desiredRoleOptions?: RoleItem[];
  initialDesiredRoleIds?: string[];
  initialProfilePrefs?: ProfilePrefsInput;
  /** 社会人経験年数の表示にだけ使う（保存はしない） */
  initialExperiences?: Stint[];
  /** ★保存済みの希望条件から出した値。親の完成度がこれを見る */
  onHasPrefsChange: (hasPrefs: boolean) => void;
  /** 未保存のカードがあるか。親のタブ名の「未保存」印と beforeunload が見る */
  onDirtyChange: (dirty: boolean) => void;
  notifyGlobalSave: (status: "saving" | "saved" | "error") => void;
}) {
  // ── 希望条件 (ow_profiles) state ─────────────────────────────────────────────
  const [prefRoleIds, setPrefRoleIds] = useState<string[]>(initialDesiredRoleIds);
  const [prefWorkStyles, setPrefWorkStyles] = useState<string[]>(initialProfilePrefs?.desired_work_styles ?? []);
  /* 希望勤務地。⚠️ 全部外したときは **null**（空配列にしない）。
     API 側も `uniq.length > 0 ? uniq : null` で null に倒しており、
     片方だけ空配列だと「未設定」の判定が列ごとに割れる。 */
  const [prefPrefectures, setPrefPrefectures] = useState<string[]>(initialProfilePrefs?.desired_prefectures ?? []);
  const [prefSalaryMin, setPrefSalaryMin] = useState(initialProfilePrefs?.desired_salary_min?.toString() ?? "");
  const [prefSalaryMax, setPrefSalaryMax] = useState(initialProfilePrefs?.desired_salary_max?.toString() ?? "");
  const [prefTiming, setPrefTiming] = useState(initialProfilePrefs?.transfer_timing ?? "");
  const [prefPhase, setPrefPhase] = useState<string[]>(initialProfilePrefs?.desired_phase ?? []);
  /* カードごとの保存状態。★1つにまとめない。まとめると、あるカードを保存したときに
     全カードのフッターが「保存しました」になる。 */
  const [prefCardState, setPrefCardState] = useState<Record<PrefCardKey, PrefCardState>>({
    roles:    { saving: false, saved: false, error: null },
    location: { saving: false, saved: false, error: null },
    salary:   { saving: false, saved: false, error: null },
    phase:    { saving: false, saved: false, error: null },
  });
  const prefSavedTimers = useRef<Partial<Record<PrefCardKey, ReturnType<typeof setTimeout>>>>({});

  /* 希望条件の**保存済みスナップショット**。入力中の state（pref*）とは別に持つ。
     ⚠️ 完成度はここからしか計算しない（2026-08-15）。入力中の state から出すと
        「保存していないのに % が上がる」ことになる。savePrefCard が成功したときだけ更新する。 */
  const [savedPrefs, setSavedPrefs] = useState<SavedPrefs>({
    desired_role_ids:    initialDesiredRoleIds,
    desired_work_styles: initialProfilePrefs?.desired_work_styles ?? null,
    desired_prefectures: initialProfilePrefs?.desired_prefectures ?? null,
    desired_salary_min:  initialProfilePrefs?.desired_salary_min ?? null,
    desired_salary_max:  initialProfilePrefs?.desired_salary_max ?? null,
    transfer_timing:     initialProfilePrefs?.transfer_timing ?? null,
    desired_phase:       initialProfilePrefs?.desired_phase ?? null,
  });

  /* カードごとの未保存判定。★配列は順序を無視して比べる（選ぶ順で dirty にしない）。 */
  const sameSet = (a: string[] | null | undefined, b: string[] | null | undefined) =>
    JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());

  const prefCardDirty: Record<PrefCardKey, boolean> = {
    roles:    !sameSet(prefRoleIds, savedPrefs.desired_role_ids),
    location:
      !sameSet(prefPrefectures, savedPrefs.desired_prefectures) ||
      !sameSet(prefWorkStyles, savedPrefs.desired_work_styles) ||
      (prefTiming || null) !== savedPrefs.transfer_timing,
    salary:
      (prefSalaryMin ? parseInt(prefSalaryMin, 10) : null) !== savedPrefs.desired_salary_min ||
      (prefSalaryMax ? parseInt(prefSalaryMax, 10) : null) !== savedPrefs.desired_salary_max,
    phase:    !sameSet(prefPhase, savedPrefs.desired_phase),
  };

  /* 希望条件が1つでも入っているか。**判定は completion.ts の1本に寄せる。**
     こことタブ完了ドットと /mypage で式が分かれると完成度がずれる（2026-08-07）。 */
  const hasPrefs = hasCareerPreferences({
    desiredRoleCount:    savedPrefs.desired_role_ids.length,
    desired_work_styles: savedPrefs.desired_work_styles,
    desired_prefectures: savedPrefs.desired_prefectures,
    desired_salary_min:  savedPrefs.desired_salary_min,
    desired_salary_max:  savedPrefs.desired_salary_max,
    transfer_timing:     savedPrefs.transfer_timing,
    desired_phase:       savedPrefs.desired_phase,
  });

  /** role_id → 職種名。希望職種チップの表示に使う */
  const roleNameById = useMemo(
    () => new Map(roles.map((r) => [r.id, r.name])),
    [roles]
  );

  /* ⚠️ 選択肢から外した値（"flexible"）を今持っている人には足し戻す。
        出さないと画面から消えたまま保存され続け、別項目を保存した拍子に失われる。 */
  const workStyleOptions = useMemo<CheckPillOption[]>(() => {
    const base: CheckPillOption[] = DESIRED_WORK_STYLES.map((o) => ({ value: o.value, label: o.label }));
    const known = new Set(base.map((o) => o.value));
    const extra = prefWorkStyles
      .filter((v) => !known.has(v))
      .map((v) => ({ value: v, label: v, legacy: true }));
    return [...base, ...extra];
  }, [prefWorkStyles]);
  // ── 社会人経験年数（職歴から自動計算・表示のみ）──────────────────────────
  // ⚠️ 職歴が0件なら null。呼び出し側は項目ごと非表示にする（「0年」と出さない）。
  // ⚠️ initialExperiences は SSR 時点のスナップショット。職歴を追加しても
  //    再読み込みまでこの年数は変わらない（**再取得はしていない**）。
  //    完成度のほうは CareerHistoryEditor から件数を受け取って追随する（savedExperienceCount）。
  const oldestCareerStart = useMemo(() => {
    const starts = initialExperiences.map((e) => e.startedAt).filter(Boolean);
    return starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  }, [initialExperiences]);
  const totalExperience = useMemo(
    () => calcTotalExperience(initialExperiences.map((e) => e.startedAt)),
    [initialExperiences]
  );

  /* ── 希望条件の保存（★カード単位のボタン保存。2026-08-15 に自動保存をやめた）──────
        以前は1項目触るたびに PUT していた。他のカード（基本情報・SNS）はボタン保存なので、
        同じ画面で作法が2つあることになり、「押さないと保存されないのか」が読めなかった。

     ⚠️ 送る内容の変換（[] や "" を null にする）は**呼び出し側で揃える**。
        API 側も null に倒すが、列ごとに扱いが割れているので手前で揃える。 */
  const buildPrefPatch = useCallback((card: PrefCardKey): Record<string, unknown> => {
    switch (card) {
      case "roles":
        return { desired_role_ids: prefRoleIds };
      case "location":
        return {
          desired_prefectures: prefPrefectures.length > 0 ? prefPrefectures : null,
          desired_work_styles: prefWorkStyles,
          transfer_timing:     prefTiming || null,
        };
      case "salary":
        return {
          desired_salary_min: prefSalaryMin ? parseInt(prefSalaryMin, 10) : null,
          desired_salary_max: prefSalaryMax ? parseInt(prefSalaryMax, 10) : null,
        };
      case "phase":
        return { desired_phase: prefPhase.length > 0 ? prefPhase : null };
    }
  }, [prefRoleIds, prefPrefectures, prefWorkStyles, prefTiming, prefSalaryMin, prefSalaryMax, prefPhase]);

  const savePrefCard = useCallback(async (card: PrefCardKey) => {
    const patch = buildPrefPatch(card);
    setPrefCardState((prev) => ({ ...prev, [card]: { saving: true, saved: false, error: null } }));
    notifyGlobalSave("saving");
    try {
      const res = await fetch("/api/jobseeker/career-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        /* ★どの項目が不正かを画面に出す。API は `desired_salary_min は 0〜…` のように
              キー名入りで返すので、丸めずにそのまま見せる。 */
        const json = await res.json().catch(() => null);
        const message = (json && typeof json.error === "string" && json.error)
          || "保存に失敗しました。もう一度お試しください。";
        setPrefCardState((prev) => ({ ...prev, [card]: { saving: false, saved: false, error: message } }));
        notifyGlobalSave("error");
        return;
      }
      /* ⚠️ 成功したときだけスナップショットを進める（完成度はこれだけを見る）。 */
      setSavedPrefs((prev) => ({ ...prev, ...(patch as Partial<SavedPrefs>) }));
      setPrefCardState((prev) => ({ ...prev, [card]: { saving: false, saved: true, error: null } }));
      notifyGlobalSave("saved");
      if (prefSavedTimers.current[card]) clearTimeout(prefSavedTimers.current[card] as ReturnType<typeof setTimeout>);
      prefSavedTimers.current[card] = setTimeout(() => {
        setPrefCardState((prev) => ({ ...prev, [card]: { ...prev[card], saved: false } }));
      }, 3000);
    } catch {
      setPrefCardState((prev) => ({ ...prev, [card]: { saving: false, saved: false, error: "保存に失敗しました。もう一度お試しください。" } }));
      notifyGlobalSave("error");
    }
  }, [buildPrefPatch, notifyGlobalSave]);

  /** 保存していない変更を捨てて、保存済みの値に戻す */
  const cancelPrefCard = useCallback((card: PrefCardKey) => {
    setPrefCardState((prev) => ({ ...prev, [card]: { ...prev[card], error: null } }));
    switch (card) {
      case "roles":
        setPrefRoleIds(savedPrefs.desired_role_ids);
        break;
      case "location":
        setPrefPrefectures(savedPrefs.desired_prefectures ?? []);
        setPrefWorkStyles(savedPrefs.desired_work_styles ?? []);
        setPrefTiming(savedPrefs.transfer_timing ?? "");
        break;
      case "salary":
        setPrefSalaryMin(savedPrefs.desired_salary_min?.toString() ?? "");
        setPrefSalaryMax(savedPrefs.desired_salary_max?.toString() ?? "");
        break;
      case "phase":
        setPrefPhase(savedPrefs.desired_phase ?? []);
        break;
    }
  }, [savedPrefs]);

  /* 保存済み・未保存を親へ返す。★親は state を持たない（保存の単位はこのタブの中） */
  const anyDirty = Object.values(prefCardDirty).some(Boolean);
  useEffect(() => { onHasPrefsChange(hasPrefs); }, [hasPrefs, onHasPrefsChange]);
  useEffect(() => { onDirtyChange(anyDirty); }, [anyDirty, onDirtyChange]);

  return (
          <div style={{ maxWidth: 680 }}>
            {/* why-fill hint */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 14px", borderRadius: 10, marginBottom: 16,
              background: "var(--warm-soft)", border: "1px solid #FDE68A",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#92400E", lineHeight: 1.6 }}>
                希望条件を埋めると、条件に合う企業や求人とのマッチング精度が上がります
              </span>
            </div>
            {/* ⚠️ 保存インジケーターは各カードのフッターに置く（2026-08-15）。
                   タブ上部に1つだと、どのカードが保存されたのか分からない。 */}

            {/* ── 希望職種（複数選択）────────────────────────────────────────
                職歴からは「やってきたこと」しか分からない。**キャリアチェンジ希望は
                ここにしか出ない**ので、希望条件の中で最も重要な項目。
                ⚠️ selectableParent は true。求職者は「営業」のような粗い希望も出したい
                   （求人フォームは false。あちらは求人の職種を1つに定める用途）。 */}
            <FormSection
              title="希望職種"
              desc="複数選べます。企業側の候補者サーチと、あなたへの求人おすすめに使われます。"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <RoleSearchSelect
                  roles={desiredRoleOptions ?? roles}
                  aliases={roleAliases}
                  value=""
                  onSelect={(roleId) => {
                    if (prefRoleIds.includes(roleId)) return;
                    if (prefRoleIds.length >= MAX_DESIRED_ROLES) return;
                    setPrefRoleIds([...prefRoleIds, roleId]);
                  }}
                  selectableParent
                  clearOnSelect
                  disabled={prefRoleIds.length >= MAX_DESIRED_ROLES}
                  placeholder={
                    prefRoleIds.length >= MAX_DESIRED_ROLES
                      ? `希望職種は ${MAX_DESIRED_ROLES} 件までです`
                      : "職種名で検索（例: 法人営業、AE、営業）"
                  }
                  ariaLabel="希望職種を検索して追加"
                />

                {prefRoleIds.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
                    まだ選ばれていません。
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {prefRoleIds.map((id) => (
                      <span
                        key={id}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 8px 6px 12px", borderRadius: 100,
                          background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                          color: "var(--royal)", fontSize: "var(--text-sm)", fontWeight: 600,
                        }}
                      >
                        {roleNameById.get(id) ?? "（不明な職種）"}
                        <button
                          type="button"
                          aria-label={`${roleNameById.get(id) ?? "この職種"} を外す`}
                          onClick={() => setPrefRoleIds(prefRoleIds.filter((r) => r !== id))}
                          style={{
                            border: "none", background: "none", cursor: "pointer",
                            color: "var(--royal)", fontSize: 15, lineHeight: 1, padding: "0 2px",
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <CardSaveFooter
                dirty={prefCardDirty.roles}
                saving={prefCardState.roles.saving}
                justSaved={prefCardState.roles.saved}
                error={prefCardState.roles.error}
                onSave={() => { void savePrefCard("roles"); }}
                onCancel={() => cancelPrefCard("roles")}
              />
            </FormSection>

            {/* ── 社会人経験年数（自動計算・表示のみ）────────────────────────
                入力欄は 2026-08-07 に廃止した。理由は2つ:
                ① API が parseNum() に通していたため "3〜5年" が必ず null に落ち、
                   **選んでも保存されていなかった**
                ② 職歴を入れた人には二重入力になり、食い違ったときどちらが正か決められない
                ⚠️ 職歴が0件なら項目ごと出さない。「0年」と出さないこと。 */}
            {totalExperience && (
              <FormSection
                title="社会人経験年数"
                desc="職歴の最も古い開始日から自動で計算しています。直すには「職歴・学歴」タブの職歴を編集してください。"
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", borderRadius: 10,
                  background: "var(--bg-tint)", border: "1px solid var(--line-soft)",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>
                    {totalExperience.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                    （{formatYmLabel(oldestCareerStart)} から）
                  </span>
                </div>
              </FormSection>
            )}

            <FormSection
              title="希望勤務地・勤務スタイル"
              desc="当てはまるものすべてを選べます。"
            >
              {/* ⚠️ 希望勤務地はモックに合わせて勤務スタイルと同じカードに置く。
                     値は所在地と同じ `PREFECTURES`。よく選ばれる4件を先頭に出す並びも流用する。 */}
              <FormGroup label="希望勤務地">
                <CheckPillGroup
                  ariaLabel="希望勤務地"
                  value={prefPrefectures}
                  options={[...COMMON_PREFECTURES, ...OTHER_PREFECTURES].map((p) => ({ value: p, label: p }))}
                  onChange={setPrefPrefectures}
                />
              </FormGroup>
              <FormGroup label="希望勤務スタイル">
                {/* ⚠️ 複数選べる。「フルリモート希望」と「週2出社まで可」を
                       並べられないと幅が表現できない、というのが作り直しの理由。 */}
                <CheckPillGroup
                  ariaLabel="希望勤務スタイル"
                  value={prefWorkStyles}
                  options={workStyleOptions}
                  onChange={setPrefWorkStyles}
                />
              </FormGroup>
              <FormGroup label="転職検討時期" htmlFor="pe-timing">
                <select
                  id="pe-timing"
                  value={prefTiming}
                  onChange={(e) => setPrefTiming(e.target.value)}
                  style={selectStyle()}
                >
                  <option value="">未設定</option>
                  {TRANSFER_TIMINGS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FormGroup>
              <CardSaveFooter
                dirty={prefCardDirty.location}
                saving={prefCardState.location.saving}
                justSaved={prefCardState.location.saved}
                error={prefCardState.location.error}
                onSave={() => { void savePrefCard("location"); }}
                onCancel={() => cancelPrefCard("location")}
              />
            </FormSection>

            <FormSection
              title="希望年収"
              desc="非公開にしたい場合は未入力のままにしてください。入力した場合は企業側に表示されます。"
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <FormGroup label="希望年収（下限）" htmlFor="pe-salary-min">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <input
                      id="pe-salary-min"
                      type="number"
                      value={prefSalaryMin}
                      onChange={(e) => setPrefSalaryMin(e.target.value)}
                      placeholder="例: 600"
                      min={0}
                      max={SALARY_MAX_MAN}
                      style={{ ...inputStyle(), width: "100%" }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                  </div>
                </FormGroup>
                <FormGroup label="希望年収（上限）" htmlFor="pe-salary-max">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <input
                      id="pe-salary-max"
                      type="number"
                      value={prefSalaryMax}
                      onChange={(e) => setPrefSalaryMax(e.target.value)}
                      placeholder="例: 900"
                      min={0}
                      max={SALARY_MAX_MAN}
                      style={{ ...inputStyle(), width: "100%" }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                  </div>
                </FormGroup>
              </div>
              {prefSalaryMin && prefSalaryMax && parseInt(prefSalaryMin) > parseInt(prefSalaryMax) && (
                <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>下限が上限を超えています
                </div>
              )}
              <CardSaveFooter
                dirty={prefCardDirty.salary}
                saving={prefCardState.salary.saving}
                justSaved={prefCardState.salary.saved}
                error={prefCardState.salary.error}
                onSave={() => { void savePrefCard("salary"); }}
                onCancel={() => cancelPrefCard("salary")}
              />
            </FormSection>

            <FormSection
              title="興味のある企業フェーズ"
              desc="どのステージの企業に関心がありますか？複数選択できます。"
            >
              <CheckPillGroup
                ariaLabel="興味のある企業フェーズ"
                value={prefPhase}
                options={DESIRED_PHASES.map((p) => ({ value: p, label: p }))}
                onChange={setPrefPhase}
              />
              <CardSaveFooter
                dirty={prefCardDirty.phase}
                saving={prefCardState.phase.saving}
                justSaved={prefCardState.phase.saved}
                error={prefCardState.phase.error}
                onSave={() => { void savePrefCard("phase"); }}
                onCancel={() => cancelPrefCard("phase")}
              />
            </FormSection>

            {/* ⚠️ 「今一番の悩み」（`ow_profiles.worry`）は 2026-08-17 に撤去した。
                   読み手が1つも無かった（マッチング・スカウト・企業側・運営画面のどこも見ていない）。
                   **列とデータは残してある。** 詳細は docs/todo.md。 */}

            <div style={{
              padding: "14px 18px", background: "var(--royal-50)",
              border: "1px solid var(--royal-100)", borderRadius: 10,
              fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.7,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 4, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <strong style={{ color: "var(--royal)" }}>希望条件は企業側に公開されます。</strong>
              条件に合う企業からスカウトが届きやすくなります。
            </div>
          </div>
  );
}
