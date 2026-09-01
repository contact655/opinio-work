"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { TeamMember } from "@/lib/business/jobs";
import Link from "next/link";
import type { BizJob } from "@/lib/business/mockJobs";
import { JobEditSubNav, type EditSection } from "./JobEditSubNav";
import { JobRejectionBanner } from "./JobRejectionBanner";
import { RequirementsTagInput } from "./RequirementsTagInput";
import { ProcessStepsEditor } from "./ProcessStepsEditor";
import { BUSINESS_MODELS } from "@/lib/constants/businessModels";
import { JOB_EMPLOYMENT_TYPES } from "@/lib/constants/careerOptions";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";
import { SALES_SEGMENTS, SALES_HUNTER_FARMER_OPTIONS } from "@/lib/constants/salesFields";
import { TECH_STACK_CATEGORIES } from "@/lib/techStack";

// ─── 定数 ───────────────────────────────────────────────────────────────────

// ⚠️ 雇用形態はここに直書きしない。API の検証と DB の CHECK と同じ定数を見る
const DURATION_OPTIONS = ["応相談", "1ヶ月以内", "3ヶ月以内", "半年以内"];

const MOCK_TEAM = [
  { id: "member-1", name: "山田 太郎（あなた）", role: "人事部 採用マネージャー · Admin", gradient: "linear-gradient(135deg, var(--royal), var(--accent))", initial: "山" },
  { id: "member-2", name: "鈴木 花子", role: "人事部 採用担当 · Member", gradient: "linear-gradient(135deg, #FBBF24, #D97706)", initial: "鈴" },
  { id: "member-3", name: "中村 一郎", role: "プロダクト部 マネージャー · Member", gradient: "linear-gradient(135deg, #34D399, var(--success))", initial: "中" },
];

const SECTION_DEFS = [
  { id: "basic",        label: "基本情報",       showStatus: true },
  { id: "salary",       label: "給与・労働条件",  showStatus: true },
  { id: "content",      label: "仕事内容",        showStatus: true },
  { id: "requirements", label: "求める人物像",    showStatus: true },
  { id: "process",      label: "選考プロセス",    showStatus: true },
  { id: "assignee",     label: "採用担当者",      showStatus: true },
  { id: "settings",     label: "公開設定",        showStatus: false },
];

type FormMode = "new" | "edit";

