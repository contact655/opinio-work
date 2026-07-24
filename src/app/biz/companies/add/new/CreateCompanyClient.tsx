"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GenreChipSelector, { type Genre } from "@/components/ui/GenreChipSelector";

// ── 型定義 ─────────────────────────────────────────────────────────────────

type UserBadge = {
  name: string;
  email: string;
};

type SearchResult = {
  id: string;
  name: string;
  logo_url: string | null;
  industry: string | null;
  admin_count: number;
};

type ConflictInfo = {
  id: string;
  name: string;
  admin_count: number;
};

// ── 定数 ──────────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  "IT / SaaS",
  "コンサルティング",
  "金融 / FinTech",
  "製造業",
  "小売 / EC",
  "メディア",
  "医療 / ヘルスケア",
  "その他",
];

const selectStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "11px 14px",
  fontSize: 13,
  border: "1.5px solid var(--line)",
  borderRadius: 8, outline: "none",
  background: "#fff",
  boxSizing: "border-box",
  fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 32,
};

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "11px 14px",
  fontSize: 13,
  border: "1.5px solid var(--line)",
  borderRadius: 8, outline: "none",
  color: "var(--ink)", background: "#fff",
  boxSizing: "border-box",
  fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12, fontWeight: 600,
  color: "var(--ink-soft)",
  marginBottom: 6,
  letterSpacing: "0.04em",
};

// ── コンポーネント ──────────────────────────────────────────────────────────

