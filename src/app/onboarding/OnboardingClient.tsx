"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
/* ⚠️ 選択肢は1箇所から。ここに47件を直書きすると API の CHECK とずれる
      （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。 */
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";

/*
  勤務形態のチップ。**value は共有定数から取る**（ここに直書きすると DB の CHECK とずれる。
  2026-08-07 に JobEditForm が日本語ラベルを送って保存が落ちた前例がある）。
  ラベルだけ入口用に短くし、並びは「出社 → フルリモート」にしている。
*/
const REMOTE_SHORT_LABEL: Record<string, string> = {
  on_site: "出社",
  hybrid: "ハイブリッド",
  full_remote: "フルリモート",
};
const REMOTE_CHIPS = REMOTE_WORK_STATUSES
  .map((o) => ({ value: o.value as string, label: REMOTE_SHORT_LABEL[o.value] ?? o.label }))
  .reverse();

type CompanyResult = {
  id: string;
  name: string;
  brand_name: string | null;
  industry: string | null;
  phase: string | null;
};

// ─── Inner component (needs useSearchParams → wrapped in Suspense) ────────────

export type OnboardingRole = { id: string; name: string };

/** 入社年の選択肢。⚠️ ビルド時ではなく描画時に現在年を取る */
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 51 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

const selectStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: "10px 12px",
  border: "1px solid var(--line)", borderRadius: 10,
  fontSize: 14, fontFamily: "inherit", background: "#fff", color: "var(--ink)",
};

