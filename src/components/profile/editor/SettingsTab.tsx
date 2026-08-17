"use client";

/**
 * 「設定」タブ（公開範囲 / スカウト設定 / 転職検討状況）。
 *
 * ⚠️ ログイン情報・メール通知・アカウント削除は 2026-08-17 に `/mypage/settings` へ移した。
 *
 * ⚠️ 3-B（2026-08-15）で `ProfileEditClient.tsx` から**そのまま移した**。
 *    差分は「移動」と「props の受け渡し」だけ。ロジックは変えていない。
 *
 * ⚠️ このタブの保存は「1操作＝1設定」（トグル・ラジオの即時保存）で、
 *    プロフィール/転職の希望のカード単位保存とは作法が違う。**揃えていないのは意図的**。
 *    公開範囲だけは明示保存（誤って公開範囲が変わると影響が大きいため）。
 */

import { useState, useCallback, useEffect, useRef } from "react";
import Toast from "@/components/ui/Toast";
import { FormSection } from "./formKit";
import { PROFILE_VISIBILITY_OPTIONS } from "@/lib/constants/profileVisibility";
import type { Stint } from "@/components/profile/CareerHistoryEditor";

export type SettingsState = {
  avatarColor: string;
  coverColor: string;
  visibility: "public" | "login_only" | "private";
  isOpenToWork: boolean;
};


/* ⚠️ `NotificationSettingsSection` は 2026-08-17 に `/mypage/settings` へ移した。
      ここに書き戻さない（同じ設定が2箇所になる）。 */

// ─── Textarea Field with soft-limit counter ───────────────────────────────────


