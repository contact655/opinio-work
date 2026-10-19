"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { TeamMember } from "@/lib/business/jobs";
import Link from "next/link";
import type { BizJob } from "@/lib/business/mockJobs";
import { JobEditSubNav, type EditStep, type StepStatus } from "./JobEditSubNav";
import { missingForPublish, isPublishRequired, requirementsFor, type PublishRequirement } from "@/lib/jobs/publishRequirements";
import {
  CONTRACT_PERIODS, CONTRACT_RENEWALS, WORKPLACE_CHANGE_SCOPES, DUTIES_CHANGE_SCOPES, YES_NO,
  SOCIAL_INSURANCES, SMOKING_MEASURES, EMPTY_LABOR_TERMS, type LaborTerms,
} from "@/lib/jobs/laborTerms";
import { checkWording, wordingFieldsFromForm } from "@/lib/jobs/wordingCheck";
import { decidePublish, wordingRequirements, COMPANY_NOT_LISTED_MESSAGE, POST_PUBLISH_NOTE } from "@/lib/jobs/publishGate";
import { jobState } from "@/lib/jobs/jobState";
import { RequirementsTagInput } from "./RequirementsTagInput";
import { ProcessStepsEditor } from "./ProcessStepsEditor";
import { BUSINESS_MODELS } from "@/lib/constants/businessModels";
import { JOB_EMPLOYMENT_TYPES } from "@/lib/constants/careerOptions";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";
import { payLabel } from "@/lib/utils/salary";
import { SALES_SEGMENTS, SALES_HUNTER_FARMER_OPTIONS } from "@/lib/constants/salesFields";
import { TECH_STACK_CATEGORIES } from "@/lib/techStack";
import { JOB_EXPERIENCE_YEARS, JOB_POSITION_LEVELS } from "@/lib/constants/jobFit";
import { JobInternalNote } from "@/components/business/JobInternalNote";
import { flattenTree } from "@/lib/business/orgTree";

// ─── 定数 ───────────────────────────────────────────────────────────────────

// ⚠️ 雇用形態はここに直書きしない。API の検証と DB の CHECK と同じ定数を見る
const DURATION_OPTIONS = ["応相談", "1ヶ月以内", "3ヶ月以内", "半年以内"];

/* ⚠️★**`MOCK_TEAM`（架空の3人）は 2026-09-18 に削除した。戻さないこと。**
      `teamMembers ?? MOCK_TEAM` というフォールバックだったが、
      **`??` は `[]` では発火しない**ので実際には一度も出ていなかった。
      ⚠️★**出ていたら、そのほうが悪かった。** id が `member-1`〜`3` の実在しない人で、
         保存側（`POST/PUT /api/biz/jobs`）は
         `assigneeIds.filter((uid) => validIds.has(uid))` で**黙って捨てる**。
         企業は担当者を選べたつもりで、**何も保存されない**
         （CLAUDE.md「入力させたのに保存しない UI を作らない」）。
      → 0件のときは**架空の人ではなく空状態**を出し、メンバーと権限へ送る。 */

/* ★入力のステップ（2026-10-11 に並べ直した）。⚠️ `lib/business/jobEditSections.ts` と揃える */
const STEP_DEFS = [
  { id: "job",          label: "何の仕事か" },
  { id: "conditions",   label: "条件" },
  { id: "requirements", label: "求める人" },
  { id: "process",      label: "選考の進め方" },
  { id: "more",         label: "さらに伝える" },
  { id: "review",       label: "確認して公開" },
] as const;
type StepId = (typeof STEP_DEFS)[number]["id"];

/* ★使う技術を出す職種の大分類（それ以外の職種では出さない。既に値がある求人では出す） */
const TECH_ROOT_NAMES = ["エンジニア", "データ・AI", "デザイナー"];

type FormMode = "new" | "edit";

type FormState = {
  title: string;
  employmentType: string;
  jobCategory: string;
  department: string;
  salaryMin: string;
  salaryMax: string;
  /** ★報酬・給与が「要相談」（2026-10-10）。true のとき金額は送らない */
  salaryNegotiable: boolean;
  salaryNote: string;
  location: string;
  remoteWorkStatus: string;
  probationPeriod: string;
  workHours: string;
  holidays: string;
  descriptionMarkdown: string;
  messageToCandidates: string;
  requiredSkills: string[];
  preferredSkills: string[];
  cultureFit: string;
  selectionSteps: string[];
  selectionDuration: string;
  startDatePreference: string;
  assigneeIds: string[];
  urgency: "open" | "hot";
  whyHire: string;
  teamComposition: string;
  first90Days: string;
  businessModel: string;
  // セールス職専用項目 (Migration 212)
  oteMin: string;
  oteMax: string;
  salesSegment: string[];
  salesHunterFarmer: string;
  incentiveNote: string;
  // 技術スタック (Migration 245)
  techStack: string[];
  /** 自社での呼び方。ow_company_job_roles に溜まる（表示専用。検索は標準職種のまま） */
  companyRoleName: string;
  /** ★この職種の経験年数（"" = 未入力 / "0" = 不問 / "3" = 3年以上）。2026-10-12 */
  requiredExperienceYears: string;
  /** ★ポジションのレベル（"" = 未入力。値は RANKS）。2026-10-12 */
  positionLevel: string;
  /** ★労働条件（2026-10-11）。API には `laborTerms` のまま送る（lib/jobs/laborTerms.ts） */
  laborTerms: LaborTerms;
};

function jobToForm(job: BizJob | null): FormState {
  if (!job) return {
    title: "", employmentType: "正社員", jobCategory: "", department: "",
    salaryMin: "", salaryMax: "", salaryNegotiable: false, salaryNote: "", location: "", remoteWorkStatus: "",
    probationPeriod: "", workHours: "", holidays: "",
    descriptionMarkdown: "", messageToCandidates: "",
    requiredSkills: [], preferredSkills: [], cultureFit: "",
    selectionSteps: ["書類選考", "カジュアル面談", "1次面接", "最終面接"],
    selectionDuration: "", startDatePreference: "応相談", assigneeIds: [], urgency: "open",
    whyHire: "", teamComposition: "", first90Days: "", businessModel: "",
    oteMin: "", oteMax: "", salesSegment: [], salesHunterFarmer: "", incentiveNote: "",
    techStack: [], companyRoleName: "", requiredExperienceYears: "", positionLevel: "", laborTerms: { ...EMPTY_LABOR_TERMS },
  };
  return {
    title: job.title,
    employmentType: job.employmentType,
    jobCategory: job.jobCategory,
    department: job.department ?? "",
    salaryMin: job.salaryMin?.toString() ?? "",
    salaryMax: job.salaryMax?.toString() ?? "",
    salaryNegotiable: job.salaryNegotiable === true,
    salaryNote: job.salaryNote ?? "",
    location: job.location ?? "",
    remoteWorkStatus: job.remoteWorkStatus ?? "",
    probationPeriod: job.probationPeriod ?? "",
    workHours: job.workHours ?? "",
    holidays: job.holidays ?? "",
    descriptionMarkdown: job.descriptionMarkdown ?? "",
    messageToCandidates: job.messageToCandidates ?? "",
    requiredSkills: [...job.requiredSkills],
    preferredSkills: [...job.preferredSkills],
    cultureFit: job.cultureFit ?? "",
    selectionSteps: [...job.selectionSteps],
    selectionDuration: job.selectionDuration ?? "",
    startDatePreference: job.startDatePreference ?? "応相談",
    /* ⚠️ `job.assigneeNames` は `lib/business/jobs.ts` が**常に `[]`** を入れる
          （実体は `initialAssigneeIds` で別途渡ってきて、下の `useState` が上書きする）。
          2026-09-18 まで MOCK_TEAM の並び順から偽の id を作っていたが、
          **`assigneeNames` が空なので結果は常に `[]`** で、死んだコードだった。 */
    assigneeIds: [],
    urgency: job.urgency ?? "open",
    /* ⚠️ 2026-09-02 まで `as unknown as { why_hire?: string }` で**スネークケースの
          プロパティを読もうとしており、`BizJob` には存在しないので常に undefined** だった。
          キャストは型検査を素通りさせるので tsc も lint も何も言わない。
          **キャストで別名を読むくらいなら、型に足すこと。** */
    whyHire: job.whyHire ?? "",
    teamComposition: job.teamComposition ?? "",
    first90Days: job.first90Days ?? "",
    businessModel: job.businessModel ?? "",
    oteMin: job.oteMin?.toString() ?? "",
    oteMax: job.oteMax?.toString() ?? "",
    salesSegment: job.salesSegment ?? [],
    salesHunterFarmer: job.salesHunterFarmer ?? "",
    incentiveNote: job.incentiveNote ?? "",
    techStack: job.techStack ?? [],
    requiredExperienceYears: job.requiredExperienceYears == null ? "" : String(job.requiredExperienceYears),
    positionLevel: job.positionLevel ?? "",
    // ⚠️ 呼称は BizJob に載っていない。ページ側から initialCompanyRoleName で入れる
    companyRoleName: "",
    laborTerms: job.laborTerms ? { ...job.laborTerms } : { ...EMPTY_LABOR_TERMS },
  };
}

