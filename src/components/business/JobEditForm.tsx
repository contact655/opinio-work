"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { TeamMember } from "@/lib/business/jobs";
import Link from "next/link";
import type { BizJob } from "@/lib/business/mockJobs";
import { JobEditSubNav, type EditSection } from "./JobEditSubNav";
import { JobRejectionBanner } from "./JobRejectionBanner";
import { RequirementsTagInput } from "./RequirementsTagInput";
import { ProcessStepsEditor } from "./ProcessStepsEditor";

// ─── 定数 ───────────────────────────────────────────────────────────────────

const EMPLOYMENT_TYPES = ["正社員", "業務委託", "契約社員", "インターン", "アルバイト・パート"];
const JOB_CATEGORIES = ["営業", "PdM / PM", "カスタマーサクセス", "エンジニア", "マーケティング", "経営・CxO", "その他"];
const REMOTE_OPTIONS = ["フルリモート可", "ハイブリッド（週2-3日出社）", "原則出社"];
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
  descriptionMarkdown: string;
  messageToCandidates: string;
  requiredSkills: string[];
  preferredSkills: string[];
  cultureFit: string;
  selectionSteps: string[];
  selectionDuration: string;
  startDatePreference: string;
  assigneeIds: string[];
};

function jobToForm(job: BizJob | null): FormState {
  if (!job) return {
    title: "", employmentType: "正社員", jobCategory: "", department: "",
    salaryMin: "", salaryMax: "", salaryNote: "", location: "", remoteWorkStatus: "",
    probationPeriod: "", descriptionMarkdown: "", messageToCandidates: "",
    requiredSkills: [], preferredSkills: [], cultureFit: "",
    selectionSteps: ["書類選考", "カジュアル面談", "1次面接", "最終面接"],
    selectionDuration: "", startDatePreference: "応相談", assigneeIds: [],
  };
  return {
    title: job.title,
    employmentType: job.employmentType,
    jobCategory: job.jobCategory,
    department: job.department ?? "",
    salaryMin: job.salaryMin?.toString() ?? "",
    salaryMax: job.salaryMax?.toString() ?? "",
    salaryNote: "",
    location: job.location ?? "",
    remoteWorkStatus: job.remoteWorkStatus ?? "",
    probationPeriod: "",
    descriptionMarkdown: job.descriptionMarkdown ?? "",
    messageToCandidates: job.messageToCandidates ?? "",
    requiredSkills: [...job.requiredSkills],
    preferredSkills: [...job.preferredSkills],
    cultureFit: job.cultureFit ?? "",
    selectionSteps: [...job.selectionSteps],
    selectionDuration: job.selectionDuration ?? "",
    startDatePreference: job.startDatePreference ?? "応相談",
    assigneeIds: job.assigneeNames.map((_, i) => MOCK_TEAM[i]?.id ?? `member-${i + 1}`),
  };
}

// ─── サブコンポーネント ──────────────────────────────────────────────────────

function FormLabel({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
      {children}
      {required && <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>}
      {optional && <span style={{ color: "var(--ink-mute)", fontSize: 10, fontWeight: 400 }}>任意</span>}
    </div>
  );
}

function FormInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
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

function FormSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
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
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function FormTextarea({ value, onChange, placeholder, rows = 5 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%", padding: "10px 12px",
        border: "1.5px solid var(--line)", borderRadius: 8,
        fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
        background: "#fff", resize: "vertical", lineHeight: 1.8,
        minHeight: rows * 24 + 20, outline: "none", transition: "all 0.15s",
      }}
      onFocus={(e) => { e.target.style.borderColor = "var(--royal)"; e.target.style.boxShadow = "0 0 0 3px var(--royal-50)"; }}
      onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
    />
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
      {desc && <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 18, lineHeight: 1.7 }}>{desc}</div>}
      {children}
    </div>
  );
}

function FormGroup({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 18, ...style }}>{children}</div>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.7 }}>{children}</div>;
}

// ─── メインコンポーネント ────────────────────────────────────────────────────

