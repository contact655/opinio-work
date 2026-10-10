"use client";

import { useState, useRef, useEffect } from "react";
import { showToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CompanyEditSubNav, type CompanySubNavSection } from "@/components/business/CompanyEditSubNav";
import { OfficePhotoSection } from "@/components/business/OfficePhotoSection";
import { BenefitsEditor } from "@/components/business/BenefitsEditor";
import { TERMS_VERSION } from "@/lib/constants/terms";
import { PHASE_SELECT_OPTIONS } from "@/lib/constants/phase";
import { COMPANY_REMOTE_WORK_SELECT_OPTIONS } from "@/lib/constants/workStyle";
import { companyPageStatus } from "@/lib/companies/pageStatus";
import {
  COMPANY_SECTIONS,
  WORK_SCHEDULE_SELECT_OPTIONS,
  type BizCompany,
  type CompanySectionId,
} from "@/lib/business/mockCompany";
import { createClient } from "@/lib/supabase/client";
import { uploadCompanyLogo, type OfficePhoto } from "@/lib/business/photos";
import { MAX_BUSINESS_DOMAINS_PER_COMPANY, type BusinessDomainOption } from "@/lib/companies/businessDomains";
import { MarkdownEditor } from "@/components/business/MarkdownEditor";
import { IndustrySelectOptions } from "@/components/companies/IndustrySelectOptions";
import { hasPublicCompanyPage } from "@/lib/companies/visibility";
import { EMPLOYEE_BANDS } from "@/lib/constants/employeeBand";

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
  /** 掲載利用規約への同意済みか */
  initialTermsAgreed?: boolean;
  /** 同意記録用のユーザーID（auth.users.id） */
  userId?: string;
  /**
   * 企業が「掲載を依頼する」を押した日時（`ow_companies.listing_requested_at`）。null は未依頼。
   * ⚠️★**`form`（＝ `draft_data` に自動保存される下書き）に入れないこと。**
   *    これは運営が対応したら NULL に戻す**サーバー側の状態**で、企業が編集する値ではない。
   *    下書きに混ぜると、自動保存のたびに古い値で上書きされる。
   */
  initialListingRequestedAt?: string | null;
  /**
   * ★`ow_companies.listing_status`（2026-10-08）。状態表示（`companyPageStatus`）に使う。
   * ⚠️ `initialListingRequestedAt` と同じ理由で `form` に入れない。取れなければ null。
   */
  listingStatus?: string | null;
  /**
   * その会社の有効な担当者（`ow_company_admins` ＋ `ow_users`）。通知先の候補。
   * ⚠️ 空配列でも動く（自由入力だけになる）。
   */
  teamMembers?: NotificationTeamMember[];
  /** 事業領域の選択肢（`ow_business_domains` の有効なもの）。⚠️ コードに書かない */
  businessDomainOptions?: BusinessDomainOption[];
  initialBusinessDomainIds?: string[];
  initialPrimaryBusinessDomainId?: string | null;
  /** この企業の業種が事業領域を必須としているか（`ow_industries.requires_business_domain`）。
   *  ⚠️ **slug で判定しないこと**（`/admin` 側と同じ規則） */
  industryRequiresDomain?: boolean;
  /** ow_industries 全件。2026-08-25 からフラット20件（親子は無い） */
  /** ⚠️ `parent_id` は必須。2階層（製造業）を `<optgroup>` で出すのに要る（2026-09-05） */
  industries?: { id: string; name: string; slug: string; display_order: number; parent_id: string | null }[];
  /** スコア計算用（サーバー側で取得した静的カウント） */
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

/**
 * 通知先の1人ぶん。⚠️ 出どころは `ow_company_admins`（その会社の有効な担当者）＋ `ow_users`。
 * ⚠️ `department` / `role_title` は `ow_company_admins` の列。**`ow_users` の職歴ではない。**
 */
export type NotificationTeamMember = {
  name: string;
  email: string;
  department: string | null;
  roleTitle: string | null;
  /** `permission === "admin"`。⚠️ 未設定のときのフォールバック先はこの人たちだけ */
  isAdminPermission: boolean;
};