export function CreateCompanyClient({
  userBadge,
  availableGenres = [],
  prefilledCompanyName = null,
  prefilledCompanyId = null,
}: {
  userBadge?: UserBadge | null;
  availableGenres?: Genre[];
  prefilledCompanyName?: string | null;
  prefilledCompanyId?: string | null;
}) {
  const [name, setName] = useState(prefilledCompanyName ?? "");
  const [prefilledLocked, setPrefilledLocked] = useState(!!prefilledCompanyName);

  // sessionStorage の pending company をフォールバックとして読み込む
  useEffect(() => {
    if (prefilledCompanyName) return;
    try {
      const raw = sessionStorage.getItem("opinio_biz_pending_company");
      if (raw) {
        const parsed = JSON.parse(raw) as { name?: string };
        if (parsed.name) {
          setName(parsed.name);
          setPrefilledLocked(true);
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [industry, setIndustry] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 3: 「別のアカウントを使う」確認モーダル
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchingOut, setSwitchingOut] = useState(false);

  // サジェスト
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  // 重複情報と発生元（suggestion=ドロップダウン選択 / error=409エラー）
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [conflictSource, setConflictSource] = useState<"suggestion" | "error" | null>(null);
  const [joinRequestLoading, setJoinRequestLoading] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);

  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // サジェスト外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        !nameInputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // プリフィル企業が DB に存在する場合はマウント時に即座に conflict を設定
  useEffect(() => {
    if (!prefilledCompanyId || !prefilledCompanyName) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/companies/search?q=${encodeURIComponent(prefilledCompanyName)}&limit=5`
        );
        if (!res.ok) return;
        const data = await res.json();
        const match = (data.results ?? []).find((r: SearchResult) => r.id === prefilledCompanyId);
        if (match) {
          setConflict({ id: match.id, name: match.name, admin_count: match.admin_count });
          setConflictSource("suggestion");
        }
      } catch { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 会社名変更 → デバウンスサジェスト検索
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setConflict(null);
    setConflictSource(null);
    setError(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/companies/search?q=${encodeURIComponent(value.trim())}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results ?? []);
          setShowSuggestions((data.results?.length ?? 0) > 0);
        }
      } catch {
        // ignore search error
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  // サジェストを選択（入力欄にセット）
  function handleSelectSuggestion(s: SearchResult) {
    setName(s.name);
    setShowSuggestions(false);
    setSuggestions([]);
    setConflict({ id: s.id, name: s.name, admin_count: s.admin_count });
    setConflictSource("suggestion");
    setJoinRequestSent(false);
  }

  // 参加リクエスト送信
  async function handleJoinRequest() {
    if (!conflict) return;
    setJoinRequestLoading(true);
    try {
      const res = await fetch("/api/biz/join-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: conflict.id }),
      });
      if (res.status === 409) {
        // すでにメンバー → ダッシュボードへ
        router.push("/biz/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.auto_approved) {
          // 管理者ゼロ → 即時承認 → ダッシュボードへ
          router.push("/biz/dashboard");
          return;
        }
        // 管理者あり → 既存担当者へ通知済み
        setJoinRequestSent(true);
      } else {
        setError("リクエストの送信に失敗しました。時間をおいて再度お試しください。");
      }
    } catch {
      setError("エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setJoinRequestLoading(false);
    }
  }

  // フォーム送信
  async function handleSubmit(e: React.FormEvent, forceCreate = false) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("会社名を入力してください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/biz/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry || null,
          website: website.trim() || null,
          force_create: forceCreate,
          genres,
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.error === "company_name_exists") {
        setConflict(data.existing_company);
        setConflictSource("error");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "会社の作成に失敗しました");
        setLoading(false);
        return;
      }

      // 成功 → redirect_to へ
      window.location.href = data.redirect_to ?? "/biz/dashboard";
    } catch {
      setError("エラーが発生しました。時間をおいて再度お試しください。");
      setLoading(false);
    }
  }

  // Phase 3: 別アカウントへ切替（ログアウト → /biz/auth）
  async function handleSwitchAccount() {
    setSwitchingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.replace("/biz/auth");
    } catch {
      setSwitchingOut(false);
      setShowSwitchModal(false);
    }
  }

  const canSubmit = name.trim() !== "" && !loading && !conflict;

  // サイドバー: アカウントバッジ
  const sidebar = userBadge ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        padding: "14px 16px",
        background: "var(--bg-tint)",
        border: "1px solid var(--line)",
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 10 }}>
          作成アカウント
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "var(--royal-50)", color: "var(--royal)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
              {userBadge.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userBadge.email}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSwitchModal(true)}
          style={{
            width: "100%",
            padding: "7px 12px",
            background: "transparent",
            border: "1.5px solid var(--line)",
            borderRadius: 7,
            fontSize: 12, fontWeight: 600,
            color: "var(--ink-soft)",
            cursor: "pointer",
            fontFamily: "'Noto Sans JP', sans-serif",
            textAlign: "center",
          }}
        >
          別のアカウントを使う
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* 2カラムレイアウト */}
      <div style={{
        display: "grid",
        gridTemplateColumns: sidebar ? "1fr 260px" : "1fr",
        gap: 32,
        alignItems: "start",
      }}>
      {/* メインフォーム */}
      <div>

      {/* Phase 3: 別アカウント切替確認モーダル */}
      {showSwitchModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSwitchModal(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-modal-title"
            style={{
            background: "#fff", borderRadius: 14, padding: "28px 28px 24px",
            maxWidth: 400, width: "calc(100% - 40px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
          }}>
            <div id="switch-modal-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
              別のアカウントで企業を作成しますか？
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 22 }}>
              別のアカウントで企業を作成するには、一度ログアウトする必要があります。
              入力中の企業情報は失われます。
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                disabled={switchingOut}
                style={{
                  padding: "9px 16px",
                  background: "transparent",
                  border: "1.5px solid var(--line)",
                  borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  color: "var(--ink-soft)",
                  cursor: switchingOut ? "not-allowed" : "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={switchingOut}
                style={{
                  padding: "9px 16px",
                  background: switchingOut ? "var(--ink-mute)" : "var(--error)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  color: "#fff",
                  cursor: switchingOut ? "not-allowed" : "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                {switchingOut ? "ログアウト中..." : "ログアウトして新規登録へ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* アイコン */}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "var(--royal-50)", color: "var(--royal)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>

      <h1 style={{
        fontFamily: "var(--font-noto-serif)",
        fontSize: 22, fontWeight: 700,
        color: "var(--ink)", marginBottom: 8,
      }}>
        所属企業を登録する
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.7 }}>
        詳細な企業情報は登録後に編集できます。
      </p>

      <form onSubmit={(e) => handleSubmit(e, false)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 会社名（サジェスト付き） */}
        <div>
          <label htmlFor="cc-company-name" style={labelStyle}>
            会社名 <span style={{ color: "var(--error)" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            {/* 登録済み企業チップ（×で変更可能） */}
            {prefilledLocked ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: "var(--royal-50)",
                border: "1.5px solid var(--royal-100)",
                borderRadius: 8,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  background: "var(--royal)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}>
                  {name.charAt(0)}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--royal)" }}>
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => { setPrefilledLocked(false); setName(""); setConflict(null); setConflictSource(null); }}
                  title="変更する"
                  style={{
                    flexShrink: 0,
                    padding: "3px 8px",
                    background: "transparent",
                    border: "1px solid var(--royal-100)",
                    borderRadius: 6,
                    fontSize: 11, color: "var(--royal)",
                    cursor: "pointer",
                    fontFamily: "'Noto Sans JP', sans-serif",
                    fontWeight: 600,
                  }}
                >
                  × 変更する
                </button>
              </div>
            ) : (
            <input
              id="cc-company-name"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="株式会社〇〇"
              style={inputStyle}
              autoComplete="off"
            />
            )}
            {/* 検索中インジケーター */}
            {searching && (
              <span style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                fontSize: 11, color: "var(--ink-mute)",
              }}>
                検索中...
              </span>
            )}

            {/* サジェストドロップダウン */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  background: "#fff",
                  border: "1.5px solid var(--line)",
                  borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "6px 12px 4px", fontSize: 10, color: "var(--ink-mute)", fontWeight: 600, letterSpacing: "0.06em" }}>
                  既存の企業
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "8px 12px",
                      background: "transparent", border: "none", textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: "var(--royal-50)", color: "var(--royal)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {s.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>
                        {s.industry ?? "業界不明"} · {s.admin_count > 0 ? `担当者 ${s.admin_count}名` : "担当者未登録"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 既存企業カード — suggestion / error 共通 */}
        {conflict && (conflictSource === "suggestion" || conflictSource === "error") && (() => {
          const isFirst = !conflict.admin_count || conflict.admin_count === 0;
          const isAmber = conflictSource === "error";
          const bg = isAmber ? "var(--warm-soft)" : "var(--royal-50)";
          const border = isAmber ? "1.5px solid #FCD34D" : "1.5px solid var(--royal-100)";
          const headColor = isAmber ? "#92400E" : "var(--royal)";
          const bodyColor = isAmber ? "#78350F" : "#1e3a6e";
          return (
          <div style={{ background: bg, border, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: headColor, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              {isFirst ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
              {isFirst
                ? "この企業はまだ担当者が登録されていません"
                : conflictSource === "error" ? "同名の企業が既に存在します" : "この企業は既に OPINIO に登録されています"
              }
            </div>
            <div style={{ fontSize: 12, color: bodyColor, lineHeight: 1.7, marginBottom: 14 }}>
              {isFirst ? (
                <><strong>{conflict.name}</strong> は OPINIO に登録済みですが、まだ担当者がいません。最初の担当者として参加できます。</>
              ) : (
                <><strong>{conflict.name}</strong>（担当者 {conflict.admin_count}名）が既に登録されています。既存の担当者に参加リクエストを送ってください。</>
              )}
            </div>
            {joinRequestSent ? (
              <div style={{
                fontSize: 12, color: "var(--success)", fontWeight: 600,
                padding: "10px 14px", background: "var(--success-soft)",
                borderRadius: 8, marginBottom: 10,
              }}>
                ✓ {isFirst ? "参加が完了しました。ダッシュボードに移動します..." : "参加リクエストを送信しました。担当者からの招待をお待ちください。"}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={handleJoinRequest}
                  disabled={joinRequestLoading}
                  style={{
                    padding: "8px 16px",
                    background: isAmber ? "#92400E" : "var(--royal)",
                    color: "#fff",
                    border: "none", borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                    cursor: joinRequestLoading ? "not-allowed" : "pointer",
                    fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
                  }}
                >
                  {joinRequestLoading ? "処理中..." : (isFirst ? "最初の担当者として参加する" : "参加リクエストを送る")}
                </button>
                <button
                  type="button"
                  onClick={() => { setConflict(null); setConflictSource(null); setName(""); setJoinRequestSent(false); }}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    color: isAmber ? "#92400E" : "var(--royal)",
                    border: `1.5px solid ${isAmber ? "#FCD34D" : "var(--royal-100)"}`,
                    borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
                  }}
                >
                  別の会社名で探す
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
                disabled={loading}
                style={{
                  padding: "0", background: "transparent", color: "var(--ink-mute)",
                  border: "none", fontSize: 11,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
                  textDecoration: "underline",
                }}
              >
                {loading ? "作成中..." : "この名前で別会社として新規作成する"}
              </button>
            </div>
          </div>
          );
        })()}

        {/* 業界 — conflict中は非表示 */}
        {!conflict && (
        <div>
          <label htmlFor="cc-industry" style={labelStyle}>業界</label>
          <select
            id="cc-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={{ ...selectStyle, color: industry ? "var(--ink)" : "var(--ink-mute)" }}
          >
            <option value="">選択してください</option>
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        )}

        {/* 企業ジャンル — conflict中は非表示 */}
        {!conflict && availableGenres.length > 0 && (
          <div>
            <label style={labelStyle}>
              企業ジャンル
              <span style={{ fontWeight: 400, color: "var(--ink-mute)", marginLeft: 6, fontSize: 11 }}>
                任意・複数選択可
              </span>
            </label>
            <GenreChipSelector
              genres={availableGenres}
              selected={genres}
              onChange={setGenres}
              disabled={loading}
            />
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 8, lineHeight: 1.6 }}>
              該当するジャンルを選択してください。検索や一覧表示で活用されます。
            </div>
          </div>
        )}

        {/* 企業サイト URL — conflict中は非表示 */}
        {!conflict && (
        <div>
          <label htmlFor="cc-website" style={labelStyle}>企業サイト URL</label>
          <input
            id="cc-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            style={{ ...inputStyle, color: website ? "var(--ink)" : undefined }}
          />
        </div>
        )}

        {/* エラー・送信ボタン — conflict中は非表示（conflict時はカード内のボタンで操作） */}
        {!conflict && (
        <>
        {error && (
          <div style={{
            fontSize: 12, color: "var(--error)",
            padding: "9px 12px", background: "var(--error-soft)",
            borderRadius: 6, lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: "block", width: "100%",
              padding: "13px",
              background: canSubmit ? "var(--royal)" : "var(--ink-mute)",
              color: "#fff",
              border: "none", borderRadius: 10,
              fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
              fontSize: 14, fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "background 0.15s",
              boxShadow: canSubmit ? "0 4px 14px rgba(0,35,102,0.2)" : "none",
              boxSizing: "border-box",
            } as React.CSSProperties}
          >
            {loading ? "作成中..." : "作成する"}
          </button>
          <a
            href="/biz/companies/add"
            style={{
              display: "block", textAlign: "center",
              fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
              padding: "8px",
            }}
          >
            キャンセル
          </a>
        </div>
        </>
        )}
      </form>
      </div>{/* /メインフォーム */}

      {/* サイドバー */}
      {sidebar && (
        <div style={{ position: "sticky", top: 24 }}>
          {sidebar}
        </div>
      )}
      </div>{/* /2カラムグリッド */}
    </div>
  );
}
