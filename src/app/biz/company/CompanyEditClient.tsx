"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { showToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CompanyEditSubNav, type CompanySubNavSection } from "@/components/business/CompanyEditSubNav";
import { OfficePhotoSection } from "@/components/business/OfficePhotoSection";
import { BenefitsEditor } from "@/components/business/BenefitsEditor";
import { TERMS_VERSION } from "@/lib/constants/terms";
import { PHASE_SELECT_OPTIONS } from "@/lib/constants/phase";
import {
  COMPANY_SECTIONS,
  REMOTE_OPTIONS,
  WORK_SCHEDULE_OPTIONS,
  type BizCompany,
  type CompanySectionId,
} from "@/lib/business/mockCompany";
import { createClient } from "@/lib/supabase/client";
import { uploadCompanyLogo, type OfficePhoto } from "@/lib/business/photos";
import GenreChipSelector, { type Genre } from "@/components/ui/GenreChipSelector";
import { calcDisclosureScore } from "@/lib/utils/disclosureScore";
import { MarkdownEditor } from "@/components/business/MarkdownEditor";
import { IndustrySelectOptions } from "@/components/companies/IndustrySelectOptions";

// ── SaveState ──────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

// ── Props ──────────────────────────────────────────────────────────────────

type Props = {
  initialCompany: BizCompany;
  initialPhotos: OfficePhoto[];
  companyId: string;
  userName: string;
  tenantName: string;
  tenantLogoGradient?: string | null;
  tenantLogoLetter?: string | null;
  memberships?: import("@/lib/business/dashboard").TenantCompany[];
  isAdmin?: boolean;
  /** ow_genres 全件（display_order 昇順ソート済み）。GenreChipSelector に渡す。 */
  availableGenres?: Genre[];
  /** 掲載利用規約への同意済みか */
  initialTermsAgreed?: boolean;
  /** 同意記録用のユーザーID（auth.users.id） */
  userId?: string;
  /** ow_industries 全件。2026-08-25 からフラット20件（親子は無い） */
  /** ⚠️ `parent_id` は必須。2階層（製造業）を `<optgroup>` で出すのに要る（2026-09-05） */
  industries?: { id: string; name: string; slug: string; display_order: number; parent_id: string | null }[];
  /** スコア計算用（サーバー側で取得した静的カウント） */
  initialPublishedJobCount?: number;
  initialPublishedStoryCount?: number;
  initialInterviewScore?: number;
  initialDescription?: string | null;
};

// ── 小コンポーネント ────────────────────────────────────────────────────────

function FormLabel({
  children,
  required,
  optional,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8,
    }}>
      {children}
      {required && <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>}
      {optional && <span style={{ color: "var(--ink-mute)", fontSize: 10, fontWeight: 400 }}>任意</span>}
    </label>
  );
}

function FormGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 18 }}>{children}</div>;
}

function FormHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.7 }}>
      {children}
    </div>
  );
}

function SectionCard({
  title,
  desc,
  children,
}: {
  title?: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "26px 30px",
      marginBottom: 18,
    }}>
      {title && (
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: desc ? 6 : 18 }}>
          {title}
        </div>
      )}
      {desc && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 18, lineHeight: 1.7 }}>
          {desc}
        </div>
      )}
      {children}
    </div>
  );
}

function FormInput({
  value,
  onChange,
  placeholder,
  type = "text",
  ariaLabel,
  maxLength,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  ariaLabel?: string;
  maxLength?: number;
  id?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      maxLength={maxLength}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: "1.5px solid var(--line)",
        borderRadius: 8,
        fontFamily: "inherit",
        fontSize: 13,
        color: "var(--ink)",
        background: "#fff",
        outline: "none",
        transition: "all 0.15s",
      }}
      onFocus={(e) => {
        (e.target as HTMLInputElement).style.borderColor = "var(--royal)";
        (e.target as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--royal-50)";
      }}
      onBlur={(e) => {
        (e.target as HTMLInputElement).style.borderColor = "var(--line)";
        (e.target as HTMLInputElement).style.boxShadow = "none";
      }}
    />
  );
}

function EmailTagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tags = value ? value.split(",").map((e) => e.trim()).filter(Boolean) : [];
  const [inputVal, setInputVal] = useState("");

  function commit(raw: string) {
    const email = raw.trim();
    if (!email) return;
    const next = [...tags, email].join(", ");
    onChange(next);
    setInputVal("");
  }

  function remove(idx: number) {
    const next = tags.filter((_, i) => i !== idx).join(", ");
    onChange(next);
  }

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
      padding: "8px 10px", border: "1.5px solid var(--line)", borderRadius: 8,
      background: "#fff", cursor: "text", minHeight: 42,
    }}
      onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "var(--royal-50)", color: "var(--royal)",
          border: "1px solid var(--royal-100)", borderRadius: 6,
          fontSize: 12, fontWeight: 500, padding: "2px 8px",
        }}>
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(i); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "var(--royal)", fontSize: 13, fontWeight: 700 }}
          >×</button>
        </span>
      ))}
      <input
        type="email"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(inputVal); }
          if (e.key === "Backspace" && !inputVal && tags.length > 0) remove(tags.length - 1);
        }}
        onBlur={() => { if (inputVal) commit(inputVal); }}
        placeholder={tags.length === 0 ? "recruiting@example.co.jp" : "追加..."}
        style={{ border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", color: "var(--ink)", flex: "1 1 160px", minWidth: 120, background: "transparent" }}
      />
    </div>
  );
}