// ─── サブコンポーネント ──────────────────────────────────────────────────────

/* ★「必須」の印は公開に必要な項目（`lib/jobs/publishRequirements.ts`）にだけ付ける（2026-10-11）。
      ⚠️ それ以外には「任意」の印も付けない。印と実際の条件が食い違うと、表示が嘘になる。 */
function FormLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
      {children}
      {required && <span style={{ color: "var(--error)", fontSize: 12, fontWeight: 600 }}>必須</span>}
    </label>
  );
}

function FormInput({ value, onChange, placeholder, type = "text", id, required, list }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; id?: string; required?: boolean; list?: string }) {
  return (
    <input
      id={id}
      list={list}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      style={{
        width: "100%", padding: "10px 12px",
        border: "1.5px solid var(--line)", borderRadius: 8,
        fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
        background: "#fff", transition: "all 0.15s", outline: "none",
      }}
      onFocus={(e) => { e.target.style.borderColor = "var(--royal)"; e.target.style.boxShadow = "0 0 0 3px var(--royal-50)"; }}
      onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
    />
  );
}

/** options は文字列（value=label）でも {value,label} でも渡せる。
    ⚠️ DB の値と表示ラベルが違う項目は必ず {value,label} で渡すこと。 */
function FormSelect({ value, onChange, options, id }: { value: string; onChange: (v: string) => void; options: readonly (string | { value: string; label: string })[]; id?: string }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "10px 32px 10px 12px",
        border: "1.5px solid var(--line)", borderRadius: 8,
        fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
        background: "#fff", cursor: "pointer", appearance: "none", outline: "none",
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
      }}
      onFocus={(e) => { e.target.style.borderColor = "var(--royal)"; e.target.style.boxShadow = "0 0 0 3px var(--royal-50)"; }}
      onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
    >
      <option value="">選択してください</option>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

function FormTextarea({ value, onChange, placeholder, rows = 5, maxLength, ariaLabel, id }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; maxLength?: number; ariaLabel?: string; id?: string }) {
  const nearLimit = maxLength ? value.length >= maxLength * 0.9 : false;
  const atLimit = maxLength ? value.length >= maxLength : false;
  return (
    <div style={{ position: "relative" }}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-label={ariaLabel}
        style={{
          width: "100%", padding: "10px 12px",
          paddingBottom: maxLength ? "26px" : "10px",
          border: "1.5px solid var(--line)", borderRadius: 8,
          fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
          background: "#fff", resize: "vertical", lineHeight: 1.8,
          minHeight: rows * 24 + 20, outline: "none", transition: "all 0.15s",
          boxSizing: "border-box",
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--royal)"; e.target.style.boxShadow = "0 0 0 3px var(--royal-50)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
      />
      {maxLength && (
        <span style={{
          position: "absolute", bottom: 6, right: 10,
          fontSize: 12,
          color: atLimit ? "var(--error)" : nearLimit ? "var(--warm-ink)" : "var(--ink-mute)",
          fontWeight: nearLimit ? 600 : 400, pointerEvents: "none",
          fontFamily: "var(--font-inter), var(--font-noto)",
        }}>
          {value.length} / {maxLength}
        </span>
      )}
    </div>
  );
}

function FormSection({ title, desc, children }: { title?: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="jef-card" style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, marginBottom: 18,
    }}>
      {/* ⚠️ 入力欄が1つだけの枠には見出しを付けない（ラベルと同じ言葉が2回並ぶ） */}
      {title && (
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: desc ? 6 : 18 }}>
          {title}
        </div>
      )}
      {desc && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 18, lineHeight: 1.7 }}>{desc}</div>}
      {children}
    </div>
  );
}

function MoreGroup({ title, filled, children }: { title: string; filled: boolean; children: React.ReactNode }) {
  return (
    <details className="jef-more" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 10 }}>
      <summary style={{ padding: "14px 18px", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
        {filled && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--success-ink)" }}>入力済み</span>}
        {/* ⚠️ 記号を CSS の content で出さない（style の中の引用符はハイドレーションを壊す。ui-conventions） */}
        <span aria-hidden="true" className="jef-more-plus" style={{ color: "var(--ink-mute)", fontWeight: 400 }}>＋</span>
        <span aria-hidden="true" className="jef-more-minus" style={{ color: "var(--ink-mute)", fontWeight: 400 }}>−</span>
      </summary>
      <div style={{ padding: "0 18px 18px" }}>{children}</div>
    </details>
  );
}

/** 選択肢をチップで並べる（もう一度押すと外せる）。⚠️ options は laborTerms.ts の定数を渡す */
function ChoiceChips({ id, options, value, onChange }: { id?: string; options: readonly { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div id={id} role="group" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} type="button" aria-pressed={active} onClick={() => onChange(active ? "" : o.value)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontFamily: "inherit", fontSize: 13, cursor: "pointer",
              border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
              background: active ? "var(--royal-50)" : "#fff",
              color: active ? "var(--royal)" : "var(--ink-soft)", fontWeight: active ? 700 : 400,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FormGroup({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 18, ...style }}>{children}</div>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.7 }}>{children}</div>;
}

// ─── メインコンポーネント ────────────────────────────────────────────────────

export type RoleItem = { id: string; parent_id: string | null; name: string; level: number };
/** role_id → 別名。検索でヒットさせるために使う（ow_role_aliases） */
export type RoleAliasMap = Record<string, string[]>;
type SelectedRole = { roleId: string; isPrimary: boolean };

export type DeptItem = { id: string; parent_id: string | null; name: string };

type Props = {
  /**
   * ★最初に開くステップ（2026-09-21）。求人管理の「公開へ」が `review` を渡す。
   * ⚠️ 公開は**この画面の「確認して公開」からだけ**行う。掲載ガイドラインへの同意の一文が
   *    ここにしか無いので、カードの上から直接申請する経路を作らないこと。
   * ⚠️ 値の検証は呼ぶ側（edit/page.tsx）で `lib/business/jobEditSections.ts` と突き合わせる。
   */
  initialSection?: string;
  mode: FormMode;
  initialJob?: BizJob | null;
  initialAssigneeIds?: string[];
  initialJobRoles?: SelectedRole[];
  companyId?: string;
  teamMembers?: TeamMember[];
  roles?: RoleItem[];
  /** 検索でヒットさせる別名。role_id → alias[] */
  roleAliases?: RoleAliasMap;
  departments?: DeptItem[];
  initialDepartmentId?: string | null;
  /** 自社での呼び方の初期値。編集画面でページ側が解決して渡す */
  initialCompanyRoleName?: string;
  /** ★企業ページが公開中（listed）か（2026-10-12）。公開中でなければ求人を公開できない（lib/jobs/publishGate.ts） */
  companyListed?: boolean;
};

