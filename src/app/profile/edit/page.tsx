"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MOCK_PROFILE,
  LOCATIONS,
  AGE_RANGES,
  type ProfileData,
  type Experience,
} from "./mockProfileData";
import { getRoleLabelById, getRoleCategoryLabel } from "./roleData";
import CareerModal from "./CareerModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved";
type ActiveView = "basic" | "career" | "sns" | "account";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPeriod(exp: Experience): string {
  const start = exp.startedAt.replace("-", ".");
  if (exp.isCurrent) return `${start} 〜 現在`;
  const end = exp.endedAt ? exp.endedAt.replace("-", ".") : "";
  if (exp.startedAt && exp.endedAt) {
    const sy = parseInt(exp.startedAt.split("-")[0]);
    const sm = parseInt(exp.startedAt.split("-")[1]);
    const ey = parseInt(exp.endedAt.split("-")[0]);
    const em = parseInt(exp.endedAt.split("-")[1]);
    const months = (ey - sy) * 12 + (em - sm);
    const years = Math.floor(months / 12);
    const rem = months % 12;
    const dur = years > 0 ? `${years}年${rem > 0 ? rem + "ヶ月" : ""}` : `${rem}ヶ月`;
    return `${start} 〜 ${end}（${dur}）`;
  }
  return `${start} 〜 ${end}`;
}

// ─── Sub components ───────────────────────────────────────────────────────────

function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const saving = status === "saving";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, padding: "4px 10px", borderRadius: 100,
      color: saving ? "var(--ink-soft)" : "var(--success)",
      background: saving ? "var(--bg-tint)" : "var(--success-soft)",
      transition: "all 0.3s",
    }}>
      {saving ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          保存中...
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          自動保存されました
        </>
      )}
    </span>
  );
}

function SidebarItem({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 24px", fontSize: 13, fontWeight: active ? 600 : 500,
        color: active ? "var(--royal)" : "var(--ink-soft)",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10,
        borderLeft: `3px solid ${active ? "var(--royal)" : "transparent"}`,
        background: active ? "var(--royal-50)" : "transparent",
        transition: "all 0.15s",
      }}
      className="sidebar-nav-item"
    >
      <span style={{ color: active ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0 }}>
        {icon}
      </span>
      {label}
    </div>
  );
}

function FormSection({
  title, desc, children,
}: {
  title: React.ReactNode; desc?: string; children: React.ReactNode;
}) {
  return (
    <section style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, padding: "28px 32px", marginBottom: 20,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: desc ? 6 : 20 }}>
        {title}
      </div>
      {desc && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
          {desc}
        </div>
      )}
      {children}
    </section>
  );
}

function FormGroup({ label, required, optional, hint, children }: {
  label: string; required?: boolean; optional?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8,
      }}>
        {label}
        {required && <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>}
        {optional && <span style={{ color: "var(--ink-mute)", fontSize: 10, fontWeight: 400 }}>任意</span>}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.6 }}>{hint}</div>
      )}
    </div>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid var(--line)", borderRadius: 8,
    fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
    background: "#fff", outline: "none", transition: "border-color 0.15s",
    ...extra,
  };
}

function selectStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    appearance: "none" as const,
    cursor: "pointer",
    paddingRight: 32,
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };
}

// ─── Career card ──────────────────────────────────────────────────────────────

