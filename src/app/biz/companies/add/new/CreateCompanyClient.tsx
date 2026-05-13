"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── 型定義 ─────────────────────────────────────────────────────────────────

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

export function CreateCompanyClient() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // サジェスト
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  // 重複（409）情報
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

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

  // 会社名変更 → デバウンスサジェスト検索
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setConflict(null); // 入力変更したら conflict クリア
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
    // 同名企業への注意を表示
    setConflict({ id: s.id, name: s.name, admin_count: s.admin_count });
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
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.error === "company_name_exists") {
        // 重複検知 → conflict UI を表示
        setConflict(data.existing_company);
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

  const canSubmit = name.trim() !== "" && !loading;

  return (
    <div style={{ maxWidth: "var(--max-w-form)", margin: "0 auto", padding: "48px 24px" }}>
      {/* 戻るリンク */}
      <a
        href="/biz/companies/add"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
          marginBottom: 32,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        追加方法を選ぶ
      </a>

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
        新しい会社を作成
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.7 }}>
        あなたが代表となる新しい会社を Opinio に登録します。
        詳細な企業情報は作成後に会社設定ページから編集できます。
      </p>

      <form onSubmit={(e) => handleSubmit(e, false)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 会社名（サジェスト付き） */}
        <div>
          <label style={labelStyle}>
            会社名 <span style={{ color: "var(--error)" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="株式会社〇〇"
              style={inputStyle}
              autoComplete="off"
            />
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
                        {s.industry ?? "業界不明"} · 担当者 {s.admin_count}名
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 重複（409）通知 */}
        {conflict && (
          <div style={{
            background: "var(--warm-soft)",
            border: "1.5px solid #FCD34D",
            borderRadius: 10,
            padding: "16px 18px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>
              ⚠️ 同名の企業が既に存在します
            </div>
            <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.7, marginBottom: 14 }}>
              <strong>{conflict.name}</strong>（担当者 {conflict.admin_count}名）が既に登録されています。<br />
              参加したい場合は、その企業の管理者に招待を依頼してください。
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  background: loading ? "var(--ink-mute)" : "var(--ink)",
                  color: "#fff",
                  border: "none", borderRadius: 8,
                  fontSize: 12, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
                }}
              >
                {loading ? "作成中..." : "別法人として新規作成する"}
              </button>
              <button
                type="button"
                onClick={() => { setConflict(null); setName(""); }}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#92400E",
                  border: "1.5px solid #FCD34D", borderRadius: 8,
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
                }}
              >
                会社名を変更する
              </button>
            </div>
          </div>
        )}

        {/* 業界 */}
        <div>
          <label style={labelStyle}>業界</label>
          <select
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

        {/* 企業サイト URL */}
        <div>
          <label style={labelStyle}>企業サイト URL</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            style={{ ...inputStyle, color: website ? "var(--ink)" : undefined }}
          />
        </div>

        {/* エラー */}
        {error && (
          <div style={{
            fontSize: 12, color: "var(--error)",
            padding: "9px 12px", background: "var(--error-soft)",
            borderRadius: 6, lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        {/* 送信ボタン（conflict表示中は非表示） */}
        {!conflict && (
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
        )}
      </form>
    </div>
  );
}