export function JobEditForm({
  mode,
  initialJob = null,
  initialAssigneeIds,
  initialJobRoles = [],
  companyId,
  teamMembers,
  roles = [],
  roleAliases = {},
  departments = [],
  initialDepartmentId = null,
  initialCompanyRoleName = "",
  initialSection = "job",
  companyListed = false,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => {
    const base = { ...jobToForm(initialJob), companyRoleName: initialCompanyRoleName };
    if (initialAssigneeIds?.length) return { ...base, assigneeIds: initialAssigneeIds };
    return base;
  });
  const [departmentId, setDepartmentId] = useState<string>(initialDepartmentId ?? "");
  const [activeSection, setActiveSection] = useState(initialSection);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // currentJobId: 新規モードでも自動保存後の ID を追跡する
  // 初期値は initialJob?.id（編集モード）または null（新規モード）
  const [currentJobId, setCurrentJobId] = useState<string | null>(initialJob?.id ?? null);
  const [selectedRoles, setSelectedRoles] = useState<SelectedRole[]>(initialJobRoles);
  /* ⚠️ 2段セレクト用の roleParentId / roleChildId / childRoles / addRole は
        2026-08-06 に検索セレクトへ置き換えたので削除した。追加は addRoleById 一本。 */


  // セールス専用ブロック（OTE・担当セグメント）の出し分け。
  // 旧実装は job_category のフリーテキストを見ていたが、その入力欄を廃止したため
  // 選択中のロールが「営業」配下かどうかで判定する。ow_roles は最大3階層あり
  // （営業 → ソリューションエンジニア・プリセールス → セールスエンジニア）、
  // 親を1回辿るだけでは足りないのでルートまで遡る。
  /* 選んだ職種の大分類（ルート）の名前。ow_roles は最大3階層あるのでルートまで遡る。
     ⚠️ 営業 → 営業職の項目、エンジニア・データ・AI・デザイナー → 使う技術、の出し分けに使う */
  const selectedRootNames = useMemo(() => {
    const byId = new Map(roles.map((r) => [r.id, r]));
    const names = new Set<string>();
    for (const sr of selectedRoles) {
      let node = byId.get(sr.roleId);
      const seen = new Set<string>();
      while (node && node.parent_id && !seen.has(node.id)) {
        seen.add(node.id);
        node = byId.get(node.parent_id);
      }
      if (node) names.add(node.name);
    }
    return names;
  }, [roles, selectedRoles]);
  const isSalesSelected = selectedRootNames.has("営業");
  const isTechSelected = TECH_ROOT_NAMES.some((n) => selectedRootNames.has(n));
  /** 代表の職種名（「この職種の経験年数」の見出しに添える） */
  const primaryRoleName = roles.find((r) => r.id === (selectedRoles.find((x) => x.isPrimary) ?? selectedRoles[0])?.roleId)?.name ?? null;

  /*
    検索セレクトから直接 id を受けて追加する。
    ⚠️ 重複は足さない。最初の1件が代表（isPrimary）になる。
       ここは唯一の追加経路なので、代表の決まり方を分岐させないこと。
  */
  const addRoleById = (targetId: string) => {
    if (!targetId || selectedRoles.some((r) => r.roleId === targetId)) return;
    setSelectedRoles((prev) => [...prev, { roleId: targetId, isPrimary: prev.length === 0 }]);
  };

  const removeRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      const next = prev.filter((r) => r.roleId !== roleId);
      // 削除後に primary がなければ先頭を primary に
      if (next.length > 0 && !next.some((r) => r.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const setPrimary = (roleId: string) => {
    setSelectedRoles((prev) => prev.map((r) => ({ ...r, isPrimary: r.roleId === roleId })));
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };
  /* ⚠️ `?? []` にしない。`teamMembers` が `[]` のときは**空状態を出す**（下）。
        既定値で埋めると「担当者がいない」と「取得に失敗した」が同じ見た目になる。 */
  const effectiveTeam = teamMembers ?? [];

  // 実際の保存処理。useAutoSave の onSave に渡す。
  // useCallback で最新の form/currentJobId を閉じる。useAutoSave 側で ref 経由で
  // 参照するため、form が変わるたびに debounce タイマーがリセットされることはない。
  const doSave = useCallback(async () => {
    if (!currentJobId) {
      // 新規モード: タイトルが入力されていればレコード発行
      if (!form.title.trim()) return;
      const res = await fetch("/api/biz/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, departmentId: departmentId || null, companyId, jobRoles: selectedRoles }),
      });
      if (!res.ok) throw new Error("create failed");
      const { id } = (await res.json()) as { id: string };
      setCurrentJobId(id);
      window.history.replaceState({}, "", `/biz/jobs/${id}/edit`);
    } else {
      const res = await fetch(`/api/biz/jobs/${currentJobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, departmentId: departmentId || null, jobRoles: selectedRoles }),
      });
      if (!res.ok) throw new Error("save failed");
    }
  }, [form, selectedRoles, currentJobId, companyId, departmentId]);

  const { saveState, trigger: triggerAutosave } = useAutoSave({ onSave: doSave });

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 新規モードでタイトルが空のうちは自動保存しない（空レコード量産防止）
    // 「key === "title"」の場合は入力中の新しい値で判定する
    const effectiveTitle = key === "title" ? (value as string) : form.title;
    if (currentJobId || effectiveTitle.trim().length > 0) {
      triggerAutosave();
    }
  }

  /*
    自社での呼び方のサジェスト。既存 GET /api/biz/job-roles をそのまま使う。
    ⚠️ 新しい API は作らない。/biz/organization の登録UIと同じ受け皿を共有する。
  */
  const [companyRoles, setCompanyRoles] = useState<{ name: string; departmentIds: string[]; standardRoleId: string | null }[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/biz/job-roles")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.jobRoles) return;
        setCompanyRoles((d.jobRoles as { name: string; departmentIds?: string[]; standard_role_id?: string | null }[])
          .map((x) => ({ name: x.name, departmentIds: x.departmentIds ?? [], standardRoleId: x.standard_role_id ?? null })));
      })
      .catch((e) => console.error("[JobEditForm] job-roles fetch", e));
    return () => { alive = false; };
  }, []);

  /* ★選んだ部門の職種を先に並べる（2026-09-22）。紐付けは /biz/organization の職種タブで付ける。
        ⚠️ 並べ替えるだけで、他の職種も選べるまま（絞り込まない） */
  const deptRoleNames = departmentId
    ? companyRoles.filter((r) => r.departmentIds.includes(departmentId)).map((r) => r.name)
    : [];
  /* ★部門・職種の標準の職種と、この求人の代表の職種が違うとき（2026-10-12）。
        ⚠️ 自動では直さない（求人の保存は空の行にしか標準の職種を入れない。companyJobRole.ts） */
  const roleMismatch = (() => {
    const cr = companyRoles.find((r) => r.name === form.companyRoleName.trim());
    const primary = selectedRoles.find((r) => r.isPrimary)?.roleId;
    if (!cr?.standardRoleId || !primary || cr.standardRoleId === primary) return null;
    const standard = roles.find((r) => r.id === cr.standardRoleId)?.name;
    const job = roles.find((r) => r.id === primary)?.name;
    return standard && job ? { standard, job } : null;
  })();
  const companyRoleSuggestions = [
    ...deptRoleNames,
    ...companyRoles.map((r) => r.name).filter((n) => !deptRoleNames.includes(n)),
  ];

  // selectedRoles が変わるたびに自動保存トリガー
  /* ⚠️ 職種が実際に変わったときだけ保存する。2026-10-11 まで、編集画面を開くだけで PUT が1回走っていた。
        ⚠️ 「初回だけ飛ばす」フラグにしない（開発時の StrictMode は effect を2回走らせるので、2回目で保存される） */
  const lastRolesKey = useRef(JSON.stringify(initialJobRoles));
  useEffect(() => {
    const key = JSON.stringify(selectedRoles);
    if (key === lastRolesKey.current) return;
    lastRolesKey.current = key;
    if (currentJobId) triggerAutosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoles]);

  /* ── ★公開に必要な項目（2026-10-11）──────────────────────────────
     ⚠️★判定は `missingForPublish()` の1か所。目次・「必須」の印・公開ボタンが同じ結果を見る。
     ⚠️ 旧版の「入力進捗 %」と「推奨項目」は外した（%は何を書けば公開できるかを言っていなかった）。 */
  const missing = useMemo(() => missingForPublish({
    title: form.title,
    roleCount: selectedRoles.length,
    description: form.descriptionMarkdown,
    employmentType: form.employmentType,
    salaryMin: form.salaryNegotiable ? null : form.salaryMin,
    salaryMax: form.salaryNegotiable ? null : form.salaryMax,
    location: form.location,
    workHours: form.workHours,
    holidays: form.holidays,
    probationPeriod: form.probationPeriod,
    labor: form.laborTerms,
  }), [form, selectedRoles]);

  /* ★公開の判定（2026-10-12）。サーバー（requestPublish）と同じ関数 decidePublish。
        ⚠️ 禁止表現はいま入力している内容で見る（直したらすぐ消える） */
  const wordingHits = useMemo(() => checkWording(wordingFieldsFromForm(form)), [form]);
  /* ★状態は jobState（求人管理の一覧と同じ関数）。停止中は「自社で停止」と「運営が停止」で押した結果が違う
        （自社 → すぐ公開 ／ 運営 → 再開の依頼。サーバーの requestPublish と揃える） */
  const state = initialJob ? jobState(initialJob) : "draft";
  const isStopped = state === "stopped_ops" || state === "reopen_requested";
  const decision = useMemo(() => decidePublish({ missing, hits: wordingHits, companyListed, stopped: isStopped }), [missing, wordingHits, companyListed, isStopped]);
  /* ★「公開まであと〇項目」は 必要な項目の不足＋禁止表現（どちらも公開をブロックする。2026-10-12） */
  const wordingBlockers = useMemo(() => wordingRequirements(wordingHits), [wordingHits]);
  const blockers = useMemo(() => [...missing, ...wordingBlockers], [missing, wordingBlockers]);
  /* ⚠️ 再開を依頼済みのあいだは押せない（運営の確認待ち） */
  const canPublish = decision.kind !== "blocked" && state !== "reopen_requested";
  /** 公開ボタンの文言（状態ごと） */
  const publishLabel = state === "stopped_self" ? "再開する" : state === "stopped_ops" ? "再開を依頼する"
    : state === "reopen_requested" ? "再開を依頼済み" : "公開する";

  const handlePublish = useCallback(async () => {
    const jobId = currentJobId;
    if (!jobId) return;
    if (blockers.length > 0) {
      showError(`公開の前に直してください：${blockers.map((m) => m.label).join("・")}`);
      return;
    }
    if (!companyListed) {
      showError(COMPANY_NOT_LISTED_MESSAGE);
      return;
    }
    setIsPublishing(true);
    try {
      const saveRes = await fetch(`/api/biz/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        /* ⚠️★`jobRoles` を必ず送る。2026-10-11 まで送っておらず、PUT は「送られた職種で置き換える」ので
              **公開を押すと職種が全部外れていた**（route.ts の ow_job_roles 同期）。 */
        body: JSON.stringify({ ...form, departmentId: departmentId || null, jobRoles: selectedRoles }),
      });
      if (!saveRes.ok) throw new Error("save failed");
      const submitRes = await fetch(`/api/biz/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", value: "published" }),
      });
      if (!submitRes.ok) {
        /* ★サーバーが断った理由（足りない項目・企業ページが非公開など）をそのまま出す */
        const j = (await submitRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error || "submit failed");
      }
      /* ★すぐ公開 → 公開中のタブ ／ 再開の依頼（運営が停止した求人）→ 停止中のタブ */
      const j = (await submitRes.json().catch(() => null)) as { decision?: string } | null;
      router.push(j?.decision === "review" ? "/biz/jobs?status=stopped" : "/biz/jobs?status=published");
    } catch (e) {
      const msg = e instanceof Error && e.message !== "submit failed" && e.message !== "save failed" ? e.message : null;
      showError(msg ?? "公開に失敗しました。再度お試しください。");
    } finally {
      setIsPublishing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, currentJobId, router, missing, blockers, selectedRoles, departmentId, companyListed]);

  const req = (key: string) => isPublishRequired(key, form.employmentType);
  /* 業務委託は雇用ではないので、労働条件の項目を出さない（publishRequirements.ts の requirementsFor と同じ判定） */
  const requiresLabor = requirementsFor(form.employmentType).some((r) => r.key === "contractPeriod");

  function updateLabor<K extends keyof LaborTerms>(key: K, value: LaborTerms[K]) {
    updateForm("laborTerms", { ...form.laborTerms, [key]: value });
  }

  const stepStatus = (id: StepId): StepStatus => {
    if (id === "review") return null;
    /* ⚠️ 公開の条件に入っていないステップは、空なら「任意」（「未入力」と出すと書かないと駄目に見える） */
    if (id === "more") return "optional";
    if (blockers.some((m) => m.step === id)) return "todo";
    if (id === "requirements") return form.requiredSkills.length > 0 || form.preferredSkills.length > 0 ? "done" : "optional";
    if (id === "process") return form.selectionSteps.some((s) => s.trim()) ? "done" : "optional";
    return "done";
  };
  const steps: EditStep[] = STEP_DEFS.map((s) => ({ id: s.id, label: s.label, status: stepStatus(s.id) }));

  /* 目次の「足りない項目」を押したら、そのステップを開いて入力欄へ移る。
     ⚠️ rAF ではなく setTimeout（描画されていないと rAF は発火しない。ui-debugging ⑪） */
  const goToField = (r: PublishRequirement) => {
    setActiveSection(r.step);
    setTimeout(() => {
      const el = document.getElementById(r.fieldId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = el.matches("input,textarea,select,button") ? el : el.querySelector<HTMLElement>("input,textarea,select,button");
      focusable?.focus({ preventScroll: true });
    }, 80);
  };

  const goToStep = (id: string) => {
    setActiveSection(id);
    setTimeout(() => document.getElementById("jef-main")?.scrollTo({ top: 0 }), 0);
  };

  // 保存状態（小さく出す）
  const saveStatusText = saveState === "saving" ? "保存中…"
    : saveState === "saved"  ? "保存しました"
    : saveState === "error"  ? "保存に失敗しました"
    : null;
  const saveStatusColor = saveState === "error" ? "var(--error-ink)" : saveState === "saved" ? "var(--success-ink)" : "var(--ink-mute)";

  const pageTitle = mode === "new" ? "求人を作成" : (initialJob?.title ?? "求人を編集");

  /* 選んだ職種の大分類で出し分ける（営業 → 営業職の項目、エンジニア・データ・AI・デザイナー → 使う技術）。
     ⚠️ 既に値が入っている求人では、職種に関係なく出す（出さないと消す手段が無くなる） */
  const showSales = isSalesSelected || !!(form.oteMin || form.oteMax || form.salesSegment.length || form.salesHunterFarmer || form.incentiveNote.trim());
  const showTech = isTechSelected || form.techStack.length > 0;

  // ── 部品 ───────────────────────────────────────────────────────────────

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20,
    border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
    background: active ? "var(--royal-50)" : "#fff",
    color: active ? "var(--royal)" : "var(--ink-soft)",
    fontSize: 13, fontWeight: active ? 700 : 400,
    cursor: "pointer", fontFamily: "inherit",
  });

  const stepIndex = STEP_DEFS.findIndex((s) => s.id === activeSection);
  const current = STEP_DEFS[stepIndex] ?? STEP_DEFS[0];
  const prev = stepIndex > 0 ? STEP_DEFS[stepIndex - 1] : null;
  const next = stepIndex >= 0 && stepIndex < STEP_DEFS.length - 1 ? STEP_DEFS[stepIndex + 1] : null;

  // ── ステップの中身 ─────────────────────────────────────────────────────

  function renderStep() {
    switch (current.id) {
      case "job":
        return (
          <>
            <FormSection>
              <FormGroup>
                <FormLabel required={req("title")} htmlFor="jef-title">求人タイトル</FormLabel>
                <FormInput id="jef-title" value={form.title} onChange={(v) => updateForm("title", v)} placeholder="例：法人営業（SaaS）" />
                <Hint>求職者が最初に目にする項目です。ポジション名と補足を書いてください。タイトルを入れると下書きとして保存されます。</Hint>
              </FormGroup>

              {roles.length > 0 && (
                <FormGroup>
                <div id="jef-role">
                  <FormLabel required={req("role")}>職種</FormLabel>
                  {/* ⚠️ 2026-08-06 に2段セレクトから検索セレクトに置き換えた。
                         selectableParent={false} は「子があるカテゴリでは親を選べない」旧UIの制約を維持している。 */}
                  <div style={{ marginBottom: 8 }}>
                    <RoleSearchSelect
                      roles={roles}
                      aliases={roleAliases}
                      value=""
                      clearOnSelect
                      selectableParent={false}
                      onSelect={(id) => addRoleById(id)}
                      ariaLabel="職種を検索して追加"
                      placeholder="職種名で検索（例: マーケティング）"
                    />
                  </div>
                  {selectedRoles.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selectedRoles.map((sr) => {
                        const role = roles.find((r) => r.id === sr.roleId);
                        return (
                          <div key={sr.roleId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: sr.isPrimary ? "var(--royal-50)" : "var(--bg-tint)", border: `1px solid ${sr.isPrimary ? "var(--royal-100)" : "var(--line)"}` }}>
                            <input type="radio" name="primary-role" aria-label={`${role?.name ?? ""}を代表にする`} checked={sr.isPrimary} onChange={() => setPrimary(sr.roleId)} style={{ accentColor: "var(--royal)", cursor: "pointer" }} />
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: sr.isPrimary ? 700 : 400, color: sr.isPrimary ? "var(--royal)" : "var(--ink)" }}>
                              {role?.name ?? sr.roleId}
                              {sr.isPrimary && <span style={{ marginLeft: 6, fontSize: 12, color: "var(--ink-mute)", fontWeight: 400 }}>（代表）</span>}
                            </span>
                            <button type="button" onClick={() => removeRole(sr.roleId)} style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>外す</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Hint>いくつか選べます。いちばん近いものを「代表」にしてください。求職者の検索と絞り込みは代表の職種で行われます。</Hint>
                </div>
                </FormGroup>
              )}

              {/* ★ポジションのレベル（2026-10-12）。任意・選ぶだけ。語彙は職歴の役職と同じ（突き合わせに使う） */}
              <FormGroup>
                <FormLabel htmlFor="jef-position-level">ポジションのレベル</FormLabel>
                <div style={{ maxWidth: 360 }}>
                  <FormSelect id="jef-position-level" value={form.positionLevel} onChange={(v) => updateForm("positionLevel", v)}
                    options={JOB_POSITION_LEVELS.map((o) => ({ value: o.value, label: o.label }))} />
                </div>
                <Hint>任意です。入れると、同じかそれ以上の役職を経験した候補者に「合うところ」として出ます。</Hint>
              </FormGroup>

              <FormLabel required={req("description")} htmlFor="jef-description">仕事内容</FormLabel>
              <textarea
                /* ⚠️ **描画とセットで扱うこと。** 求職者側は `components/common/Markdown` で解釈する。
                      片方だけ変えると「書けるのに出ない」か「記号がそのまま出る」になる。
                   ⚠️ 2026-10-11 に、押しても何も起きなかった書式ボタン（H2 / B / List など）を外した。 */
                id="jef-description"
                value={form.descriptionMarkdown}
                onChange={(e) => updateForm("descriptionMarkdown", e.target.value)}
                placeholder={"## このポジションのミッション\n\n具体的な業務内容を書いてください。"}
                rows={10}
                style={{
                  width: "100%", padding: "12px 14px", border: "1.5px solid var(--line)", borderRadius: 8,
                  background: "#fff", fontFamily: "inherit", fontSize: 13, boxSizing: "border-box",
                  color: "var(--ink)", lineHeight: 1.8, resize: "vertical", minHeight: 200, outline: "none",
                }}
              />
              <Hint>求職者に表示されます。見出し（##）や箇条書き（-）が使えます。</Hint>
            </FormSection>
          </>
        );

      case "conditions": {
        const L = form.laborTerms;
        const contractOnly = !requiresLabor;
        return (
          <>
            <FormSection title="雇用形態と契約期間">
              <FormGroup style={contractOnly ? { marginBottom: 0 } : undefined}>
                <FormLabel required={req("employmentType")}>雇用形態</FormLabel>
                <div id="jef-employment" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {JOB_EMPLOYMENT_TYPES.map((type) => {
                    const active = form.employmentType === type;
                    return (
                      <button key={type} type="button" aria-pressed={active} onClick={() => updateForm("employmentType", type)}
                        style={{
                          padding: "8px 16px", borderRadius: 100, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: active ? "var(--royal)" : "#fff",
                          border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
                          color: active ? "#fff" : "var(--ink-soft)",
                        }}>
                        {type}
                      </button>
                    );
                  })}
                </div>
                {contractOnly && <Hint>業務委託は雇用契約ではないため、契約期間・社会保険などの労働条件の項目はありません。</Hint>}
              </FormGroup>
              {!contractOnly && (
                <FormGroup style={{ marginBottom: 0 }}>
                  <FormLabel required={req("contractPeriod")}>契約期間</FormLabel>
                  <ChoiceChips id="jef-contract-period" options={CONTRACT_PERIODS} value={L.contractPeriod} onChange={(v) => updateLabor("contractPeriod", v)} />
                  {L.contractPeriod === "fixed" && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <FormLabel required htmlFor="jef-contract-period-detail">期間</FormLabel>
                        <FormInput id="jef-contract-period-detail" value={L.contractPeriodDetail} onChange={(v) => updateLabor("contractPeriodDetail", v)} placeholder="例：1年（2027年3月31日まで）" />
                      </div>
                      <div>
                        <FormLabel required>契約の更新</FormLabel>
                        <ChoiceChips options={CONTRACT_RENEWALS} value={L.contractRenewal} onChange={(v) => updateLabor("contractRenewal", v)} />
                      </div>
                      <div>
                        <FormLabel htmlFor="jef-contract-renewal-limit">更新の上限</FormLabel>
                        <FormInput id="jef-contract-renewal-limit" value={L.contractRenewalLimit} onChange={(v) => updateLabor("contractRenewalLimit", v)} placeholder="例：通算5年まで／上限なし" />
                        <Hint>更新の上限（通算の契約期間や更新の回数）がある場合は書いてください。</Hint>
                      </div>
                    </div>
                  )}
                </FormGroup>
              )}
            </FormSection>

            <FormSection title="給与">
              <FormGroup>
                <FormLabel required={req("salary")} htmlFor="jef-salary-min">{payLabel(form.employmentType) === "報酬" ? "報酬（下限〜上限）" : "年収（下限〜上限）"}</FormLabel>
                {/* ★要相談（2026-10-10）。選ぶと金額は送らず、求職者には「年収：要相談」と出る。
                       ⚠️ 2026-10-11 から公開には下限・上限が要る（要相談だけでは申請できない） */}
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink)", marginBottom: 8, cursor: "pointer" }}>
                  <input type="checkbox" data-state={form.salaryNegotiable ? "negotiable" : "amount"} checked={form.salaryNegotiable}
                    onChange={(e) => { updateForm("salaryNegotiable", e.target.checked); if (e.target.checked) { updateForm("salaryMin", ""); updateForm("salaryMax", ""); } }} />
                  要相談にする
                </label>
                {!form.salaryNegotiable && (
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr) auto", gap: 8, alignItems: "center" }}>
                    <FormInput value={form.salaryMin} onChange={(v) => updateForm("salaryMin", v)} placeholder="600" type="number" id="jef-salary-min" />
                    <span style={{ color: "var(--ink-mute)", fontWeight: 600 }}>〜</span>
                    <FormInput value={form.salaryMax} onChange={(v) => updateForm("salaryMax", v)} placeholder="1000" type="number" id="jef-salary-max" />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                  </div>
                )}
                {form.salaryMin && form.salaryMax && Number(form.salaryMax) < Number(form.salaryMin) && (
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 4 }}>上限は下限以上にしてください</p>
                )}
                {form.salaryMin && form.salaryMax && Number(form.salaryMax) >= Number(form.salaryMin) && (Number(form.salaryMax) - Number(form.salaryMin)) > 250 && (
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--warm-ink)", marginTop: 4 }}>幅が250万円を超えています。求職者に分かりやすい範囲か確認してください</p>
                )}
                <Hint>
                  {form.salaryNegotiable
                    ? <>「要相談」だけでは公開できません。下限と上限を入れ、決め方は下の「給与の補足」に書いてください（例：経験・能力により決定）</>
                    : <>求職者側では「{payLabel(form.employmentType)}{form.salaryMin || "?"}万円〜{form.salaryMax || "?"}万円」と表示されます</>}
                </Hint>
              </FormGroup>
              {!contractOnly && (
                <FormGroup>
                  <FormLabel required={req("fixedOvertime")}>固定残業代</FormLabel>
                  <ChoiceChips id="jef-fixed-overtime" options={YES_NO} value={L.fixedOvertime} onChange={(v) => updateLabor("fixedOvertime", v)} />
                  {L.fixedOvertime === "yes" && (
                    <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto minmax(0,1fr) auto", gap: 8, alignItems: "center", marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>月</span>
                      <FormInput id="jef-fixed-overtime-hours" type="number" value={L.fixedOvertimeHours} onChange={(v) => updateLabor("fixedOvertimeHours", v)} placeholder="20" />
                      <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>時間分</span>
                      <FormInput id="jef-fixed-overtime-pay" type="number" value={L.fixedOvertimePay} onChange={(v) => updateLabor("fixedOvertimePay", v)} placeholder="50000" />
                      <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>円</span>
                    </div>
                  )}
                  {L.fixedOvertime === "yes" && <Hint>時間を超えた分は追加で支払う、と求職者に表示されます。</Hint>}
                </FormGroup>
              )}
              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel htmlFor="jef-salary-note">給与の補足</FormLabel>
                <FormTextarea id="jef-salary-note" value={form.salaryNote} onChange={(v) => updateForm("salaryNote", v)} placeholder="例：経験・能力により決定。賞与は年2回、業績連動。" rows={3} maxLength={200} />
              </FormGroup>
            </FormSection>

            <FormSection title="勤務地と変更の範囲">
              <FormGroup>
                <FormLabel required={req("location")} htmlFor="jef-location">勤務地</FormLabel>
                <FormInput id="jef-location" value={form.location} onChange={(v) => updateForm("location", v)} placeholder="例：東京都豊島区東池袋1-9-6" />
              </FormGroup>
              {!contractOnly && (
                <>
                  <FormGroup>
                    <FormLabel required={req("workplaceChange")}>就業場所の変更の範囲</FormLabel>
                    <ChoiceChips id="jef-workplace-change" options={WORKPLACE_CHANGE_SCOPES} value={L.workplaceChangeScope} onChange={(v) => updateLabor("workplaceChangeScope", v)} />
                    <div style={{ marginTop: 8 }}>
                      <FormInput id="jef-workplace-change-note" value={L.workplaceChangeNote} onChange={(v) => updateLabor("workplaceChangeNote", v)} placeholder="補足（例：本社および全国の支店）" />
                    </div>
                  </FormGroup>
                  <FormGroup>
                    <FormLabel required={req("dutiesChange")}>業務の変更の範囲</FormLabel>
                    <ChoiceChips id="jef-duties-change" options={DUTIES_CHANGE_SCOPES} value={L.dutiesChangeScope} onChange={(v) => updateLabor("dutiesChangeScope", v)} />
                    <div style={{ marginTop: 8 }}>
                      <FormInput id="jef-duties-change-note" value={L.dutiesChangeNote} onChange={(v) => updateLabor("dutiesChangeNote", v)} placeholder="補足（例：営業部門の業務全般）" />
                    </div>
                  </FormGroup>
                </>
              )}
              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel htmlFor="jef-remote">リモートワーク</FormLabel>
                <FormSelect id="jef-remote" value={form.remoteWorkStatus} onChange={(v) => updateForm("remoteWorkStatus", v)} options={REMOTE_WORK_STATUSES} />
              </FormGroup>
            </FormSection>

            {/* ★勤務時間・休日（2026-09-02 追加）。⚠️ 自由入力にしてある（企業ごとに書き方が違う）。 */}
            <FormSection title="勤務時間と休日">
              <FormGroup>
                <FormLabel required={req("workHours")} htmlFor="jef-work-hours">始業・終業時刻</FormLabel>
                <FormInput id="jef-work-hours" value={form.workHours} onChange={(v) => updateForm("workHours", v)} placeholder="例：9:00〜18:00／フレックスタイム制（コア11:00〜15:00）" />
              </FormGroup>
              {!contractOnly && (
                <div className="jef-2col" style={{ marginBottom: 18 }}>
                  <div>
                    <FormLabel required={req("breakTime")} htmlFor="jef-break-time">休憩時間</FormLabel>
                    <FormInput id="jef-break-time" value={L.breakTime} onChange={(v) => updateLabor("breakTime", v)} placeholder="例：60分" />
                  </div>
                  <div>
                    <FormLabel required={req("overtime")}>時間外労働</FormLabel>
                    <ChoiceChips id="jef-overtime" options={YES_NO} value={L.overtime} onChange={(v) => updateLabor("overtime", v)} />
                  </div>
                </div>
              )}
              <FormGroup>
                <FormLabel required={req("holidays")} htmlFor="jef-holidays">休日・休暇</FormLabel>
                <FormInput id="jef-holidays" value={form.holidays} onChange={(v) => updateForm("holidays", v)} placeholder="例：完全週休2日制（土日祝）、年末年始、有給休暇（初年度10日）" />
              </FormGroup>
              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel required={req("probation")} htmlFor="jef-probation">試用期間</FormLabel>
                <FormInput id="jef-probation" value={form.probationPeriod} onChange={(v) => updateForm("probationPeriod", v)} placeholder="例：3ヶ月（条件の変更なし）" />
                <Hint>試用期間が無い場合は「なし」と書いてください。</Hint>
              </FormGroup>
            </FormSection>

            {!contractOnly && (
              <FormSection title="社会保険と受動喫煙対策">
                <FormGroup>
                  <FormLabel required={req("socialInsurance")}>加入する社会保険</FormLabel>
                  <div id="jef-social-insurance" style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                    {SOCIAL_INSURANCES.map((o) => {
                      const checked = L.socialInsurance.includes(o.value);
                      return (
                        <label key={o.value} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => updateLabor("socialInsurance", checked ? L.socialInsurance.filter((x) => x !== o.value) : [...L.socialInsurance, o.value])} />
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                </FormGroup>
                <FormGroup style={{ marginBottom: 0 }}>
                  <FormLabel required={req("smoking")}>受動喫煙防止の措置</FormLabel>
                  <ChoiceChips id="jef-smoking" options={SMOKING_MEASURES} value={L.smokingMeasure} onChange={(v) => updateLabor("smokingMeasure", v)} />
                  <div style={{ marginTop: 8 }}>
                    <FormInput id="jef-smoking-note" value={L.smokingNote} onChange={(v) => updateLabor("smokingNote", v)}
                      placeholder={L.smokingMeasure === "other" ? "内容を書いてください（必須）" : "補足（例：ビル内に喫煙所あり）"} />
                  </div>
                </FormGroup>
              </FormSection>
            )}
          </>
        );
      }

      case "requirements":
        return (
          <FormSection title="経験・スキル">
            {/* ★この職種の経験年数（2026-10-12）。任意・選ぶだけ。代表の職種の経験年数で突き合わせる */}
            <FormGroup>
              <FormLabel htmlFor="jef-experience-years">
                この職種の経験年数{primaryRoleName ? <span style={{ fontWeight: 400, color: "var(--ink-mute)" }}>（{primaryRoleName}）</span> : null}
              </FormLabel>
              <div style={{ maxWidth: 240 }}>
                <FormSelect id="jef-experience-years" value={form.requiredExperienceYears} onChange={(v) => updateForm("requiredExperienceYears", v)}
                  options={JOB_EXPERIENCE_YEARS.map((o) => ({ value: String(o.value), label: o.label }))} />
              </div>
              <Hint>任意です。入れると、その年数以上この職種を経験した候補者に「合うところ」として出ます。</Hint>
            </FormGroup>
            <FormGroup>
              <FormLabel>必須の経験</FormLabel>
              {/* ⚠️ id は禁止表現から移る先（wordingCheck.ts の WORDING_FIELD_TARGETS） */}
              <div id="jef-required-skills" tabIndex={-1} style={{ outline: "none" }}>
              <RequirementsTagInput tags={form.requiredSkills} onTagsChange={(t) => updateForm("requiredSkills", t)} placeholder="経験・スキルを入力して Enter" />
              </div>
              <Hint>業務に欠かせない経験・スキルを書いてください。年齢・性別などの属性は書かないでください。</Hint>
            </FormGroup>
            <FormGroup style={{ marginBottom: 0 }}>
              <FormLabel>歓迎する経験</FormLabel>
              <div id="jef-preferred-skills" tabIndex={-1} style={{ outline: "none" }}>
              <RequirementsTagInput tags={form.preferredSkills} onTagsChange={(t) => updateForm("preferredSkills", t)} placeholder="経験・スキルを入力して Enter" />
              </div>
            </FormGroup>
            {/* ⚠️★「求めるカルチャーフィット」の入力欄は 2026-10-11 に外した（求職者側に表示先が無いため）。
                   **列（culture_fit）と既存の値は残してある。** `form.cultureFit` も送り続けるので値は消えない。 */}
          </FormSection>
        );

      case "process":
        return (
          <>
            <FormSection title="選考ステップ" desc="求職者側の求人ページに表示されます。">
              <ProcessStepsEditor steps={form.selectionSteps} onStepsChange={(s) => updateForm("selectionSteps", s)} />
            </FormSection>
            <FormSection title="期間と入社時期">
              <div className="jef-2col">
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel htmlFor="jef-selection-duration">内定までの期間</FormLabel>
                  <FormInput id="jef-selection-duration" value={form.selectionDuration} onChange={(v) => updateForm("selectionDuration", v)} placeholder="例：3〜4週間" />
                </FormGroup>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel htmlFor="jef-start-date">入社時期</FormLabel>
                  <FormSelect id="jef-start-date" value={form.startDatePreference} onChange={(v) => updateForm("startDatePreference", v)} options={DURATION_OPTIONS} />
                </FormGroup>
              </div>
            </FormSection>
          </>
        );

      case "more":
        return (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, margin: "0 0 16px" }}>
              書かなくても公開できます。書くと、求職者が応募するかを決めやすくなります。
            </p>
            <MoreGroup title="なぜ今採用するか" filled={!!form.whyHire.trim()}>
              <FormTextarea id="jef-why-hire" ariaLabel="なぜ今採用するか" value={form.whyHire} onChange={(v) => updateForm("whyHire", v)} placeholder="例：プロダクトの成長にともない、PMを1名から3名体制にします。" rows={4} maxLength={600} />
            </MoreGroup>
            <MoreGroup title="チーム構成" filled={!!form.teamComposition.trim()}>
              <FormTextarea id="jef-team-composition" ariaLabel="チーム構成" value={form.teamComposition} onChange={(v) => updateForm("teamComposition", v)} placeholder="例：PM2名、エンジニア8名、デザイナー2名の12名。" rows={4} maxLength={600} />
            </MoreGroup>
            <MoreGroup title="入社後90日でやること" filled={!!form.first90Days.trim()}>
              <FormTextarea id="jef-first-90-days" ariaLabel="入社後90日でやること" value={form.first90Days} onChange={(v) => updateForm("first90Days", v)} placeholder="例：1か月目はオンボーディング。2か月目に小さな機能のPRDを書きます。" rows={4} maxLength={600} />
            </MoreGroup>
            <MoreGroup title="候補者へのメッセージ" filled={!!form.messageToCandidates.trim()}>
              <FormTextarea id="jef-message-to-candidates" ariaLabel="候補者へのメッセージ" value={form.messageToCandidates} onChange={(v) => updateForm("messageToCandidates", v)} placeholder="例：社会的意義のあるプロダクトに関わりたい方をお待ちしています。" rows={4} maxLength={500} />
            </MoreGroup>
            <MoreGroup title="事業のかたち" filled={!!form.businessModel}>
              <Hint>どういう売り方・提供のしかたの事業かを選びます。業界とは別の軸です。</Hint>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {BUSINESS_MODELS.map((m) => {
                  const active = form.businessModel === m.key;
                  return (
                    <button key={m.key} type="button" aria-pressed={active} title={m.desc || undefined}
                      onClick={() => updateForm("businessModel", active ? "" : m.key)} style={chipStyle(active)}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </MoreGroup>

            {showSales && (
              <MoreGroup title="営業職の項目" filled={!!(form.oteMin || form.oteMax || form.salesSegment.length || form.salesHunterFarmer || form.incentiveNote.trim())}>
                <FormGroup>
                  <FormLabel htmlFor="jef-ote-min">OTE（目標達成時の想定年収）</FormLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr) auto", gap: 8, alignItems: "center" }}>
                    <FormInput value={form.oteMin} onChange={(v) => updateForm("oteMin", v)} placeholder="800" type="number" id="jef-ote-min" />
                    <span style={{ color: "var(--ink-mute)", fontWeight: 600 }}>〜</span>
                    <FormInput value={form.oteMax} onChange={(v) => updateForm("oteMax", v)} placeholder="1400" type="number" id="jef-ote-max" />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                  </div>
                  <Hint>インセンティブ込みで目標を達成したときの年収です。</Hint>
                </FormGroup>
                <FormGroup>
                  <FormLabel>担当セグメント</FormLabel>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {SALES_SEGMENTS.map((seg) => {
                      const active = form.salesSegment.includes(seg.key);
                      return (
                        <button key={seg.key} type="button" aria-pressed={active} title={seg.desc} style={chipStyle(active)}
                          onClick={() => updateForm("salesSegment", active ? form.salesSegment.filter((s) => s !== seg.key) : [...form.salesSegment, seg.key])}>
                          {seg.label}
                        </button>
                      );
                    })}
                  </div>
                </FormGroup>
                <FormGroup>
                  <FormLabel>新規／既存</FormLabel>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {SALES_HUNTER_FARMER_OPTIONS.map((opt) => {
                      const active = form.salesHunterFarmer === opt.key;
                      return (
                        <button key={opt.key} type="button" aria-pressed={active} title={opt.desc} style={chipStyle(active)}
                          onClick={() => updateForm("salesHunterFarmer", active ? "" : opt.key)}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </FormGroup>
                <FormGroup style={{ marginBottom: 0 }}>
                  <FormLabel htmlFor="jef-incentive-note">インセンティブの補足</FormLabel>
                  <FormTextarea id="jef-incentive-note" value={form.incentiveNote} onChange={(v) => updateForm("incentiveNote", v)} placeholder="例：コミッション上限なし。四半期ごとに目標設定・評価。" rows={2} maxLength={500} />
                </FormGroup>
              </MoreGroup>
            )}

            {showTech && (
              <MoreGroup title="使う技術" filled={form.techStack.length > 0}>
                <Hint>このポジションで主に使う技術・ツールを選んでください。</Hint>
                {TECH_STACK_CATEGORIES.map((cat) => (
                  <div key={cat.label} style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 8 }}>{cat.label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {cat.items.map((tech) => {
                        const active = form.techStack.includes(tech);
                        return (
                          <button key={tech} type="button" aria-pressed={active} style={chipStyle(active)}
                            onClick={() => updateForm("techStack", active ? form.techStack.filter((t) => t !== tech) : [...form.techStack, tech])}>
                            {active && <span style={{ marginRight: 4 }}>✓</span>}{tech}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </MoreGroup>
            )}

            <MoreGroup title="部門" filled={!!(departmentId || form.department.trim())}>
              {departments.length > 0 ? (
                <>
                  <select
                    id="jef-department"
                    aria-label="部門"
                    value={departmentId}
                    onChange={(e) => { setDepartmentId(e.target.value); if (currentJobId) triggerAutosave(); }}
                    style={{
                      width: "100%", padding: "10px 32px 10px 12px", border: "1.5px solid var(--line)", borderRadius: 8,
                      fontFamily: "inherit", fontSize: 13, color: "var(--ink)", background: "#fff", cursor: "pointer", outline: "none",
                    }}
                  >
                    <option value="">選択しない</option>
                    {/* ★`<optgroup>` は入れ子にできないので、字下げした `<option>` を並べる（2026-09-19）。
                           並べ替えは `flattenTree` を通すこと。 */}
                    {flattenTree(departments).map(({ node, depth }) => (
                      <option key={node.id} value={node.id}>
                        {"　".repeat(depth - 1)}{depth > 1 ? "└ " : ""}{node.name}
                      </option>
                    ))}
                  </select>
                  <Hint>ここに無い部門は <a href="/biz/organization" target="_blank" rel="noopener" style={{ color: "var(--royal)", textDecoration: "underline" }}>部門・職種</a> で追加できます。</Hint>
                </>
              ) : (
                <>
                  <FormInput id="jef-department" value={form.department} onChange={(v) => updateForm("department", v)} placeholder="例：プロダクト本部" />
                  <Hint><a href="/biz/organization" target="_blank" rel="noopener" style={{ color: "var(--royal)", textDecoration: "underline" }}>部門・職種</a> で部門を登録すると、ここで選べるようになります。</Hint>
                </>
              )}
            </MoreGroup>

            {/* 自社での呼び方。⚠️ 代表職種が決まっていないと紐づけ先が無いので出さない */}
            {roles.length > 0 && selectedRoles.some((r) => r.isPrimary) && (
              <MoreGroup title="自社での呼び方" filled={!!form.companyRoleName.trim()}>
                <FormInput id="jef-company-role-name" list="jef-company-role-suggestions" value={form.companyRoleName} onChange={(v) => updateForm("companyRoleName", v)} placeholder="例：CXデザイナー" />
                <datalist id="jef-company-role-suggestions">
                  {companyRoleSuggestions.map((n) => <option key={n} value={n} />)}
                </datalist>
                {deptRoleNames.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>この部門の職種：</span>
                    {deptRoleNames.map((n) => {
                      const active = form.companyRoleName === n;
                      return (
                        <button key={n} type="button" onClick={() => updateForm("companyRoleName", n)} aria-pressed={active}
                          style={{ ...chipStyle(active), fontSize: 12, padding: "3px 10px" }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                )}
                <Hint>求人ページにはこの呼び方が出ます。検索や絞り込みは「職種」で選んだものを使います。</Hint>
                {roleMismatch && (
                  <p data-state="company-role-mismatch" style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-mute)" }}>
                    部門・職種での設定（{roleMismatch.standard}）と、この求人の職種（{roleMismatch.job}）が違います{" "}
                    <a href="/biz/organization?tab=roles" style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>部門・職種を開く ›</a>
                  </p>
                )}
              </MoreGroup>
            )}
          </>
        );

      case "review":
        return (
          <>
            <FormSection title="採用担当者">
              {/* ★0件のときは架空の人を出さず、行き先を示す（2026-09-18）。 */}
              {effectiveTeam.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9 }}>
                  選べる担当者がいません。<a href="/biz/members" style={{ color: "var(--royal)", fontWeight: 600 }}>メンバーと権限</a> でメンバーを追加すると選べるようになります。
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {effectiveTeam.map((member) => {
                    const active = form.assigneeIds.includes(member.id);
                    return (
                      <button key={member.id} type="button" aria-pressed={active}
                        onClick={() => updateForm("assigneeIds", active ? form.assigneeIds.filter((id) => id !== member.id) : [...form.assigneeIds, member.id])}
                        style={{ ...chipStyle(active), display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {active && <span aria-hidden="true">✓</span>}{member.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </FormSection>

            <FormSection title="採用の温度感">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([
                  { value: "open", label: "OPEN（通常募集）" },
                  { value: "hot",  label: "HOT（積極採用中）" },
                ] as const).map((opt) => (
                  <button key={opt.value} type="button" aria-pressed={form.urgency === opt.value}
                    onClick={() => updateForm("urgency", opt.value)} style={chipStyle(form.urgency === opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <Hint>HOT にすると、求職者側の求人カードに目立つ印が付きます。</Hint>
            </FormSection>

            {/* ★公開（2026-10-12 / 即時公開）。判定は decidePublish（サーバーと同じ関数） */}
            <div data-state={decision.kind === "publish" ? "ready" : decision.kind === "review" ? "reopen" : decision.reason} style={{
              background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", marginTop: 8,
            }}>
              {blockers.length > 0 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                    公開の前に、あと{blockers.length}つ直してください
                  </div>
                  {missing.length > 0 && (
                    <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                      {missing.map((r) => (
                        <li key={r.key}>
                          <button type="button" onClick={() => goToField(r)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--royal)", textDecoration: "underline" }}>
                            {r.label}（{STEP_DEFS.find((s) => s.id === r.step)?.label}）
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* ★禁止表現（2026-10-12 から公開をブロックする）。言い換えの例を出し、押すとその入力欄へ */}
                  {wordingBlockers.length > 0 && (
                    <ul data-state="wording-hits" style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
                      {wordingBlockers.map((r) => (
                        <li key={r.key} style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.8 }}>
                          {r.message}{" "}
                          <button type="button" onClick={() => goToField(r)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--royal)", textDecoration: "underline" }}>
                            {STEP_DEFS.find((s) => s.id === r.step)?.label}の該当箇所へ
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : !companyListed ? (
                <div data-state="company-not-listed" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{COMPANY_NOT_LISTED_MESSAGE}</div>
              ) : state === "reopen_requested" ? (
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>再開を依頼済みです。OPINIO 運営が確認したうえで掲載を再開します</div>
              ) : isStopped ? (
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>「再開を依頼する」を押すと、OPINIO 運営が確認したうえで掲載を再開します</div>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{state === "stopped_self" ? "再開できます" : "公開できます"}</div>
              )}
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 14 }}>
                {POST_PUBLISH_NOTE}
              </div>
              <button
                type="button"
                onClick={handlePublish}
                data-state="publish-button"
                disabled={isPublishing || !canPublish || !currentJobId}
                style={{
                  padding: "12px 28px", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  background: isPublishing || !canPublish || !currentJobId ? "var(--line)" : "var(--royal)",
                  color: isPublishing || !canPublish || !currentJobId ? "var(--ink-mute)" : "#fff",
                  cursor: isPublishing || !canPublish || !currentJobId ? "not-allowed" : "pointer",
                }}
              >
                {isPublishing ? "送信中…" : publishLabel}
              </button>
              <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 10 }}>
                公開することで、求人掲載ガイドラインに同意したものとみなされます。
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  }

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <div className="jef-root">
      <style>{`
        .jef-root { display: flex; flex-direction: column; height: calc(100vh - var(--biz-header-h)); }
        .jef-body { display: grid; grid-template-columns: 240px minmax(0,1fr); flex: 1; overflow: hidden; }
        /* ★社内メモ（2026-10-12）。1280px 以上は右に固定の枠、1279px 以下はフォームの上に折りたたみ */
        .jef-note-side { display: none; }
        @media (min-width: 1280px) {
          .jef-body { grid-template-columns: 240px minmax(0,1fr) 300px; }
          .jef-note-side { display: block; overflow-y: auto; padding: 28px 20px 40px 0; }
          .jef-note-collapsible { display: none; }
        }
        .jef-2col { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; }
        .jef-main { overflow-y: auto; padding: 28px 40px 60px; max-width: 900px; }
        .jef-card { padding: 24px 28px; }
        .jef-more summary { list-style: none; }
        .jef-more summary::-webkit-details-marker { display: none; }
        .jef-more[open] .jef-more-plus { display: none; }
        .jef-more:not([open]) .jef-more-minus { display: none; }
        /* ★スマホでは BusinessLayout が本文に余白（20px 16px 48px）を足す。この画面は自分で余白を持つので打ち消す（2026-10-20）。
              打ち消さないと、上の帯と目次が両端16pxずつ浮いて見えた。⚠️ 境界は BusinessLayout と同じ 768px */
        @media (max-width: 768px) {
          .jef-root { margin: -20px -16px -48px; }
        }
        @media (max-width: 767px) {
          .jef-root { height: auto; }
          .jef-body { grid-template-columns: minmax(0,1fr); overflow: visible; }
          .jef-2col { grid-template-columns: minmax(0,1fr); }
          .jef-main { padding: 20px 16px 48px; overflow-y: visible; }
          .jef-card { padding: 18px 16px; }
          .jef-head-title { display: none; }
        }
      `}</style>

      {/* 編集サブヘッダー */}
      <div style={{
        height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
        background: "rgba(255,255,255,0.96)", borderBottom: "1px solid var(--line)",
      }}>
        <Link href="/biz/jobs" style={{
          display: "flex", alignItems: "center", gap: 6, paddingRight: 12, borderRight: "1px solid var(--line)",
          color: "var(--ink-soft)", fontSize: 13, fontWeight: 500, textDecoration: "none", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          求人一覧
        </Link>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span className="jef-head-title" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {pageTitle}
          </span>
          {saveStatusText && (
            <span role="status" style={{ fontSize: 12, color: saveStatusColor, flexShrink: 0 }}>{saveStatusText}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            /* `/biz/jobs/{id}/preview` は所属チェック付き・描画は公開ページと同じ `JobDetailView`。 */
            if (currentJobId) window.open(`/biz/jobs/${currentJobId}/preview`, "_blank", "noopener,noreferrer");
          }}
          disabled={!currentJobId}
          title={currentJobId ? undefined : "タイトルを入れると下書きが作られ、プレビューできます"}
          style={{
            padding: "7px 14px", fontSize: 13, fontWeight: 600, border: "1px solid var(--line)", borderRadius: 8,
            background: "#fff", color: currentJobId ? "var(--ink)" : "var(--ink-mute)", cursor: currentJobId ? "pointer" : "not-allowed", flexShrink: 0,
          }}
        >
          プレビュー
        </button>
      </div>

      {/* 2カラム：目次 + フォーム */}
      <div className="jef-body">
        <JobEditSubNav
          steps={steps}
          activeStep={current.id}
          onStepClick={goToStep}
          missing={blockers}
          onMissingClick={goToField}
          readyNote={decision.kind === "blocked" && decision.reason === "company_not_listed" ? "企業ページの公開後に公開できます"
            : state === "reopen_requested" ? "再開を依頼済みです（運営が確認中）"
            : decision.kind === "review" ? "再開を依頼すると運営が確認します" : null}
        />

        <main id="jef-main" className="jef-main">
          {/* ★社内メモ（1279px 以下はここに折りたたみ。1280px 以上は右の枠） */}
          <JobInternalNote jobId={currentJobId} variant="collapsible" />
          {/* ★停止中の知らせ（2026-10-12。下書き／公開中／停止中の3つ）。⚠️ 状態は灰色の文字で（バッジにしない） */}
          {mode === "edit" && (state === "stopped_self" || state === "stopped_ops" || state === "reopen_requested") && (
            <div data-state={`job-${state}-notice`} style={{
              background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, lineHeight: 1.8, color: "var(--ink)",
            }}>
              <div style={{ color: "var(--ink-mute)" }}>
                {state === "stopped_self" ? "停止中（自社で停止）" : state === "stopped_ops" ? "停止中（OPINIO 運営が停止）" : "停止中（OPINIO 運営が停止・再開を依頼済み）"}
              </div>
              {state !== "stopped_self" && (initialJob?.stoppedReason || initialJob?.rejectionReason) && (
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>理由：{initialJob?.stoppedReason ?? initialJob?.rejectionReason}</p>
              )}
              <p style={{ margin: "4px 0 0", color: "var(--ink-soft)" }}>
                {state === "stopped_self" ? "「再開する」を押すと、必要な項目がそろっていればすぐに公開されます。"
                  : state === "stopped_ops" ? "内容を直して「再開を依頼する」を押すと、運営が確認したうえで掲載を再開します。"
                  : "運営が確認したうえで掲載を再開します。結果はメールと、この画面でお知らせします。"}
              </p>
            </div>
          )}
          {errorMessage && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", marginBottom: 20, borderRadius: 8,
              background: "var(--error-soft)", border: "1px solid #FCA5A5", fontSize: 13, color: "var(--error-ink)", fontWeight: 600,
            }} role="alert">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} /><span style={{ flex: 1, minWidth: 0 }}>{errorMessage}</span>
              <button type="button" aria-label="閉じる" onClick={() => setErrorMessage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: 16, padding: "0 4px" }}>×</button>
            </div>
          )}

          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 4 }}>ステップ {stepIndex + 1} / {STEP_DEFS.length}</div>
          <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 22, fontWeight: 500, color: "var(--ink)", margin: "0 0 20px" }}>{current.label}</h1>

          {renderStep()}

          {/* ★次のステップへ（行き先を名前で出す）。最後は「確認して公開へ」 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            {prev && (
              <button type="button" onClick={() => goToStep(prev.id)}
                style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, border: "1px solid var(--line)", borderRadius: 8, background: "#fff", color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}>
                戻る
              </button>
            )}
            {next && (
              <button type="button" onClick={() => goToStep(next.id)}
                style={{ marginLeft: "auto", padding: "10px 20px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 8, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                {next.id === "review" ? "確認して公開へ" : `次へ：${next.label}`}
              </button>
            )}
          </div>
        </main>
        <div className="jef-note-side">
          <JobInternalNote jobId={currentJobId} variant="panel" />
        </div>
      </div>
    </div>
  );
}