/** 大文字小文字を無視して比べる。⚠️ メールのローカル部は本来大小を区別するが、
 *  実運用で区別している事業者はほぼ無く、区別すると同じ人を2回選べてしまう。 */
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * 企業への通知先を選ぶ（2026-09-29 / 柴さんの指示）。
 *
 * ── なぜ作ったか ──────────────────────────────────────────────────────────
 * それまでは**カンマ区切りのメールアドレスだけ**で、
 * `recruiting@example.co.jp` と並んでいても**誰のアドレスか分からなかった。**
 * 実測（2026-09-29 / 本番）: この列を設定している企業は **0社**。
 * ＝ **一度も使われないまま**、実際に効いていたのはフォールバック（②有効な管理者）だけ。
 *
 * → その会社の **OPINIO アカウントから選ぶ**形にした。名前・部門・職種・メールが出る。
 *
 * ⚠️★**自由入力を消さないこと。** `recruiting@` のような共有メールボックスや
 *    採用代行など、**OPINIO アカウントを持たない宛先が実在する。**
 *
 * ⚠️★**保存先は今までどおり `notification_emails`（text[]）。** 選んだ人の
 *    「メールアドレスだけ」を入れる。**`user_id` で持つ形に変えていない。**
 *    理由: `lib/notify/recipients.ts` がアドレスの配列を期待しており、
 *    ここだけ構造を変えると**宛先の解決が2通りに割れる**（そちらのほうが危ない）。
 *    ⚠️ 引き換えに、その人が OPINIO のメールアドレスを変えても追随しない。
 *       いまは**本人がメールアドレスを変える機能が存在しない**ので実害は無い
 *       （CLAUDE.md「`email` は本人向けの変更機能が無いから GRANT を落としている」）。
 *       **変更機能を作る日は、ここも一緒に考えること。**
 *
 * ⚠️★**「上書き」であることを画面に出す。** `notification_emails` は
 *    既定の宛先への**追加ではなく上書き**（`recipients.ts` の解決順①）。
 *    1人でも選ぶと、選ばなかった管理者には**届かなくなる。**
 */