export default function SettingsTab({
  initialSettings: initialSettingsProp,
  initialScoutEnabled = null,
  initialExperiences = [],
  onSettingsChange,
  onDirtyChange,
  notifyGlobalSave,
}: {
  initialSettings: SettingsState;
  initialScoutEnabled?: boolean | null;
  /** 「在籍企業にスカウトを見せない」の表示にだけ使う */
  initialExperiences?: Stint[];
  /** 保存に成功した公開設定。★親が保持し、写真カードのプレビューが見る */
  onSettingsChange: (settings: SettingsState) => void;
  onDirtyChange: (dirty: boolean) => void;
  notifyGlobalSave: (status: "saving" | "saved" | "error") => void;
}) {
  // ── 公開設定タブの状態（明示保存方式） ──────────────────────────────────
  /* ⚠️ 既定値の組み立ては親（ProfileEditClient）に残してある。
        `owUser` の列と既定色を知っているのはあちらなので、両方に書かない。 */
  const [settings, setSettings] = useState<SettingsState>(initialSettingsProp);
  // 初期値を保持して変更検知（JSON.stringify 比較）
  const [initialSettings, setInitialSettings] = useState<SettingsState>(initialSettingsProp);
  const [accountSaving,       setAccountSaving]       = useState(false);
  const [accountJustSaved,    setAccountJustSaved]    = useState(false);
  const [accountToastMsg,     setAccountToastMsg]     = useState<string | null>(null);
  const [accountToastVariant, setAccountToastVariant] = useState<"default" | "error">("default");

  const isAccountDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleSavePrivacy = useCallback(async () => {
    setAccountSaving(true);
    notifyGlobalSave("saving");
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility:      settings.visibility,
          is_open_to_work: settings.isOpenToWork,
        }),
      });
      if (!res.ok) throw new Error();
      setInitialSettings(settings); // 保存成功: 次回比較の基準点を更新
      /* ★保存できたときだけ親へ返す（入力中の値を見せない）。 */
      onSettingsChange(settings);
      setAccountToastVariant("default");
      setAccountToastMsg("アカウント設定を保存しました");
      setAccountJustSaved(true);
      notifyGlobalSave("saved");
      setTimeout(() => setAccountJustSaved(false), 3000);
    } catch {
      setAccountToastVariant("error");
      setAccountToastMsg("保存に失敗しました。もう一度お試しください。");
      notifyGlobalSave("error");
    } finally {
      setAccountSaving(false);
    }
  }, [settings, notifyGlobalSave, onSettingsChange]);

  const handleCancelAccount = useCallback(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  // ── スカウト設定の状態（ow_profiles.scout_enabled） ─────────────────────
  const [scoutEnabled, setScoutEnabled] = useState<boolean | null>(initialScoutEnabled ?? null);
  const [scoutSaving, setScoutSaving] = useState(false);
  const [scoutSaved, setScoutSaved] = useState(false);

  type BlockedCompany = {
    id: string | null;
    company_id: string | null;
    company_name: string;
    block_reason: "experience" | "manual";
  };
  const [blockedCompanies, setBlockedCompanies] = useState<BlockedCompany[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

  const loadBlockedCompanies = useCallback(async () => {
    setBlockedLoading(true);
    try {
      const res = await fetch("/api/jobseeker/scout-settings");
      if (res.ok) {
        const data = await res.json();
        setBlockedCompanies(data.blocks ?? []);
      }
    } catch {
      // best-effort
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlockedCompanies();
  }, [loadBlockedCompanies]);

  const handleRemoveBlock = useCallback(async (blockId: string) => {
    setRemovingBlockId(blockId);
    try {
      await fetch(`/api/jobseeker/scout-settings?id=${blockId}`, { method: "DELETE" });
      setBlockedCompanies(prev => prev.filter(b => b.id !== blockId));
    } catch {
      // best-effort
    } finally {
      setRemovingBlockId(null);
    }
  }, []);

  // 企業追加ブロック
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [blockSearchResults, setBlockSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [blockSearchLoading, setBlockSearchLoading] = useState(false);
  const [addingBlockId, setAddingBlockId] = useState<string | null>(null);
  const blockSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBlockSearch = useCallback((q: string) => {
    setBlockSearchQuery(q);
    if (blockSearchTimer.current) clearTimeout(blockSearchTimer.current);
    if (!q.trim()) { setBlockSearchResults([]); return; }
    blockSearchTimer.current = setTimeout(async () => {
      setBlockSearchLoading(true);
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q.trim())}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setBlockSearchResults((data.results ?? []) as { id: string; name: string }[]);
        }
      } catch {
        // best-effort
      } finally {
        setBlockSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleAddBlock = useCallback(async (company: { id: string; name: string }) => {
    setAddingBlockId(company.id);
    try {
      const res = await fetch("/api/jobseeker/scout-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: company.id }),
      });
      if (res.ok) {
        setBlockedCompanies(prev => {
          if (prev.some(b => b.company_id === company.id)) return prev;
          return [...prev, { id: null, company_id: company.id, company_name: company.name, block_reason: "manual" }];
        });
        // reload to get the real block id
        await loadBlockedCompanies();
        setBlockSearchQuery("");
        setBlockSearchResults([]);
      }
    } catch {
      // best-effort
    } finally {
      setAddingBlockId(null);
    }
  }, [loadBlockedCompanies]);

  const handleSaveScout = useCallback(async (value: boolean | null) => {
    setScoutEnabled(value);
    setScoutSaving(true);
    try {
      await fetch("/api/jobseeker/scout-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scout_enabled: value }),
      });
      setScoutSaved(true);
      setTimeout(() => setScoutSaved(false), 2000);
    } catch {
      // best-effort
    } finally {
      setScoutSaving(false);
    }
  }, []);

  useEffect(() => { onDirtyChange(isAccountDirty); }, [isAccountDirty, onDirtyChange]);

  return (
    <div style={{ maxWidth: 680 }}>
      {(() => {
          const isPrivate = settings.visibility === "private";
          const effectiveScout = !isPrivate && scoutEnabled === true;
          const currentEmployerNames = initialExperiences
            .filter((e) => e.isCurrent && e.companyType !== "anon" && e.displayCompanyName)
            .map((e) => e.displayCompanyName);

          return (
            <div style={{ maxWidth: 680 }}>

              {/* ── サマリーカード ──────────────────────────────────────────── */}
              <div style={{
                background: "linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)",
                border: "1.5px solid var(--royal-100)",
                borderRadius: 14, padding: "20px 24px", marginBottom: 24,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", marginBottom: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  あなたの現在の公開状態
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {/* 公開範囲 */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink)" }}>
                    <span style={{
                      flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isPrivate ? "var(--error-soft)" : "var(--success-soft)",
                      color: isPrivate ? "var(--error)" : "var(--success)", fontSize: 12, fontWeight: 700,
                    }}>{isPrivate ? "✗" : "✓"}</span>
                    <span>
                      {/* 現在の挙動をそのまま書く。public と login_only は
                          いま同じ見え方になるので、違いは「将来の扱い」であることを示す。 */}
                      {settings.visibility === "public" && "公開（ログイン中のOPINIOユーザーが閲覧可）"}
                      {settings.visibility === "login_only" && "ログイン中のOPINIOユーザーのみ閲覧可"}
                      {settings.visibility === "private" && <span style={{ color: "var(--ink-soft)" }}>非公開（自分のみ閲覧可）</span>}
                    </span>
                  </div>
                  {/* スカウト */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink)" }}>
                    <span style={{
                      flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: effectiveScout ? "var(--success-soft)" : "var(--bg-tint)",
                      color: effectiveScout ? "var(--success)" : "var(--ink-mute)", fontSize: 12, fontWeight: 700,
                    }}>{effectiveScout ? "✓" : "✗"}</span>
                    <span style={{ color: effectiveScout ? "var(--ink)" : "var(--ink-soft)" }}>
                      {isPrivate
                        ? "非公開設定のため、スカウトは届きません"
                        : scoutEnabled === true
                          ? "企業からスカウトを受け取る"
                          : scoutEnabled === false
                            ? "スカウトを受け取らない設定"
                            : "スカウト設定が未設定です"}
                    </span>
                  </div>
                  {/* 自動ブロック */}
                  {currentEmployerNames.length > 0 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink)" }}>
                      <span style={{
                        flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "var(--royal-50)", color: "var(--royal)", fontSize: 12, fontWeight: 700,
                      }}>✓</span>
                      <span>
                        在籍企業からは自動でブロック中
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6 }}>
                          ({currentEmployerNames.join("・")})
                        </span>
                      </span>
                    </div>
                  )}
                  {/* 転職検討状況 */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink)" }}>
                    <span style={{
                      flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: settings.isOpenToWork ? "var(--success-soft)" : "var(--bg-tint)",
                      color: settings.isOpenToWork ? "var(--success)" : "var(--ink-mute)", fontSize: 12, fontWeight: 700,
                    }}>{settings.isOpenToWork ? "✓" : "✗"}</span>
                    <span style={{ color: settings.isOpenToWork ? "var(--ink)" : "var(--ink-soft)" }}>
                      {settings.isOpenToWork ? "「転職検討中」バッジを表示中" : "転職検討中バッジは非表示"}
                    </span>
                  </div>
                </div>
                {/* ⚠️ ここにあった「公開プロフィールを確認する →」は外した（2026-08-16）。
                       タブ行の右端に「公開プロフィールを見る」を常設したため、この節では
                       同じ場所への入口が2つ並んでいた（`.claude/rules/ui-debugging.md` ⑧）。
                       ★タブ行のボタンは**公開範囲に関わらず常に出る**ので、
                       ここが `!isPrivate` で消えていた非公開の人にも導線が届くようになった。 */}
              </div>

              {/* ── Section 1: プロフィールの公開範囲 ───────────────────────── */}
              <FormSection
                title="プロフィールの公開範囲"
                desc="プロフィールページを誰が閲覧できるかを設定します。"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {PROFILE_VISIBILITY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                        padding: "10px 14px", borderRadius: 8,
                        border: `1.5px solid ${settings.visibility === opt.value ? "var(--royal)" : "var(--line)"}`,
                        background: settings.visibility === opt.value ? "var(--royal-50)" : "#fff",
                      }}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={opt.value}
                        checked={settings.visibility === opt.value}
                        onChange={() => setSettings((prev) => ({ ...prev, visibility: opt.value }))}
                        style={{ marginTop: 2, accentColor: "var(--royal)", flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{opt.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 2 }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </FormSection>

              {/* ── Section 2: スカウト設定 ──────────────────────────────────── */}
              <FormSection
                title="スカウト設定"
                desc="企業からのスカウトを受け取るかどうかを設定します。"
              >
                {isPrivate ? (
                  /* 非公開時グレーアウト */
                  <div style={{
                    background: "var(--bg-tint)", borderRadius: 10, padding: "16px 18px",
                    border: "1px solid var(--line)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>
                      非公開設定のため、企業からのスカウトは届きません。
                    </span>
                  </div>
                ) : (
                  <>
                    {scoutEnabled === null && (
                      <div style={{
                        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
                        padding: "10px 14px", fontSize: 12, fontWeight: 500, color: "#92400E", marginBottom: 12,
                      }}>
                        下記から設定してください。
                      </div>
                    )}
                    <div
                      role="radio"
                      aria-checked={scoutEnabled === true}
                      onClick={() => !scoutSaving && handleSaveScout(true)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "13px 16px", marginBottom: 8, cursor: "pointer",
                        background: scoutEnabled === true ? "var(--royal-50)" : "var(--bg-tint)",
                        border: `1.5px solid ${scoutEnabled === true ? "var(--royal)" : "var(--line)"}`,
                        borderRadius: 10, transition: "all 0.15s",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                          受け取る（推奨）
                          {scoutEnabled === true && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, var(--royal), #3B5FD9)", color: "#fff" }}>
                              ✓ 設定中
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>条件に合う企業からスカウトが届きやすくなります。</div>
                      </div>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${scoutEnabled === true ? "var(--royal)" : "var(--line)"}`,
                        background: scoutEnabled === true ? "var(--royal)" : "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {scoutEnabled === true && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                    </div>
                    <div
                      role="radio"
                      aria-checked={scoutEnabled === false}
                      onClick={() => !scoutSaving && handleSaveScout(false)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "13px 16px", cursor: "pointer",
                        background: "#fff",
                        border: `1.5px solid ${scoutEnabled === false ? "var(--ink-mute)" : "var(--line)"}`,
                        borderRadius: 10, transition: "all 0.15s",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                          受け取らない
                          {scoutEnabled === false && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, fontSize: 12, fontWeight: 700, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>
                              ✓ 設定中
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>企業からは一切見えません</div>
                      </div>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${scoutEnabled === false ? "var(--ink-mute)" : "var(--line)"}`,
                        background: scoutEnabled === false ? "var(--ink-mute)" : "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {scoutEnabled === false && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                    </div>
                    {(scoutSaving || scoutSaved) && (
                      <div style={{ fontSize: 12, fontWeight: 500, color: scoutSaved ? "var(--success)" : "var(--ink-mute)", marginTop: 8 }}>
                        {scoutSaved ? "✓ 保存しました" : "保存中..."}
                      </div>
                    )}

                    {/* ブロック企業一覧 */}
                    <div style={{
                      marginTop: 20,
                      opacity: scoutEnabled === false ? 0.45 : 1,
                      pointerEvents: scoutEnabled === false ? "none" : "auto",
                      transition: "opacity 0.2s",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                        ブロック中の企業
                      </div>
                      {scoutEnabled === false && (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 8 }}>
                          スカウトを受け取らない設定のため、ブロック設定は使用されません。
                        </div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 8, lineHeight: 1.6 }}>
                        職務経歴に登録した企業からは自動的に見えません。転職活動が今の会社に知られることはありません。
                      </div>
                      {blockedLoading ? (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", padding: "10px 0" }}>読み込み中…</div>
                      ) : blockedCompanies.length === 0 ? (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", padding: "10px 14px", background: "var(--bg-tint)", borderRadius: 8, border: "1px solid var(--line)" }}>
                          ブロック中の企業はありません
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {blockedCompanies.map((b, i) => (
                            <div key={b.id ?? `${b.company_id}-${i}`} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 14px", borderRadius: 8,
                              background: "var(--bg-tint)", border: "1px solid var(--line)",
                            }}>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{b.company_name}</span>
                                <span style={{
                                  marginLeft: 8, fontSize: 12, fontWeight: 600,
                                  padding: "2px 7px", borderRadius: 100,
                                  background: b.block_reason === "experience" ? "var(--royal-50)" : "var(--line-soft)",
                                  color: b.block_reason === "experience" ? "var(--royal)" : "var(--ink-soft)",
                                }}>
                                  {b.block_reason === "experience" ? "在籍企業（自動）" : "手動でブロック中"}
                                </span>
                              </div>
                              {b.block_reason === "manual" && b.id && (
                                <button
                                  type="button"
                                  disabled={removingBlockId === b.id}
                                  onClick={() => handleRemoveBlock(b.id!)}
                                  style={{
                                    fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 6,
                                    border: "1px solid var(--line)", background: "#fff",
                                    color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit",
                                    opacity: removingBlockId === b.id ? 0.5 : 1,
                                  }}
                                >
                                  {removingBlockId === b.id ? "解除中…" : "解除"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>
                          + 企業を追加でブロック
                        </div>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={blockSearchQuery}
                            onChange={e => handleBlockSearch(e.target.value)}
                            placeholder="企業名を検索…"
                            style={{
                              width: "100%", padding: "8px 12px", fontSize: 13,
                              border: "1px solid var(--line)", borderRadius: 8,
                              fontFamily: "inherit", boxSizing: "border-box",
                              color: "var(--ink)", background: "#fff",
                            }}
                          />
                          {blockSearchLoading && (
                            <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>検索中…</div>
                          )}
                          {blockSearchResults.length > 0 && (
                            <div style={{
                              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10,
                              background: "#fff", border: "1px solid var(--line)", borderRadius: 8,
                              boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden",
                            }}>
                              {blockSearchResults.map(c => {
                                const alreadyBlocked = blockedCompanies.some(b => b.company_id === c.id);
                                return (
                                  <div key={c.id} style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "10px 14px", borderBottom: "1px solid var(--line-soft)",
                                  }}>
                                    <span style={{ fontSize: 13, color: "var(--ink)" }}>{c.name}</span>
                                    {alreadyBlocked ? (
                                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>ブロック済み</span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={addingBlockId === c.id}
                                        onClick={() => handleAddBlock(c)}
                                        style={{
                                          fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 6,
                                          border: "1px solid var(--line)", background: "var(--bg-tint)",
                                          color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit",
                                          opacity: addingBlockId === c.id ? 0.5 : 1,
                                        }}
                                      >
                                        {addingBlockId === c.id ? "追加中…" : "ブロック"}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 4 }}>
                          OPINIOに掲載されている企業のみ検索できます
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </FormSection>

              {/* ── Section 3: 転職検討状況 ──────────────────────────────────── */}
              <FormSection
                title="転職検討状況"
                desc="ONにすると、プロフィールに「転職検討中」バッジが表示されます。"
              >
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 16px",
                  background: settings.isOpenToWork ? "#ECFDF5" : "var(--bg-tint)",
                  border: `1px solid ${settings.isOpenToWork ? "#A7F3D0" : "var(--line)"}`,
                  borderRadius: 10, transition: "all 0.2s",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                      転職を検討しています
                      {settings.isOpenToWork && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 100,
                          fontSize: 12, fontWeight: 700,
                          background: "linear-gradient(135deg, var(--success), #10B981)",
                          color: "#fff", fontFamily: "'Inter', sans-serif",
                        }}>
                          ✓ 有効
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                      {settings.isOpenToWork
                        ? "企業側の候補者検索でフィルタリングできます"
                        : "非公開（企業側には表示されません）"}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.isOpenToWork}
                    onClick={() => setSettings((prev) => ({ ...prev, isOpenToWork: !prev.isOpenToWork }))}
                    style={{
                      width: 44, height: 24, borderRadius: 100,
                      background: settings.isOpenToWork ? "var(--success)" : "var(--line)",
                      border: "none", cursor: "pointer",
                      position: "relative", flexShrink: 0, transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 3,
                      left: settings.isOpenToWork ? 23 : 3,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>
              </FormSection>

              {/* ── 公開設定タブの保存・キャンセル ─────────────────────────── */}
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  onClick={handleCancelAccount}
                  disabled={!isAccountDirty || accountSaving || accountJustSaved}
                  style={{
                    padding: "10px 20px", fontSize: "var(--text-sm)", fontWeight: 600,
                    background: "#fff", color: "var(--ink-soft)",
                    border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit",
                    cursor: !isAccountDirty || accountSaving || accountJustSaved ? "default" : "pointer",
                    opacity: !isAccountDirty || accountSaving || accountJustSaved ? 0.5 : 1,
                  }}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSavePrivacy}
                  disabled={!isAccountDirty || accountSaving || accountJustSaved}
                  style={{
                    padding: "10px var(--space-6)", fontSize: "var(--text-sm)", fontWeight: 600, minWidth: 140,
                    background: accountJustSaved ? "var(--success)" : (!isAccountDirty || accountSaving) ? "var(--ink-mute)" : "var(--royal)",
                    color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit",
                    cursor: !isAccountDirty || accountSaving || accountJustSaved ? "default" : "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  {accountSaving ? "保存中…" : accountJustSaved ? "✓ 保存しました" : "保存"}
                </button>
              </div>
              {accountToastMsg && (
                <Toast
                  message={accountToastMsg}
                  variant={accountToastVariant}
                  onDone={() => setAccountToastMsg(null)}
                />
              )}

            </div>
          );
      })()}

      {/* ⚠️ ログイン情報・メール通知・アカウント削除は 2026-08-17 に
             `/mypage/settings` へ移した。ここに書き戻さないこと（同じ設定が2箇所になる）。 */}
    </div>
  );
}
