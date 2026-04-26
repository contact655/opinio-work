"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CompanyEditSubNav, type CompanySubNavSection } from "@/components/business/CompanyEditSubNav";
import { CompanyPublishStatusBar } from "@/components/business/CompanyPublishStatusBar";
import { MarkdownEditor } from "@/components/business/MarkdownEditor";
import { OfficePhotoSection } from "@/components/business/OfficePhotoSection";
import { RequirementsTagInput } from "@/components/business/RequirementsTagInput";
import {
  COMPANY_SECTIONS,
  INDUSTRY_OPTIONS,
  PHASE_OPTIONS,
  REMOTE_OPTIONS,
  WORK_SCHEDULE_OPTIONS,
  type BizCompany,
  type CompanySectionId,
} from "@/lib/business/mockCompany";
import { createClient } from "@/lib/supabase/client";
import { buildLogoStoragePath, type OfficePhoto } from "@/lib/business/photos";

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
  planType: string | null;
};

// ── 小コンポーネント ────────────────────────────────────────────────────────

function FormLabel({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8,
    }}>
      {children}
      {required && <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>}
      {optional && <span style={{ color: "var(--ink-mute)", fontSize: 10, fontWeight: 400 }}>任意</span>}
    </div>
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
  title: string;
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
      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: desc ? 6 : 18 }}>
        {title}
      </div>
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
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

function FormSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
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
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  serif?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: "1.5px solid var(--line)",
        borderRadius: 8,
        fontFamily: serif ? "'Noto Serif JP', serif" : "inherit",
        fontSize: serif ? 16 : 13,
        fontWeight: serif ? 500 : 400,
        color: "var(--ink)",
        background: "#fff",
        outline: "none",
        resize: "vertical",
        lineHeight: 1.8,
        transition: "all 0.15s",
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
  planType,
}: Props) {
  const router = useRouter();

  const [form, setForm] = useState<BizCompany>({ ...initialCompany });
  const [activeSection, setActiveSection] = useState<CompanySectionId>("basic");
  const [photos, setPhotos] = useState<OfficePhoto[]>(initialPhotos);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPublishing, setIsPublishing] = useState(false);
  const hasInteracted = useRef(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

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
        setTimeout(() => setSaveState("idle"), 2000);
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/svg+xml", "image/webp"].includes(file.type)) {
      alert("JPG・PNG・SVG・WebP のみ対応しています");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("5MB 以内のファイルを選択してください");
      return;
    }

    try {
      const supabase = createClient();
      const path = buildLogoStoragePath(companyId, file.name);
      const { error: uploadError } = await supabase.storage
        .from("ow-uploads")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("ow-uploads")
        .getPublicUrl(path);

      hasInteracted.current = true;
      setForm((prev) => ({ ...prev, logoUrl: publicUrl }));
    } catch (err) {
      console.error("[CompanyEditClient] logo upload failed:", err);
      alert("ロゴのアップロードに失敗しました。もう一度お試しください。");
    }
  }

  function update<K extends keyof BizCompany>(key: K, value: BizCompany[K]) {
    hasInteracted.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── 公開ハンドラ ───────────────────────────────────────────────────────────
  async function handlePublish() {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      const res = await fetch("/api/biz/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      });
      if (!res.ok) {
        alert("公開に失敗しました。再度お試しください。");
        return;
      }
      const { publishedAt } = await res.json() as { publishedAt: string };
      const now = new Date(publishedAt);
      const lastPublishedAt = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setForm((prev) => ({
        ...prev,
        isPublished: true,
        lastPublishedAt,
        lastPublishedAgo: "今",
        hasDraftChanges: false,
      }));
    } catch {
      alert("公開に失敗しました。再度お試しください。");
    } finally {
      setIsPublishing(false);
    }
  }

  // ── 完成度計算 ─────────────────────────────────────────────────────────────
  const completionPercent = useMemo(() => {
    const checks = [
      !!form.name,
      !!form.mission,
      !!form.descriptionMarkdown,
      !!form.location,
      form.benefitsTags.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  const subNavSections: CompanySubNavSection[] = COMPANY_SECTIONS.map((s) => ({
    ...s,
    hasDraft: form.hasDraftChanges && s.showStatus,
  }));

  const saveStatusStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 11, padding: "4px 10px", borderRadius: 100,
    transition: "all 0.3s", flexShrink: 0,
    ...(saveState === "saving"
      ? { color: "var(--warm)", background: "var(--warm-soft)" }
      : saveState === "saved"
        ? { color: "var(--success)", background: "var(--success-soft)" }
        : saveState === "error"
          ? { color: "var(--error)", background: "var(--error-soft)" }
          : { color: "var(--ink-mute)", background: "var(--bg-tint)" }),
  };
  const saveStatusText =
    saveState === "saving" ? "下書きに保存中..."
    : saveState === "saved"  ? "下書きを自動保存しました"
    : saveState === "error"  ? "保存に失敗しました"
    : "編集中";

  // ── セクションレンダラー ──────────────────────────────────────────────────

  function renderSection() {
    switch (activeSection) {

      case "basic":
        return (
          <>
            <h1 style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
              基本情報
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 30, lineHeight: 1.9 }}>
              企業ロゴ、企業名、ミッション、業種など、求職者側のヒーローエリアに表示される情報を編集します。
            </p>
            <CompanyPublishStatusBar
              hasDraftChanges={form.hasDraftChanges}
              draftSections="基本情報"
            />

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
                    fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 38,
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

            <SectionCard title="企業の基本情報">
              <FormGroup>
                <FormLabel required>企業名</FormLabel>
                <FormInput value={form.name} onChange={(v) => update("name", v)} />
              </FormGroup>
              <FormGroup>
                <FormLabel required>ミッション</FormLabel>
                <FormTextarea serif value={form.mission} onChange={(v) => update("mission", v)} rows={2} placeholder="企業のミッションやビジョン" />
                <FormHint>企業詳細ページのヒーローエリアに大きく表示される、企業の核となるメッセージです。短く、印象的に。</FormHint>
              </FormGroup>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup>
                  <FormLabel required>業種</FormLabel>
                  <FormSelect value={form.industry} onChange={(v) => update("industry", v)} options={INDUSTRY_OPTIONS} />
                </FormGroup>
                <FormGroup>
                  <FormLabel>事業ステージ</FormLabel>
                  <FormSelect value={form.phase} onChange={(v) => update("phase", v)} options={PHASE_OPTIONS} />
                </FormGroup>
              </div>
              <FormGroup>
                <FormLabel>公式サイトURL</FormLabel>
                <FormInput type="url" value={form.url} onChange={(v) => update("url", v)} placeholder="https://example.co.jp" />
              </FormGroup>
            </SectionCard>
          </>
        );

      case "about":
        return (
          <>
            <h1 style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
              About（企業説明）
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 30, lineHeight: 1.9 }}>
              企業の事業・組織・価値観を、求職者に伝える長文セクションです。マークダウン記法で見出しや太字を使えます。
            </p>
            <SectionCard
              title="企業説明"
              desc="企業の事業内容、創業背景、組織カルチャー、これからの展望などを自由に記述してください。読み物として読まれます。"
            >
              <MarkdownEditor
                value={form.descriptionMarkdown}
                onChange={(v) => update("descriptionMarkdown", v)}
                placeholder="## 私たちについて&#10;&#10;事業の特徴や組織カルチャーを記述してください..."
                minHeight={300}
              />
            </SectionCard>
          </>
        );

      case "data":
        return (
          <>
            <h1 style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
              数値データ
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 30, lineHeight: 1.9 }}>
              求職者側の企業詳細ページの「数値データ」セクションに表示されます。空欄の項目は表示されません。
            </p>
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
              </div>
            </SectionCard>
            <SectionCard title="評価制度・福利厚生">
              <FormGroup>
                <FormLabel>評価制度</FormLabel>
                <FormTextarea value={form.evaluationSystem} onChange={(v) => update("evaluationSystem", v)} rows={3} placeholder="評価制度の説明..." />
              </FormGroup>
              <FormGroup>
                <FormLabel>福利厚生</FormLabel>
                <RequirementsTagInput
                  tags={form.benefitsTags}
                  onTagsChange={(tags) => update("benefitsTags", tags)}
                  placeholder="タグを追加して Enter..."
                  color="royal"
                />
                <FormHint>求職者側ではタグ形式で表示されます</FormHint>
              </FormGroup>
            </SectionCard>
          </>
        );

      case "workstyle":
        return (
          <>
            <h1 style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
              働き方
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 30, lineHeight: 1.9 }}>
              オフィス所在地、リモートワーク状況、フレックスなど、働き方に関する情報を編集します。
            </p>
            <SectionCard title="オフィス所在地">
              <FormGroup>
                <FormLabel required>本社所在地</FormLabel>
                <FormInput value={form.location} onChange={(v) => update("location", v)} placeholder="東京都渋谷区..." />
              </FormGroup>
              <FormGroup>
                <FormLabel>最寄り駅</FormLabel>
                <FormInput value={form.nearestStation} onChange={(v) => update("nearestStation", v)} placeholder="例: JR渋谷駅 東口より徒歩5分" />
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
                <FormGroup>
                  <FormLabel>月間平均残業時間</FormLabel>
                  <FormInput value={form.avgOvertimeHours} onChange={(v) => update("avgOvertimeHours", v)} placeholder="例: 20時間" />
                </FormGroup>
                <FormGroup>
                  <FormLabel>有給取得率</FormLabel>
                  <FormInput value={form.paidLeaveRate} onChange={(v) => update("paidLeaveRate", v)} placeholder="例: 78%" />
                </FormGroup>
              </div>
              <FormGroup>
                <FormLabel optional>働き方の補足説明</FormLabel>
                <FormTextarea value={form.workstyleNote} onChange={(v) => update("workstyleNote", v)} rows={3} placeholder="数値だけでは伝わらない、働き方の文化や考え方を補足してください" />
                <FormHint>数値だけでは伝わらない、働き方の文化や考え方を補足してください</FormHint>
              </FormGroup>
            </SectionCard>
          </>
        );

      case "photos":
        return (
          <>
            <h1 style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
              オフィス写真
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 30, lineHeight: 1.9 }}>
              オフィスの様子を写真で伝えます。カテゴリごとに最大5枚まで登録できます。
            </p>
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
            <h1 style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
              公開設定
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 30, lineHeight: 1.9 }}>
              企業情報の公開状態と、求職者からの問い合わせを受けるかを設定します。
            </p>
            <SectionCard title="公開状態">
              <FormGroup>
                <FormLabel>企業情報の公開</FormLabel>
                <FormSelect
                  value={form.isPublished ? "public" : "private"}
                  onChange={(v) => update("isPublished", v === "public")}
                  options={["public", "private"]}
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
                  options={["accepting", "paused"]}
                />
                <FormHint>「一時停止」中は、求職者側のページから「カジュアル面談を申し込む」ボタンが非表示になります。</FormHint>
              </FormGroup>
            </SectionCard>
            <SectionCard title="通知設定">
              <FormGroup>
                <FormLabel>新規カジュアル面談の通知先</FormLabel>
                <FormInput
                  value={form.notificationEmails}
                  onChange={(v) => update("notificationEmails", v)}
                  placeholder="recruiting@example.co.jp"
                />
                <FormHint>複数のメールアドレスを設定する場合はカンマ区切り</FormHint>
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
      planType={planType as any}
      variant="fullBleed"
    >
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 57px)",
      }}>

        {/* サブトップバー */}
        <div style={{
          height: 52,
          borderBottom: "1px solid var(--line)",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
          flexShrink: 0,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              企業情報を編集
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
              onClick={() => alert("プレビュー（実装予定）")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                borderRadius: 8, cursor: "pointer",
                border: "1px solid var(--line)", background: "#fff", color: "var(--ink)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal-100)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--royal-50)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
                (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              プレビュー
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                borderRadius: 8, cursor: isPublishing ? "wait" : "pointer",
                background: "var(--success)", color: "#fff",
                border: "1px solid var(--success)",
                transition: "all 0.2s",
                opacity: isPublishing ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isPublishing) {
                  (e.currentTarget as HTMLButtonElement).style.background = "#047857";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#047857";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--success)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--success)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              {isPublishing ? "公開中..." : "変更を公開する"}
            </button>
          </div>
        </div>

        {/* 2カラム本体 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          flex: 1,
          overflow: "hidden",
        }}>
          <CompanyEditSubNav
            sections={subNavSections}
            activeSection={activeSection}
            onSectionClick={(id) => setActiveSection(id as CompanySectionId)}
            completionPercent={completionPercent}
            lastPublishedAt={form.lastPublishedAt}
            lastPublishedAgo={form.lastPublishedAgo}
            onViewPublicPage={() => router.push(`/companies/${companyId}`)}
          />

          <main style={{
            overflowY: "auto",
            padding: "32px 40px 60px",
            maxWidth: 900,
          }}>
            {renderSection()}
          </main>
        </div>
      </div>
    </BusinessLayout>
  );
}
