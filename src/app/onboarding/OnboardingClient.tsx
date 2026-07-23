"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CompanyResult = {
  id: string;
  name: string;
  brand_name: string | null;
  industry: string | null;
  phase: string | null;
};

// ─── Inner component (needs useSearchParams → wrapped in Suspense) ────────────

function OnboardingInner() {
  const router = useRouter();
  const _searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth guard + focus
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/auth/login?next=" + encodeURIComponent("/onboarding"));
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [router]);

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // デバウンス検索
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length === 0) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/onboarding/companies/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setShowDropdown(true);
        }
      } finally {
        setSearching(false);
      }
    }, 280);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedCompany(null);
    search(val);
  };

  const selectCompany = (c: CompanyResult) => {
    setSelectedCompany(c);
    setQuery(c.name);
    setShowDropdown(false);
  };

  const clearSelection = () => {
    setSelectedCompany(null);
    setQuery("");
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // フリーテキストで登録（DBに見つからない場合）
  const useAsNew = () => {
    setShowDropdown(false);
  };

  const finish = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // ow_profiles に onboarding_completed を記録
      const { data: existing } = await supabase
        .from("ow_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ow_profiles")
          .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      } else {
        await supabase.from("ow_profiles").insert({ user_id: user.id, onboarding_completed: true });
      }

      // 会社を登録
      const companyInput = query.trim();
      if (companyInput) {
        try {
          if (selectedCompany) {
            // DBの企業を選択した場合 → company_id で登録
            await supabase.from("ow_experiences").insert({
              user_id: user.id,
              company_id: selectedCompany.id,
              company_text: selectedCompany.name,
              is_current: true,
              role_title: "",
              started_at: null,
            });
          } else {
            // フリーテキストで登録
            await supabase.from("ow_experiences").insert({
              user_id: user.id,
              company_text: companyInput,
              is_current: true,
              role_title: "",
              started_at: null,
            });
          }
        } catch {/* best-effort */}
      }

      // candidate ロールを付与
      await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "candidate" }),
      }).catch(() => {});
    }

    setSaving(false);
    setDone(true);
  };

  // ── 完了画面 ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={pageWrap}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <LogoMark />
          <div style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 20, padding: "40px 36px", boxShadow: "var(--shadow-md)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--success), #34D399)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 6px 20px rgba(5,150,105,0.3)",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h2 style={{
              fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 700,
              color: "var(--ink)", marginBottom: 10, textAlign: "center",
            }}>
              ようこそ、OPINIO へ！
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.85, marginBottom: 24, textAlign: "center" }}>
              登録が完了しました。<br />まず何から始めますか？
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="/companies" style={{
                display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
                background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                color: "#fff", borderRadius: 12, textDecoration: "none",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>企業を見てみる</div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>IT/SaaS企業の内側情報を確認する</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", opacity: 0.7, flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
              <a href="/profile/edit" style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                background: "var(--bg-tint)", border: "1px solid var(--line)",
                color: "var(--ink-soft)", borderRadius: 12, textDecoration: "none",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--royal)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: "var(--ink)" }}>プロフィールを設定する</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>職歴・スキルをあとから追加できます</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ドロップダウンに表示する候補
  const showFreeTextOption = query.trim().length >= 1 && !selectedCompany && results.length < 8;
  const exactMatch = results.some(
    (r) => r.name === query.trim() || (r.brand_name ?? "") === query.trim()
  );

  // ── 現職会社入力画面 ──────────────────────────────────────────────────────
  return (
    <div style={pageWrap}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <LogoMark />

        {/* 入力カード */}
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 20, padding: "32px 28px", marginBottom: 16,
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>

          <h2 style={{
            fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700,
            color: "var(--ink)", marginBottom: 6, lineHeight: 1.45,
          }}>
            現在お勤めの会社を教えてください
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 24, lineHeight: 1.7 }}>
            在籍中の企業の情報は、あなたには非表示になります。<br />
            任意入力です。あとから変更できます。
          </p>

          {/* 検索インプット + ドロップダウン */}
          <div style={{ position: "relative" }}>
            {/* 選択済みチップ表示 */}
            {selectedCompany ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 14px",
                border: "2px solid var(--royal)",
                borderRadius: 10, background: "var(--royal-50)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedCompany.name}
                  </div>
                  {selectedCompany.industry && (
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>{selectedCompany.industry}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  style={{
                    flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                    color: "var(--ink-mute)", padding: 4, borderRadius: 4,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  aria-label="選択を解除"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowDropdown(false);
                    if (e.key === "Enter" && !saving && !showDropdown) finish();
                  }}
                  placeholder="例：セールスフォース、Salesforce、株式会社〇〇"
                  disabled={saving}
                  style={{
                    width: "100%", padding: "13px 40px 13px 16px",
                    border: "1px solid var(--line)", borderRadius: 10,
                    fontSize: 14, color: "var(--ink)", fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box" as const,
                    background: saving ? "var(--bg-tint)" : "#fff",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--royal)";
                    if (results.length > 0 || query.trim()) setShowDropdown(true);
                  }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                  autoComplete="off"
                />
                {/* 検索アイコン / スピナー */}
                <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  {searching ? (
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--royal-100)", borderTopColor: "var(--royal)", animation: "spin 0.7s linear infinite" }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  )}
                </div>
              </div>
            )}

            {/* ドロップダウン */}
            {showDropdown && (results.length > 0 || showFreeTextOption) && (
              <div
                ref={dropdownRef}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                  background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100,
                  overflow: "hidden",
                }}
              >
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectCompany(c); }}
                    style={{
                      width: "100%", textAlign: "left", background: "none", border: "none",
                      padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--royal-50)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {c.name.replace(/^株式会社|合同会社|有限会社/, "").trim().charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </div>
                      {(c.industry || c.phase) && (
                        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>
                          {[c.industry, c.phase].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                ))}

                {/* フリーテキスト登録オプション（DBに完全一致がない場合） */}
                {showFreeTextOption && !exactMatch && query.trim().length > 0 && (
                  <>
                    {results.length > 0 && <div style={{ height: 1, background: "var(--line)", margin: "0 12px" }} />}
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); useAsNew(); setShowDropdown(false); }}
                      style={{
                        width: "100%", textAlign: "left", background: "none", border: "none",
                        padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: "var(--bg-tint)", border: "1px dashed var(--line)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                          「{query.trim()}」で登録する
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>
                          OPINIOに未掲載の企業として登録
                        </div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 選択済みの場合の説明テキスト */}
          {selectedCompany && (
            <p style={{ fontSize: 12, color: "var(--success)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              OPINIOに掲載中の企業と連携します
            </p>
          )}
          {!selectedCompany && query.trim() && !searching && results.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 8 }}>
              候補が見つかりません。このまま「登録して始める」をクリックして入力した名前で登録できます。
            </p>
          )}

          <button
            type="button"
            onClick={finish}
            disabled={saving}
            style={{
              marginTop: 20, width: "100%", padding: "13px 20px",
              background: query.trim() || selectedCompany
                ? "linear-gradient(135deg, var(--royal), #3B5FD9)"
                : "var(--line)",
              color: (query.trim() || selectedCompany) ? "#fff" : "var(--ink-mute)",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: saving ? "wait" : "pointer", fontFamily: "inherit", transition: "all 0.2s",
            }}
          >
            {saving ? "登録中..." : "登録して始める →"}
          </button>
        </div>

        {/* スキップ */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={finish}
            disabled={saving}
            style={{
              fontSize: 13, color: "var(--ink-soft)", background: "none",
              border: "1px solid var(--line)", borderRadius: 8,
              cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
              padding: "9px 20px", display: "flex", alignItems: "center", gap: 5,
            }}
          >
            後で設定する
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles & sub-components ──────────────────────────────────────────

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "var(--bg-tint)",
};

function LogoMark() {
  return (
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "var(--royal)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--royal)" }}>
          OPINIO
        </span>
      </a>
    </div>
  );
}

// ─── Page export (Suspense boundary for useSearchParams) ─────────────────────

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-tint)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--royal-100)", borderTopColor: "var(--royal)", animation: "spin 0.8s linear infinite" }} />
      </div>
    }>
      <OnboardingInner />
    </Suspense>
  );
}