function CareerCard({
  exp, onEdit, onDelete,
}: {
  exp: Experience; onEdit: () => void; onDelete: () => void;
}) {
  const catLabel = getRoleCategoryLabel(exp.roleCategoryId);
  const roleLabel = getRoleLabelById(exp.roleCategoryId);

  return (
    <div style={{
      background: "var(--bg-tint)", border: `1px solid var(--line)`,
      borderLeft: exp.isCurrent ? "3px solid var(--success)" : "1px solid var(--line)",
      borderRadius: 10, padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 11,
            color: "var(--ink-mute)", fontWeight: 500, marginBottom: 2,
          }}>
            {formatPeriod(exp)}
            {exp.isCurrent && (
              <span style={{
                background: "var(--success-soft)", color: "var(--success)",
                padding: "1px 6px", borderRadius: 4, fontWeight: 700,
                marginLeft: 6, fontSize: 9, letterSpacing: "0.05em",
              }}>
                CURRENT
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>
            {exp.roleTitle || roleLabel}
            {catLabel && exp.roleTitle && (
              <span style={{ fontSize: 10, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>
                ※ 職種: {catLabel} &gt; {roleLabel}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {exp.displayCompanyName}
            {exp.companyType === "master" && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                color: "var(--royal)",
              }}>マスタ登録</span>
            )}
            {exp.companyType === "custom" && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: "#fff", border: "1px dashed var(--line)",
                color: "var(--ink-mute)",
              }}>未登録企業</span>
            )}
            {exp.companyType === "anon" && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: "var(--warm-soft)", border: "1px solid #FDE68A",
                color: "#B45309",
              }}>非公開</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button
            onClick={onEdit}
            title="編集"
            style={{
              width: 28, height: 28, border: "none", background: "transparent",
              borderRadius: 6, cursor: "pointer", color: "var(--ink-mute)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            className="career-icon-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            title="削除"
            style={{
              width: 28, height: 28, border: "none", background: "transparent",
              borderRadius: 6, cursor: "pointer", color: "var(--ink-mute)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            className="career-icon-btn career-delete-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
      {exp.description && (
        <div style={{
          fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7,
          marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)",
        }}>
          {exp.description}
        </div>
      )}
    </div>
  );
}

// ─── Section: 基本情報 ────────────────────────────────────────────────────────

function BasicSection({
  profile, onChange,
}: {
  profile: ProfileData;
  onChange: (patch: Partial<ProfileData>) => void;
}) {
  return (
    <div>
      <h1 style={{
        fontFamily: '"Noto Serif JP", serif', fontWeight: 500,
        fontSize: 28, color: "var(--ink)", marginBottom: 10, letterSpacing: "0.02em",
      }}>基本情報</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 36, lineHeight: 1.9 }}>
        あなたのプロフィールの主要情報です。入力した内容は他のユーザーに表示されます。<br />
        ※ 変更はすべて自動的に保存されます。
      </p>

      <FormSection
        title="プロフィール画像・カバー"
        desc="あなたのプロフィールページのヘッダーに表示されます。カバー画像は自動的に色が生成されます。"
      >
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 200, height: 80, borderRadius: "10px 10px 0 0",
              background: profile.coverColor, position: "relative",
            }}>
              <div style={{
                width: 70, height: 70, borderRadius: "50%",
                background: profile.avatarColor,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 600, border: "4px solid #fff",
                position: "absolute", bottom: -35, left: 16,
                boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
              }}>
                {profile.name.charAt(0)}
              </div>
            </div>
            <div style={{ height: 35 }} />
          </div>
          <div style={{ flex: 1, paddingTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
              プロフィール画像
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 12, lineHeight: 1.7 }}>
              未設定の場合、名前の頭文字で自動生成されます。
            </div>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 12px", background: "#fff", color: "var(--ink)",
              border: "1px solid var(--line)", borderRadius: 6,
              fontFamily: "inherit", fontSize: 11, fontWeight: 600,
              cursor: "pointer", marginRight: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              画像をアップロード
            </button>
          </div>
        </div>
      </FormSection>

      <FormSection title="氏名・基本情報">
        <FormGroup label="氏名" required hint="本名でもニックネームでもOK。姓と名の間にスペースを入れると見やすくなります。">
          <input
            type="text"
            value={profile.name}
            onChange={(e) => onChange({ name: e.target.value })}
            style={inputStyle()}
          />
        </FormGroup>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FormGroup label="所在地">
            <select
              value={profile.location}
              onChange={(e) => onChange({ location: e.target.value })}
              style={selectStyle()}
            >
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="年齢層">
            <select
              value={profile.ageRange}
              onChange={(e) => onChange({ ageRange: e.target.value })}
              style={selectStyle()}
            >
              {AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </FormGroup>
        </div>
      </FormSection>

      <FormSection
        title="About Me"
        desc="自己紹介文。あなたの価値観や仕事への想いを自由に書いてください。"
      >
        <FormGroup label="自己紹介" hint="500文字程度までを目安に。箇条書きや絵文字も使えます。">
          <textarea
            value={profile.aboutMe}
            onChange={(e) => onChange({ aboutMe: e.target.value })}
            rows={6}
            style={{ ...inputStyle({ resize: "vertical", minHeight: 120, lineHeight: "1.8" }) }}
          />
        </FormGroup>
      </FormSection>
    </div>
  );
}

// ─── Section: キャリア ────────────────────────────────────────────────────────

