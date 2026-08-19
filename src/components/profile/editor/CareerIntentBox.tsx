"use client";

import { useCallback, useMemo, useState } from "react";
import { ProfileEditModal } from "./ProfileEditModal";
import { CollapsibleRow, FormGroup, selectStyle, inputStyle } from "./formKit";
import { PencilIcon } from "@/components/profile/view/RowActions";
import { CheckPillGroup, type CheckPillOption } from "@/components/ui/CheckPillGroup";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import { PROFILE_VISIBILITY_OPTIONS } from "@/lib/constants/profileVisibility";
import {
  DESIRED_WORK_STYLES, TRANSFER_TIMINGS, DESIRED_PHASES, SALARY_MAX_MAN,
} from "@/lib/constants/careerPreferences";
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";

/**
 * ヘッダー直下の「転職の希望」ボックス（2026-08-17 / フェーズ4-2）。
 *
 * ── なぜ作ったか ─────────────────────────────────────────────────────────────
 * 「転職の希望」と「設定」はタブだった。タブは**開かないと中身が分からない**ので、
 * 公開範囲やスカウトの現在値を確かめるだけでもタブを行き来する必要があった。
 * 要約をヘッダーの直下に常設し、直すのは ✎ からモーダル、という形に変える。
 *
 * ⚠️ **要約は値そのものを短く出す。** 「設定済み」「未設定」のような抽象語にしない。
 *    現在値が読めないなら、要約を置く意味が無い。
 *
 * ⚠️ **API の呼び方は変えない**（3系統のまま）。
 *    | 系統 | 何を保存するか |
 *    |---|---|
 *    | `PUT /api/jobseeker/profile` | 公開範囲・転職検討状況 |
 *    | ~~`PUT /api/jobseeker/scout-settings`~~ | **2026-08-20 に右カラムの StanceCard へ移した** |
 *    | `PUT /api/jobseeker/career-preferences` | 希望職種・勤務地・勤務スタイル・時期・年収・フェーズ |
 *
 * ⚠️ ★**1回の「保存」で3系統を呼ぶ。失敗しても成功したものは残す。**
 *    巻き戻さない理由は2つ。①巻き戻しも書き込みなので同じように失敗しうる、
 *    ②列は系統ごとに独立していて、片方だけ保存された状態が壊れた状態ではない。
 *    失敗したら**どの系統が失敗したかを名指しでフッターに出し、モーダルは開いたまま**にする。
 *    もう一度「保存」を押すと全系統を送り直す（同じ値の再送は無害）。
 */

export type IntentPrefs = {
  desired_role_ids: string[];
  desired_prefectures: string[] | null;
  desired_work_styles: string[] | null;
  transfer_timing: string | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  desired_phase: string[] | null;
};

type Visibility = "public" | "login_only" | "private";

const MAX_DESIRED_ROLES = 5;

/** 要約の1行。⚠️ 値そのものを出す */
function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
      <span style={{ flexShrink: 0, width: 84, fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 600, minWidth: 0,
        color: muted ? "var(--ink-mute)" : "var(--ink)",
      }}>{value}</span>
    </div>
  );
}