type FormState = {
  title: string;
  employmentType: string;
  jobCategory: string;
  department: string;
  salaryMin: string;
  salaryMax: string;
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
    salaryMin: "", salaryMax: "", salaryNote: "", location: "", remoteWorkStatus: "",
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
    assigneeIds: job.assigneeNames.map((_, i) => MOCK_TEAM[i]?.id ?? `member-${i + 1}`),
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

function FormLabel({ children, required, optional, htmlFor }: { children: React.ReactNode; required?: boolean; optional?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
      {children}
      {required && <span style={{ color: "var(--error)", fontSize: 12, fontWeight: 600 }}>必須</span>}
      {optional && <span style={{ color: "var(--ink-mute)", fontSize: 12, fontWeight: 400 }}>任意</span>}
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

function FormSection({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, padding: "26px 30px", marginBottom: 18,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: desc ? 6 : 18, display: "flex", alignItems: "center", gap: 8 }}>
        {title}
      </div>
      {desc && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 18, lineHeight: 1.7 }}>{desc}</div>}
      {children}
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
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => {
    const base = { ...jobToForm(initialJob), companyRoleName: initialCompanyRoleName };
    if (initialAssigneeIds?.length) return { ...base, assigneeIds: initialAssigneeIds };
    return base;
  });
  const [departmentId, setDepartmentId] = useState<string>(initialDepartmentId ?? "");
  const [activeSection, setActiveSection] = useState("basic");
  const [isCreating, setIsCreating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // currentJobId: 新規モードでも自動保存後の ID を追跡する
  // 初期値は initialJob?.id（編集モード）または null（新規モード）
  const [currentJobId, setCurrentJobId] = useState<string | null>(initialJob?.id ?? null);
  const [selectedRoles, setSelectedRoles] = useState<SelectedRole[]>(initialJobRoles);
  /* ⚠️ 2段セレクト用の roleParentId / roleChildId / childRoles / addRole は
        2026-08-06 に検索セレクトへ置き換えたので削除した。追加は addRoleById 一本。 */

  const parentRoles = useMemo(() => roles.filter((r) => r.parent_id === null), [roles]);

  // セールス専用ブロック（OTE・担当セグメント）の出し分け。
  // 旧実装は job_category のフリーテキストを見ていたが、その入力欄を廃止したため
  // 選択中のロールが「営業」配下かどうかで判定する。ow_roles は最大3階層あり
  // （営業 → ソリューションエンジニア・プリセールス → セールスエンジニア）、
  // 親を1回辿るだけでは足りないのでルートまで遡る。
  const isSalesSelected = useMemo(() => {
    const byId = new Map(roles.map((r) => [r.id, r]));
    const salesRootId = parentRoles.find((r) => r.name === "営業")?.id;
    if (!salesRootId) return false;
    return selectedRoles.some((sr) => {
      let node = byId.get(sr.roleId);
      const seen = new Set<string>();
      while (node && !seen.has(node.id)) {
        if (node.id === salesRootId) return true;
        seen.add(node.id);
        node = node.parent_id ? byId.get(node.parent_id) : undefined;
      }
      return false;
    });
  }, [roles, parentRoles, selectedRoles]);

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
  const effectiveTeam = teamMembers ?? MOCK_TEAM;

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
  }, [form, selectedRoles, currentJobId, companyId]);

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
  const [companyRoleSuggestions, setCompanyRoleSuggestions] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/biz/job-roles")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.jobRoles) return;
        setCompanyRoleSuggestions((d.jobRoles as { name: string }[]).map((x) => x.name));
      })
      .catch((e) => console.error("[JobEditForm] job-roles fetch", e));
    return () => { alive = false; };
  }, []);

  // selectedRoles が変わるたびに自動保存トリガー
  useEffect(() => {
    if (currentJobId) triggerAutosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoles]);

  const handleCreate = useCallback(async () => {
    if (!form.title.trim()) { showError("求人タイトルを入力してください。"); return; }
    setIsCreating(true);
    try {
      if (currentJobId) {
        // 自動保存が既にレコードを作成済み → ページを edit モードでリロードして完全に切り替える
        router.replace(`/biz/jobs/${currentJobId}/edit`);
        return;
      }
      const res = await fetch("/api/biz/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, departmentId: departmentId || null, companyId }),
      });
      if (!res.ok) throw new Error("create failed");
      const { id } = await res.json() as { id: string };
      router.replace(`/biz/jobs/${id}/edit`);
    } catch {
      showError("求人の作成に失敗しました。再度お試しください。");
    } finally {
      setIsCreating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, companyId, router, currentJobId]);

  const handlePublish = useCallback(async () => {
    const jobId = currentJobId;
    if (!jobId) return;
    setIsPublishing(true);
    try {
      const saveRes = await fetch(`/api/biz/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, departmentId: departmentId || null }),
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
  }, [form, currentJobId, router]);

  // セクション完成度チェック
  const sectionComplete = useMemo(() => ({
    basic:        !!form.title.trim(),
    salary:       !!(form.salaryMin && form.salaryMax),
    content:      !!form.descriptionMarkdown.trim(),
    requirements: form.requiredSkills.length > 0 || !!form.cultureFit.trim(),
    process:      form.selectionSteps.length > 0,
    assignee:     form.assigneeIds.length > 0,
    settings:     true,
  }), [form]);

  const completionPercent = useMemo(() => {
    const keys = ["basic", "salary", "content", "requirements", "process", "assignee"] as const;
    const done = keys.filter((k) => sectionComplete[k]).length;
    return Math.round((done / keys.length) * 100);
  }, [sectionComplete]);

  const sections: EditSection[] = SECTION_DEFS.map((s) => ({
    ...s,
    isComplete: sectionComplete[s.id as keyof typeof sectionComplete],
  }));

  // topbar 保存状態ピル
  const saveStatusStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 12, padding: "4px 10px", borderRadius: 100,
    transition: "all 0.3s", flexShrink: 0,
    ...(saveState === "saving" ? { color: "var(--warm-ink)", background: "var(--warm-soft)" }
      : saveState === "saved"  ? { color: "var(--success-ink)", background: "var(--success-soft)" }
      : saveState === "error"  ? { color: "var(--error-ink)", background: "var(--error-soft)" }
      : { color: "var(--ink-mute)", background: "var(--bg-tint)" }),
  };
  const saveStatusText = saveState === "saving" ? "下書きに保存中..."
    : saveState === "saved"  ? "下書きを自動保存しました"
    : saveState === "error"  ? "保存に失敗しました"
    : "編集中";

  const pageTitle = mode === "new" ? "求人を作成" : (initialJob?.title ?? "求人を編集");

  // ── セクションレンダラー ───────────────────────────────────────────────

  function renderSection() {
    switch (activeSection) {
      case "basic":
        return (
          <>
            <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>基本情報</h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.9 }}>求人の基本情報を入力してください。求職者側の検索・一覧表示に使われる重要な項目です。</p>
            <FormSection title="求人タイトル・職種">
              <FormGroup>
                <FormLabel required htmlFor="jef-title">求人タイトル</FormLabel>
                <FormInput id="jef-title" value={form.title} onChange={(v) => updateForm("title", v)} placeholder="例：プロダクトマネージャー（タイミーキャリアプラス）" required />
                <Hint>求職者が最初に目にする最重要項目。ポジション名 + 補足情報を記載してください。</Hint>
              </FormGroup>
              <FormGroup>
                <FormLabel required>雇用形態</FormLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {JOB_EMPLOYMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("employmentType", type)}
                      style={{
                        padding: "8px 16px",
                        background: form.employmentType === type ? "var(--royal)" : "#fff",
                        border: `1.5px solid ${form.employmentType === type ? "var(--royal)" : "var(--line)"}`,
                        borderRadius: 100,
                        fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                        color: form.employmentType === type ? "#fff" : "var(--ink-soft)",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </FormGroup>
              {/*
                「職種カテゴリ」セレクト（JOB_CATEGORIES 7値 → ow_jobs.job_category）は
                2026-08-03 に削除した。職種は下の「職種（ow_roles）」ピッカー一本に統一する。

                削除した理由: この7値（営業 / PdM・PM / エンジニア / その他 など）が
                職種ページ側の語彙と噛み合わず、正しく選んでも4/7はどの職種ページにも
                載らなかった。二重入力で、しかも壊れているほうを残す理由が無い。

                job_category カラム自体はまだ残っており、API 側で primary ロール名から
                派生させて書いている（表示用の互換値）。参照箇所の移行が済んだら列ごと落とす。
              */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel optional htmlFor="jef-department">所属部門</FormLabel>
                  {departments.length > 0 ? (
                    <div>
                      <select
                        id="jef-department"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
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
                        <option value="">部門を選択（任意）</option>
                        {departments.filter((d) => !d.parent_id).map((parent) => (
                          <optgroup key={parent.id} label={parent.name}>
                            <option value={parent.id}>{parent.name}（全体）</option>
                            {departments.filter((d) => d.parent_id === parent.id).map((child) => (
                              <option key={child.id} value={child.id}>　└ {child.name}</option>
                            ))}
                          </optgroup>
                        ))}
                        {departments.filter((d) => !d.parent_id && !departments.some((c) => c.parent_id === d.id)).length === 0 && null}
                      </select>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 5 }}>
                        部門マスタは <a href="/biz/organization" target="_blank" rel="noopener" style={{ color: "var(--royal)", textDecoration: "underline" }}>組織体制</a> から管理できます
                      </p>
                    </div>
                  ) : (
                    <div>
                      <FormInput id="jef-department" value={form.department} onChange={(v) => updateForm("department", v)} placeholder="例：タイミーキャリアプラス事業部" />
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 5 }}>
                        <a href="/biz/organization" target="_blank" rel="noopener" style={{ color: "var(--royal)", textDecoration: "underline" }}>組織体制</a> で部門マスタを登録すると、ここでセレクトできるようになります
                      </p>
                    </div>
                  )}
                </FormGroup>
              </div>
              {/* 職種マスタ連携 */}
              {roles.length > 0 && (
                <FormGroup>
                  <FormLabel optional>職種（マスタ紐づけ）</FormLabel>
                  {/*
                    ⚠️ 2026-08-06 に2段セレクトから検索セレクトに置き換えた。
                       105件を目視で探させるUIが機能しておらず、求人20件が
                       大分類11件と孫7件に偏り、中間の子職種が1件も使われていなかった。
                    ⚠️ selectableParent={false} は2段セレクト時代の制約をそのまま維持している。
                       旧UIは「子があるカテゴリでは親を選べない」形だった
                       （targetId = childRoles.length > 0 ? roleChildId : roleParentId）。
                       子を持たない大分類は従来どおり選べる。
                    ⚠️ 選択済みタグ・代表切替・解除には手を触れていない。
                       addRole を呼ぶ手段を差し替えただけ。
                  */}
                  <div style={{ marginBottom: 8 }}>
                    <RoleSearchSelect
                      roles={roles}
                      aliases={roleAliases}
                      value=""
                      clearOnSelect
                      selectableParent={false}
                      onSelect={(id) => addRoleById(id)}
                      ariaLabel="職種を検索して追加"
                      placeholder="職種名で検索して追加（例: 法人営業、AE）"
                    />
                  </div>
                  {selectedRoles.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selectedRoles.map((sr) => {
                        const role = roles.find((r) => r.id === sr.roleId);
                        return (
                          <div key={sr.roleId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: sr.isPrimary ? "var(--royal-50)" : "var(--bg-tint)", border: `1px solid ${sr.isPrimary ? "var(--royal-100)" : "var(--line)"}` }}>
                            <input type="radio" name="primary-role" checked={sr.isPrimary} onChange={() => setPrimary(sr.roleId)} style={{ accentColor: "var(--royal)", cursor: "pointer" }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: sr.isPrimary ? 700 : 400, color: sr.isPrimary ? "var(--royal)" : "var(--ink)" }}>
                              {role?.name ?? sr.roleId}
                              {sr.isPrimary && <span style={{ marginLeft: 6, fontSize: 12, color: "var(--ink-mute)", fontWeight: 400 }}>（代表）</span>}
                            </span>
                            <button type="button" onClick={() => removeRole(sr.roleId)} style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>解除</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 6 }}>
                    複数選択可。ラジオボタンで代表職種を1つ指定してください。
                  </p>
                </FormGroup>
              )}
              {/*
                自社での呼び方。表示は自社呼称・検索は標準職種、の入力側。
                ⚠️ 代表職種が決まっていないと紐づけ先（standard_role_id）が無いので出さない。
                ⚠️ 代表職種を切り替えてもこの値は保持する。紐づけ先が変わるだけ。
              */}
              {roles.length > 0 && selectedRoles.some((r) => r.isPrimary) && (
                <FormGroup>
                  <FormLabel optional htmlFor="jef-company-role-name">自社での呼び方</FormLabel>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: -4, marginBottom: 8, lineHeight: 1.6 }}>
                    社内やスカウトで使っている呼称があれば入力してください（例: CXデザイナー）
                  </p>
                  <FormInput
                    id="jef-company-role-name"
                    list="jef-company-role-suggestions"
                    value={form.companyRoleName}
                    onChange={(v) => updateForm("companyRoleName", v)}
                    placeholder="例：CXデザイナー"
                  />
                  <datalist id="jef-company-role-suggestions">
                    {companyRoleSuggestions.map((n) => <option key={n} value={n} />)}
                  </datalist>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 6 }}>
                    求人ページにはこの呼び方が出ます。検索や絞り込みは上で選んだ標準職種のままです。
                  </p>
                </FormGroup>
              )}
              <FormGroup>
                <FormLabel optional htmlFor="jef-business-model">業態タグ（プロダクト特性）</FormLabel>
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: -4, marginBottom: 8, lineHeight: 1.6 }}>
                  「どういう売り方・提供形態か」を求職者に伝えるタグです。業界（ドメイン）とは別の軸です。
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {BUSINESS_MODELS.map((m) => {
                    const isActive = form.businessModel === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => updateForm("businessModel", isActive ? "" : m.key)}
                        title={m.desc || undefined}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 20,
                          border: `1.5px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
                          background: isActive ? "var(--royal-50)" : "#fff",
                          color: isActive ? "var(--royal)" : "var(--ink-soft)",
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 400,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all 0.1s",
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </FormGroup>

              {/* 技術スタック (Migration 245) */}
              <FormGroup>
                <FormLabel optional>技術スタック</FormLabel>
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: -4, marginBottom: 12, lineHeight: 1.6 }}>
                  このポジションで主に使う技術・ツールを選択してください（複数可、任意）。
                </p>
                {TECH_STACK_CATEGORIES.map((cat) => (
                  <div key={cat.label} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                      {cat.label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {cat.items.map((tech) => {
                        const isActive = form.techStack.includes(tech);
                        return (
                          <button
                            key={tech}
                            type="button"
                            onClick={() => {
                              const next = isActive
                                ? form.techStack.filter((t) => t !== tech)
                                : [...form.techStack, tech];
                              updateForm("techStack", next);
                            }}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 20,
                              border: `1.5px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
                              background: isActive ? "var(--royal-50)" : "#fff",
                              color: isActive ? "var(--royal)" : "var(--ink-soft)",
                              fontSize: 13,
                              fontWeight: isActive ? 700 : 400,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              transition: "all 0.1s",
                            }}
                          >
                            {isActive && <span style={{ marginRight: 4 }}>✓</span>}{tech}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {form.techStack.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginRight: 4 }}>選択中:</span>
                    {form.techStack.map((t) => (
                      <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", fontSize: 12, fontWeight: 700 }}>
                        {t}
                        <button type="button" onClick={() => updateForm("techStack", form.techStack.filter((x) => x !== t))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--royal)", fontSize: 14, lineHeight: 1, padding: 0, fontFamily: "inherit" }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </FormGroup>
            </FormSection>
          </>
        );

      case "salary":
        return (
          <>
            <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>給与・労働条件</h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.9 }}>給与レンジ、勤務地、勤務形態など、労働条件を入力してください。</p>
            <FormSection title="給与">
              <FormGroup>
                <FormLabel required>基本給レンジ</FormLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 60px", gap: 8, alignItems: "center" }}>
                  <FormInput value={form.salaryMin} onChange={(v) => updateForm("salaryMin", v)} placeholder="600" type="number" id="jef-salary-min" />
                  <span style={{ color: "var(--ink-mute)", fontWeight: 600 }}>〜</span>
                  <FormInput value={form.salaryMax} onChange={(v) => updateForm("salaryMax", v)} placeholder="1000" type="number" id="jef-salary-max" />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                </div>
                {/* 入力時バリデーション */}
                {form.salaryMin && form.salaryMax && Number(form.salaryMax) < Number(form.salaryMin) && (
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 4 }}>最高給与は最低給与以上に設定してください</p>
                )}
                {form.salaryMin && form.salaryMax && Number(form.salaryMax) >= Number(form.salaryMin) && (Number(form.salaryMax) - Number(form.salaryMin)) > 250 && (
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--warm-ink)", marginTop: 4 }}>⚠ レンジ幅が250万円を超えています。求職者に分かりやすい範囲か確認してください</p>
                )}
                {/* 未入力時の注意文 */}
                {(!form.salaryMin && !form.salaryMax) && (
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.6 }}>
                    💡 給与レンジを記載すると応募数が増加します。未記載の求人は検索結果で下位に表示されます。
                  </p>
                )}
                <Hint>固定報酬ベースのレンジです。求職者側では「基本給 {form.salaryMin || "?"}〜{form.salaryMax || "?"}万円」と表示されます</Hint>
              </FormGroup>

              {/* ── セールス職専用ブロック ── */}
              {isSalesSelected && (
                <div style={{ border: "1.5px solid #DBEAFE", borderRadius: 12, padding: "20px 20px 12px", background: "#EFF6FF", marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "var(--royal)", color: "#fff" }}>営業職</span>
                    <span style={{ fontSize: 12, color: "#1D4ED8", fontWeight: 600 }}>セールス専用の報酬・担当領域</span>
                  </div>

                  {/* OTE */}
                  <FormGroup>
                    <FormLabel optional>OTE（目標達成時の想定年収）</FormLabel>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: -4, marginBottom: 8, lineHeight: 1.6 }}>
                      インセンティブ・コミッション込みで目標達成時に想定される年収レンジ。基本給レンジとは別に入力してください。
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 60px", gap: 8, alignItems: "center" }}>
                      <FormInput value={form.oteMin} onChange={(v) => updateForm("oteMin", v)} placeholder="800" type="number" id="jef-ote-min" />
                      <span style={{ color: "var(--ink-mute)", fontWeight: 600 }}>〜</span>
                      <FormInput value={form.oteMax} onChange={(v) => updateForm("oteMax", v)} placeholder="1400" type="number" id="jef-ote-max" />
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                    </div>
                  </FormGroup>

                  {/* 担当セグメント */}
                  <FormGroup>
                    <FormLabel optional>担当セグメント</FormLabel>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {SALES_SEGMENTS.map((seg) => {
                        const isActive = form.salesSegment.includes(seg.key);
                        return (
                          <button
                            key={seg.key}
                            type="button"
                            title={seg.desc}
                            onClick={() => {
                              const next = isActive
                                ? form.salesSegment.filter((s) => s !== seg.key)
                                : [...form.salesSegment, seg.key];
                              updateForm("salesSegment", next);
                            }}
                            style={{
                              padding: "8px 16px", borderRadius: 100,
                              border: `1.5px solid ${isActive ? "#1D4ED8" : "var(--line)"}`,
                              background: isActive ? "#DBEAFE" : "#fff",
                              color: isActive ? "#1D4ED8" : "var(--ink-soft)",
                              fontSize: 13, fontWeight: isActive ? 700 : 400,
                              cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                            }}
                          >
                            {seg.label}
                          </button>
                        );
                      })}
                    </div>
                    <Hint>複数選択可。SMB・ミッドマーケット・エンタープライズなど担当する市場規模を選んでください</Hint>
                  </FormGroup>

                  {/* 新規/既存の傾向 */}
                  <FormGroup>
                    <FormLabel optional>新規/既存の傾向</FormLabel>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {SALES_HUNTER_FARMER_OPTIONS.map((opt) => {
                        const isActive = form.salesHunterFarmer === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            title={opt.desc}
                            onClick={() => updateForm("salesHunterFarmer", isActive ? "" : opt.key)}
                            style={{
                              padding: "8px 16px", borderRadius: 100,
                              border: `1.5px solid ${isActive ? "#1D4ED8" : "var(--line)"}`,
                              background: isActive ? "#DBEAFE" : "#fff",
                              color: isActive ? "#1D4ED8" : "var(--ink-soft)",
                              fontSize: 13, fontWeight: isActive ? 700 : 400,
                              cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </FormGroup>

                  {/* インセンティブ補足 */}
                  <FormGroup style={{ marginBottom: 4 }}>
                    <FormLabel optional htmlFor="jef-incentive-note">インセンティブ補足</FormLabel>
                    <FormTextarea
                      id="jef-incentive-note"
                      value={form.incentiveNote}
                      onChange={(v) => updateForm("incentiveNote", v)}
                      placeholder="例：コミッション上限なし。四半期ごとに目標設定・評価。超過達成時はボーナスあり。"
                      rows={2}
                      maxLength={500}
                    />
                  </FormGroup>
                </div>
              )}

              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel optional htmlFor="jef-salary-note">給与の補足説明</FormLabel>
                <FormTextarea id="jef-salary-note" value={form.salaryNote} onChange={(v) => updateForm("salaryNote", v)} placeholder="例：賞与は年2回、業績連動。ストックオプション制度あり。" rows={3} maxLength={200} />
              </FormGroup>
            </FormSection>
            <FormSection title="勤務地・勤務形態">
              <FormGroup>
                <FormLabel required htmlFor="jef-location">勤務地</FormLabel>
                <FormInput id="jef-location" value={form.location} onChange={(v) => updateForm("location", v)} placeholder="例：東京都豊島区東池袋1-9-6" required />
              </FormGroup>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel required htmlFor="jef-remote">リモートワーク</FormLabel>
                  <FormSelect id="jef-remote" value={form.remoteWorkStatus} onChange={(v) => updateForm("remoteWorkStatus", v)} options={REMOTE_WORK_STATUSES} />
                </FormGroup>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel optional htmlFor="jef-probation">試用期間</FormLabel>
                  <FormInput id="jef-probation" value={form.probationPeriod} onChange={(v) => updateForm("probationPeriod", v)} placeholder="例：3ヶ月" />
                </FormGroup>
              </div>
              {/* ★勤務体系・休日（2026-09-02 追加）。
                     列は前からあったが**入力欄・SELECT・描画のどれも無く、全件0件**だった。
                  ⚠️ 自由入力にしてある。企業ごとに書き方が違い（「フレックス（コア11-15時）」
                     「裁量労働制」など）、選択肢に畳むと必ず当てはまらない企業が出るため。
                     ⚠️ 選択肢にするなら UI・API・DB の CHECK を3つ揃えること。 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel optional htmlFor="jef-work-hours">勤務体系</FormLabel>
                  <FormInput id="jef-work-hours" value={form.workHours} onChange={(v) => updateForm("workHours", v)} placeholder="例: 所定労働時間8時間、フレックスタイム制" />
                </FormGroup>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel optional htmlFor="jef-holidays">休日・休暇</FormLabel>
                  <FormInput id="jef-holidays" value={form.holidays} onChange={(v) => updateForm("holidays", v)} placeholder="例: 完全週休2日制、有給休暇（初年度10日）" />
                </FormGroup>
              </div>
            </FormSection>
          </>
        );

      case "content":
        return (
          <>
            <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>仕事内容</h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.9 }}>具体的な仕事内容、ミッション、入社後の期待値を記述してください。</p>
            <FormSection title="仕事内容の詳細" desc="候補者がポジションをイメージできるよう、具体的な業務内容を記述してください。">
              {/* Markdown editor toolbar + textarea */}
              <div style={{ border: "1.5px solid var(--line)", borderRadius: 8, overflow: "hidden" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--royal)")}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.style.borderColor = "var(--line)"; }}
                tabIndex={-1}
              >
                <div style={{ display: "flex", gap: 2, padding: "6px 8px", background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
                  {["H2", "H3", "B", "I", "List", "Quote", "Link"].map((tool, i) => (
                    <>
                      {(i === 2 || i === 4) && <div key={`div-${i}`} style={{ width: 1, background: "var(--line)", margin: "4px 4px" }} />}
                      <button key={tool} type="button" onClick={() => {}} style={{
                        padding: "5px 10px", background: "transparent", border: "none", borderRadius: 5,
                        fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 700,
                        color: "var(--ink-soft)", cursor: "pointer",
                      }}>{tool}</button>
                    </>
                  ))}
                </div>
                <textarea
                  /* ⚠️ **描画とセットで扱うこと。** 求職者側は `components/common/Markdown`
                        で解釈する（2026-08-26 に対応）。片方だけ変えると
                        「書けるのに出ない」か「記号がそのまま出る」になる。 */
                  aria-label="求人詳細（Markdown）"
                  value={form.descriptionMarkdown}
                  onChange={(e) => updateForm("descriptionMarkdown", e.target.value)}
                  placeholder={"## このポジションのミッション\n\n具体的な業務内容を記載してください。"}
                  rows={10}
                  style={{
                    width: "100%", padding: "14px 16px", border: "none",
                    background: "#fff", fontFamily: "inherit", fontSize: 13,
                    color: "var(--ink)", lineHeight: 1.8, resize: "vertical",
                    minHeight: 200, outline: "none",
                  }}
                />
              </div>
            </FormSection>
            <FormSection title="候補者へのメッセージ" desc="採用担当者から候補者へのメッセージ。求職者側の求人詳細ページに表示されます。">
              <FormTextarea id="jef-message-to-candidates" value={form.messageToCandidates} onChange={(v) => updateForm("messageToCandidates", v)} placeholder="例：BtoCマーケティングの経験を活かして、社会的意義のあるプロダクトに関わりたい方をお待ちしています。" rows={5} maxLength={500} />
            </FormSection>
            <FormSection title="なぜ今採用するか" desc="採用背景・ビジネス課題・チームの状況を記述してください。求職者の意欲を高めます。">
              <FormTextarea id="jef-why-hire" value={form.whyHire} onChange={(v) => updateForm("whyHire", v)} placeholder="例：プロダクトの急成長にともない、PMが1名から3名体制に拡充する必要があります。新機能ロードマップの推進を担うポジションです。" rows={4} maxLength={600} />
            </FormSection>
            <FormSection title="チーム構成" desc="人数・職種・チームの雰囲気などを記述してください。">
              <FormTextarea id="jef-team-composition" value={form.teamComposition} onChange={(v) => updateForm("teamComposition", v)} placeholder="例：プロダクトチームはPM2名、エンジニア8名、デザイナー2名の12名構成。週1でチーム全体のレトロスペクティブを実施。" rows={4} maxLength={600} />
            </FormSection>
            <FormSection title="入社後90日でやること" desc="最初のミッション・期待役割を明示することで候補者の不安を解消できます。">
              <FormTextarea id="jef-first-90-days" value={form.first90Days} onChange={(v) => updateForm("first90Days", v)} placeholder="例：1ヶ月目：既存プロダクトのオンボーディング・ユーザーインタビュー参加。2ヶ月目：小規模機能のPRD作成・実装レビュー。3ヶ月目：四半期OKRの一つを担当。" rows={4} maxLength={600} />
            </FormSection>
          </>
        );

      case "requirements":
        return (
          <>
            <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>求める人物像</h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.9 }}>必須スキル・歓迎スキル・求めるカルチャーフィットを記入してください。</p>
            <FormSection title="スキル・経験">
              <FormGroup>
                <FormLabel>必須スキル・経験</FormLabel>
                <RequirementsTagInput
                  tags={form.requiredSkills}
                  onTagsChange={(t) => updateForm("requiredSkills", t)}
                  placeholder="スキルを入力して Enter..."
                />
                <Hint>業務遂行に必要不可欠なスキル・経験を記述してください。年齢・性別等の属性は記載しないでください。</Hint>
              </FormGroup>
              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel optional>歓迎スキル・経験</FormLabel>
                <RequirementsTagInput
                  tags={form.preferredSkills}
                  onTagsChange={(t) => updateForm("preferredSkills", t)}
                  placeholder="歓迎スキルを入力して Enter..."
                />
              </FormGroup>
            </FormSection>
            <FormSection title="求めるカルチャーフィット" desc="スキルだけでは測れない、価値観・働き方のフィットについて記述してください。">
              <FormTextarea id="jef-culture-fit" value={form.cultureFit} onChange={(v) => updateForm("cultureFit", v)} placeholder="例：データドリブンな意思決定を大切にしながらも、ユーザーの声に真摯に向き合える方。" rows={5} maxLength={500} />
            </FormSection>
          </>
        );

      case "process":
        return (
          <>
            <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>選考プロセス</h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.9 }}>候補者がイメージできるよう、選考のステップを記述してください。</p>
            <FormSection title="選考ステップ" desc="通常の選考フローを記入してください。求職者側の求人ページに表示されます。">
              <ProcessStepsEditor
                steps={form.selectionSteps}
                onStepsChange={(s) => updateForm("selectionSteps", s)}
              />
            </FormSection>
            <FormSection title="選考期間の目安">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel htmlFor="jef-selection-duration">カジュアル面談から内定まで</FormLabel>
                  <FormInput id="jef-selection-duration" value={form.selectionDuration} onChange={(v) => updateForm("selectionDuration", v)} placeholder="例：3-4週間" />
                </FormGroup>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel optional htmlFor="jef-start-date">入社可能時期</FormLabel>
                  <FormSelect id="jef-start-date" value={form.startDatePreference} onChange={(v) => updateForm("startDatePreference", v)} options={DURATION_OPTIONS} />
                </FormGroup>
              </div>
            </FormSection>
          </>
        );

      case "assignee":
        return (
          <>
            <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>採用担当者</h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.9 }}>この求人の採用担当者を選択してください。複数選択可能。</p>
            <FormSection title="担当者選択" desc="チームメンバーから、この求人の担当者を選んでください。">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {effectiveTeam.map((member) => {
                  const isActive = form.assigneeIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        const newIds = isActive
                          ? form.assigneeIds.filter((id) => id !== member.id)
                          : [...form.assigneeIds, member.id];
                        updateForm("assigneeIds", newIds);
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "18px 36px 1fr",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 14px",
                        background: isActive ? "var(--royal-50)" : "var(--bg-tint)",
                        border: `1.5px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 18, height: 18,
                        border: `2px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
                        borderRadius: 4,
                        background: isActive ? "var(--royal)" : "transparent",
                        flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isActive && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </div>
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: member.gradient, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 600, fontSize: 14,
                      }}>
                        {member.initial}
                      </div>
                      {/* Info */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{member.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{member.role}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormSection>
          </>
        );

      case "settings":
        return (
          <>
            <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>公開設定</h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.9 }}>求人の公開状態を選択してください。新規・編集後は運営審査を経て公開されます。</p>
            <FormSection title="採用温度感" desc="「HOT」にすると求職者側の求人カードに強調バッジが表示されます。積極的に採用したいポジションに設定してください。">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  { value: "open", label: "OPEN", sublabel: "通常募集", color: "var(--success-ink)", bg: "var(--success-soft)" },
                  { value: "hot",  label: "HOT",  sublabel: "積極採用中", color: "var(--error-ink)", bg: "#FEE2E2" },
                ] as const).map((opt) => {
                  const isSelected = form.urgency === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateForm("urgency", opt.value)}
                      style={{
                        padding: "14px 16px",
                        border: `2px solid ${isSelected ? opt.color : "var(--line)"}`,
                        borderRadius: 10,
                        background: isSelected ? opt.bg : "#fff",
                        cursor: "pointer",
                        textAlign: "left" as const,
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{
                        fontSize: 15, fontWeight: 800, color: isSelected ? opt.color : "var(--ink-mute)",
                        fontFamily: "var(--font-inter), var(--font-noto)", letterSpacing: "0.05em", marginBottom: 3,
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 12, color: isSelected ? opt.color : "var(--ink-mute)", fontWeight: 600 }}>
                        {opt.sublabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormSection>
            <FormSection title="公開状態">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "👁", title: "公開申請する", desc: "「公開申請」ボタンを押すと、運営審査（2-3営業日）を経て、OPINIO上で求職者に公開されます。", isPublic: true },
                  { icon: "🔒", title: "下書きとして保存", desc: "求人を下書きとして保存します。公開はされません。後で編集を続けることができます。", isPublic: false },
                ].map((opt) => (
                  <div key={String(opt.isPublic)} style={{
                    display: "flex", gap: 12,
                    padding: "14px 16px",
                    background: "var(--bg-tint)",
                    border: "1.5px solid var(--line)",
                    borderRadius: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: opt.isPublic ? "var(--success)" : "var(--ink-mute)",
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, fontSize: 14,
                    }}>
                      {opt.isPublic ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{opt.title}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.7 }}>{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>
            {/* 公開申請エリア */}
            <div style={{
              background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
              border: "1px solid var(--royal-100)",
              borderRadius: 14, padding: "24px 28px",
              marginTop: 24, textAlign: "center",
            }}>
              <div style={{ fontFamily: "var(--font-noto-serif)", fontSize: 16, fontWeight: 600, color: "var(--royal)", marginBottom: 8 }}>
                準備ができたら、公開申請をしてください
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 16 }}>
                公開申請後、OPINIO運営が内容を確認します（通常2-3営業日）。<br/>審査通過後、求職者に公開されます。
              </div>
              <button
                type="button"
                onClick={mode === "new" ? handleCreate : handlePublish}
                disabled={isCreating || isPublishing}
                style={{
                  padding: "12px 32px",
                  background: "var(--royal)", color: "#fff",
                  border: "none", borderRadius: 10,
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(0, 35, 102, 0.2)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                公開申請する
              </button>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 12 }}>
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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 57px)" }}>

      {/* 編集サブヘッダー */}
      <div style={{
        height: 52, flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 24px",
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
      }}>
        <Link href="/biz/jobs" style={{
          display: "flex", alignItems: "center", gap: 6,
          paddingRight: 16, borderRight: "1px solid var(--line)",
          color: "var(--ink-soft)", fontSize: 13, fontWeight: 500,
          textDecoration: "none", flexShrink: 0,
          transition: "color 0.15s",
        }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--royal)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          求人一覧に戻る
        </Link>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: "var(--ink)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {pageTitle}
          </span>
          <span style={saveStatusStyle}>
            {saveState === "saving" ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ) : saveState === "saved" ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            ) : saveState === "error" ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ) : null}
            {saveStatusText}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              /* ⚠️★2026-09-02 まで公開ページ `/jobs/{id}` を開いており、
                     **下書きでは必ず 404** だった（公開ページは published かつ is_test=false しか返さない）。
                     つまり企業は公開申請する前に見た目を確認できなかった。
                     `/biz/jobs/{id}/preview` は force-dynamic ＋ noindex ＋ 所属チェック付きで、
                     描画は公開ページと同じ `JobDetailView` を使う。 */
              if (currentJobId) window.open(`/biz/jobs/${currentJobId}/preview`, "_blank", "noopener,noreferrer");
            }}
            disabled={!currentJobId}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              border: "1px solid var(--line)", borderRadius: 8,
              background: "#fff", color: "var(--ink)", cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            プレビュー
          </button>
          {mode === "new" ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || !form.title.trim()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                border: "1px solid var(--royal)", borderRadius: 8,
                background: isCreating || !form.title.trim() ? "var(--ink-mute)" : "var(--royal)",
                color: "#fff", cursor: isCreating || !form.title.trim() ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {isCreating ? "作成中..." : "作成して続ける"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                border: "1px solid var(--royal)", borderRadius: 8,
                background: isPublishing ? "var(--ink-mute)" : "var(--royal)",
                color: "#fff", cursor: isPublishing ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              {isPublishing ? "送信中..." : "公開申請する"}
            </button>
          )}
        </div>
      </div>

      {/* 2カラム：サブナビ + フォーム */}
      <div className="biz-2col" style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        flex: 1,
        overflow: "hidden",
      }}>
        <JobEditSubNav
          sections={sections}
          activeSection={activeSection}
          onSectionClick={setActiveSection}
          completionPercent={completionPercent}
        />

        <main style={{
          overflowY: "auto",
          padding: "32px 40px 60px",
          maxWidth: 900,
        }}>
          {/* 差し戻しバナー（edit + rejected のみ） */}
          {mode === "edit" && initialJob?.status === "rejected" && initialJob.rejectionReason && (
            <JobRejectionBanner
              reason={initialJob.rejectionReason}
              date={initialJob.rejectionDate}
              reviewer={initialJob.rejectionReviewer}
            />
          )}
          {/* エラーバナー */}
          {errorMessage && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", marginBottom: 20, borderRadius: 8,
              background: "var(--error-soft)", border: "1px solid #FCA5A5",
              fontSize: 13, color: "var(--error-ink)", fontWeight: 600,
            }} role="alert">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} /><span>{errorMessage}</span>
              <button type="button" onClick={() => setErrorMessage(null)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--error)", fontSize: 16, padding: "0 4px",
              }}>×</button>
            </div>
          )}
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