function CareerSection({
  experiences,
  onAdd,
  onEdit,
  onDelete,
}: {
  experiences: Experience[];
  onAdd: () => void;
  onEdit: (exp: Experience) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...experiences].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return b.startedAt.localeCompare(a.startedAt);
  });

  return (
    <div>
      <h1 style={{
        fontFamily: '"Noto Serif JP", serif', fontWeight: 500,
        fontSize: 28, color: "var(--ink)", marginBottom: 10, letterSpacing: "0.02em",
      }}>キャリア（職歴）</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 36, lineHeight: 1.9 }}>
        あなたの職歴を追加してください。現職は複数登録できます（副業・パラレルキャリアに対応）。<br />
        登録された会社名は、リンク表示 / テキスト表示 / 匿名表示の3種類から選べます。
      </p>

      <FormSection
        title="職歴一覧"
        desc="時系列で自動的に並び替えられます。各項目の編集ボタンから変更できます。"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {sorted.length === 0 && (
            <div style={{
              textAlign: "center", padding: "32px 0", color: "var(--ink-mute)",
              fontSize: 13,
            }}>
              職歴がまだ追加されていません
            </div>
          )}
          {sorted.map((exp) => (
            <CareerCard
              key={exp.id}
              exp={exp}
              onEdit={() => onEdit(exp)}
              onDelete={() => onDelete(exp.id)}
            />
          ))}
        </div>

        <button
          onClick={onAdd}
          style={{
            width: "100%", padding: 14,
            background: "#fff", color: "var(--royal)",
            border: "1.5px dashed var(--royal-100)", borderRadius: 10,
            fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.2s",
          }}
          className="add-career-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          職歴を追加する
        </button>
      </FormSection>

      {/* Mentor notice */}
      <div style={{
        background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
        color: "#fff", borderRadius: 14, padding: "24px 28px", marginTop: 24,
        display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center",
      }}>
        <div>
          <div style={{
            fontFamily: '"Noto Serif JP", serif',
            fontSize: 16, fontWeight: 500, marginBottom: 6,
          }}>
            メンターとして、後輩の相談に乗りませんか？
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.7 }}>
            Opinioメンターは、運営による厳正な審査を経て認定される制度です。<br />
            あなたの経験を、キャリアに悩む誰かに届けてみませんか。
          </div>
        </div>
        <button style={{
          padding: "10px 20px", background: "#fff", color: "var(--royal)",
          border: "none", borderRadius: 8, fontFamily: "inherit",
          fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
        }}>
          メンター登録について
        </button>
      </div>
    </div>
  );
}

// ─── Section: SNS ─────────────────────────────────────────────────────────────

function SnsSection({
  profile, onChange,
}: {
  profile: ProfileData;
  onChange: (patch: Partial<ProfileData>) => void;
}) {
  const snsPlatforms = [
    {
      key: "twitter" as const,
      label: "X（旧Twitter）",
      placeholder: "https://x.com/yourname",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      key: "linkedin" as const,
      label: "LinkedIn",
      placeholder: "https://linkedin.com/in/yourname",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43c-1.14 0-2.06-.93-2.06-2.07 0-1.14.92-2.06 2.06-2.06s2.06.92 2.06 2.06c0 1.14-.92 2.07-2.06 2.07zm1.78 13.02H3.56V9h3.56v11.45z" />
        </svg>
      ),
    },
    {
      key: "note" as const,
      label: "note",
      placeholder: "https://note.com/yourname",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <h1 style={{
        fontFamily: '"Noto Serif JP", serif', fontWeight: 500,
        fontSize: 28, color: "var(--ink)", marginBottom: 10, letterSpacing: "0.02em",
      }}>SNSリンク</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 36, lineHeight: 1.9 }}>
        あなたのSNSアカウントをプロフィールに表示します。すべてオプションです。
      </p>

      <FormSection
        title="ソーシャルアカウント"
        desc='プロフィールページの「PROFILE INFO」セクションに小さなアイコンで表示されます。'
      >
        {snsPlatforms.map((sns) => (
          <FormGroup key={sns.key} label={sns.label} optional>
            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, alignItems: "center" }}>
              <div style={{
                width: 32, height: 32, background: "var(--bg-tint)",
                borderRadius: 8, display: "flex", alignItems: "center",
                justifyContent: "center", color: "var(--ink-soft)",
              }}>
                {sns.icon}
              </div>
              <input
                type="text"
                value={profile.socialLinks[sns.key] ?? ""}
                onChange={(e) =>
                  onChange({
                    socialLinks: { ...profile.socialLinks, [sns.key]: e.target.value },
                  })
                }
                placeholder={sns.placeholder}
                style={inputStyle()}
              />
            </div>
          </FormGroup>
        ))}
      </FormSection>
    </div>
  );
}