function FormSelect({
  value,
  onChange,
  options,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[] | { value: string; label: string }[];
  id?: string;
}) {
  const normalized = (options as (string | { value: string; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "10px 32px 10px 12px",
        border: "1.5px solid var(--line)",
        borderRadius: 8,
        fontFamily: "inherit",
        fontSize: 13,
        color: "var(--ink)",
        background: "#fff",
        outline: "none",
        appearance: "none",
        backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onFocus={(e) => {
        (e.target as HTMLSelectElement).style.borderColor = "var(--royal)";
        (e.target as HTMLSelectElement).style.boxShadow = "0 0 0 3px var(--royal-50)";
      }}
      onBlur={(e) => {
        (e.target as HTMLSelectElement).style.borderColor = "var(--line)";
        (e.target as HTMLSelectElement).style.boxShadow = "none";
      }}
    >
      {normalized.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function FormTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  serif,
  maxLength,
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  serif?: boolean;
  maxLength?: number;
  ariaLabel?: string;
  id?: string;
}) {
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
          width: "100%",
          padding: "10px 12px",
          paddingBottom: maxLength ? "28px" : "10px",
          border: "1.5px solid var(--line)",
          borderRadius: 8,
          fontFamily: serif ? "var(--font-noto-serif)" : "inherit",
          fontSize: serif ? 16 : 13,
          fontWeight: serif ? 500 : 400,
          color: "var(--ink)",
          background: "#fff",
          outline: "none",
          resize: "vertical",
          lineHeight: 1.8,
          transition: "all 0.15s",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          (e.target as HTMLTextAreaElement).style.borderColor = "var(--royal)";
          (e.target as HTMLTextAreaElement).style.boxShadow = "0 0 0 3px var(--royal-50)";
        }}
        onBlur={(e) => {
          (e.target as HTMLTextAreaElement).style.borderColor = "var(--line)";
          (e.target as HTMLTextAreaElement).style.boxShadow = "none";
        }}
      />
      {maxLength && (
        <span style={{
          position: "absolute",
          bottom: 6,
          right: 10,
          fontSize: 10,
          color: atLimit ? "var(--error)" : nearLimit ? "var(--warm-ink)" : "var(--ink-mute)",
          fontWeight: nearLimit ? 600 : 400,
          pointerEvents: "none",
          fontFamily: "var(--font-inter), var(--font-noto)",
        }}>
          {value.length} / {maxLength}
        </span>
      )}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export function CompanyEditClient({
  initialCompany,
  initialPhotos,
  companyId,
  userName,
  tenantName,
  tenantLogoGradient,
  tenantLogoLetter,
  memberships,
  isAdmin = true,
  availableGenres = [],
  initialTermsAgreed = false,
  userId = "",
  industries = [],
  initialPublishedJobCount = 0,
  initialPublishedStoryCount = 0,
  initialInterviewScore = 0,
  initialDescription = null,
}: Props) {
  const router = useRouter();

  const [form, setForm] = useState<BizCompany>({ ...initialCompany });

  /* ⚠️ ここにあった `showSaasCategory = (selectedChildSlug === "it-saas")` は
        2026-08-25 に削除した。業種マスタを作り直して `it-saas` という slug が
        存在しなくなったので、残しておくと**永遠に false を返す死んだ比較**になる。
        SaaSカテゴリの入力欄も同時に外した（`ow_companies.saas_category_id` の
        列と値は残してある。列の COMMENT に行き先を書いた）。
     ⚠️ 事業領域（ow_business_domains）の入力欄は、事業領域のUIを作る日に併せて作る。 */
  const [termsAgreed, setTermsAgreed] = useState(initialTermsAgreed);
  const [termsChecked, setTermsChecked] = useState(false);
  const [isRecordingAgreement, setIsRecordingAgreement] = useState(false);
  const [activeSection, setActiveSection] = useState<CompanySectionId>("basic");
  const [photos, setPhotos] = useState<OfficePhoto[]>(initialPhotos);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRegisteringNumbers, setIsRegisteringNumbers] = useState(false);
  const [numbersRegisteredAt, setNumbersRegisteredAt] = useState(initialCompany.numbersUpdatedAt);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };
  // draft_data の有無を独立 state で管理（form に含めると autosave ループが起きる）
  const [hasDraftChanges, setHasDraftChanges] = useState(initialCompany.hasDraftChanges);
  // 今セッションで最後に自動保存した時刻
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveAgoText, setSaveAgoText] = useState("");
  const hasInteracted = useRef(false);
  // PATCH (publish) が in-flight 中に autosave PUT コールバックが hasDraftChanges を上書きするのを防ぐ
  const isPublishingRef = useRef(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // 相対時刻を30秒ごとに更新
  useEffect(() => {
    function calcAgo() {
      if (!lastSavedAt) return;
      const diffSec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
      if (diffSec < 10) setSaveAgoText("今");
      else if (diffSec < 60) setSaveAgoText(`${diffSec}秒前`);
      else if (diffSec < 3600) setSaveAgoText(`${Math.floor(diffSec / 60)}分前`);
      else setSaveAgoText(`${Math.floor(diffSec / 3600)}時間前`);
    }
    calcAgo();
    const timer = setInterval(calcAgo, 30000);
    return () => clearInterval(timer);
  }, [lastSavedAt]);

  // ── 自動保存（700ms debounce）──────────────────────────────────────────────
  useEffect(() => {
    if (!hasInteracted.current) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/biz/company", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        setSaveState("saved");
        showToast("保存しました ✓", "default");
        // PATCH (publish) が concurrent に走っている間は上書きしない（race condition 防止）
        if (!isPublishingRef.current) {
          setHasDraftChanges(true);
          setLastSavedAt(new Date());
        }
        setTimeout(() => setSaveState("idle"), 3000);
      } catch (err) {
        console.error("[company autosave]", err);
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(timer);
  // photos と表示専用フィールドは依存から除外
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function handlePhotosChange(next: OfficePhoto[]) {
    setPhotos(next);
  }

  async function handleRegisterNumbers() {
    setIsRegisteringNumbers(true);
    try {
      const res = await fetch("/api/biz/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_numbers_timestamp" }),
      });
      if (res.ok) {
        setNumbersRegisteredAt(new Date().toISOString());
      }
    } finally {
      setIsRegisteringNumbers(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/svg+xml", "image/webp"].includes(file.type)) {
      showError("JPG・PNG・SVG・WebP のみ対応しています");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("5MB 以内のファイルを選択してください");
      return;
    }

    try {
      /* ⚠️ アップロードとURLの組み立ては `uploadCompanyLogo` の内側。
            **ここで path を組み立て直さないこと**（固定名と `?v=` の扱いが割れる）。 */
      const publicUrl = await uploadCompanyLogo(createClient(), companyId, file);
      hasInteracted.current = true;
      setForm((prev) => ({ ...prev, logoUrl: publicUrl }));
    } catch (err) {
      console.error("[CompanyEditClient] logo upload failed:", err);
      showError("ロゴのアップロードに失敗しました。もう一度お試しください。");
    }
  }

  function update<K extends keyof BizCompany>(key: K, value: BizCompany[K]) {
    hasInteracted.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── 規約同意記録 ──────────────────────────────────────────────────────────
  async function handleAgreeAndContinue() {
    if (!termsChecked || isRecordingAgreement) return;
    setIsRecordingAgreement(true);
    try {
      await fetch("/api/biz/terms-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          companyId,
          termsType: "listing",
          /* ⚠️ 版はハードコードしない（termsAgreement.ts の TERMS_VERSION を見る） */
          termsVersion: TERMS_VERSION,
        }),
      });
      setTermsAgreed(true);
      showToast("掲載利用規約への同意を記録しました ✓", "default");
    } finally {
      setIsRecordingAgreement(false);
    }
  }

  // ── 公開ハンドラ ───────────────────────────────────────────────────────────
  async function handlePublish() {
    if (isPublishing) return;
    setIsPublishing(true);
    isPublishingRef.current = true;
    try {
      const res = await fetch("/api/biz/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      });
      if (!res.ok) {
        showError("公開に失敗しました。再度お試しください。");
        return;
      }
      const { publishedAt } = await res.json() as { publishedAt: string };
      const now = new Date(publishedAt);
      const lastPublishedAt = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      // 公開後に form 変化が autosave を再トリガーして draft_data が即座に再投入されるのを防ぐ
      hasInteracted.current = false;
      setForm((prev) => ({
        ...prev,
        isPublished: true,
        lastPublishedAt,
        lastPublishedAgo: "今",
      }));
      setHasDraftChanges(false);
      setLastSavedAt(null);
    } catch {
      showError("公開に失敗しました。再度お試しください。");
    } finally {
      isPublishingRef.current = false;
      setIsPublishing(false);
    }
  }

  // ── 開示スコア計算 ─────────────────────────────────────────────────────────
  const disclosureScore = useMemo(() => calcDisclosureScore({
    tagline: form.tagline,
    description: initialDescription,
    photoCount: photos.length,
    benefitsCount: form.benefitsTags.length,
    hasPublishedJob: initialPublishedJobCount > 0,
    hasPublishedStory: initialPublishedStoryCount > 0,
  }), [form.tagline, initialDescription, photos.length, form.benefitsTags.length, initialPublishedJobCount, initialPublishedStoryCount]);

  const subNavSections: CompanySubNavSection[] = COMPANY_SECTIONS.map((s) => ({
    ...s,
    hasDraft: hasDraftChanges && s.showStatus,
  }));

  const saveStatusText =
    saveState === "saving" ? "保存中..."
    : saveState === "saved"  ? "保存しました"
    : saveState === "error"  ? "保存できませんでした"
    : lastSavedAt           ? `最終保存: ${saveAgoText}`
    : "";

  async function handleRetrySave() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/biz/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveState("saved");
      setHasDraftChanges(true);
      setLastSavedAt(new Date());
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      console.error("[company retry]", err);
      setSaveState("error");
    }
  }

  // ── セクションレンダラー ──────────────────────────────────────────────────

  function renderSection() {
    switch (activeSection) {

      case "logo":
        return (
          <>
            <SectionCard
              title="企業ロゴ"
              desc="求職者側の企業詳細ページ・一覧ページに表示されます。アップロードしない場合、企業名の頭文字で自動生成されます。"
            >
              <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logoUrl}
                    alt="企業ロゴ"
                    style={{
                      width: 90, height: 90, borderRadius: 16,
                      objectFit: "cover",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.12)", flexShrink: 0,
                      border: "1px solid var(--line)",
                    }}
                  />
                ) : (
                  <div style={{
                    width: 90, height: 90, borderRadius: 16,
                    background: form.logoGradient, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, fontSize: 38,
                    boxShadow: "0 6px 16px rgba(0,0,0,0.12)", flexShrink: 0,
                  }}>
                    {form.logoLetter}
                  </div>
                )}
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>ロゴ画像</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 12, lineHeight: 1.7 }}>
                    JPG・PNG・SVG・5MB以内 · 推奨サイズ 512×512px
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/svg+xml,image/webp"
                      style={{ display: "none" }}
                      onChange={handleLogoUpload}
                    />
                    <button type="button" onClick={() => logoFileInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "#fff", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      画像をアップロード
                    </button>
                    <button type="button" onClick={() => { hasInteracted.current = true; setForm((prev) => ({ ...prev, logoUrl: "" })); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "#fff", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      自動生成に戻す
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </>
        );

      case "basic":
        return (
          <>
            <SectionCard>
              <FormGroup>
                <FormLabel required htmlFor="ce-name">企業名</FormLabel>
                <FormInput id="ce-name" value={form.name} onChange={(v) => update("name", v)} />
              </FormGroup>
              <FormGroup>
                <FormLabel htmlFor="ce-tagline">タグライン</FormLabel>
                <FormInput id="ce-tagline" value={form.tagline} onChange={(v) => update("tagline", v)} placeholder="例: MA領域でシリーズCのスタートアップ" />
                <FormHint>企業詳細ページのミッション直下に表示される短いサブテキストです。SEOの meta description にも使用されます。</FormHint>
              </FormGroup>
              {/* 業種（単一選択）
                  ── 経緯 ────────────────────────────────────────────────
                  2026-08-25 に**2段階セレクトをやめて1段にした**。業種マスタを
                  フラット20件に作り直したので `parent_id` を持つ行が1件も無く、
                  「業種（中分類）」は**常に空で常に disabled** の死んだ入力欄になっていた。

                  ★2026-09-05 に業種を2階層に戻した（親は「製造業」1つだけ）。
                  ⚠️★**ただし2段セレクトには戻していない。** 1段のまま
                     `<optgroup>` ＋ 親自身の option で出している
                     （`IndustrySelectOptions`）。理由は2つ:
                       ・親を持つのは1件だけなので、2段にすると**17件で2段目が空**になる
                       ・親も選べる必要がある（「製造業としか言えない人」が詰まる）が、
                         2段セレクトだと大分類を選んだ後に中分類が必須に見える
                  ⚠️ 2段に戻すなら、上の「2段目が空になる」問題をどう出すかを先に決めること。
                  ⚠️ ここにあった「SaaSカテゴリ」欄も同時に外した（判定に使っていた
                     slug `it-saas` がマスタから消えたため）。`saas_category_id` の
                     列と値は残してある。事業領域の入力欄は別途作る。
                  ⚠️ **`update("saasCategoryId", "")` を書き戻さないこと。** 業種を
                     変えるたびに `saas_category_id` を空にしていたので、そのままだと
                     65社ぶんの値が「業種を選び直しただけ」で消える。
                  ⚠️ ここにあった `industries.length === 0` のときの代替入力欄
                     （`industry`(text) を書く FormSelect）も外した。**別の列に書く
                     二重の保存経路**になっており、実際には一度も描画されていなかった。 */}
              <FormGroup>
                <FormLabel required htmlFor="ce-industry">業種</FormLabel>
                {industries.length > 0 ? (
                  <select
                    id="ce-industry"
                    value={form.industryId}
                    onChange={(e) => update("industryId", e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, background: "#fff" }}
                  >
                    <option value="">選択してください</option>
                    {/* ⚠️ 2階層（製造業）を出す。**親も選べる**（2026-09-05）。
                           フラットに map すると親子が混ざるので、必ずこの部品を通すこと。 */}
                    <IndustrySelectOptions options={industries} />
                  </select>
                ) : (
                  <FormHint>業種の一覧を取得できませんでした。時間をおいて再読み込みしてください。</FormHint>
                )}
              </FormGroup>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup>
                  <FormLabel htmlFor="ce-phase">事業ステージ</FormLabel>
                  {/* ⚠️★**`PHASE_OPTIONS` をそのまま渡さないこと**（2026-09-06）。
                         2026-09-06 まで渡しており、`value` が日本語だったため
                         **12個すべてが DB の CHECK 違反で保存できなかった**。
                         `ow_companies` は UPDATE が列単位 GRANT なので、
                         事業ステージを選ぶと企業情報の保存が丸ごと失敗していた。 */}
                  <FormSelect id="ce-phase" value={form.phase} onChange={(v) => update("phase", v)} options={PHASE_SELECT_OPTIONS} />
                </FormGroup>
              </div>
              {availableGenres.length > 0 && (
                <FormGroup>
                  <FormLabel optional>企業ジャンル</FormLabel>
                  <GenreChipSelector
                    genres={availableGenres}
                    selected={form.genres ?? []}
                    onChange={(newSlugs) => update("genres", newSlugs)}
                    disabled={isPublishing}
                  />
                  <FormHint>該当するジャンルを選択してください（複数可）。企業一覧・検索での絞り込みに活用されます。</FormHint>
                </FormGroup>
              )}
              <FormGroup>
                <FormLabel htmlFor="ce-url">公式サイトURL</FormLabel>
                <FormInput id="ce-url" type="url" value={form.url} onChange={(v) => update("url", v)} placeholder="https://example.co.jp" />
              </FormGroup>
              <FormGroup>
                <FormLabel htmlFor="ce-careers-url">採用情報ページURL</FormLabel>
                <FormInput id="ce-careers-url" type="url" value={form.careersUrl} onChange={(v) => update("careersUrl", v)} placeholder="https://careers.example.co.jp" />
                <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>設定すると企業詳細ページに「採用情報ページ」リンクが表示されます</p>
              </FormGroup>
            </SectionCard>

            {/* 規約同意 */}
            {!termsAgreed ? (
              <div style={{
                marginTop: 24, padding: "24px 28px",
                background: "var(--warm-soft)", border: "1px solid #FDE68A",
                borderRadius: 12,
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                  掲載利用規約への同意
                </p>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16, lineHeight: 1.8 }}>
                  OPINIOに企業情報を掲載するには、
                  <a href="/terms/listing" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 600 }}>
                    掲載利用規約
                  </a>
                  への同意が必要です。規約の全文を確認の上、同意してください。
                  {/* ⚠️★**成功報酬（人材紹介）の案内は外した**（2026-09-05）。**戻さないこと。**
                         「スカウト・紹介機能を使うときに人材紹介利用規約への同意をお願いします」と
                         書いていたが、**その同意はもう求めていない**（同日にスカウト側の
                         ゲートを外した）。事実でなくなるので消した。

                      ⚠️ OPINIO は職安法4条6項の募集情報等提供に該当するサービスで、
                         あっせんを行わない（掲載利用規約 第6条1項）。月額プランのみで、
                         成功報酬は発生しない。会社（株式会社Opinio）は人材紹介事業も
                         行っているが、**それは別契約で、このプロダクトの対象外**。 */}
                </p>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    onChange={(e) => setTermsChecked(e.target.checked)}
                    style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>
                    <a href="/terms/listing" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>掲載利用規約</a>
                    の全文を読み、内容に同意します。
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleAgreeAndContinue}
                  disabled={!termsChecked || isRecordingAgreement}
                  style={{
                    background: termsChecked ? "var(--royal)" : "var(--line)",
                    color: termsChecked ? "#fff" : "var(--ink-mute)",
                    border: "none", borderRadius: 8,
                    padding: "10px 20px", fontSize: 14, fontWeight: 600,
                    cursor: termsChecked ? "pointer" : "not-allowed",
                  }}
                >
                  {isRecordingAgreement ? "記録中..." : "同意して続ける"}
                </button>
              </div>
            ) : (
              <div style={{
                marginTop: 16, padding: "12px 16px",
                background: "var(--success-soft)", border: "1px solid #A7F3D0",
                borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: 13, color: "var(--success-ink)", fontWeight: 600 }}>
                  掲載利用規約に同意済み
                </span>
                <a href="/terms/listing" target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-soft)", textDecoration: "underline" }}>
                  規約全文を確認する →
                </a>
              </div>
            )}
          </>
        );

      case "about":
        return (
          <>
            <SectionCard
              title="企業説明"
              desc="企業の事業内容、創業背景、組織カルチャー、これからの展望などを自由に記述してください。読み物として読まれます。"
            >
              {/* ⚠️ **描画とセットで扱うこと。** 企業ページは
                     `components/common/Markdown` で解釈する（2026-08-26 に対応）。
                     片方だけ変えると `##` が記号のまま出る。 */}
              <MarkdownEditor
                value={form.descriptionMarkdown}
                onChange={(v) => update("descriptionMarkdown", v)}
                placeholder="## 私たちについて&#10;&#10;事業の特徴や組織カルチャーを記述してください..."
                minHeight={300}
              />
            </SectionCard>

            <SectionCard
              title="入社する理由・魅力"
              desc="求職者が「なぜこの会社を選ぶのか」を伝えるテキストです。企業一覧での About テキストとして参照されます。"
            >
              <FormTextarea
                value={form.whyJoin}
                onChange={(v) => update("whyJoin", v)}
                rows={4}
                placeholder="例: 日本のSaaS市場の最前線で、プロダクトの本質的な価値を追求できる環境です。..."
                maxLength={600}
                ariaLabel="入社する理由・魅力"
              />
            </SectionCard>

            <SectionCard
              title="企業の特徴"
              desc="求職者向けページの「特徴」セクションとして1件ずつカード表示されます。最大5件まで登録できます。"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {form.companyFeatures.map((feature, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <FormTextarea
                        value={feature}
                        onChange={(v) => {
                          const next = [...form.companyFeatures];
                          next[i] = v;
                          update("companyFeatures", next);
                        }}
                        rows={3}
                        placeholder={`特徴 ${i + 1}: 候補者の視点から見た、この会社ならではの魅力を記述してください`}
                        maxLength={200}
                        ariaLabel={`企業の特徴 ${i + 1}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.companyFeatures.filter((_, j) => j !== i);
                        update("companyFeatures", next);
                      }}
                      style={{
                        marginTop: 2, padding: "8px", background: "#fff", border: "1px solid var(--line)",
                        borderRadius: 6, cursor: "pointer", color: "var(--ink-mute)", flexShrink: 0,
                        display: "flex", alignItems: "center",
                      }}
                      title="削除"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
                {form.companyFeatures.length < 5 && (
                  <button
                    type="button"
                    onClick={() => update("companyFeatures", [...form.companyFeatures, ""])}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", background: "#fff", color: "var(--ink)",
                      border: "1px dashed var(--line)", borderRadius: 8,
                      fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      alignSelf: "flex-start",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    特徴を追加（{form.companyFeatures.length}/5）
                  </button>
                )}
              </div>
              <FormHint>1件目が「OPINIO のコメント」として強調表示されます。もっとも伝えたい特徴を1番目に書いてください。</FormHint>
            </SectionCard>

          </>
        );

      case "data":
        return (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16, lineHeight: 1.9 }}>
              求職者側の「数値で見る企業」セクションに表示されます。入力後「数値を保存・公開する」ボタンを押すと、求職者側に更新日時が表示されます。
            </p>
            {/* 回答状態バー */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderRadius: 10,
              background: numbersRegisteredAt ? "var(--success-soft)" : "var(--bg-tint)",
              border: `1px solid ${numbersRegisteredAt ? "#A7F3D0" : "var(--line)"}`,
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {numbersRegisteredAt ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontSize: 13, color: "var(--success-ink)", fontWeight: 600 }}>
                      回答済み · {new Date(numbersRegisteredAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}
                    </span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                    <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>未回答（数値を入力後、下のボタンで登録してください）</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleRegisterNumbers}
                disabled={isRegisteringNumbers}
                style={{
                  padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: "var(--royal)", color: "#fff", border: "none", cursor: "pointer",
                  opacity: isRegisteringNumbers ? 0.6 : 1,
                }}
              >
                {isRegisteringNumbers ? "登録中..." : "数値を保存・公開する"}
              </button>
            </div>
            <SectionCard title="基本情報">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup>
                  <FormLabel required>従業員数</FormLabel>
                  <FormInput value={form.employeeCount} onChange={(v) => update("employeeCount", v)} placeholder="例: 1,642" />
                  <FormHint>数字のみを入力（カンマ含む）</FormHint>
                </FormGroup>
                <FormGroup>
                  <FormLabel>設立年月</FormLabel>
                  <FormInput value={form.foundedAt} onChange={(v) => update("foundedAt", v)} placeholder="例: 2017年8月" />
                </FormGroup>
                <FormGroup>
                  <FormLabel>平均年齢</FormLabel>
                  <FormInput value={form.avgAge} onChange={(v) => update("avgAge", v)} placeholder="例: 29歳" />
                </FormGroup>
                <FormGroup>
                  <FormLabel>男女比</FormLabel>
                  <FormInput value={form.genderRatio} onChange={(v) => update("genderRatio", v)} placeholder="例: 男性 65% / 女性 35%" />
                </FormGroup>
                <FormGroup>
                  <FormLabel>平均年収</FormLabel>
                  <FormInput value={form.avgSalary} onChange={(v) => update("avgSalary", v)} placeholder="例: 600万〜950万" />
                  <FormHint>空欄の場合は求職者側に表示されません</FormHint>
                </FormGroup>
                <FormGroup>
                  <FormLabel>累計調達額</FormLabel>
                  <FormInput value={form.fundingTotal} onChange={(v) => update("fundingTotal", v)} placeholder="例: 32億円" />
                  <FormHint>空欄の場合は求職者側に表示されません</FormHint>
                </FormGroup>
              </div>
            </SectionCard>
            <SectionCard title="福利厚生">
              <FormGroup>
                <FormLabel>福利厚生</FormLabel>
                {/* ⚠️★2026-08-31 に `RequirementsTagInput` から差し替えた。
                       あれは**名前だけ**の共通部品で、求人フォームでも使う。
                       福利厚生は**項目ごとに詳細（任意）**を持つので専用部品にした。
                    ⚠️ ここを戻すと、企業が詳細を入力できなくなる。 */}
                <BenefitsEditor
                  items={form.benefitsTags}
                  onChange={(items) => update("benefitsTags", items)}
                />
                <FormHint>
                  求職者側ではタグ形式で表示されます。
                  <strong>詳細を入れると、その項目を押したときに表示されます</strong>（任意）。
                </FormHint>
              </FormGroup>
            </SectionCard>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleRegisterNumbers}
                disabled={isRegisteringNumbers}
                style={{
                  padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: "var(--royal)", color: "#fff", border: "none", cursor: "pointer",
                  opacity: isRegisteringNumbers ? 0.6 : 1,
                }}
              >
                {isRegisteringNumbers ? "登録中..." : "✓ 数値を保存・公開する"}
              </button>
            </div>
          </>
        );

      case "workstyle":
        return (
          <>
            <SectionCard title="オフィス所在地">
              <FormGroup>
                <FormLabel required htmlFor="ce-location">本社所在地</FormLabel>
                <FormInput id="ce-location" value={form.location} onChange={(v) => update("location", v)} placeholder="東京都渋谷区..." />
              </FormGroup>
              <FormGroup>
                <FormLabel htmlFor="ce-nearest-station">最寄り駅</FormLabel>
                <FormInput id="ce-nearest-station" value={form.nearestStation} onChange={(v) => update("nearestStation", v)} placeholder="例: JR渋谷駅 東口より徒歩5分" />
              </FormGroup>
            </SectionCard>
            <SectionCard title="働き方">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup>
                  <FormLabel>リモートワーク状況</FormLabel>
                  <FormSelect value={form.remoteWorkStatus} onChange={(v) => update("remoteWorkStatus", v)} options={REMOTE_OPTIONS} />
                </FormGroup>
                <FormGroup>
                  <FormLabel>勤務時間制度</FormLabel>
                  <FormSelect value={form.workScheduleType} onChange={(v) => update("workScheduleType", v)} options={WORK_SCHEDULE_OPTIONS} />
                </FormGroup>
              </div>
            </SectionCard>
          </>
        );


      case "photos":
        return (
          <>
            <OfficePhotoSection
              companyId={companyId}
              photos={photos}
              onPhotosChange={handlePhotosChange}
            />
          </>
        );

      case "settings":
        return (
          <>
            <SectionCard title="公開状態">
              <FormGroup>
                <FormLabel>企業情報の公開</FormLabel>
                <FormSelect
                  value={form.isPublished ? "public" : "private"}
                  onChange={(v) => update("isPublished", v === "public")}
                  options={[{ value: "public", label: "公開中" }, { value: "private", label: "非公開" }]}
                />
                <FormHint>
                  {form.isPublished
                    ? "現在、求職者側に企業詳細ページが表示されています。"
                    : "現在、非公開です。求職者には表示されません。"}
                </FormHint>
              </FormGroup>
              <FormGroup>
                <FormLabel>カジュアル面談の受付</FormLabel>
                <FormSelect
                  value={form.acceptingCasualMeetings ? "accepting" : "paused"}
                  onChange={(v) => update("acceptingCasualMeetings", v === "accepting")}
                  options={[{ value: "accepting", label: "受付中" }, { value: "paused", label: "一時停止" }]}
                />
                <FormHint>「一時停止」中は、求職者側のページから「カジュアル面談を申し込む」ボタンが非表示になります。</FormHint>
              </FormGroup>
            </SectionCard>
            <SectionCard title="通知設定">
              <FormGroup>
                {/*
                  ⚠️ ラベルは「新規カジュアル面談の通知先」だったが 2026-08-05 に改めた。
                     この宛先は面談だけでなく、応募・参加リクエスト・スカウト返信の
                     4経路すべてで使われる（lib/notify/recipients.ts）。
                  ⚠️ 未設定でも通知は止まらない。管理者権限の担当者にフォールバックする。
                     この値は「既定の宛先の上書き」なので、設定するとフォールバックは効かなくなる。
                */}
                <FormLabel>企業への通知先</FormLabel>
                <EmailTagInput
                  value={form.notificationEmails}
                  onChange={(v) => update("notificationEmails", v)}
                />
                <FormHint>Enterまたはカンマで複数のメールアドレスを追加できます</FormHint>
                {!form.notificationEmails.trim() && (
                  <FormHint>未設定の場合は、管理者権限の担当者に届きます。</FormHint>
                )}
              </FormGroup>
            </SectionCard>
          </>
        );

      default:
        return null;
    }
  }

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <BusinessLayout
      userName={userName}
      tenantName={tenantName}
      tenantLogoGradient={tenantLogoGradient ?? undefined}
      tenantLogoLetter={tenantLogoLetter ?? undefined}
      variant="fullBleed"
      memberships={memberships}
      currentTenantId={companyId}
    >
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 57px)",
      }}>

        {/* 2カラム本体 */}
        <div className="biz-2col" style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          flex: 1,
          overflow: "hidden",
        }}>
          <CompanyEditSubNav
            sections={subNavSections}
            activeSection={activeSection}
            onSectionClick={(id) => setActiveSection(id as CompanySectionId)}
            bizScore={disclosureScore.biz}
            interviewScore={initialInterviewScore}
            hasDraftChanges={hasDraftChanges}
            lastPublishedAt={form.lastPublishedAt}
            lastPublishedAgo={form.lastPublishedAgo}
            onViewPublicPage={() => router.push(`/companies/${companyId}`)}
            onPreview={() => window.open(`/companies/${companyId}`, "_blank", "noopener,noreferrer")}
            onPublish={handlePublish}
            isPublishing={isPublishing}
            isAdmin={isAdmin}
            termsAgreed={termsAgreed}
            onShowTermsSection={() => setActiveSection("basic")}
            saveState={saveState}
            saveStatusText={saveStatusText}
            onRetrySave={handleRetrySave}
          />

          <main style={{
            overflowY: "auto",
            padding: "32px 40px 60px",
            maxWidth: 900,
          }}>
            {errorMessage && (
              <div role="alert" aria-live="polite" style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", marginBottom: 20, borderRadius: 8,
                background: "var(--error-soft)", border: "1px solid #FCA5A5",
                fontSize: 13, color: "var(--error-ink)", fontWeight: 600,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{errorMessage}</span>
                <button type="button" onClick={() => setErrorMessage(null)} aria-label="エラーを閉じる" style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--error)", fontSize: 16, padding: "0 4px",
                }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            )}
            {renderSection()}
          </main>
        </div>
      </div>
      {/* 規約同意バナー — 右上固定 */}
      {isAdmin && !termsAgreed && (
        <button
          type="button"
          onClick={() => setActiveSection("basic")}
          style={{
            position: "fixed",
            top: 16,
            right: 24,
            zIndex: 50,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 8,
            background: "#FFFBEB",
            color: "var(--warm-ink)",
            border: "none",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          ⚠ 規約に同意してから公開できます
        </button>
      )}
    </BusinessLayout>
  );
}
