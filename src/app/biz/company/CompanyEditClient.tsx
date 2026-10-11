"use client";

import { useState, useRef, useEffect } from "react";
import { showToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { OfficePhotoSection } from "@/components/business/OfficePhotoSection";
import { BenefitsEditor } from "@/components/business/BenefitsEditor";
import { TERMS_VERSION } from "@/lib/constants/terms";
import { PHASE_SELECT_OPTIONS } from "@/lib/constants/phase";
import { COMPANY_REMOTE_WORK_SELECT_OPTIONS } from "@/lib/constants/workStyle";
import { companyPageStatus, companyStatusText } from "@/lib/companies/pageStatus";
import { WORK_SCHEDULE_SELECT_OPTIONS, type BizCompany } from "@/lib/business/mockCompany";
import { createClient } from "@/lib/supabase/client";
import { uploadCompanyLogo, type OfficePhoto } from "@/lib/business/photos";
import { MAX_BUSINESS_DOMAINS_PER_COMPANY, type BusinessDomainOption } from "@/lib/companies/businessDomains";
import { MarkdownEditor } from "@/components/business/MarkdownEditor";
import { IndustrySelectOptions } from "@/components/companies/IndustrySelectOptions";
import { EMPLOYEE_BANDS } from "@/lib/constants/employeeBand";
import { COMPANY_REQUIREMENTS, missingCompanyRequirements, type CompanyRequirement } from "@/lib/companies/companyRequirements";

/*
 * ★企業ページの編集（/biz/company）。2026-10-12 に作り直した（柴さんの指示）。
 *
 * ── 方針 ──────────────────────────────────────────────────────────────
 *   ・**求職者に見えないものは入力させない。** 外した入力欄（平均年齢・男女比・平均年収・累計調達額・
 *     企業の特徴・「数値を最新として公開する」）の列とデータは残してある。**フォームに戻さないこと。**
 *   ・反映は「公開する」1つ。入力は下書き（draft_data）に自動保存され、写真も未公開で入る。
 *       掲載前 … 「掲載を依頼する」→ 運営が掲載にする操作の中で、下書きと写真がまとめて公開される
 *       掲載中 … 「変更を公開する」で反映（lib/companies/applyDraft.ts）
 *   ・事業領域も下書きに入る（それまでは選ぶと即時保存だった）。反映のときに本体より先に書く。
 *   ・公開に必要な項目は `companyRequirements.ts` の1か所。右側の「公開まであと〇つ」とサーバーが同じ関数を呼ぶ。
 *   ・掲載利用規約の同意は、初めて「掲載を依頼する」を押したときの確認画面で取る（サーバー側の確認は2か所のまま）。
 *   ・通知の宛先は「メンバーと権限」へ移した（即時保存）。
 *   ・タブはやめて1ページ。並び: 基本情報 → 会社紹介 → 働き方 → 写真。
 * ⚠️ 状態はバッジにしない（灰色の文字）。
 */

type SaveState = "idle" | "saving" | "saved" | "error";

type IndustryItem = {
  id: string; name: string; slug: string; display_order: number; parent_id: string | null;
  requires_business_domain: boolean;
};

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
  /** 掲載利用規約に（見ている人が）同意済みか */
  initialTermsAgreed?: boolean;
  /** 同意記録用のユーザーID（auth.users.id） */
  userId?: string;
  /** 掲載を依頼した日時。⚠️ `form`（下書き）に入れない（運営が対応したら null に戻すサーバー側の状態） */
  initialListingRequestedAt?: string | null;
  /** `ow_companies.listing_status`。⚠️ 同じ理由で `form` に入れない */
  listingStatus?: string | null;
  /** `ow_companies.is_published`（本番の値）。⚠️ 下書きの値を使わない */
  isPublished?: boolean;
  /** `ow_companies.headquarters_address`（運営が入れる本社の住所）。本社所在地の判定に使う */
  headquartersAddress?: string | null;
  businessDomainOptions?: BusinessDomainOption[];
  /** ⚠️ `parent_id` は必須（2階層を `<optgroup>` で出す）。`requires_business_domain` は事業領域が必須か */
  industries?: IndustryItem[];
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

function FormInput({
  value,
  onChange,
  placeholder,
  type = "text",
  ariaLabel,
  maxLength,
  id,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  ariaLabel?: string;
  maxLength?: number;
  id?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      id={id}
      readOnly={readOnly}
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
        color: readOnly ? "var(--ink-soft)" : "var(--ink)",
        background: readOnly ? "var(--bg-tint)" : "#fff",
        outline: "none",
        transition: "all 0.15s",
      }}
      onFocus={(e) => {
        if (readOnly) return;
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

/**
 * このページのプルダウン。**見た目はここ1箇所**。
 *
 * ⚠️★**素の `<select>` を各所に書かないこと**（2026-09-18）。業種だけが素の select で、
 *    ブラウザ標準の見た目のまま他のプルダウンと揃っていなかった。
 * ⚠️ `children` は `<optgroup>` が要るとき用の口（業種は2階層）。
 *    ⚠️ `options` と同時に渡さないこと。渡すと `children` が勝つ。
 */
function FormSelect({
  value,
  onChange,
  options,
  id,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: string[] | { value: string; label: string }[];
  id?: string;
  /** `<optgroup>` などを自前で出すとき。⚠️ `options` の代わりに使う */
  children?: React.ReactNode;
}) {
  const normalized = ((options ?? []) as (string | { value: string; label: string })[]).map((o) =>
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
      {/* ⚠️ `children` が来たらそちらを出す（`<optgroup>` が要る業種用） */}
      {children ?? normalized.map((o) => (
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

// ── 画面の部品 ──────────────────────────────────────────────────────────────

/** 本文の節（基本情報・会社紹介・働き方・写真）。⚠️ `id` は「公開まであと〇つ」から飛ぶ先ではない（飛ぶのは入力欄の id） */
function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px 28px", marginBottom: 18, scrollMarginTop: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: desc ? "0 0 4px" : "0 0 18px" }}>{title}</h2>
      {desc && <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, margin: "0 0 18px" }}>{desc}</p>}
      {children}
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: "22px 0 12px", paddingTop: 18, borderTop: "1px solid var(--line-soft)" }}>{children}</div>;
}

/** 右側の小さな箱 */
function SideCard({ children, state }: { children: React.ReactNode; state?: string }) {
  return (
    <div data-state={state} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", marginBottom: 12 }}>
      {children}
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
  initialTermsAgreed = false,
  userId = "",
  initialListingRequestedAt = null,
  listingStatus = null,
  isPublished = false,
  headquartersAddress = null,
  businessDomainOptions = [],
  industries = [],
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<BizCompany>({ ...initialCompany });
  const [photos, setPhotos] = useState<OfficePhoto[]>(initialPhotos);
  const [termsAgreed, setTermsAgreed] = useState(initialTermsAgreed);
  const [listingRequestedAt, setListingRequestedAt] = useState<string | null>(initialListingRequestedAt);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [hasDraftChanges, setHasDraftChanges] = useState(initialCompany.hasDraftChanges);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /* 確認画面。⚠️ 未同意のときはここで掲載利用規約への同意を取る。
     ★"publish" … 掲載中の企業で、押した人がまだ同意していないとき（2026-10-12）。
        サーバーは「変更を公開する」でも同意を確かめるので、ここで取らないと行き止まりになる
        （運営が依頼なしに掲載した企業や、あとから加わった担当者）。 */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"listing" | "publish">("listing");
  const [termsChecked, setTermsChecked] = useState(false);

  const hasInteracted = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* 公開・依頼の最中に自動保存の結果で「未公開の変更あり」を立て直さない */
  const busyRef = useRef(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 8000);
  };

  // ── 状態 ───────────────────────────────────────────────────────────────
  /* ⚠️ 掲載の状態は本番の値（isPublished / listingStatus）で決める。下書きの値を使わない */
  const pageStatus = companyPageStatus({ isPublished, listingStatus, termsAgreed, listingRequestedAt });
  const listed = pageStatus.kind === "listed";
  const requiresDomain = industries.find((i) => i.id === form.industryId)?.requires_business_domain ?? false;
  const hasPrimaryDomain = form.primaryBusinessDomainId !== null && form.businessDomainIds.includes(form.primaryBusinessDomainId);
  /* ★判定は companyRequirements.ts（サーバーと同じ関数）。⚠️ ここで条件を書かない */
  const missingAll = missingCompanyRequirements({
    name: form.name,
    industryId: form.industryId,
    requiresBusinessDomain: requiresDomain,
    hasPrimaryDomain,
    employeeCountBand: form.employeeCountBand,
    location: form.location,
    headquartersAddress,
  }, { forListing: true });
  /* 掲載中は企業名・業種・事業領域だけで止める（従業員数・本社所在地は「掲載を依頼する」のときだけ） */
  const blocking: CompanyRequirement[] = listed ? missingAll.filter((r) => r.scope === "always") : missingAll;
  const hasChanges = hasDraftChanges || photos.some((p) => p.isDraft);

  /* ★1行の状態はホームの右の列と同じ関数（`companyStatusText`） */
  const statusText = companyStatusText(pageStatus, { hasChanges, listingRequestedAt, blockingCount: blocking.length });

  // ── 自動保存（下書き）──────────────────────────────────────────────────
  async function putDraft(next: BizCompany): Promise<boolean> {
    const res = await fetch("/api/biz/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    return res.ok;
  }

  useEffect(() => {
    if (!hasInteracted.current) return;
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      try {
        if (!(await putDraft(form))) throw new Error("save failed");
        setSaveState("saved");
        if (!busyRef.current) setHasDraftChanges(true);
        setTimeout(() => setSaveState("idle"), 2500);
      } catch (err) {
        console.error("[company autosave]", err);
        setSaveState("error");
      }
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  /** ★公開・依頼の前に、待っている自動保存をその場で済ませる。
   *  ⚠️ 判定は下書きの値で行うので、最後の入力が下書きに入っていないと古い値で判定・公開される */
  async function flushDraft(): Promise<boolean> {
    if (!saveTimer.current && saveState !== "error") return true;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const ok = await putDraft(form).catch(() => false);
    setSaveState(ok ? "idle" : "error");
    if (!ok) showError("入力内容を保存できませんでした。通信状況をご確認ください。");
    return ok;
  }

  function update<K extends keyof BizCompany>(key: K, value: BizCompany[K]) {
    hasInteracted.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── ロゴ ───────────────────────────────────────────────────────────────
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
      /* ⚠️ アップロードとURLの組み立ては `uploadCompanyLogo` の内側。ここで path を組み立て直さない。
            ⚠️ URL は下書き（logo_url）に入るだけで、「公開する」まで求職者には出ない */
      const publicUrl = await uploadCompanyLogo(createClient(), companyId, file);
      update("logoUrl", publicUrl);
    } catch (err) {
      console.error("[CompanyEditClient] logo upload failed:", err);
      showError("ロゴのアップロードに失敗しました。もう一度お試しください。");
    }
  }

  // ── 事業領域（下書きに入る）────────────────────────────────────────────
  function toggleDomain(id: string) {
    const ids = form.businessDomainIds;
    const checked = ids.includes(id);
    const nextIds = checked ? ids.filter((x) => x !== id) : [...ids, id];
    let nextPrimary = form.primaryBusinessDomainId;
    /* 外した領域が主だったら主を空にする。残り1件・最初の1件は自動で主にする */
    if (checked && nextPrimary === id) nextPrimary = nextIds.length === 1 ? nextIds[0] : null;
    if (!checked && nextIds.length === 1) nextPrimary = id;
    if (nextIds.length === 0) nextPrimary = null;
    hasInteracted.current = true;
    setForm((prev) => ({ ...prev, businessDomainIds: nextIds, primaryBusinessDomainId: nextPrimary }));
  }

  /** ★未同意なら、確認画面のチェックを受けてここで同意を記録する（サーバーは依頼・公開の API でも同意を確かめる）。
   *  ⚠️ 結果を見てから同意済みにする（2026-09-18 に「記録できていないのに同意済み」と出た） */
  async function recordAgreementIfNeeded(): Promise<boolean> {
    if (termsAgreed) return true;
    if (!termsChecked) return false;
    const tr = await fetch("/api/biz/terms-agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      /* ⚠️ 版はハードコードしない（TERMS_VERSION） */
      body: JSON.stringify({ userId, companyId, termsType: "listing", termsVersion: TERMS_VERSION }),
    });
    if (!tr.ok) {
      const d = await tr.json().catch(() => null);
      showError(d?.message ?? "掲載利用規約への同意を記録できませんでした。時間をおいてもう一度お試しください。");
      return false;
    }
    setTermsAgreed(true);
    return true;
  }

  // ── 公開（掲載中）──────────────────────────────────────────────────────
  async function handlePublish() {
    if (busy) return;
    setBusy(true);
    busyRef.current = true;
    try {
      if (!(await flushDraft())) return;
      if (!(await recordAgreementIfNeeded())) return;
      const res = await fetch("/api/biz/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish_draft" }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        showError(d?.message ?? d?.error ?? "公開に失敗しました。時間をおいてもう一度お試しください。");
        return;
      }
      hasInteracted.current = false;
      setConfirmOpen(false);
      setHasDraftChanges(false);
      setPhotos((prev) => prev.map((p) => ({ ...p, isDraft: false })));
      showToast("変更を公開しました ✓", "default");
      router.refresh();
    } catch {
      showError("公開に失敗しました。通信状況をご確認ください。");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // ── 掲載の依頼（掲載前）────────────────────────────────────────────────
  async function handleRequestListing() {
    if (busy) return;
    setBusy(true);
    busyRef.current = true;
    try {
      if (!(await flushDraft())) return;
      if (!(await recordAgreementIfNeeded())) return;
      const res = await fetch("/api/biz/company/listing-request", { method: "POST" });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        /* ⚠️ 409（すでに依頼済み）は失敗ではない。別の担当者が先に押した場合 */
        if (res.status === 409 && typeof d?.requestedAt === "string") {
          setListingRequestedAt(d.requestedAt);
          setConfirmOpen(false);
          showToast("すでに掲載依頼を受け付けています", "default");
          return;
        }
        showError(d?.message ?? d?.error ?? "掲載依頼を送信できませんでした。時間をおいてもう一度お試しください。");
        return;
      }
      setListingRequestedAt(typeof d?.requestedAt === "string" ? d.requestedAt : new Date().toISOString());
      setConfirmOpen(false);
      showToast("掲載を依頼しました ✓", "default");
    } catch {
      showError("掲載依頼を送信できませんでした。通信状況をご確認ください。");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  /** 「公開まであと〇つ」から入力欄へ移る。⚠️ rAF は使わない（描画されていないと発火しない） */
  function jumpTo(anchor: string) {
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => (el as HTMLElement).focus?.({ preventScroll: true }), 300);
  }

  // ── 主ボタン ───────────────────────────────────────────────────────────
  const primary = (() => {
    if (listed) {
      if (!hasChanges) return { label: "公開済み", enabled: false, onClick: undefined as (() => void) | undefined, state: "published" };
      return {
        label: busy ? "公開中..." : "変更を公開する", enabled: isAdmin && blocking.length === 0 && !busy, state: "publish",
        /* 押した人がまだ掲載利用規約に同意していなければ、確認画面で同意を取ってから公開する */
        onClick: termsAgreed ? handlePublish : () => { setTermsChecked(false); setConfirmMode("publish"); setConfirmOpen(true); },
      };
    }
    if (listingRequestedAt) return { label: "掲載を依頼済み", enabled: false, onClick: undefined, state: "requested" };
    return {
      label: "掲載を依頼する",
      enabled: isAdmin && blocking.length === 0 && !busy,
      onClick: () => { setTermsChecked(false); setConfirmMode("listing"); setConfirmOpen(true); },
      state: "request",
    };
  })();
  const primaryHint = !isAdmin
    ? "公開・掲載の依頼は管理者権限の担当者が行えます。"
    : primary.state !== "published" && primary.state !== "requested" && blocking.length > 0
      ? `必要な項目があと${blocking.length}つあります（右側から移動できます）。`
      : null;

  const saveText = saveState === "saving" ? "保存中..." : saveState === "saved" ? "下書きを保存しました" : saveState === "error" ? "保存できませんでした" : "";

  // ── 描画 ───────────────────────────────────────────────────────────────
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
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--biz-header-h))" }}>
        {/* ── 上部: 見出し・状態（灰色の文字）・主ボタン ── */}
        <div className="cpe-head" style={{ background: "#fff", borderBottom: "1px solid var(--line)", flexShrink: 0, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>企業ページ</h1>
          <span data-state="page-status" title={pageStatus.detail} style={{ fontSize: 13, color: "var(--ink-mute)" }}>{statusText}</span>
          {saveText && (
            <span aria-live="polite" style={{ fontSize: 12, color: saveState === "error" ? "var(--error-ink)" : "var(--ink-mute)" }}>
              {saveText}
              {saveState === "error" && (
                <button type="button" onClick={() => { void flushDraft(); }} style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: "var(--error-ink)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>再試行</button>
              )}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {primaryHint && <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{primaryHint}</span>}
          <button
            type="button"
            data-state={`primary-${primary.state}`}
            onClick={primary.onClick}
            disabled={!primary.enabled}
            className="btn-fixed-size"
            style={{
              padding: "9px 20px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
              background: primary.enabled ? "var(--royal)" : "var(--line-soft)",
              color: primary.enabled ? "#fff" : "var(--ink-mute)",
              cursor: primary.enabled ? "pointer" : "default",
            }}
          >
            {primary.label}
          </button>
        </div>

        <div className="cpe-scroll" style={{ flex: 1, overflowY: "auto" }}>
          <div className="cpe-grid">
            {/* ── 本文 ── */}
            <div style={{ minWidth: 0 }}>
              {errorMessage && (
                <div role="alert" style={{
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
                  padding: "12px 16px", marginBottom: 16, borderRadius: 8,
                  background: "var(--error-soft)", border: "1px solid #FCA5A5",
                  fontSize: 13, color: "var(--error-ink)", fontWeight: 600, lineHeight: 1.7,
                }}>
                  <span>{errorMessage}</span>
                  <button type="button" onClick={() => setErrorMessage(null)} aria-label="閉じる" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: 16 }}>×</button>
                </div>
              )}

              {/* ── 基本情報 ── */}
              <Section id="cpe-basic" title="基本情報">
                <FormGroup>
                  <FormLabel required htmlFor="ce-name">企業名</FormLabel>
                  {/* ★掲載後は企業からは変えられない（2026-10-12）。サーバー（PUT /api/biz/company）も本番の社名で上書きする。
                        掲載前は編集でき、運営が掲載にする操作の中で反映される */}
                  <FormInput id="ce-name" value={form.name} onChange={(v) => update("name", v)} readOnly={listed} />
                  {listed && (
                    <FormHint>
                      社名の変更は運営へご連絡ください（<a href="/business/contact" style={{ color: "var(--royal)", fontWeight: 600 }}>お問い合わせ</a>）。
                    </FormHint>
                  )}
                </FormGroup>
                <FormGroup>
                  <FormLabel required htmlFor="ce-industry">業種</FormLabel>
                  {industries.length > 0 ? (
                    <FormSelect id="ce-industry" value={form.industryId} onChange={(v) => update("industryId", v)}>
                      <option value="">選択してください</option>
                      {/* ⚠️ 2階層（製造業）を出す。フラットに map すると親子が混ざる */}
                      <IndustrySelectOptions options={industries} />
                    </FormSelect>
                  ) : (
                    <FormHint>業種の一覧を取得できませんでした。時間をおいて再読み込みしてください。</FormHint>
                  )}
                </FormGroup>
                {businessDomainOptions.length > 0 && (
                  <FormGroup>
                    <FormLabel required={requiresDomain}>事業領域</FormLabel>
                    <FormHint>
                      この会社が何を作っているかです（最大 {MAX_BUSINESS_DOMAINS_PER_COMPANY} 件）。
                      1つを「主」にしてください。企業一覧のカードと検索結果に出るのは主の1件です。
                      {!requiresDomain && " この業種では任意です。"}
                    </FormHint>
                    {/* ⚠️ id は「公開まであと〇つ」から移る先。tabIndex を付けてフォーカスできるようにする */}
                    <div id="ce-business-domain" tabIndex={-1} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, outline: "none" }}>
                      {businessDomainOptions.map((d) => {
                        const checked = form.businessDomainIds.includes(d.id);
                        const atLimit = !checked && form.businessDomainIds.length >= MAX_BUSINESS_DOMAINS_PER_COMPANY;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            aria-pressed={checked}
                            onClick={() => toggleDomain(d.id)}
                            disabled={atLimit}
                            title={d.description ?? undefined}
                            className="btn-fixed-size"
                            style={{
                              border: `1.5px solid ${checked ? "var(--royal)" : "var(--line)"}`,
                              background: checked ? "var(--royal-50)" : "#fff",
                              color: checked ? "var(--royal)" : "var(--ink-soft)",
                              borderRadius: 100, padding: "6px 14px",
                              fontSize: 13, fontWeight: checked ? 700 : 500,
                              cursor: atLimit ? "not-allowed" : "pointer",
                              opacity: atLimit ? 0.4 : 1, fontFamily: "inherit",
                            }}
                          >
                            {d.name}
                          </button>
                        );
                      })}
                    </div>
                    {form.businessDomainIds.length > 1 && (
                      <div style={{ marginTop: 10 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-mute)", marginRight: 8 }}>主にするもの</span>
                        <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 12 }}>
                          {form.businessDomainIds.map((id) => {
                            const d = businessDomainOptions.find((x) => x.id === id);
                            if (!d) return null;
                            return (
                              <label key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13, color: "var(--ink)" }}>
                                <input type="radio" name="biz-primary-business-domain" checked={form.primaryBusinessDomainId === id}
                                  onChange={() => update("primaryBusinessDomainId", id)} style={{ width: 14, height: 14, cursor: "pointer" }} />
                                {d.name}
                              </label>
                            );
                          })}
                        </span>
                      </div>
                    )}
                    {/* ⚠️ 主が決まっていない状態を黙って通さない（公開のときに止まる） */}
                    {form.businessDomainIds.length > 0 && !hasPrimaryDomain && (
                      <FormHint>主にするものを1つ選んでください。</FormHint>
                    )}
                  </FormGroup>
                )}
                <FormGroup>
                  <FormLabel htmlFor="ce-phase">事業ステージ</FormLabel>
                  {/* ⚠️ 選択肢の value は DB に入る値そのもの（PHASE_SELECT_OPTIONS）。日本語の配列を渡さない */}
                  <FormSelect id="ce-phase" value={form.phase} onChange={(v) => update("phase", v)} options={PHASE_SELECT_OPTIONS} />
                </FormGroup>

                <FormGroup>
                  <FormLabel>ロゴ</FormLabel>
                  <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                    {form.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.logoUrl} alt="企業ロゴ" style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }} />
                    ) : (
                      <div style={{
                        width: 72, height: 72, borderRadius: 14, flexShrink: 0,
                        background: form.logoGradient || "linear-gradient(135deg, var(--royal), var(--accent))", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, fontSize: 30,
                      }}>
                        {form.logoLetter || form.name?.[0] || "?"}
                      </div>
                    )}
                    <div>
                      <input ref={logoFileInputRef} type="file" accept="image/jpeg,image/png,image/svg+xml,image/webp" style={{ display: "none" }} onChange={handleLogoUpload} />
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => logoFileInputRef.current?.click()} style={{ padding: "7px 12px", background: "#fff", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          画像を選ぶ
                        </button>
                        {form.logoUrl && (
                          <button type="button" onClick={() => update("logoUrl", "")} style={{ padding: "7px 12px", background: "#fff", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            画像を外す
                          </button>
                        )}
                      </div>
                      <FormHint>JPG・PNG・SVG・WebP、5MB以内。正方形（512×512px 程度）がきれいに出ます。画像が無いときは社名の頭文字を出します。</FormHint>
                    </div>
                  </div>
                </FormGroup>

                <FormGroup>
                  <FormLabel htmlFor="ce-tagline">タグライン</FormLabel>
                  <FormInput id="ce-tagline" value={form.tagline} onChange={(v) => update("tagline", v)} placeholder="例: 中小企業の採用を、データで変える" />
                  <FormHint>企業一覧のカードに、社名と一緒に出る一文です。Google などの検索結果に出る説明文にも使われます。</FormHint>
                </FormGroup>
                <div className="cpe-2col">
                  <FormGroup>
                    <FormLabel htmlFor="ce-url">公式サイトのURL</FormLabel>
                    <FormInput id="ce-url" type="url" value={form.url} onChange={(v) => update("url", v)} placeholder="https://example.co.jp" />
                  </FormGroup>
                  <FormGroup>
                    <FormLabel htmlFor="ce-careers-url">採用ページのURL</FormLabel>
                    <FormInput id="ce-careers-url" type="url" value={form.careersUrl} onChange={(v) => update("careersUrl", v)} placeholder="https://careers.example.co.jp" />
                    <FormHint>入れると、企業ページに「採用情報ページ」へのリンクが出ます。</FormHint>
                  </FormGroup>
                </div>
              </Section>

              {/* ── 会社紹介 ── */}
              <Section id="cpe-about" title="会社紹介">
                <FormGroup>
                  <FormLabel>企業説明</FormLabel>
                  {/* ⚠️ 求職者側は Markdown として描画する（components/common/Markdown）。入力欄は記号を見せない */}
                  <MarkdownEditor
                    value={form.descriptionMarkdown}
                    onChange={(v) => update("descriptionMarkdown", v)}
                    placeholder="事業の内容、創業の背景、社内の雰囲気、これからの展望などを書いてください。"
                    minHeight={260}
                  />
                  <FormHint>企業ページの「企業について」に出ます。上のボタンで見出し・太字・箇条書き・リンクを付けられます。</FormHint>
                </FormGroup>
                <FormGroup>
                  <FormLabel htmlFor="ce-why-join">入社する理由・魅力</FormLabel>
                  <FormTextarea id="ce-why-join" value={form.whyJoin} onChange={(v) => update("whyJoin", v)} rows={4} maxLength={600}
                    placeholder="例: 創業期のプロダクトづくりに、職種をこえて関われます。" ariaLabel="入社する理由・魅力" />
                  <FormHint>求人ページの「企業について」に、企業説明と一緒に出ます。</FormHint>
                </FormGroup>
              </Section>

              {/* ── 働き方 ── */}
              <Section id="cpe-work" title="働き方">
                <div className="cpe-2col">
                  <FormGroup>
                    {/* ⚠️ 帯の語彙は EMPLOYEE_BANDS の1か所（DB の CHECK と同じ） */}
                    <FormLabel required htmlFor="ce-employee-band">従業員数</FormLabel>
                    <FormSelect id="ce-employee-band" value={form.employeeCountBand} onChange={(v) => update("employeeCountBand", v)}
                      options={[{ value: "", label: "選択してください" }, ...EMPLOYEE_BANDS.map((b) => ({ value: b.value, label: b.label }))]} />
                    <div style={{ marginTop: 10 }}>
                      <FormLabel optional htmlFor="ce-employee-asof">いつ時点の人数か</FormLabel>
                      <FormInput id="ce-employee-asof" type="month" value={form.employeeCountAsOf} onChange={(v) => update("employeeCountAsOf", v)} ariaLabel="従業員数の時点（年月）" />
                    </div>
                    <FormHint>採用する法人の人数です。企業ページに「51〜200名（2026年4月時点）」のように出ます。</FormHint>
                  </FormGroup>
                  <FormGroup>
                    {/* ⚠️ 保存は founded_year（整数）。月は保存されないので「設立年」にした（2026-10-12） */}
                    <FormLabel htmlFor="ce-founded">設立年</FormLabel>
                    <FormInput id="ce-founded" value={form.foundedAt} onChange={(v) => update("foundedAt", v.replace(/[^\d]/g, "").slice(0, 4))} placeholder="例: 2017" maxLength={4} />
                  </FormGroup>
                </div>
                <div className="cpe-2col">
                  <FormGroup>
                    <FormLabel htmlFor="ce-remote">リモートワーク</FormLabel>
                    {/* ⚠️ 日本語を value にした選択肢を渡さない（DB の CHECK に落ちる） */}
                    <FormSelect id="ce-remote" value={form.remoteWorkStatus} onChange={(v) => update("remoteWorkStatus", v)} options={COMPANY_REMOTE_WORK_SELECT_OPTIONS} />
                  </FormGroup>
                  <FormGroup>
                    <FormLabel htmlFor="ce-schedule">勤務時間制度</FormLabel>
                    <FormSelect id="ce-schedule" value={form.workScheduleType} onChange={(v) => update("workScheduleType", v)} options={WORK_SCHEDULE_SELECT_OPTIONS} />
                  </FormGroup>
                </div>
                <FormGroup>
                  <FormLabel>福利厚生</FormLabel>
                  {/* ⚠️ 項目ごとに詳細（任意）を持つ専用部品。RequirementsTagInput に戻さない */}
                  <BenefitsEditor items={form.benefitsTags} onChange={(items) => update("benefitsTags", items)} />
                  <FormHint>企業ページに項目ごとに出ます。詳細を入れると、その項目を押したときに表示されます（任意）。</FormHint>
                </FormGroup>
                <SubHeading>所在地</SubHeading>
                <div className="cpe-2col">
                  <FormGroup>
                    <FormLabel required htmlFor="ce-location">本社所在地</FormLabel>
                    <FormInput id="ce-location" value={form.location} onChange={(v) => update("location", v)} placeholder="例: 東京都渋谷区..." />
                    {headquartersAddress && <FormHint>運営が登記などから確認した住所（{headquartersAddress}）がある場合は、そちらが企業ページに出ます。</FormHint>}
                  </FormGroup>
                  <FormGroup>
                    <FormLabel htmlFor="ce-nearest-station">最寄り駅</FormLabel>
                    <FormInput id="ce-nearest-station" value={form.nearestStation} onChange={(v) => update("nearestStation", v)} placeholder="例: JR渋谷駅 東口より徒歩5分" />
                  </FormGroup>
                </div>
              </Section>

              {/* ── 写真 ── */}
              <Section id="cpe-photos" title="写真">
                <OfficePhotoSection companyId={companyId} photos={photos} onPhotosChange={setPhotos} />
              </Section>
            </div>

            {/* ── 右側（固定）── */}
            <aside className="cpe-side">
              <SideCard state="requirements">
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {blocking.length > 0 ? `公開まであと${blocking.length}つ` : "公開に必要な項目はそろっています"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6, marginBottom: 10 }}>
                  {listed ? "掲載中です。従業員数・本社所在地が空でも公開は止まりませんが、入力してください。" : "すべてそろうと「掲載を依頼する」を押せます。"}
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {COMPANY_REQUIREMENTS.map((r) => {
                    if (r.key === "business_domain" && !requiresDomain) return null;
                    const missing = missingAll.some((m) => m.key === r.key);
                    return (
                      <li key={r.key}>
                        <button type="button" data-state={missing ? "missing" : "done"} onClick={() => jumpTo(r.anchor)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 4px",
                            background: "none", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                            fontSize: 13, color: missing ? "var(--ink)" : "var(--ink-mute)", textAlign: "left",
                          }}>
                          <span aria-hidden style={{
                            width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                            border: missing ? "1.5px solid var(--line)" : "none",
                            background: missing ? "#fff" : "var(--line-soft)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {!missing && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
                          </span>
                          <span style={{ flex: 1 }}>{r.label}</span>
                          <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{missing ? "未入力" : "入力済み"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </SideCard>

              <SideCard state="preview">
                {/* ⚠️ 開くのは**公開中の**企業ページ（未公開の変更は含まれない）。2026-09-21 に外した「プレビュー」と同じ誤解をさせないよう書いておく */}
                <button type="button" disabled={!pageStatus.pageVisible}
                  onClick={() => window.open(`/companies/${companyId}`, "_blank", "noopener")}
                  className="btn-fixed-size"
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                    background: "#fff", border: "1px solid var(--line)",
                    color: pageStatus.pageVisible ? "var(--ink)" : "var(--ink-mute)",
                    cursor: pageStatus.pageVisible ? "pointer" : "default",
                  }}>
                  求職者からの見え方
                </button>
                <div style={{ fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6, marginTop: 8 }}>
                  {pageStatus.pageVisible ? "公開中の企業ページを新しいタブで開きます。未公開の変更は含まれません。" : "企業ページが公開されると見られます。"}
                </div>
              </SideCard>

              <SideCard state="casual-meeting">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>カジュアル面談の受付</span>
                  <button type="button" role="switch" aria-checked={form.acceptingCasualMeetings} aria-label="カジュアル面談の受付"
                    onClick={() => update("acceptingCasualMeetings", !form.acceptingCasualMeetings)}
                    className="btn-fixed-size"
                    style={{
                      width: 40, height: 22, borderRadius: 100, border: "none", padding: 2, cursor: "pointer", flexShrink: 0,
                      background: form.acceptingCasualMeetings ? "var(--royal)" : "var(--line)",
                      display: "flex", justifyContent: form.acceptingCasualMeetings ? "flex-end" : "flex-start",
                    }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", display: "block" }} />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>{form.acceptingCasualMeetings ? "受付中" : "一時停止"}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6, marginTop: 4 }}>
                  一時停止中は、企業ページに申し込みのボタンが出ません。「公開する」で反映されます。
                </div>
              </SideCard>
            </aside>
          </div>
        </div>
      </div>

      {/* ── 掲載依頼の確認画面（初めてのときは掲載利用規約への同意もここで取る）── */}
      {confirmOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="cpe-confirm-title" data-state="listing-confirm"
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setConfirmOpen(false); }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, padding: "24px 26px" }}>
            <h2 id="cpe-confirm-title" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
              {confirmMode === "listing" ? "掲載を依頼する" : "変更を公開する"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 14px" }}>
              {confirmMode === "listing"
                ? "OPINIO 運営が内容を確認してから、企業一覧に掲載します。掲載のときに、いま入力している内容と写真がまとめて公開されます。押しただけでは掲載は始まりません。"
                : "いま入力している内容と未公開の写真を、企業ページに公開します。公開するには、掲載利用規約への同意が必要です。"}
            </p>
            {!termsAgreed && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "12px 14px", borderRadius: 10, background: "var(--bg-tint)", border: "1px solid var(--line)", marginBottom: 14 }}>
                <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>
                  <a href="/terms/listing" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 600 }}>掲載利用規約</a>
                  を読み、内容に同意します。
                </span>
              </label>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={busy}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", color: "var(--ink)" }}>
                やめる
              </button>
              {(() => {
                const ok = !busy && (termsAgreed || termsChecked);
                return (
                  <button type="button" onClick={confirmMode === "listing" ? handleRequestListing : handlePublish} disabled={!ok} className="btn-fixed-size"
                    style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                      background: ok ? "var(--royal)" : "var(--line-soft)", color: ok ? "#fff" : "var(--ink-mute)", cursor: ok ? "pointer" : "default" }}>
                    {busy ? "送信中..."
                      : confirmMode === "listing" ? (termsAgreed ? "掲載を依頼する" : "同意して掲載を依頼する")
                      : "同意して公開する"}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ style タグの中に不等号・バッククォートを書かない（ハイドレーションが壊れる） */}
      <style>{`
        .cpe-head { padding: 14px 32px; }
        .cpe-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 24px; max-width: 1180px; padding: 24px 32px 48px; }
        .cpe-side { position: sticky; top: 24px; align-self: start; }
        .cpe-2col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
        @media (max-width: 1023px) {
          .cpe-grid { grid-template-columns: minmax(0, 1fr); padding: 16px; }
          .cpe-side { position: static; order: -1; }
          .cpe-head { padding: 12px 16px; }
        }
        @media (max-width: 640px) {
          .cpe-2col { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </BusinessLayout>
  );
}
