"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { MypageMockProvider } from "@/app/(jobseeker)/mypage/_components/MypageMockContext";
import Tabs, { type TabItem } from "./Tabs";
import CareerHistoryEditor from "@/components/profile/CareerHistoryEditor";
import { LOCATIONS, AGE_RANGES } from "@/app/profile/edit/mockProfileData";

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved";

type ProfileTab = "basic" | "career" | "skills" | "socials" | "account";

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  cover_color: string | null;
  visibility: string | null;
  location: string | null;
  age_range: string | null;
  about_me: string | null;
  future_aspirations: string | null;
} | null;

// ─── Basic info state ─────────────────────────────────────────────────────────

type BasicInfo = {
  name: string;
  location: string;
  ageRange: string;
};

type SettingsState = {
  avatarColor: string;
  coverColor: string;
  visibility: "public" | "login_only" | "private";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_AVATAR_COLOR = "linear-gradient(135deg, #002366, #3B5FD9)";
const DEFAULT_COVER_COLOR  = "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)";

const PROFILE_TABS: TabItem[] = [
  { key: "basic",   label: "基本情報" },
  { key: "career",  label: "職歴" },
  { key: "skills",  label: "スキル" },
  { key: "socials", label: "SNS" },
  { key: "account", label: "アカウント設定" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const saving = status === "saving";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12, padding: "4px 10px", borderRadius: 100,
        color: saving ? "var(--ink-soft)" : "var(--success)",
        background: saving ? "var(--bg-tint)" : "var(--success-soft)",
        transition: "all 0.3s",
      }}
    >
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

function FormSection({
  title, desc, children,
}: {
  title: React.ReactNode; desc?: string; children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 14, padding: "28px 32px", marginBottom: 20,
      }}
    >
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

function FormGroup({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.6 }}>
          {hint}
        </div>
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

// ─── Placeholder Tab Content ──────────────────────────────────────────────────

function PlaceholderTabContent({ label }: { label: string }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <div
        style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "48px 32px",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, marginBottom: 24,
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--bg-tint)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)" }}>
          {label}（実装中）
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, textAlign: "center" }}>
          この機能は現在開発中です。近日公開予定です。
        </div>
      </div>
      {/* 各タブ最下部に「保存」ボタン — プレースホルダーは disabled */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled
          style={{
            padding: "10px 24px", fontSize: 13, fontWeight: 600,
            background: "var(--bg-tint)", color: "var(--ink-mute)",
            border: "1px solid var(--line)", borderRadius: 8,
            fontFamily: "inherit", cursor: "not-allowed",
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileEditClient({
  owUser,
  authEmail,
}: {
  owUser: OwUser;
  authEmail: string;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("basic");

  // ── アカウント設定タブの状態 ────────────────────────────────────────────
  const [settings, setSettings] = useState<SettingsState>({
    avatarColor: owUser?.avatar_color ?? DEFAULT_AVATAR_COLOR,
    coverColor:  owUser?.cover_color  ?? DEFAULT_COVER_COLOR,
    visibility:  (owUser?.visibility ?? "public") as SettingsState["visibility"],
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const settingsRef = useRef<SettingsState>(settings);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: settingsRef.current.visibility }),
      }).catch(() => {});
      setSaveStatus("saved");
    }, 700);
  }, []);

  const patchSettings = useCallback(
    (patch: Partial<SettingsState>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        settingsRef.current = next;
        return next;
      });
      triggerSave();
    },
    [triggerSave]
  );

  // ── 基本情報タブの状態（名前・所在地・年齢層） ──────────────────────────
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name:     owUser?.name     ?? "",
    location: owUser?.location ?? "",
    ageRange: owUser?.age_range ?? "",
  });
  const basicInfoRef   = useRef<BasicInfo>(basicInfo);
  const [basicSaveStatus, setBasicSaveStatus] = useState<SaveStatus>("idle");
  const basicSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchBasicInfo = useCallback((patch: Partial<BasicInfo>) => {
    setBasicInfo((prev) => {
      const next = { ...prev, ...patch };
      basicInfoRef.current = next;
      return next;
    });
    setBasicSaveStatus("saving");
    if (basicSaveTimer.current) clearTimeout(basicSaveTimer.current);
    basicSaveTimer.current = setTimeout(async () => {
      await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     basicInfoRef.current.name,
          location: basicInfoRef.current.location,
          age_range: basicInfoRef.current.ageRange,
        }),
      }).catch(() => {});
      setBasicSaveStatus("saved");
    }, 700);
  }, []);

  return (
    <MypageMockProvider>
      <MypageLayout activeKey="profile">

        {/* ── ヘッダー行: タイトル + 保存状態 + ← マイページ ───────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <h1 style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 700,
            color: "var(--ink)", margin: 0,
          }}>プロフィール</h1>
          {activeTab === "basic"   && <SaveStatusPill status={basicSaveStatus} />}
          {activeTab === "account" && <SaveStatusPill status={saveStatus} />}
          <div style={{ marginLeft: "auto" }}>
            <Link
              href="/mypage"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                border: "1px solid var(--line)", borderRadius: 8,
                background: "#fff", color: "var(--ink-soft)",
                textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              マイページ
            </Link>
          </div>
        </div>

        {/* ── タブナビゲーション ──────────────────────────────────────────────── */}
        <Tabs
          tabs={PROFILE_TABS}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as ProfileTab)}
        />

        {/* ── タブコンテンツ ──────────────────────────────────────────────────── */}

        {/* 基本情報タブ */}
        {activeTab === "basic" && (
          <div style={{ maxWidth: 680 }}>

            {/* ── Section 1: 基本情報（名前・所在地・年齢層） ──────────────── */}
            <FormSection
              title="基本情報"
              desc="プロフィールページに表示される情報です。変更すると自動で保存されます。"
            >
              <FormGroup label="名前">
                <input
                  type="text"
                  value={basicInfo.name}
                  onChange={(e) => patchBasicInfo({ name: e.target.value })}
                  placeholder="例：山田 太郎"
                  style={inputStyle()}
                />
              </FormGroup>

              <FormGroup label="所在地" hint="現在お住まいの都道府県を選択してください。">
                <div style={{ position: "relative" }}>
                  <select
                    value={basicInfo.location}
                    onChange={(e) => patchBasicInfo({ location: e.target.value })}
                    style={selectStyle()}
                  >
                    <option value="">選択してください</option>
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </FormGroup>

              <FormGroup label="年齢層" hint="おおよその年齢層を選択してください。">
                <div style={{ position: "relative" }}>
                  <select
                    value={basicInfo.ageRange}
                    onChange={(e) => patchBasicInfo({ ageRange: e.target.value })}
                    style={selectStyle()}
                  >
                    <option value="">選択してください</option>
                    {AGE_RANGES.map((range) => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                </div>
              </FormGroup>
            </FormSection>

            {/* ── Section 2: 自己紹介（次のコミットで実装） ───────────────────── */}
            <FormSection
              title="自己紹介"
              desc="あなたのキャリアや想いを、企業・メンターに伝えるテキストです。200字を目安に。"
            >
              <div style={{
                padding: "20px", borderRadius: 8,
                background: "var(--bg-tint)", border: "1px dashed var(--line)",
                color: "var(--ink-mute)", fontSize: 12, textAlign: "center",
                lineHeight: 1.7,
              }}>
                次のコミットで実装予定です
              </div>
            </FormSection>

            {/* ── Section 3: やってみたいこと（次のコミットで実装） ────────────── */}
            <FormSection
              title="この先やってみたいこと"
              desc="中長期でやってみたいこと、挑戦したいことを自由に書いてください。"
            >
              <div style={{
                padding: "20px", borderRadius: 8,
                background: "var(--bg-tint)", border: "1px dashed var(--line)",
                color: "var(--ink-mute)", fontSize: 12, textAlign: "center",
                lineHeight: 1.7,
              }}>
                次のコミットで実装予定です
              </div>
            </FormSection>

          </div>
        )}

        {/* 職歴タブ */}
        {activeTab === "career" && (
          <div style={{ maxWidth: 680 }}>
            <CareerHistoryEditor />
          </div>
        )}

        {/* スキルタブ（実装中） */}
        {activeTab === "skills" && (
          <PlaceholderTabContent label="スキル" />
        )}

        {/* SNSタブ（実装中） */}
        {activeTab === "socials" && (
          <PlaceholderTabContent label="SNS" />
        )}

        {/* アカウント設定タブ（動作） */}
        {activeTab === "account" && (
          <div style={{ maxWidth: 680 }}>

            {/* ── Section 1: プロフィール画像・カバー ──────────────────────── */}
            <FormSection
              title="プロフィール画像・カバー"
              desc="プロフィールページのヘッダーに表示されます。"
            >
              <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ flexShrink: 0 }}>
                  <div
                    style={{
                      width: 200, height: 80, borderRadius: "10px 10px 0 0",
                      background: settings.coverColor, position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: 68, height: 68, borderRadius: "50%",
                        background: settings.avatarColor,
                        color: "#fff", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 26, fontWeight: 600,
                        border: "4px solid #fff",
                        position: "absolute", bottom: -34, left: 14,
                        boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
                      }}
                    >
                      {basicInfo.name.charAt(0) || "?"}
                    </div>
                  </div>
                  <div style={{ height: 34 }} />
                  <div style={{ fontSize: 10, color: "var(--ink-mute)", textAlign: "center", marginTop: 2 }}>
                    プレビュー
                  </div>
                </div>
                <div style={{ flex: 1, paddingTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                    プロフィール画像
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 12, lineHeight: 1.7 }}>
                    未設定の場合、名前の頭文字で自動生成されます。
                  </div>
                  <button
                    type="button"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 12px", background: "#fff", color: "var(--ink)",
                      border: "1px solid var(--line)", borderRadius: 6,
                      fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                      cursor: "not-allowed", opacity: 0.5,
                    }}
                    disabled
                    title="画像アップロードは近日公開予定です"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    画像をアップロード（近日公開）
                  </button>
                </div>
              </div>
            </FormSection>

            {/* ── Section 2: ログイン情報 ───────────────────────────────────── */}
            <FormSection title="ログイン情報">
              <FormGroup label="メールアドレス">
                <input
                  type="email"
                  value={authEmail}
                  readOnly
                  style={{ ...inputStyle(), background: "var(--bg-tint)", color: "var(--ink-soft)", cursor: "default" }}
                />
              </FormGroup>
              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  パスワード
                </div>
                <button
                  type="button"
                  style={{
                    padding: "8px 16px", fontSize: 13, fontWeight: 600,
                    border: "1px solid var(--line)", borderRadius: 8,
                    background: "#fff", color: "var(--ink)", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  パスワードを変更
                </button>
              </div>
            </FormSection>

            {/* ── Section 3: プロフィールの公開設定 ───────────────────────── */}
            <FormSection
              title="プロフィールの公開設定"
              desc="プロフィールページを他のユーザーが閲覧できるかどうかを設定します。"
            >
              <FormGroup label="公開範囲">
                <select
                  value={settings.visibility}
                  onChange={(e) =>
                    patchSettings({ visibility: e.target.value as SettingsState["visibility"] })
                  }
                  style={selectStyle()}
                >
                  <option value="public">すべてのOpinioユーザーに公開</option>
                  <option value="login_only">ログインユーザーのみ公開</option>
                  <option value="private">非公開（自分だけ見れる）</option>
                </select>
              </FormGroup>
            </FormSection>

            {/* ── Danger zone ──────────────────────────────────────────────── */}
            <div
              style={{
                background: "var(--error-soft)", border: "1px solid #FECACA",
                borderRadius: 14, padding: "20px 24px", marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--error)", marginBottom: 6 }}>
                ⚠ アカウント削除
              </div>
              <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 14, lineHeight: 1.7 }}>
                アカウントを削除すると、プロフィール・職歴・記事へのコメントなど、すべてのデータが完全に削除されます。
                取材済みの記事は掲載を続ける場合があります。この操作は取り消せません。
              </div>
              <button
                type="button"
                style={{
                  padding: "8px 16px", fontSize: 13, fontWeight: 600,
                  border: "1px solid var(--error)", borderRadius: 8,
                  background: "#fff", color: "var(--error)", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                アカウントを削除する
              </button>
            </div>

            {/* ── アカウント設定タブの「保存」ボタン ──────────────────────── */}
            {/* 公開設定は自動保存のため、「保存」ボタンは情報提供用 */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
              <SaveStatusPill status={saveStatus} />
              <button
                type="button"
                onClick={triggerSave}
                style={{
                  padding: "10px 24px", fontSize: 13, fontWeight: 600,
                  background: "var(--royal)", color: "#fff",
                  border: "none", borderRadius: 8,
                  fontFamily: "inherit", cursor: "pointer",
                }}
              >
                変更を保存
              </button>
            </div>

          </div>
        )}

        <style>{`
          input:focus, textarea:focus, select:focus {
            border-color: var(--royal) !important;
            box-shadow: 0 0 0 3px var(--royal-50) !important;
          }
        `}</style>

      </MypageLayout>
    </MypageMockProvider>
  );
}