// ─── Section: アカウント設定 ─────────────────────────────────────────────────

function AccountSection({
  profile, onChange,
}: {
  profile: ProfileData;
  onChange: (patch: Partial<ProfileData>) => void;
}) {
  return (
    <div>
      <h1 style={{
        fontFamily: '"Noto Serif JP", serif', fontWeight: 500,
        fontSize: 28, color: "var(--ink)", marginBottom: 10, letterSpacing: "0.02em",
      }}>アカウント設定</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 36, lineHeight: 1.9 }}>
        ログイン情報・プライバシー設定を管理します。
      </p>

      <FormSection title="ログイン情報">
        <FormGroup label="メールアドレス">
          <input
            type="email"
            value={profile.email}
            onChange={(e) => onChange({ email: e.target.value })}
            style={inputStyle()}
          />
        </FormGroup>
        <div style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>パスワード</div>
          <button style={{
            padding: "8px 16px", fontSize: 13, fontWeight: 600,
            border: "1px solid var(--line)", borderRadius: 8,
            background: "#fff", color: "var(--ink)", cursor: "pointer",
            fontFamily: "inherit",
          }}>
            パスワードを変更
          </button>
        </div>
      </FormSection>

      <FormSection
        title="プロフィールの公開設定"
        desc="プロフィールページを他のユーザーが閲覧できるかどうかを設定します。"
      >
        <FormGroup label="公開範囲">
          <select
            value={profile.visibility}
            onChange={(e) =>
              onChange({ visibility: e.target.value as ProfileData["visibility"] })
            }
            style={selectStyle()}
          >
            <option value="public">すべてのOpinioユーザーに公開</option>
            <option value="login_only">ログインユーザーのみ公開</option>
            <option value="private">非公開（自分だけ見れる）</option>
          </select>
        </FormGroup>
      </FormSection>

      <div style={{
        background: "var(--error-soft)", border: "1px solid #FECACA",
        borderRadius: 14, padding: "20px 24px", marginTop: 8,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--error)", marginBottom: 6 }}>
          ⚠ アカウント削除
        </div>
        <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 14, lineHeight: 1.7 }}>
          アカウントを削除すると、プロフィール・職歴・記事へのコメントなど、すべてのデータが完全に削除されます。
          取材済みの記事は掲載を続ける場合があります。この操作は取り消せません。
        </div>
        <button style={{
          padding: "8px 16px", fontSize: 13, fontWeight: 600,
          border: "1px solid var(--error)", borderRadius: 8,
          background: "#fff", color: "var(--error)", cursor: "pointer",
          fontFamily: "inherit",
        }}>
          アカウントを削除する
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfileEditPage() {
  const [profile, setProfile] = useState<ProfileData>(MOCK_PROFILE);
  const [activeView, setActiveView] = useState<ActiveView>("basic");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showBanner, setShowBanner] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Experience | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 700);
  }, []);

  const patchProfile = useCallback(
    (patch: Partial<ProfileData>) => {
      setProfile((p) => ({ ...p, ...patch }));
      triggerSave();
    },
    [triggerSave]
  );

  const handleAddCareer = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const handleEditCareer = (exp: Experience) => {
    setEditTarget(exp);
    setModalOpen(true);
  };

  const handleDeleteCareer = (id: string) => {
    setProfile((p) => ({
      ...p,
      experiences: p.experiences.filter((e) => e.id !== id),
    }));
    triggerSave();
  };

  const handleSaveCareer = (exp: Experience) => {
    setProfile((p) => {
      const exists = p.experiences.find((e) => e.id === exp.id);
      const experiences = exists
        ? p.experiences.map((e) => (e.id === exp.id ? exp : e))
        : [...p.experiences, exp];
      return { ...p, experiences };
    });
    triggerSave();
    setModalOpen(false);
  };

  const navItems: { view: ActiveView; label: string; icon: React.ReactNode }[] = [
    {
      view: "basic", label: "基本情報",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      ),
    },
    {
      view: "career", label: "キャリア（職歴）",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      view: "sns", label: "SNSリンク",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
    },
    {
      view: "account", label: "アカウント設定",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  const profileCompletion = (() => {
    let score = 0;
    if (profile.name) score += 20;
    if (profile.aboutMe) score += 20;
    if (profile.location !== "非公開") score += 10;
    if (profile.experiences.length > 0) score += 30;
    if (Object.values(profile.socialLinks).some(Boolean)) score += 10;
    if (profile.ageRange !== "非公開") score += 10;
    return score;
  })();

  return (
    <>
      {/* Topbar */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 24,
      }}>
        <Link href="/" style={{
          fontFamily: "Inter, sans-serif", fontWeight: 700,
          fontSize: 22, color: "var(--royal)", letterSpacing: "-0.02em",
        }}>
          Opinio
        </Link>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            プロフィール編集
          </span>
          <SaveStatusPill status={saveStatus} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/profile"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              border: "1px solid var(--line)", borderRadius: 8,
              background: "#fff", color: "var(--ink)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            プロフィールを見る
          </Link>
        </div>
      </header>

      {/* Onboarding banner */}
      {showBanner && (
        <div style={{
          background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
          borderBottom: "1px solid var(--royal-100)",
          padding: "14px 32px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, background: "var(--royal)",
            color: "#fff", borderRadius: 10, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4L12 14.01 9 11.01" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>
              Opinioへようこそ、{profile.name}さん
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              まずは「基本情報」を入力しましょう。その後、キャリアやSNSは好きなタイミングで追加できます。
            </div>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            style={{
              border: "none", background: "none", cursor: "pointer",
              color: "var(--ink-mute)", padding: 6, borderRadius: 6,
              display: "flex", alignItems: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        minHeight: `calc(100vh - ${showBanner ? 120 : 59}px)`,
      }}>
        {/* Sidebar */}
        <aside style={{
          background: "#fff", borderRight: "1px solid var(--line)",
          padding: "24px 0",
          position: "sticky", top: showBanner ? 120 : 59,
          alignSelf: "start",
          height: `calc(100vh - ${showBanner ? 120 : 59}px)`,
          overflowY: "auto",
        }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "0 24px 10px",
          }}>
            編集セクション
          </div>

          <nav style={{ display: "flex", flexDirection: "column" }}>
            {navItems.slice(0, 3).map((item) => (
              <SidebarItem
                key={item.view}
                icon={item.icon}
                label={item.label}
                active={activeView === item.view}
                onClick={() => { setActiveView(item.view); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              />
            ))}
          </nav>

          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "20px 24px 8px",
          }}>
            アカウント
          </div>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            <SidebarItem
              icon={navItems[3].icon}
              label={navItems[3].label}
              active={activeView === "account"}
              onClick={() => { setActiveView("account"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          </nav>

          {/* Progress card */}
          <div style={{
            margin: "30px 20px 16px",
            padding: "14px 16px",
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", marginBottom: 8 }}>
              プロフィール完成度
            </div>
            <div style={{
              height: 6, background: "#fff", borderRadius: 100, overflow: "hidden", marginBottom: 8,
            }}>
              <div style={{
                height: "100%", width: `${profileCompletion}%`,
                background: "linear-gradient(to right, var(--royal), var(--accent))",
                borderRadius: 100, transition: "width 0.4s",
              }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              {profileCompletion}% ·{" "}
              {profileCompletion < 50
                ? "基本情報と職歴を埋めるとさらに充実します"
                : profileCompletion < 80
                ? "SNSリンクを追加するとより充実します"
                : "プロフィールが充実しています！"}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ padding: "36px 48px 60px", maxWidth: 760 }}>
          {activeView === "basic" && (
            <BasicSection profile={profile} onChange={patchProfile} />
          )}
          {activeView === "career" && (
            <CareerSection
              experiences={profile.experiences}
              onAdd={handleAddCareer}
              onEdit={handleEditCareer}
              onDelete={handleDeleteCareer}
            />
          )}
          {activeView === "sns" && (
            <SnsSection profile={profile} onChange={patchProfile} />
          )}
          {activeView === "account" && (
            <AccountSection profile={profile} onChange={patchProfile} />
          )}
        </main>
      </div>

      {/* Career modal */}
      <CareerModal
        open={modalOpen}
        editTarget={editTarget}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCareer}
      />

      <style>{`
        .sidebar-nav-item:hover {
          background: var(--bg-tint) !important;
          color: var(--ink) !important;
        }
        .career-icon-btn:hover {
          background: #fff !important;
          color: var(--ink) !important;
        }
        .career-delete-btn:hover {
          background: var(--error-soft) !important;
          color: var(--error) !important;
        }
        .add-career-btn:hover {
          background: var(--royal-50) !important;
          border-color: var(--royal) !important;
        }
        input:focus, textarea:focus, select:focus {
          border-color: var(--royal) !important;
          box-shadow: 0 0 0 3px var(--royal-50) !important;
        }
        @media (max-width: 900px) {
          .profile-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
