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
import { missingForPublish, isPublishRequired, type PublishRequirement } from "@/lib/jobs/publishRequirements";
import { JobRejectionBanner } from "./JobRejectionBanner";
import { RequirementsTagInput } from "./RequirementsTagInput";
import { ProcessStepsEditor } from "./ProcessStepsEditor";
import { BUSINESS_MODELS } from "@/lib/constants/businessModels";
import { JOB_EMPLOYMENT_TYPES } from "@/lib/constants/careerOptions";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";
import { payLabel } from "@/lib/utils/salary";
import { SALES_SEGMENTS, SALES_HUNTER_FARMER_OPTIONS } from "@/lib/constants/salesFields";
import { TECH_STACK_CATEGORIES } from "@/lib/techStack";
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
  { id: "review",       label: "確認して公開申請" },
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
    techStack: [], companyRoleName: "",
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
    // ⚠️ 呼称は BizJob に載っていない。ページ側から initialCompanyRoleName で入れる
    companyRoleName: "",
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
   * ★最初に開くステップ（2026-09-21）。求人管理のカードの「公開申請へ」が `review` を渡す。
   * ⚠️ 公開申請は**この画面の「確認して公開申請」からだけ**行う。掲載ガイドラインへの同意の一文が
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
  const [companyRoles, setCompanyRoles] = useState<{ name: string; departmentIds: string[] }[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/biz/job-roles")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.jobRoles) return;
        setCompanyRoles((d.jobRoles as { name: string; departmentIds?: string[] }[])
          .map((x) => ({ name: x.name, departmentIds: x.departmentIds ?? [] })));
      })
      .catch((e) => console.error("[JobEditForm] job-roles fetch", e));
    return () => { alive = false; };
  }, []);

  /* ★選んだ部門の職種を先に並べる（2026-09-22）。紐付けは /biz/organization の職種タブで付ける。
        ⚠️ 並べ替えるだけで、他の職種も選べるまま（絞り込まない） */
  const deptRoleNames = departmentId
    ? companyRoles.filter((r) => r.departmentIds.includes(departmentId)).map((r) => r.name)
    : [];
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
     ⚠️★判定は `missingForPublish()` の1か所。目次・「必須」の印・公開申請ボタンが同じ結果を見る。
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
  }), [form, selectedRoles]);

  const handlePublish = useCallback(async () => {
    const jobId = currentJobId;
    if (!jobId) return;
    if (missing.length > 0) {
      showError(`公開申請の前に入力してください：${missing.map((m) => m.label).join("・")}`);
      return;
    }
    setIsPublishing(true);
    try {
      const saveRes = await fetch(`/api/biz/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        /* ⚠️★`jobRoles` を必ず送る。2026-10-11 まで送っておらず、PUT は「送られた職種で置き換える」ので
              **公開申請を押すと職種が全部外れていた**（route.ts の ow_job_roles 同期）。 */
        body: JSON.stringify({ ...form, departmentId: departmentId || null, jobRoles: selectedRoles }),
      });
      if (!saveRes.ok) throw new Error("save failed");
      const submitRes = await fetch(`/api/biz/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", value: "pending_review" }),
      });
      if (!submitRes.ok) throw new Error("submit failed");
      router.push("/biz/jobs");
    } catch {
      showError("公開申請に失敗しました。再度お試しください。");
    } finally {
      setIsPublishing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, currentJobId, router, missing, selectedRoles, departmentId]);

  const req = (key: string) => isPublishRequired(key);

  const stepStatus = (id: StepId): StepStatus => {
    if (id === "review") return null;
    if (id === "more") return "optional";
    if (missing.some((m) => m.step === id)) return "todo";
    if (id === "requirements") return form.requiredSkills.length > 0 || form.preferredSkills.length > 0 ? "done" : "todo";
    if (id === "process") return form.selectionSteps.some((s) => s.trim()) ? "done" : "todo";
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
                <FormInput id="jef-title" value={form.title} onChange={(v) => updateForm("title", v)} placeholder="例：プロダクトマネージャー（タイミーキャリアプラス）" />
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
                      placeholder="職種名で検索して追加（例: 法人営業、マーケティング、動画）"
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

      case "conditions":
        return (
          <>
            <FormSection title="雇用形態と給与">
              <FormGroup>
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
              </FormGroup>
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
                    ? <>公開申請には下限と上限が必要です。決め方は下の「給与の補足」に書けます（例：経験・能力により決定）</>
                    : <>求職者側では「{payLabel(form.employmentType)}{form.salaryMin || "?"}万円〜{form.salaryMax || "?"}万円」と表示されます</>}
                </Hint>
              </FormGroup>
              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel htmlFor="jef-salary-note">給与の補足</FormLabel>
                <FormTextarea id="jef-salary-note" value={form.salaryNote} onChange={(v) => updateForm("salaryNote", v)} placeholder="例：経験・能力により決定。賞与は年2回、業績連動。" rows={3} maxLength={200} />
              </FormGroup>
            </FormSection>

            <FormSection title="勤務地と働き方">
              <FormGroup>
                <FormLabel required={req("location")} htmlFor="jef-location">勤務地</FormLabel>
                <FormInput id="jef-location" value={form.location} onChange={(v) => updateForm("location", v)} placeholder="例：東京都豊島区東池袋1-9-6" />
              </FormGroup>
              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel htmlFor="jef-remote">リモートワーク</FormLabel>
                <FormSelect id="jef-remote" value={form.remoteWorkStatus} onChange={(v) => updateForm("remoteWorkStatus", v)} options={REMOTE_WORK_STATUSES} />
              </FormGroup>
            </FormSection>

            {/* ★勤務時間・休日（2026-09-02 追加）。⚠️ 自由入力にしてある（企業ごとに書き方が違う）。
                   選択肢にするなら UI・API・DB の CHECK を3つ揃えること。 */}
            <FormSection title="勤務時間と休日">
              <FormGroup>
                <FormLabel required={req("workHours")} htmlFor="jef-work-hours">勤務時間</FormLabel>
                <FormInput id="jef-work-hours" value={form.workHours} onChange={(v) => updateForm("workHours", v)} placeholder="例：9:00〜18:00（休憩60分）、フレックスタイム制（コア11:00〜15:00）" />
              </FormGroup>
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
          </>
        );

      case "requirements":
        return (
          <FormSection title="経験・スキル">
            <FormGroup>
              <FormLabel>必須の経験</FormLabel>
              <RequirementsTagInput tags={form.requiredSkills} onTagsChange={(t) => updateForm("requiredSkills", t)} placeholder="経験・スキルを入力して Enter" />
              <Hint>業務に欠かせない経験・スキルを書いてください。年齢・性別などの属性は書かないでください。</Hint>
            </FormGroup>
            <FormGroup style={{ marginBottom: 0 }}>
              <FormLabel>歓迎する経験</FormLabel>
              <RequirementsTagInput tags={form.preferredSkills} onTagsChange={(t) => updateForm("preferredSkills", t)} placeholder="経験・スキルを入力して Enter" />
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
              書かなくても公開申請できます。書くと、求職者が応募するかを決めやすくなります。
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
                  <FormInput id="jef-department" value={form.department} onChange={(v) => updateForm("department", v)} placeholder="例：タイミーキャリアプラス事業部" />
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

            {/* 公開申請 */}
            <div data-state={missing.length === 0 ? "ready" : "missing"} style={{
              background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", marginTop: 8,
            }}>
              {missing.length > 0 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                    公開申請の前に、あと{missing.length}つ入力してください
                  </div>
                  <ul style={{ margin: "0 0 14px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {missing.map((r) => (
                      <li key={r.key}>
                        <button type="button" onClick={() => goToField(r)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--royal)", textDecoration: "underline" }}>
                          {r.label}（{STEP_DEFS.find((s) => s.id === r.step)?.label}）
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>公開申請できます</div>
              )}
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 14 }}>
                申請のあと、OPINIO 運営が内容を確認します（通常2〜3営業日）。確認が済むと求職者に公開されます。
              </div>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || missing.length > 0 || !currentJobId}
                style={{
                  padding: "12px 28px", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  background: isPublishing || missing.length > 0 || !currentJobId ? "var(--line)" : "var(--royal)",
                  color: isPublishing || missing.length > 0 || !currentJobId ? "var(--ink-mute)" : "#fff",
                  cursor: isPublishing || missing.length > 0 || !currentJobId ? "not-allowed" : "pointer",
                }}
              >
                {isPublishing ? "送信中…" : "公開申請する"}
              </button>
              <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 10 }}>
                公開申請することで、求人掲載ガイドラインに同意したものとみなされます。
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
        .jef-2col { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; }
        .jef-main { overflow-y: auto; padding: 28px 40px 60px; max-width: 900px; }
        .jef-card { padding: 24px 28px; }
        .jef-more summary { list-style: none; }
        .jef-more summary::-webkit-details-marker { display: none; }
        .jef-more[open] .jef-more-plus { display: none; }
        .jef-more:not([open]) .jef-more-minus { display: none; }
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
          missing={missing}
          onMissingClick={goToField}
        />

        <main id="jef-main" className="jef-main">
          {mode === "edit" && initialJob?.status === "rejected" && initialJob.rejectionReason && (
            <JobRejectionBanner reason={initialJob.rejectionReason} date={initialJob.rejectionDate} reviewer={initialJob.rejectionReviewer} />
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

          {/* ★次のステップへ（行き先を名前で出す）。最後は「確認して公開申請へ」 */}
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
                {next.id === "review" ? "確認して公開申請へ" : `次へ：${next.label}`}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