export default function CareerIntentBox({
  initialVisibility, initialIsOpenToWork,
  initialPrefs, roles, roleAliases, desiredRoleOptions,
  onVisibilityChange,
}: {
  initialVisibility: Visibility;
  initialIsOpenToWork: boolean;
  /* ⚠️ `initialScoutEnabled` は 2026-08-20 に外した。スカウトの可否は
        右カラムの `StanceCard` が `ow_profiles.scout_enabled` を直接持つ。
        **ここに戻すと同じ列を触る画面が2つになる。** */
  initialPrefs: IntentPrefs;
  roles: { id: string; name: string; parent_id: string | null; display_order: number }[];
  roleAliases: Record<string, string[]>;
  desiredRoleOptions?: { id: string; name: string; parent_id: string | null; display_order: number }[];
  /** 保存できた公開範囲を親へ返す（写真カードのプレビュー等が見る） */
  onVisibilityChange?: (v: Visibility) => void;
}) {
  /* ★保存済みの値。要約はここだけを見る（ルール⑦） */
  const [saved, setSaved] = useState({
    visibility: initialVisibility,
    isOpenToWork: initialIsOpenToWork,
    prefs: initialPrefs,
  });

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 編集中の値 */
  const [visibility, setVisibility] = useState<Visibility>(saved.visibility);
  const [isOpenToWork, setIsOpenToWork] = useState(saved.isOpenToWork);
  const [roleIds, setRoleIds] = useState<string[]>(saved.prefs.desired_role_ids);
  const [prefectures, setPrefectures] = useState<string[]>(saved.prefs.desired_prefectures ?? []);
  const [workStyles, setWorkStyles] = useState<string[]>(saved.prefs.desired_work_styles ?? []);
  const [timing, setTiming] = useState(saved.prefs.transfer_timing ?? "");
  const [salaryMin, setSalaryMin] = useState(saved.prefs.desired_salary_min?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(saved.prefs.desired_salary_max?.toString() ?? "");
  const [phase, setPhase] = useState<string[]>(saved.prefs.desired_phase ?? []);

  const roleNameById = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);

  /* ⚠️ 選択肢から外した値を今持っている人には足し戻す。
        出さないと画面から消えたまま保存され続け、別項目を保存した拍子に失われる。 */
  const workStyleOptions = useMemo<CheckPillOption[]>(() => {
    const base: CheckPillOption[] = DESIRED_WORK_STYLES.map((o) => ({ value: o.value, label: o.label }));
    const known = new Set(base.map((o) => o.value));
    return [...base, ...workStyles.filter((v) => !known.has(v)).map((v) => ({ value: v, label: v, legacy: true }))];
  }, [workStyles]);

  /** 開き直したときに保存済みの値へ戻す（ルール⑦） */
  const resetToSaved = useCallback(() => {
    setVisibility(saved.visibility);
    setIsOpenToWork(saved.isOpenToWork);
    setRoleIds(saved.prefs.desired_role_ids);
    setPrefectures(saved.prefs.desired_prefectures ?? []);
    setWorkStyles(saved.prefs.desired_work_styles ?? []);
    setTiming(saved.prefs.transfer_timing ?? "");
    setSalaryMin(saved.prefs.desired_salary_min?.toString() ?? "");
    setSalaryMax(saved.prefs.desired_salary_max?.toString() ?? "");
    setPhase(saved.prefs.desired_phase ?? []);
    setError(null);
  }, [saved]);

  /* ── 変更の有無を**系統ごと**に持つ。保存で呼ぶのは変わった系統だけ ────────── */
  const profileDirty = visibility !== saved.visibility || isOpenToWork !== saved.isOpenToWork;
  const prefsPatch = useMemo(() => ({
    desired_role_ids:    roleIds,
    desired_prefectures: prefectures.length > 0 ? prefectures : null,
    desired_work_styles: workStyles,
    transfer_timing:     timing || null,
    desired_salary_min:  salaryMin ? parseInt(salaryMin, 10) : null,
    desired_salary_max:  salaryMax ? parseInt(salaryMax, 10) : null,
    desired_phase:       phase.length > 0 ? phase : null,
  }), [roleIds, prefectures, workStyles, timing, salaryMin, salaryMax, phase]);
  const prefsDirty = JSON.stringify(prefsPatch) !== JSON.stringify({
    desired_role_ids:    saved.prefs.desired_role_ids,
    desired_prefectures: saved.prefs.desired_prefectures,
    desired_work_styles: saved.prefs.desired_work_styles ?? [],
    transfer_timing:     saved.prefs.transfer_timing,
    desired_salary_min:  saved.prefs.desired_salary_min,
    desired_salary_max:  saved.prefs.desired_salary_max,
    desired_phase:       saved.prefs.desired_phase,
  });
  const dirty = profileDirty || prefsDirty;

  const handleSave = useCallback(() => {
    void (async () => {
      setSaving(true);
      setError(null);
      const failed: string[] = [];
      /* ★系統ごとに独立して保存する。**失敗しても成功したものは残す。** */
      const next = { ...saved };

      if (profileDirty) {
        try {
          const res = await fetch("/api/jobseeker/profile", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visibility, is_open_to_work: isOpenToWork }),
          });
          if (!res.ok) throw new Error();
          next.visibility = visibility;
          next.isOpenToWork = isOpenToWork;
          onVisibilityChange?.(visibility);
        } catch { failed.push("公開範囲・転職検討状況"); }
      }

      if (prefsDirty) {
        try {
          const res = await fetch("/api/jobseeker/career-preferences", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(prefsPatch),
          });
          if (!res.ok) {
            /* ★API はキー名入りの文言を返す（例: `desired_salary_min は 0〜…`）。丸めない */
            const json = await res.json().catch(() => null);
            throw new Error((json && typeof json.error === "string" && json.error) || "");
          }
          next.prefs = {
            desired_role_ids:    prefsPatch.desired_role_ids,
            desired_prefectures: prefsPatch.desired_prefectures,
            desired_work_styles: prefsPatch.desired_work_styles,
            transfer_timing:     prefsPatch.transfer_timing,
            desired_salary_min:  prefsPatch.desired_salary_min,
            desired_salary_max:  prefsPatch.desired_salary_max,
            desired_phase:       prefsPatch.desired_phase,
          };
        } catch (e) {
          const msg = e instanceof Error && e.message ? `希望条件（${e.message}）` : "希望条件";
          failed.push(msg);
        }
      }

      setSaved(next);
      setSaving(false);

      if (failed.length > 0) {
        /* ⚠️ **閉じない。** 直せる状態のまま残す。成功した系統は `saved` に入っているので、
              もう一度押しても送り直されるのは失敗した系統だけになる。 */
        setError(`${failed.join(" / ")}の保存に失敗しました。もう一度お試しください。`);
        return;
      }
      setJustSaved(true);
      setTimeout(() => { setJustSaved(false); setOpen(false); }, 800);
    })();
  }, [saved, profileDirty, prefsDirty, visibility, isOpenToWork, prefsPatch, onVisibilityChange]);

  /* ── 文言。★値そのものを出す ─────────────────────────────────────────────
        ⚠️ **ボックスの要約は「保存済みの値」、モーダルの行は「編集中の値」**を出す。
           モーダルの中で保存済みを出すと、いま選んだのと違う値が畳んだ行に残り、
           **選んだはずの値が消えたように見える**（実測で踏んだ）。 */
  const visLabel = (v: Visibility) => PROFILE_VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v;
  /* ★否定形をやめた（2026-08-20 / B-3）。**列は触っていない**。`is_open_to_work` の
        true/false に対する**表示文言だけ**を変えている。
     ⚠️ 「いまは考えていない」は、サービス側から「あなたは対象外です」と言っているのと同じ。
        OPINIO は転職しない人も主役なので、同じ状態を**参加している言葉**で書く。
     ⚠️ 右カラムの `StanceCard` と**同じ文言**にすること（片方だけ直すとズレる）。 */
  const openToWorkLabel = (b: boolean) => (b ? "積極的に探している" : "情報収集として");

  const visibilityLabel = visLabel(saved.visibility);
  const openToWorkText = openToWorkLabel(saved.isOpenToWork);

  return (
    <div style={{ maxWidth: 680 }}>
      <section style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
        padding: "18px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>転職の希望</span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <button
            type="button"
            className="tap-target tap-target-end"
            onClick={() => { resetToSaved(); setOpen(true); }}
            aria-label="転職の希望を編集"
            title="転職の希望を編集"
            style={{
              fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--royal)",
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", padding: 0,
            }}
          >
            <PencilIcon />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SummaryRow label="公開範囲" value={visibilityLabel} />
                    <SummaryRow label="転職について" value={openToWorkText} muted={!saved.isOpenToWork} />
        </div>
      </section>

      <ProfileEditModal
        open={open}
        title="転職の希望"
        dirty={dirty}
        saving={saving}
        justSaved={justSaved}
        error={error}
        onSave={handleSave}
        onClose={() => { setOpen(false); setError(null); }}
      >
        {/* ★何を開いておくかは**実測で決めた**（375px / 2026-08-17）。
               | 既定 | 行 | 開いたときの高さ |
               |---|---|---|
               | 開く | スカウト設定 | 116px |
               | 開く | 転職検討状況 | 136px |
               | 畳む | 公開範囲 | **397px**（説明が3つとも長い） |
               | 畳む | 希望職種 / 勤務地 / 年収 / フェーズ | 勤務地だけで47個のチェック |

               2つ開いた状態で本文は **547px**。375px の本文枠（約570px）に収まるので
               **スクロールなしで全7行が見える**。3つ開くと 1,009px になり、
               下の4行を見るのにスクロールが要る。
            ⚠️ **畳んでも現在値は行の右に出る**（`state`）。読むために開く必要は無い。 */}
        <CollapsibleRow first label="公開範囲" state={visLabel(visibility)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PROFILE_VISIBILITY_OPTIONS.map((o) => (
              <label key={o.value} style={{
                display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
                padding: "10px 12px", borderRadius: 10,
                border: `1.5px solid ${visibility === o.value ? "var(--royal)" : "var(--line)"}`,
                background: visibility === o.value ? "var(--royal-50)" : "#fff",
              }}>
                <input
                  type="radio" name="intent-visibility" value={o.value}
                  checked={visibility === o.value}
                  onChange={() => setVisibility(o.value)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{o.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 2 }}>{o.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </CollapsibleRow>

        {/* ★「スカウト設定」の行は 2026-08-20 に**右カラムの「声をかけられてもよいか」へ移した**。
               ⚠️ ここに戻さないこと。同じ列（`ow_profiles.scout_enabled`）を触る画面が2つになる。
               ⚠️ 画面に「スカウト」という言葉を出さない方針にも合わせている。 */}

        <CollapsibleRow defaultOpen label="転職検討状況" state={openToWorkLabel(isOpenToWork)}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isOpenToWork}
              onChange={(e) => setIsOpenToWork(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>
              「転職検討中」バッジを表示する
              <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                プロフィールと候補者一覧に出ます。企業が声をかける目安になります。
              </span>
            </span>
          </label>
        </CollapsibleRow>

        <CollapsibleRow label="希望職種" state={roleIds.length > 0 ? `${roleIds.length}件` : "未設定"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <RoleSearchSelect
              roles={desiredRoleOptions ?? roles}
              aliases={roleAliases}
              value=""
              onSelect={(roleId) => {
                if (roleIds.includes(roleId)) return;
                if (roleIds.length >= MAX_DESIRED_ROLES) return;
                setRoleIds([...roleIds, roleId]);
              }}
              selectableParent
              clearOnSelect
              ariaLabel="希望職種を検索"
              disabled={roleIds.length >= MAX_DESIRED_ROLES}
              placeholder={roleIds.length >= MAX_DESIRED_ROLES
                ? `希望職種は ${MAX_DESIRED_ROLES} 件までです`
                : "職種名で検索（例: 法人営業、AE、営業）"}
            />
            {roleIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {roleIds.map((id) => (
                  <span key={id} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: "var(--royal-50)", color: "var(--royal)",
                  }}>
                    {roleNameById.get(id) ?? id}
                    <button
                      type="button"
                      onClick={() => setRoleIds(roleIds.filter((r) => r !== id))}
                      aria-label={`${roleNameById.get(id) ?? id} を外す`}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontSize: 13, lineHeight: 1 }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CollapsibleRow>

        <CollapsibleRow
          label="希望勤務地・勤務スタイル"
          state={[
            prefectures.length > 0 ? `勤務地${prefectures.length}件` : null,
            workStyles.length > 0 ? `スタイル${workStyles.length}件` : null,
          ].filter(Boolean).join(" / ") || "未設定"}
        >
          <FormGroup label="希望勤務地">
            <CheckPillGroup
              ariaLabel="希望勤務地"
              value={prefectures}
              options={[...COMMON_PREFECTURES, ...OTHER_PREFECTURES].map((p) => ({ value: p, label: p }))}
              onChange={setPrefectures}
            />
          </FormGroup>
          <FormGroup label="希望勤務スタイル">
            <CheckPillGroup
              ariaLabel="希望勤務スタイル"
              value={workStyles}
              options={workStyleOptions}
              onChange={setWorkStyles}
            />
          </FormGroup>
          <FormGroup label="転職検討時期" htmlFor="intent-timing">
            <select id="intent-timing" value={timing} onChange={(e) => setTiming(e.target.value)} style={selectStyle()}>
              <option value="">未設定</option>
              {TRANSFER_TIMINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormGroup>
        </CollapsibleRow>

        <CollapsibleRow
          label="希望年収"
          state={salaryMin || salaryMax ? `${salaryMin || "—"}〜${salaryMax || "—"}万円` : "未設定"}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <FormGroup label="下限（万円）" htmlFor="intent-salary-min">
              <input
                id="intent-salary-min" type="number" min={0} max={SALARY_MAX_MAN}
                value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="例：600" style={inputStyle()}
              />
            </FormGroup>
            <FormGroup label="上限（万円）" htmlFor="intent-salary-max">
              <input
                id="intent-salary-max" type="number" min={0} max={SALARY_MAX_MAN}
                value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="例：900" style={inputStyle()}
              />
            </FormGroup>
          </div>
        </CollapsibleRow>

        <CollapsibleRow label="興味のある企業フェーズ" state={phase.length > 0 ? `${phase.length}件` : "未設定"}>
          <CheckPillGroup
            ariaLabel="興味のある企業フェーズ"
            value={phase}
            options={DESIRED_PHASES.map((p) => ({ value: p, label: p }))}
            onChange={setPhase}
          />
        </CollapsibleRow>
      </ProfileEditModal>
    </div>
  );
}