function OnboardingInner({ roles }: { roles: OnboardingRole[] }) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  /* 経歴として保存するために必要な3点のうち、会社以外の2つ。
     ⚠️ `ow_experiences` は company / role_category_id / started_at が必須。
        2026-08-10 まではここで会社名だけ聞いて**捨てていた**。 */
  const [roleId, setRoleId] = useState<string>("");
  const [startedYear, setStartedYear] = useState<string>("");
  const [startedMonth, setStartedMonth] = useState<string>("");
  /* 勤務地・勤務形態（どちらも任意）。
     ⚠️ **後から追記してもらうのが最も難しいデータなので、入口で聞く。**
        「フルリモートと書いてある会社に、実際にリモートで働いている人がいるか」を
        検証するための材料で、あとから思い出して埋めてもらえる性質のものではない。
     ⚠️ 任意のまま。空でも先に進める（入口の摩擦を増やさない）。 */
  const [prefecture, setPrefecture] = useState<string>("");
  const [remoteWorkStatus, setRemoteWorkStatus] = useState<string>("");
  /* 会社名を伏せたい人向け。既定は実名（既存14件中13件が real で、
     求人・企業ページに出るのが本人の目的に沿うため）。 */
  const [maskCompany, setMaskCompany] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth guard + 完了済みチェック
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login?next=" + encodeURIComponent("/onboarding"));
        return;
      }
      // すでにオンボーディング完了済みなら /companies へ
      const { data: profile } = await supabase
        .from("ow_profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.onboarding_completed) {
        router.replace("/companies");
        return;
      }
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
  const confirmFreeText = () => {
    setShowDropdown(false);
  };

  /* 会社（マスタ or 自由入力）・職種・入社年月が揃って初めて保存できる。
     ⚠️ 任意入力のままにする。埋めなければ従来どおり onboarding_completed だけ記録する。 */
  const hasCompany = !!selectedCompany || query.trim().length > 0;
  const canSaveExperience = hasCompany && !!roleId && !!startedYear && !!startedMonth;

  const finish = async () => {
    setSaving(true);
    setSaveError(null);
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

      /* 経歴を1件作る。**ここが登録の入口**。
         ⚠️ 2026-08-10 まで、会社名を入力させておきながら保存していなかった
            （role_category_id が必須で解決できなかったため）。職種と入社年月を
            聞くようにして解消した。
         ⚠️ 3点が揃っていないときは何もしない。中途半端な行を作らない。
         ⚠️ 失敗してもオンボーディング自体は完了させる（best-effort）。
            ただし握り潰さず、画面にも出してログにも残す。 */
      if (canSaveExperience) {
        try {
          const res = await fetch("/api/jobseeker/experiences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // ⚠️ company_id / company_text は **XOR**。両方送ると 400
              ...(selectedCompany
                ? { company_id: selectedCompany.id }
                : { company_text: query.trim() }),
              role_category_id: roleId,
              started_at: `${startedYear}-${startedMonth}`,
              is_current: true,
              /* ⚠️ 空のときはキーごと送らない。API は不正値を 400 で弾くので、
                    "" を送ると登録の入口が落ちる。 */
              ...(prefecture ? { prefecture } : {}),
              ...(remoteWorkStatus ? { remote_work_status: remoteWorkStatus } : {}),
              visibility_company: maskCompany ? "masked" : "real",
              visibility_company_profile: maskCompany ? "masked" : "real",
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            console.error("[onboarding] 経歴の保存に失敗", res.status, j);
            setSaveError("経歴の保存に失敗しました。プロフィール編集からあとで登録できます。");
          }
        } catch (err) {
          console.error("[onboarding] 経歴の保存に失敗", err);
          setSaveError("経歴の保存に失敗しました。プロフィール編集からあとで登録できます。");
        }
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
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>掲載中の企業を見てみる</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>IT/SaaS企業の内側情報を確認する</div>
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
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>職歴・学歴をあとから追加できます</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>

            {/* 採用担当者・企業の方向け導線 */}
            <a
              href={query.trim() ? `/biz/auth?company=${encodeURIComponent(query.trim())}` : "/biz/auth"}
              style={{
                marginTop: 12,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "13px 16px",
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 10, textDecoration: "none",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
                <span style={{ fontSize: 14, color: "var(--royal)", fontWeight: 700 }}>採用担当者・企業の方はこちら</span>
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
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
            {/*
              ⚠️ ここに「在籍中の企業の情報は、あなたには非表示になります。」という
                 一文があったが削除した（2026-08-13）。主語と目的語が入れ替わっていて
                 意味を成さないうえ、「勤務先には見られない」と読めてしまい、
                 下の「その企業のページに『現役社員』として表示されます」と正面から矛盾していた。
                 どこに出るかの説明は、実際に表示先が決まる下のブロックに一本化する。
            */}
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
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>{selectedCompany.industry}</div>
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
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
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
                      onMouseDown={(e) => { e.preventDefault(); confirmFreeText(); }}
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
                      {/* ⚠️ 「登録」と書かない。企業マスタには何も作らず、
                             ow_experiences.company_text に名前が入るだけ（2026-08-13）。
                          ⚠️ 「企業として保存します」も書かない（2026-08-14）。
                             ow_companies に行は作られないので、企業ページも検索候補も増えない。
                             作られると読める文言は、この画面で実際に誤解された。 */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                          「{query.trim()}」をこの名前のまま入力する
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                          あなたの経歴にこの社名で保存します
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
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--success)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              OPINIOに掲載中の企業と連携します
            </p>
          )}
          {/*
            ⚠️ ここを「候補が見つかりません」に戻さないこと（2026-08-13 変更）。

               掲載が無いのは **OPINIO 側の都合**であって、入力した人は何も間違えていない。
               「見つかりません」は検索の失敗＝自分のミスとして読まれ、
               入力し直しか離脱を誘う。実際 IT/SaaS 以外の企業では普通に起きる。

            ⚠️ 「紐づきません」のような実装語を使わない。何を失うのかが伝わらない。
               失うのは「企業ページへのリンク」だけで、経歴としては普通に残る。
               **まず「このまま進めて大丈夫」と言い切ること。**
          */}
          {!selectedCompany && query.trim() && !searching && results.length === 0 && (
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 8, lineHeight: 1.8 }}>
              この会社はまだ OPINIO に掲載されていません。<strong style={{ color: "var(--ink-soft)" }}>このまま進めて大丈夫です。</strong>
              <br />
              入力した社名がそのまま経歴に残ります（企業ページへのリンクは付きません）。
              掲載されたら、プロフィール編集で選び直せます。
            </p>
          )}

          {/* ── 職種・入社年月 ────────────────────────────────────────────────
              ⚠️ 会社が決まってから出す。最初から3つ並べると入口が重くなる。
              ⚠️ ここまで埋めて初めて経歴として保存できる（3点が必須）。 */}
          {hasCompany && (
            <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                職種
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
                いちばん近いものを1つ選んでください。あとから詳しく設定できます。
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                {roles.map((r) => {
                  const active = roleId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoleId(active ? "" : r.id)}
                      style={{
                        padding: "7px 13px", borderRadius: 100,
                        border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
                        background: active ? "var(--royal-50)" : "#fff",
                        color: active ? "var(--royal)" : "var(--ink-soft)",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
                入社年月
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={startedYear}
                  onChange={(e) => setStartedYear(e.target.value)}
                  style={selectStyle}
                  aria-label="入社年"
                >
                  <option value="">年</option>
                  {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                </select>
                <select
                  value={startedMonth}
                  onChange={(e) => setStartedMonth(e.target.value)}
                  style={selectStyle}
                  aria-label="入社月"
                >
                  <option value="">月</option>
                  {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                </select>
              </div>

              {/*
                勤務地・勤務形態（どちらも任意・2026-08-13 追加）
                ⚠️ **後から追記してもらうのが最も難しいデータなので、入口で聞く。**
                   「フルリモートと書いてある会社に、実際にリモートで働いている人がいるか」の
                   検証材料。編集画面に追いやると、実際には誰も戻ってこない。
                ⚠️ 任意。**空でも先に進める**（編集フォーム側の必須ゲートも同日に外した）。
                ⚠️ どちらも1タップで終わる形にしている。項目を増やしすぎない。
              */}
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 20, marginBottom: 10 }}>
                勤務地（任意）
              </div>
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                style={{ ...selectStyle, width: "100%" }}
                aria-label="勤務地（都道府県）"
              >
                <option value="">都道府県</option>
                {/* ⚠️ よく選ばれる4件を先頭に出す。47件を北から南に並べると
                       東京都は13番目・大阪府は27番目で、毎回スクロールが要る。
                    ⚠️ 二重に出さないため下は `OTHER_PREFECTURES`（43件）。 */}
                <optgroup label="よく選ばれる">
                  {COMMON_PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </optgroup>
                <optgroup label="すべての都道府県">
                  {OTHER_PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </optgroup>
              </select>

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 16, marginBottom: 10 }}>
                勤務形態（任意）
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {REMOTE_CHIPS.map((o) => {
                  const active = remoteWorkStatus === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setRemoteWorkStatus(active ? "" : o.value)}
                      style={{
                        padding: "7px 13px", borderRadius: 100,
                        border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
                        background: active ? "var(--royal-50)" : "#fff",
                        color: active ? "var(--royal)" : "var(--ink-soft)",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>

              {/* ⚠️ どこに出るかを、保存する前に明記する */}
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 18, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={maskCompany}
                  onChange={(e) => setMaskCompany(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                  会社名は伏せる（プロフィールで「IT企業」のような表記になります）
                </span>
              </label>
              <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 10, lineHeight: 1.8 }}>
                {maskCompany
                  ? "会社名を伏せても、経歴はプロフィールに残ります。"
                  : "この経歴は、その企業のページに「現役社員」として表示されます。"}
                <br />
                表示されるのは <strong style={{ color: "var(--ink-soft)" }}>OPINIO にログインしている人</strong> だけです。
                公開範囲はプロフィール編集からいつでも変更できます。
              </p>
            </div>
          )}

          {/* ⚠️ 会社だけ埋めて職種・年月が空だと**保存されない**。
                 黙って捨てると、いま直したのと同じ「入力させたのに保存しない」に戻る。 */}
          {hasCompany && !canSaveExperience && (
            <p style={{ fontSize: 12, fontWeight: 600, color: "#92400E", background: "var(--warm-soft)",
                        border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px", marginTop: 16, lineHeight: 1.7 }}>
              職種と入社年月を選ぶと、経歴として保存されます。
              このまま進めると会社名は保存されません（あとからプロフィール編集で登録できます）。
            </p>
          )}

          {saveError && (
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 14 }}>{saveError}</p>
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

export default function OnboardingPage({ roles }: { roles: OnboardingRole[] }) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-tint)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--royal-100)", borderTopColor: "var(--royal)", animation: "spin 0.8s linear infinite" }} />
      </div>
    }>
      <OnboardingInner roles={roles} />
    </Suspense>
  );
}