function NotificationRecipients({
  value,
  onChange,
  members,
}: {
  value: string;
  onChange: (v: string) => void;
  members: NotificationTeamMember[];
}) {
  const emails = value ? value.split(",").map((e) => e.trim()).filter(Boolean) : [];

  /** 担当者のアドレスに当たらないもの＝共有アドレスなど。⚠️ 落とさずに必ず残す */
  const others = emails.filter((e) => !members.some((m) => sameEmail(m.email, e)));
  const isSelected = (m: NotificationTeamMember) => emails.some((e) => sameEmail(m.email, e));

  /**
   * ★並びは常に「担当者（`members` の順）→ その他」に組み直す。
   *
   * ⚠️★**押した順に足す形にしないこと**（2026-09-29 に実際に食い違った）。
   *    チェックを付けた経路と、その他のアドレスを足した経路とで**並びが変わり**、
   *    同じ宛先なのに「いまの宛先」の表示順が操作の順番で変わる。
   *    保存値（`notification_emails`）にも順序が残るので、**中身が同じでも差分が出て
   *    「未公開の変更あり」が無意味に点く。**
   */
  function rebuild(selectedEmails: string[], otherEmails: string[]) {
    const ordered = members.filter((m) => selectedEmails.some((e) => sameEmail(m.email, e))).map((m) => m.email);
    onChange([...ordered, ...otherEmails].join(", "));
  }

  function toggle(m: NotificationTeamMember) {
    const selected = members.filter(isSelected).map((x) => x.email);
    const nextSelected = isSelected(m)
      ? selected.filter((e) => !sameEmail(m.email, e))
      : [...selected, m.email];
    rebuild(nextSelected, others);
  }

  /** その他のアドレスだけを置き換える。⚠️ 選択済みの担当者を巻き込まないこと */
  function setOthers(v: string) {
    const nextOthers = v ? v.split(",").map((e) => e.trim()).filter(Boolean) : [];
    rebuild(members.filter(isSelected).map((m) => m.email), nextOthers);
  }

  /** 未設定のときに実際に届く人（`recipients.ts` の②）。⚠️ 条件を変えるならあちらと揃える */
  const fallback = members.filter((m) => m.isAdminPermission);

  /* ★★2択にした（2026-10-08 / 柴さんの指示）。
        それまでは未設定のとき**チェックが全部外れているのに**、説明文だけが
        「いまは◯◯（管理者）に届きます」と言っていた。**見た目と実際の宛先が食い違う。**
     ・既定（管理者全員）… 管理者を**灰色のチェック済み**で示す。押せない
     ・宛先を選ぶ          … チェックと自由入力で選ぶ（`notification_emails` に保存＝上書き）
     ⚠️ モードは local state で持つ。値から毎回導くと、「選ぶ」にした直後（まだ0件）に
        既定へ戻ってしまう。
     ⚠️★既定へ戻すと `notification_emails` を空にする（＝既定の宛先に戻る）。 */
  const [mode, setMode] = useState<"default" | "custom">(emails.length > 0 ? "custom" : "default");

  function chooseDefault() {
    setMode("default");
    onChange("");
  }
  function chooseCustom() {
    setMode("custom");
    /* ⚠️ 0件から始めない。既定と同じ顔ぶれを最初の状態にして、そこから外す・足す形にする
          （0件のままだと保存値が空＝既定のまま、という分かりにくい状態になる） */
    if (emails.length === 0) rebuild(fallback.map((m) => m.email), []);
  }

  const radio = (key: "default" | "custom", label: string, hint: string, onPick: () => void) => (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
      padding: "8px 10px", borderRadius: 8,
      border: `1.5px solid ${mode === key ? "var(--royal)" : "var(--line)"}`,
      background: mode === key ? "var(--royal-50)" : "#fff",
    }}>
      <input type="radio" name="notif-mode" checked={mode === key} onChange={onPick}
        style={{ marginTop: 3, accentColor: "var(--royal)", cursor: "pointer" }} />
      <span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{hint}</span>
      </span>
    </label>
  );

  return (
    <div>
      <div role="radiogroup" aria-label="通知の宛先" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {radio("default", "管理者全員（既定）",
          fallback.length > 0
            ? "管理者権限の担当者全員に届きます。担当者が増えると自動で宛先に入ります。"
            : "管理者権限の担当者がいないため、いまは運営に届きます。",
          chooseDefault)}
        {radio("custom", "宛先を選ぶ",
          "ここで選んだ宛先だけに届きます（選ばなかった担当者には届きません）。",
          chooseCustom)}
      </div>

      {members.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {members.map((m) => {
            /* ★既定のときは「実際に届く人」をチェック済みで示す（押せない） */
            const isDefault = mode === "default";
            const checked = isDefault ? m.isAdminPermission : isSelected(m);
            /* ⚠️ 値が無ければ出さない（「—」や「所属不明」で埋めない） */
            const sub = [m.department, m.roleTitle].filter(Boolean).join(" ・ ");
            return (
              <label
                key={m.email}
                data-state={isDefault ? (checked ? "default-on" : "default-off") : (checked ? "on" : "off")}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  cursor: isDefault ? "default" : "pointer",
                  padding: "10px 12px", borderRadius: 8,
                  border: `1.5px solid ${checked && !isDefault ? "var(--royal)" : "var(--line)"}`,
                  background: isDefault ? "var(--bg-tint)" : checked ? "var(--royal-50)" : "#fff",
                  opacity: isDefault && !checked ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isDefault}
                  onChange={() => toggle(m)}
                  style={{ marginTop: 2, width: 16, height: 16, cursor: isDefault ? "default" : "pointer", flexShrink: 0 }}
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isDefault ? "var(--ink-soft)" : "var(--ink)" }}>{m.name}</span>
                    {sub && <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{sub}</span>}
                    {!m.isAdminPermission && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
                        border: "1px solid var(--line)", borderRadius: 100, padding: "1px 6px",
                      }}>閲覧のみ</span>
                    )}
                  </span>
                  <span style={{
                    display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2,
                    overflowWrap: "anywhere",
                  }}>{m.email}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <FormHint>
          この会社にはまだ OPINIO の担当者が登録されていません。
          {mode === "custom" ? "下の欄にメールアドレスを直接入力してください。" : ""}
        </FormHint>
      )}

      {/* ⚠️★**自由入力を消さないこと。** 共有メールボックスや採用代行の宛先が実在する。
             ⚠️ 自由入力も既定の宛先を**上書き**するので、「宛先を選ぶ」のときだけ出す。 */}
      {mode === "custom" && (
        <>
          <FormLabel optional>その他のアドレス</FormLabel>
          <EmailTagInput value={others.join(", ")} onChange={setOthers} />
          <FormHint>
            recruiting@ のような共有アドレスを追加できます（Enter またはカンマで区切ります）。
          </FormHint>
          {/* ⚠️ 数ではなく**宛先そのもの**を出す。数だけだと誰が外れたか分からない */}
          {emails.length === 0 ? (
            <FormHint>
              宛先が1つも選ばれていないため、いまは管理者全員に届きます。
            </FormHint>
          ) : (
            <FormHint>
              いまの宛先: <strong style={{ color: "var(--ink)" }}>{emails.join(" ・ ")}</strong>
            </FormHint>
          )}
        </>
      )}
    </div>
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
  teamMembers = [],
  businessDomainOptions = [],
  initialBusinessDomainIds = [],
  initialPrimaryBusinessDomainId = null,
  industryRequiresDomain = false,
  industries = [],
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
  /* ★事業領域（2026-09-29）。
     ⚠️★**`form`（＝ `draft_data`）に入れないこと。** junction テーブルなので
        下書きに載せると、公開ゲートが「主が1件」を見る時点でまだ書かれておらず、
        **初回の公開が必ず失敗する**（ゲートは更新を当てる前に走る）。
        ＝ **この項目だけ即時保存**。画面にもそう書いてある。 */
  const [domainIds, setDomainIds] = useState<string[]>(initialBusinessDomainIds);
  const [primaryDomainId, setPrimaryDomainId] = useState<string | null>(initialPrimaryBusinessDomainId);
  const [isSavingDomains, setIsSavingDomains] = useState(false);

  /* ★掲載依頼（2026-09-29）。⚠️ `form` に入れない（Props の注記を読むこと） */
  const [listingRequestedAt, setListingRequestedAt] = useState<string | null>(initialListingRequestedAt);
  /* ★状態は1つの関数で決める（2026-10-08）。上部バッジ・右上の案内・設定タブの3か所が
        これを使う。⚠️ 画面側で `form.isPublished` から文言を組み直さないこと。 */
  const pageStatus = companyPageStatus({
    isPublished: form.isPublished, listingStatus, termsAgreed, listingRequestedAt,
  });
  const [isRequestingListing, setIsRequestingListing] = useState(false);
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
      const res = await fetch("/api/biz/terms-agreement", {
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
      /* ⚠️★**結果を見ずに「記録しました」と出さないこと**（2026-09-18）。
            API は 2026-09-18 まで**失敗しても 200 `{ok:true}`** を返しており、
            記録が残らないまま「同意しました ✓」と出ていた。API 側は直したので、
            ここで結果を見れば利用者に伝わる。
         ⚠️ `setTermsAgreed(true)` を先に呼ばないこと。押した人は同意したつもりのまま
            「変更を公開する」で 400 に当たることになる。 */
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        showError(d?.message ?? "同意を記録できませんでした。時間をおいてもう一度お試しください。");
        return;
      }
      setTermsAgreed(true);
      showToast("掲載利用規約への同意を記録しました ✓", "default");
    } catch {
      showError("同意を記録できませんでした。通信状況をご確認ください。");
    } finally {
      setIsRecordingAgreement(false);
    }
  }

  // ── 事業領域ハンドラ（2026-09-29）────────────────────────────────────────
  /*
   * ⚠️★**即時保存。**「変更を公開する」を経由しない（state の注記を読むこと）。
   * ⚠️★**サーバーが返すまで state を進めない。** 失敗したのに選ばれたように見えると、
   *    公開ゲートに当たって初めて気づくことになる（規約同意で 2026-09-18 に踏んだ形）。
   * ⚠️ 主を選ぶ前（`next.length > 0 && primary === null`）は**保存しない。**
   *    API が 400 で断るので、押すたびにエラーが出ることになる。
   */
  async function saveDomains(nextIds: string[], nextPrimary: string | null) {
    if (nextIds.length > 0 && nextPrimary === null) return;   // 主が決まるまで待つ
    setIsSavingDomains(true);
    try {
      const res = await fetch("/api/biz/company/business-domains", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_ids: nextIds, primary_domain_id: nextPrimary }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        showError(d?.error ?? "事業領域を保存できませんでした。時間をおいてもう一度お試しください。");
        return false;
      }
      return true;
    } catch {
      showError("事業領域を保存できませんでした。通信状況をご確認ください。");
      return false;
    } finally {
      setIsSavingDomains(false);
    }
  }

  async function toggleDomain(id: string) {
    const checked = domainIds.includes(id);
    const nextIds = checked ? domainIds.filter((x) => x !== id) : [...domainIds, id];
    /* 外した領域が主だったら主を空にする。⚠️ 残り1件なら自動でそれを主にする
          （主を選び直させるためだけに一往復増やさない） */
    let nextPrimary = primaryDomainId;
    if (checked && primaryDomainId === id) nextPrimary = nextIds.length === 1 ? nextIds[0] : null;
    if (!checked && nextIds.length === 1) nextPrimary = id;   // 最初の1件は自動で主
    setDomainIds(nextIds);
    setPrimaryDomainId(nextPrimary);
    await saveDomains(nextIds, nextPrimary);
  }

  async function choosePrimaryDomain(id: string) {
    setPrimaryDomainId(id);
    await saveDomains(domainIds, id);
  }

  // ── 掲載依頼ハンドラ（2026-09-29）────────────────────────────────────────
  /*
   * ⚠️★**掲載状態は変わらない。** 送るのは「依頼した」という記録だけで、
   *    掲載に切り替えるのは運営（`/admin/companies`）。
   *    画面にも「掲載はまだ始まりません」と出してある。**消さないこと。**
   * ⚠️ 結果を見てから state を更新する（規約同意で 2026-09-18 に踏んだのと同じ形。
   *    先に更新すると、失敗しても「依頼済み」に見える）。
   */
  async function handleRequestListing() {
    if (isRequestingListing) return;
    setIsRequestingListing(true);
    try {
      const res = await fetch("/api/biz/company/listing-request", { method: "POST" });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        /* ⚠️ 409（すでに依頼済み）は**失敗ではない。** 別のタブや別の担当者が
              先に押した場合なので、サーバーが返した日時で画面を合わせる。 */
        if (res.status === 409 && typeof d?.requestedAt === "string") {
          setListingRequestedAt(d.requestedAt);
          showToast("すでに掲載依頼を受け付けています", "default");
          return;
        }
        showError(d?.error ?? "掲載依頼を送信できませんでした。時間をおいてもう一度お試しください。");
        return;
      }
      setListingRequestedAt(typeof d?.requestedAt === "string" ? d.requestedAt : new Date().toISOString());
      showToast("掲載依頼を送信しました ✓", "default");
    } catch {
      showError("掲載依頼を送信できませんでした。通信状況をご確認ください。");
    } finally {
      setIsRequestingListing(false);
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
        /* ★下書きを本番列へ展開するだけ（2026-09-18 に分離）。
           ⚠️★**`isPublished` を送らないこと。** API は 400 で断る。掲載
              （`is_published` / `listing_status`）の管理は運営が行う。 */
        body: JSON.stringify({ action: "publish_draft" }),
      });
      if (!res.ok) {
        showError("公開に失敗しました。再度お試しください。");
        return;
      }
      /* ⚠️ サーバーは `publishedAt` を返さなくなった（掲載日は動かないため）。
            表示用の「最終公開」はクライアントの現在時刻で出す。 */
      const now = new Date();
      const lastPublishedAt = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      // 公開後に form 変化が autosave を再トリガーして draft_data が即座に再投入されるのを防ぐ
      hasInteracted.current = false;
      /* ⚠️★`isPublished` をここで true にしないこと。掲載の状態はこの操作では変わらない */
      setForm((prev) => ({
        ...prev,
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

  const subNavSections: CompanySubNavSection[] = COMPANY_SECTIONS.map((s) => ({
    ...s,
    hasDraft: hasDraftChanges && s.showStatus,
    /* ★掲載規約が未同意なら「設定」タブに●を出す（2026-09-18）。
       ⚠️ 規約パネルをこのタブへ移したので、**印が無いと存在に気づけない**
          （それまでは基本情報＝最初のタブに出ていた）。
       ⚠️ 管理者以外は同意の操作ができないので出さない（押せない印を出さない）。 */
    needsAttention: s.id === "settings" && isAdmin && !termsAgreed,
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

  /* ★タブを5つに畳んだので（2026-09-18）、**中身の単位はそのまま**残し、
        タブ側で束ねる。`logo` は基本情報に、`workstyle` は数字・働き方に入る。
     ⚠️ 中身ごと1つの case に貼り合わせない。**差分が読めなくなる**し、
        将来また分けるときに戻せない。 */
  type PanelId = CompanySectionId | "logo" | "workstyle";

  function renderSection() {
    switch (activeSection) {
      /* ⚠️ 並び順が画面の並び。ロゴは基本情報の**後ろ**（会社名より先に出さない） */
      case "basic": return <>{renderPanel("basic")}{renderPanel("logo")}</>;
      case "data":  return <>{renderPanel("data")}{renderPanel("workstyle")}</>;
      default:      return renderPanel(activeSection);
    }
  }

  function renderPanel(panel: PanelId) {
    switch (panel) {

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
                    background: form.logoGradient || "linear-gradient(135deg, var(--royal), var(--accent))", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, fontSize: 38,
                    boxShadow: "0 6px 16px rgba(0,0,0,0.12)", flexShrink: 0,
                  }}>
                    {form.logoLetter || form.name?.[0] || "?"}
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
                  /* ★2026-09-18 に素の `<select>` から `FormSelect` に揃えた。
                        ⚠️★**素の select に戻さないこと。** ここだけブラウザ標準の見た目で、
                           隣の「事業ステージ」など他のプルダウンと揃っていなかった。
                        ⚠️ 選択肢・保存先（`industryId`）・必須は変えていない。 */
                  <FormSelect id="ce-industry" value={form.industryId} onChange={(v) => update("industryId", v)}>
                    <option value="">選択してください</option>
                    {/* ⚠️ 2階層（製造業）を出す。**親も選べる**（2026-09-05）。
                           フラットに map すると親子が混ざるので、必ずこの部品を通すこと。 */}
                    <IndustrySelectOptions options={industries} />
                  </FormSelect>
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
              {/* ★事業領域（2026-09-29 / 柴さんの判断）。**企業ジャンルより先に置く。**
                     ⚠️★これが `/biz` に無かったせいで、企業は**自分では満たせない条件**
                        （公開ゲートの「主を1件」）で掲載を止められていた。
                        実測（2026-09-29）: 主の事業領域が無い企業が14社。
                     ⚠️★**求職者側の絞り込み・カードのタグ・企業ページのサイドバー・
                        LPファセット・フッター・sitemap を動かすのはこちら。**
                        企業ジャンルは絞り込みに1箇所も使われていない（`?genre=` は0件）。
                        **並び順を入れ替えないこと。** */}
              {businessDomainOptions.length > 0 && (
                <FormGroup>
                  <FormLabel required={industryRequiresDomain}>事業領域</FormLabel>
                  <FormHint>
                    この会社が<strong>何を作っているか</strong>です（最大 {MAX_BUSINESS_DOMAINS_PER_COMPANY} 件）。
                    1つを「主」にしてください —— 企業一覧のカードと検索結果に出るのは主の1件です。
                  </FormHint>
                  {/* ⚠️★**必須かどうかは業種マスタの `requires_business_domain`。**
                         slug で判定しないこと（`/admin` 側と同じ規則）。 */}
                  {industryRequiresDomain ? (
                    <FormHint>
                      <strong style={{ color: "var(--warm-ink)" }}>この業種では掲載に事業領域が必要です。</strong>
                      主を1件選んでいないと、掲載に切り替えられません。
                    </FormHint>
                  ) : (
                    <FormHint>この業種では任意です。当てはまらないなら空のままで構いません。</FormHint>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {businessDomainOptions.map((d) => {
                      const checked = domainIds.includes(d.id);
                      const atLimit = !checked && domainIds.length >= MAX_BUSINESS_DOMAINS_PER_COMPANY;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDomain(d.id)}
                          disabled={atLimit || isSavingDomains || isPublishing}
                          title={d.description ?? undefined}
                          style={{
                            border: `1.5px solid ${checked ? "var(--royal)" : "var(--line)"}`,
                            background: checked ? "var(--royal-50)" : "#fff",
                            color: checked ? "var(--royal)" : "var(--ink-soft)",
                            borderRadius: 100, padding: "6px 14px",
                            fontSize: 13, fontWeight: checked ? 700 : 500,
                            cursor: (atLimit || isSavingDomains) ? "not-allowed" : "pointer",
                            opacity: atLimit ? 0.4 : 1,
                            fontFamily: "inherit",
                          }}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                  {/* ⚠️★**主を選ぶ行を出す。** 主が決まるまで保存されない
                         （API が 400 で断るので、押すたびにエラーを出さないため）。
                      ⚠️ 1件だけのときは自動で主になるので、この行は2件以上のときだけ。 */}
                  {domainIds.length > 1 && (
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", marginRight: 8 }}>主にするもの</span>
                      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 12 }}>
                        {domainIds.map((id) => {
                          const d = businessDomainOptions.find((x) => x.id === id);
                          if (!d) return null;
                          return (
                            <label key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13, color: "var(--ink)" }}>
                              <input
                                type="radio"
                                name="biz-primary-business-domain"
                                checked={primaryDomainId === id}
                                onChange={() => choosePrimaryDomain(id)}
                                disabled={isSavingDomains || isPublishing}
                                style={{ width: 14, height: 14, cursor: "pointer" }}
                              />
                              {d.name}
                            </label>
                          );
                        })}
                      </span>
                    </div>
                  )}
                  {/* ⚠️★**「すぐ反映される」と出すこと。** この画面で唯一、下書きを
                         経由しない項目。黙っていると「変更を公開する」を押すまで
                         効かないと読まれる。 */}
                  {/* ⚠️★★**主が決まっていない状態を黙って通さないこと**（2026-09-29）。
                         主が null のあいだ `saveDomains` は**何も送らない**（API が 400 で
                         断るので、押すたびにエラーを出さないため）。その結果
                         **画面は新しい選択、DB は古いまま**になる。
                         例: 3件から主を外すと残り2件になり、主が空になる。
                         ここで言わないと「入力させたのに保存しない」になる。 */}
                  {domainIds.length > 0 && primaryDomainId === null ? (
                    <FormHint>
                      <strong style={{ color: "var(--warm-ink)" }}>
                        主にするものを1つ選んでください。選ぶまで保存されません。
                      </strong>
                    </FormHint>
                  ) : (
                    <FormHint>
                      {isSavingDomains
                        ? "保存中..."
                        : "この項目は選ぶとすぐに反映されます（「変更を公開する」を押す必要はありません）。"}
                    </FormHint>
                  )}
                </FormGroup>
              )}
              {/* ★★企業ジャンル（`ow_genres`）の入力欄は 2026-09-29 に畳んだ（柴さんの判断）。
                     ⚠️★**戻さないこと。** 実測（2026-09-29 / 本番）:
                       ・絞り込みに**1箇所も使われていない**（`?genre=` は src 全体で0件）
                       ・掲載中21社のうちジャンルが付いているのは**自社1社だけ**
                         （AI・LLM特化 → 株式会社Opinio。他の3行は検証用企業か
                          無効化済みジャンル）
                       ・有効5件のうち**3件は該当0社**
                     ＝ 企業に選ばせる意味が無く、**同じ画面で事業領域と紛らわしい**。
                  ⚠️ **表示は残してある。** 企業ページの Hero のバッジと `CompanyInfoBox` の
                     サイドバーは今までどおり出るし、`/admin/companies/[id]` の
                     「ジャンル」タブからは付け外しできる。**消したのは企業側の入力欄だけ。**
                  ⚠️★**`form.genres` を消さないこと。** `transformFormToDb` が
                     `draft_data.genres` に書き、PATCH がそれを `ow_company_genres` へ
                     展開する。フォームから外すと**「変更を公開する」を押した瞬間に
                     既存のジャンルが消える。**（`page.tsx` が公開済みの値で初期化している） */}
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
              求職者側の「数値で見る企業」セクションに表示されます。
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
                {isRegisteringNumbers ? "更新中..." : "数値を最新として公開する"}
              </button>
            </div>
            {/* ⚠️★このボタンは**数値を保存しない。** 保存は他の項目と同じ自動保存で、
                   ここが押すのは `PATCH { action: "update_numbers_timestamp" }` ——
                   **更新日時のスタンプだけ**。だから文言を「保存・公開」から
                   「最新として公開」に変えた（2026-09-18）。
                ⚠️ 「保存」に戻さないこと。押さないと保存されないと読まれる。 */}
            <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "-14px 0 24px", lineHeight: 1.8 }}>
              求職者側に更新日時が表示されます。
            </p>
            <SectionCard title="基本情報">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FormGroup>
                  {/* ★2026-10-10 に自由記述から「帯＋いつ時点」に変えた（柴さんの指示）。
                         ⚠️ 帯の語彙は `EMPLOYEE_BANDS` の1か所（DB の CHECK と同じ8区分）。
                         ⚠️ 採用する法人の人数を選ぶ（単体とグループがあれば単体）。 */}
                  <FormLabel required>従業員数</FormLabel>
                  <FormSelect
                    value={form.employeeCountBand}
                    onChange={(v) => update("employeeCountBand", v)}
                    options={[{ value: "", label: "選択してください" }, ...EMPLOYEE_BANDS.map((b) => ({ value: b.value, label: b.label }))]}
                  />
                  <div style={{ marginTop: 8 }}>
                    <FormInput type="month" value={form.employeeCountAsOf} onChange={(v) => update("employeeCountAsOf", v)} ariaLabel="従業員数の時点（年月）" />
                  </div>
                  <FormHint>採用する法人の人数を選んでください。下の欄に、いつ時点の人数かを年月で入れます（任意）</FormHint>
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
            {/* ⚠️★ここにあった2つ目の「数値を保存・公開する」は 2026-09-18 に削除した。
                   **上の回答状態バーのボタンと同じ `handleRegisterNumbers` を呼ぶ複製**で、
                   同じ画面に同じ操作が2つある状態だった。**戻さないこと。** */}
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
                  <FormLabel htmlFor="ce-remote">リモートワーク状況</FormLabel>
                  {/* ⚠️★**日本語を value にした選択肢を渡さないこと**（2026-09-18）。
                         2026-09-18 まで `REMOTE_OPTIONS`（日本語4件）を渡しており、
                         DB の CHECK に1つも通らず**企業情報の保存が丸ごと失敗していた**。
                         事業ステージで 2026-09-06 に直したのと同じ形。
                         選択肢の唯一の出どころは `lib/constants/workStyle.ts`。 */}
                  <FormSelect id="ce-remote" value={form.remoteWorkStatus} onChange={(v) => update("remoteWorkStatus", v)} options={COMPANY_REMOTE_WORK_SELECT_OPTIONS} />
                </FormGroup>
                <FormGroup>
                  <FormLabel>勤務時間制度</FormLabel>
                  <FormSelect value={form.workScheduleType} onChange={(v) => update("workScheduleType", v)} options={WORK_SCHEDULE_SELECT_OPTIONS} />
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
            {/* ★掲載規約の同意は 2026-09-18 にここへ移した（基本情報タブから）。
                   ⚠️★**未同意だと「変更を公開する」がそもそも描画されない**
                      （`CompanyEditSubNav` が `termsAgreed` で出し分ける）。
                      タブの奥に移した以上、**気づける導線が3つ要る**:
                        ① サブナビの「設定」に未同意バッジ（●）
                        ② 「変更を公開する」の近くの一言（未同意のときだけ）
                        ③ 右上の固定バナー（押すとこのタブへ来る）
                      **どれかを消すなら、残りで気づけるかを確かめてから。** */}
            {/* 規約同意 */}
            {!termsAgreed ? (
              /* ⚠️★**`marginTop` を付け直さないこと**（2026-09-29）。`.biz-company-body` が
                    既に `padding-top: 28px` を持っており、他タブの先頭 `SectionCard` は
                    marginTop を持たない。ここだけ 24px 足していたので**設定タブの先頭だけ
                    下にずれていた。**
                 ⚠️★**`marginBottom` を外さないこと。** `SectionCard` は
                    `marginBottom: 18` だけを持ち `marginTop` を持たないので、
                    ここに下マージンが無いと**次の「掲載状態」カードと隙間0でくっつく。** */
              <div style={{
                padding: "24px 28px", marginBottom: 18,
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
              /* ⚠️ 未同意のオレンジ枠と同じ扱いに揃えてある（2026-09-29）。
                    **片方だけ marginTop / marginBottom を変えないこと** ——
                    同意した瞬間に先頭の位置が動いて見える。 */
              <div style={{
                padding: "12px 16px", marginBottom: 18,
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
            <SectionCard title="掲載状態">
              {/* ★★企業側の掲載スイッチは 2026-09-18 に撤去した（柴さんの指示）。
                     **状態の表示だけ**にしてある。
                  ⚠️★**スイッチを戻さないこと。** 掲載の管理は運営が行う
                     （`/admin/companies` の `updateIsPublished` / `updateListingStatus`）。
                     ⚠️ UI を戻すだけでは足りない。`PATCH /api/biz/company` は
                        `isPublished` を **400 で断る**ようにしてある。
                  ⚠️ 「変更を公開する」（下書きの展開）とは**別物**。あちらは企業側に残す。 */}
              <FormGroup>
                <FormLabel>掲載状態</FormLabel>
                {/* ★判定は `companyPageStatus` の1箇所（2026-10-08）。
                       それまで `form.isPublished` だけで「掲載中／未掲載」を出しており、
                       `listing_status`（一覧に載っているか）を見ていなかった。 */}
                <div data-state={pageStatus.kind} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 8,
                  border: "1px solid var(--line)", background: "var(--bg-tint)",
                  fontSize: 13, fontWeight: 700,
                  color: pageStatus.kind === "listed" ? "var(--royal)" : "var(--ink-mute)",
                }}>
                  <span aria-hidden style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: pageStatus.kind === "listed" ? "var(--royal)" : "var(--ink-mute)",
                  }} />
                  {pageStatus.label}
                </div>
                <FormHint>{pageStatus.detail}</FormHint>
                {/* ★掲載依頼（2026-09-29 / 柴さんの指示）。
                       それまでは `/business/contact`（公開のフォーム）へのリンクだけで、
                       **ログイン済みの担当者に会社名・氏名・メールを打ち直させていた。**
                       しかもあのフォームはメール1本で DB に残らないので、運営が見落とすと追えず、
                       企業側も「依頼したかどうか」が画面から分からなかった。
                    ⚠️★**掲載状態は運営が切り替える。** ここが送るのは依頼の記録だけ
                       （`ow_companies.listing_requested_at`）。**スイッチに戻さないこと。** */}
                {pageStatus.kind === "listed" ? (
                  <FormHint>掲載の管理は運営が行います。</FormHint>
                ) : listingRequestedAt ? (
                  <div style={{
                    marginTop: 8, padding: "10px 14px", borderRadius: 8,
                    background: "var(--bg-tint)", border: "1px solid var(--line)",
                    display: "flex", alignItems: "flex-start", gap: 8,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                        掲載を依頼しました（{new Date(listingRequestedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}）
                      </span>
                      <br />
                      {/* ⚠️ 対応までの日数を書かないこと（`/business/contact` と同じ理由。
                             運営の対応時間を約束できる根拠が無い）。 */}
                      運営が内容を確認します。掲載が始まるとこの画面の掲載状態が変わります。
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={handleRequestListing}
                        /* ⚠️ 管理者だけ。掲載は会社としての意思表示なので、
                              閲覧権限の担当者には押させない（規約同意と同じ扱い）。 */
                        disabled={!isAdmin || !termsAgreed || isRequestingListing}
                        className="btn-fixed-size"
                        style={{
                          background: (isAdmin && termsAgreed) ? "var(--royal)" : "var(--line)",
                          color: (isAdmin && termsAgreed) ? "#fff" : "var(--ink-mute)",
                          border: "none", borderRadius: 8,
                          padding: "10px 20px", fontSize: 14, fontWeight: 600,
                          cursor: (isAdmin && termsAgreed) ? "pointer" : "not-allowed",
                        }}
                      >
                        {isRequestingListing ? "送信中..." : "掲載を依頼する"}
                      </button>
                    </div>
                    <FormHint>
                      {/* ⚠️★**未同意の理由を書くこと。** 押せない理由が画面に無いと、
                             同じタブの上にあるパネルに気づけない。 */}
                      {!isAdmin
                        ? "掲載の依頼は管理者権限の担当者が行えます。"
                        : !termsAgreed
                          ? "先に、このページ上部の掲載利用規約へ同意してください。"
                          : "運営に掲載の依頼が届きます。押しただけでは掲載は始まりません。"}
                    </FormHint>
                    {/* ⚠️ フォームへの導線は残す。掲載以外の相談もあるため。 */}
                    <FormHint>
                      掲載以外のご相談は{" "}
                      <a href="/business/contact" style={{ color: "var(--royal)", fontWeight: 600 }}>お問い合わせ</a>
                      から。
                    </FormHint>
                  </>
                )}
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
                {/* ★2026-09-29 に、カンマ区切りのメール1欄から
                       「担当者から選ぶ＋その他のアドレス」に変えた（柴さんの指示）。
                    ⚠️★**1欄に戻さないこと。** アドレスだけだと**誰のものか分からない。**
                       実測（2026-09-29 / 本番）: この列を設定していた企業は **0社**で、
                       実際に効いていたのはフォールバック（②有効な管理者）だけだった。
                    ⚠️ 保存先・保存形式（`notification_emails` の text[]）は変えていない。
                       `lib/notify/recipients.ts` の解決順もそのまま。 */}
                <FormLabel>企業への通知先</FormLabel>
                <NotificationRecipients
                  value={form.notificationEmails}
                  onChange={(v) => update("notificationEmails", v)}
                  members={teamMembers}
                />
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
        height: "calc(100vh - var(--biz-header-h))",
      }}>

        {/* ★上部（見出し・状態・操作・タブ）＋本文の1列（2026-09-21）。
               それまでは 240px の縦の列を左に持つ2カラムで、サイドバーと合わせて左に列が2本あった。 */}
          <CompanyEditSubNav
            sections={subNavSections}
            activeSection={activeSection}
            onSectionClick={(id) => setActiveSection(id as CompanySectionId)}
            hasDraftChanges={hasDraftChanges}
            /* ★公開ページが無いなら「公開ページを見る」を出さない（2026-09-20）。
                  判定は `hasPublicCompanyPage` の1箇所。 */
            hasPublicPage={hasPublicCompanyPage({ isPublished: form.isPublished })}
            lastPublishedAt={form.lastPublishedAt}
            onViewPublicPage={() => router.push(`/companies/${companyId}`)}
            onPublish={handlePublish}
            isPublishing={isPublishing}
            isAdmin={isAdmin}
            termsAgreed={termsAgreed}
            pageStatus={pageStatus}
            saveState={saveState}
            saveStatusText={saveStatusText}
            onRetrySave={handleRetrySave}
          />

          <div className="biz-company-body" style={{
            flex: 1,
            overflowY: "auto",
          }}>
          <div style={{ maxWidth: 900 }}>
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
          </div>
          </div>
      </div>
    </BusinessLayout>
  );
}