type Props = {
  mode: FormMode;
  initialJob?: BizJob | null;
  initialAssigneeIds?: string[];
  companyId?: string;
  teamMembers?: TeamMember[];
};

export function JobEditForm({
  mode,
  initialJob = null,
  initialAssigneeIds,
  companyId,
  teamMembers,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => {
    const base = jobToForm(initialJob);
    if (initialAssigneeIds?.length) return { ...base, assigneeIds: initialAssigneeIds };
    return base;
  });
  const [activeSection, setActiveSection] = useState("basic");
  const [isCreating, setIsCreating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { saveState, trigger: triggerAutosave } = useAutoSave();
  const isFirstRender = useRef(true);
  const effectiveTeam = teamMembers ?? MOCK_TEAM;
  const jobId = initialJob?.id ?? null;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    triggerAutosave();
  }

  // Autosave: edit mode のみ form 変更後 700ms で PUT
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!jobId || mode !== "edit" || process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") return;
    const timer = setTimeout(() => {
      fetch(`/api/biz/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).catch(console.error);
    }, 700);
    return () => clearTimeout(timer);
  // form のみ監視（jobId/mode は初期値から不変）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const handleCreate = useCallback(async () => {
    if (!form.title.trim()) { alert("求人タイトルを入力してください。"); return; }
    setIsCreating(true);
    try {
      const res = await fetch("/api/biz/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, companyId }),
      });
      if (!res.ok) throw new Error("create failed");
      const { id } = await res.json() as { id: string };
      router.replace(`/biz/jobs/${id}/edit`);
    } catch {
      alert("求人の作成に失敗しました。再度お試しください。");
    } finally {
      setIsCreating(false);
    }
  }, [form, companyId, router]);

  const handlePublish = useCallback(async () => {
    if (!jobId) return;
    setIsPublishing(true);
    try {
      const saveRes = await fetch(`/api/biz/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      alert("公開申請に失敗しました。再度お試しください。");
    } finally {
      setIsPublishing(false);
    }
  }, [form, jobId, router]);

  // セクション完成度チェック
  const sectionComplete = useMemo(() => ({
    basic:        !!form.title.trim(),
    salary:       !!(form.salaryMin || form.salaryMax),
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
    fontSize: 11, padding: "4px 10px", borderRadius: 100,
    transition: "all 0.3s", flexShrink: 0,
    ...(saveState === "saving" ? { color: "var(--warm)", background: "var(--warm-soft)" }
      : saveState === "saved"  ? { color: "var(--success)", background: "var(--success-soft)" }
      : { color: "var(--ink-mute)", background: "var(--bg-tint)" }),
  };
  const saveStatusText = saveState === "saving" ? "下書きに保存中..."
    : saveState === "saved" ? "下書きを自動保存しました" : "編集中";

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
                <FormLabel required>求人タイトル</FormLabel>
                <FormInput value={form.title} onChange={(v) => updateForm("title", v)} placeholder="例：プロダクトマネージャー（タイミーキャリアプラス）" />
                <Hint>求職者が最初に目にする最重要項目。ポジション名 + 補足情報を記載してください。</Hint>
              </FormGroup>
              <FormGroup>
                <FormLabel required>雇用形態</FormLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EMPLOYMENT_TYPES.map((type) => (
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel required>職種カテゴリ</FormLabel>
                  <FormSelect value={form.jobCategory} onChange={(v) => updateForm("jobCategory", v)} options={JOB_CATEGORIES} />
                </FormGroup>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel optional>所属部門</FormLabel>
                  <FormInput value={form.department} onChange={(v) => updateForm("department", v)} placeholder="例：タイミーキャリアプラス事業部" />
                </FormGroup>
              </div>
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
                <FormLabel required>年収レンジ</FormLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 60px", gap: 8, alignItems: "center" }}>
                  <FormInput value={form.salaryMin} onChange={(v) => updateForm("salaryMin", v)} placeholder="600" type="number" />
                  <span style={{ color: "var(--ink-mute)", fontWeight: 600 }}>〜</span>
                  <FormInput value={form.salaryMax} onChange={(v) => updateForm("salaryMax", v)} placeholder="1000" type="number" />
                  <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                </div>
                <Hint>求職者側では「¥{form.salaryMin || "?"}-{form.salaryMax || "?"}万」と表示されます</Hint>
              </FormGroup>
              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel optional>給与の補足説明</FormLabel>
                <FormTextarea value={form.salaryNote} onChange={(v) => updateForm("salaryNote", v)} placeholder="例：賞与は年2回、業績連動。ストックオプション制度あり。" rows={3} />
              </FormGroup>
            </FormSection>
            <FormSection title="勤務地・勤務形態">
              <FormGroup>
                <FormLabel required>勤務地</FormLabel>
                <FormInput value={form.location} onChange={(v) => updateForm("location", v)} placeholder="例：東京都豊島区東池袋1-9-6" />
              </FormGroup>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel required>リモートワーク</FormLabel>
                  <FormSelect value={form.remoteWorkStatus} onChange={(v) => updateForm("remoteWorkStatus", v)} options={REMOTE_OPTIONS} />
                </FormGroup>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel optional>試用期間</FormLabel>
                  <FormInput value={form.probationPeriod} onChange={(v) => updateForm("probationPeriod", v)} placeholder="例：3ヶ月" />
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
                        fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700,
                        color: "var(--ink-soft)", cursor: "pointer",
                      }}>{tool}</button>
                    </>
                  ))}
                </div>
                <textarea
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
              <FormTextarea value={form.messageToCandidates} onChange={(v) => updateForm("messageToCandidates", v)} placeholder="例：BtoCマーケティングの経験を活かして、社会的意義のあるプロダクトに関わりたい方をお待ちしています。" rows={5} />
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
                  color="royal"
                  placeholder="スキルを入力して Enter..."
                />
                <Hint>業務遂行に必要不可欠なスキル・経験を記述してください。年齢・性別等の属性は記載しないでください。</Hint>
              </FormGroup>
              <FormGroup style={{ marginBottom: 0 }}>
                <FormLabel optional>歓迎スキル・経験</FormLabel>
                <RequirementsTagInput
                  tags={form.preferredSkills}
                  onTagsChange={(t) => updateForm("preferredSkills", t)}
                  color="purple"
                  placeholder="歓迎スキルを入力して Enter..."
                />
              </FormGroup>
            </FormSection>
            <FormSection title="求めるカルチャーフィット" desc="スキルだけでは測れない、価値観・働き方のフィットについて記述してください。">
              <FormTextarea value={form.cultureFit} onChange={(v) => updateForm("cultureFit", v)} placeholder="例：データドリブンな意思決定を大切にしながらも、ユーザーの声に真摯に向き合える方。" rows={5} />
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
                  <FormLabel>カジュアル面談から内定まで</FormLabel>
                  <FormInput value={form.selectionDuration} onChange={(v) => updateForm("selectionDuration", v)} placeholder="例：3-4週間" />
                </FormGroup>
                <FormGroup style={{ margin: 0 }}>
                  <FormLabel optional>入社可能時期</FormLabel>
                  <FormSelect value={form.startDatePreference} onChange={(v) => updateForm("startDatePreference", v)} options={DURATION_OPTIONS} />
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
                        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{member.role}</div>
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
            <FormSection title="公開状態">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "👁", title: "公開申請する", desc: "「公開申請」ボタンを押すと、運営審査（2-3営業日）を経て、Opinio上で求職者に公開されます。", isPublic: true },
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
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7 }}>{opt.desc}</div>
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
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 16 }}>
                公開申請後、Opinio運営が内容を確認します（通常2-3営業日）。<br/>審査通過後、求職者に公開されます。
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
              <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 12 }}>
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
            ) : null}
            {saveStatusText}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => alert("プレビュー機能は後日実装予定です。")}
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
      <div style={{
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
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
