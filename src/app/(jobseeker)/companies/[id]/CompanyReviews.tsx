"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { JOB_TYPES } from "@/lib/constants/jobTypes";
import { RATING_AXES } from "@/lib/constants/reviewAxes";
import { createClient } from "@/lib/supabase/client";

type Review = {
  id: string;
  employment_status: "current" | "alumni";
  rating_overall: number;
  rating_culture: number | null;
  rating_growth: number | null;
  rating_wlb: number | null;
  rating_compensation: number | null;
  rating_leadership: number | null;
  rating_business: number | null;
  rating_welfare: number | null;
  pros: string | null;
  cons: string | null;
  job_type: string | null;
  created_at: string;
};

type Summary = {
  count: number;
  avg_overall: number | null;
  avg_culture: number | null;
  avg_growth: number | null;
  avg_wlb: number | null;
  avg_compensation: number | null;
  avg_leadership: number | null;
  avg_business: number | null;
  avg_welfare: number | null;
};

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill={s <= value ? "#F59E0B" : "#E2E8F0"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: 4, cursor: "pointer" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill={(hover || value) >= s ? "#F59E0B" : "#E2E8F0"}
          style={{ transition: "fill 0.1s" }}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12, color: "var(--ink-soft)", width: 72, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / 5) * 100}%`, background: "#F59E0B", borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "#B45309", width: 28, textAlign: "right" }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function CompanyReviewsSection({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchReviews = useCallback(async () => {
    const res = await fetch(`/api/company-reviews?company_id=${companyId}`);
    const data = await res.json();
    setReviews(data.reviews ?? []);
    setSummary(data.summary ?? null);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchReviews();
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    })();
  }, [fetchReviews]);

  if (loading) return null;

  return (
    <section
      id="reviews"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* ヘッダー */}
      <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8, background: "#FEF3C7",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)" }}>
              口コミ・評価
              {summary && (
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", marginLeft: 8 }}>
                  {summary.count}件
                </span>
              )}
            </h2>
          </div>
        </div>
        {isLoggedIn && !submitted && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, border: "1.5px solid var(--royal)",
                background: "transparent", color: "var(--royal)", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "var(--font-noto-sans)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              口コミを書く
            </button>
            <Link
              href={`/companies/${companyId}/review`}
              style={{ fontSize: 12, color: "var(--ink-mute)", textDecoration: "none" }}
            >
              専用ページで書く →
            </Link>
          </div>
        )}
      </div>

      <div style={{ padding: "24px 32px" }}>
        {summary && (
          <div style={{ display: "flex", gap: 32, marginBottom: 24, flexWrap: "wrap" }}>
            {/* 総合スコア */}
            <div style={{ textAlign: "center", minWidth: 80 }}>
              <div style={{ fontSize: 40, fontWeight: 900, fontFamily: "Inter, sans-serif", color: "#B45309", lineHeight: 1 }}>
                {summary.avg_overall?.toFixed(1)}
              </div>
              <Stars value={Math.round(summary.avg_overall ?? 0)} size={16} />
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>総合評価</div>
            </div>
            {/* カテゴリ別バー */}
            <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
              {RATING_AXES.map(({ label, avg_key }) => (
                <RatingBar key={avg_key} label={label} value={(summary as unknown as Record<string, number | null>)[avg_key]} />
              ))}
            </div>
          </div>
        )}

        {reviews.length === 0 && !submitted && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <p style={{ margin: 0, fontSize: 14 }}>まだ口コミがありません</p>
            {isLoggedIn ? (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
                在籍経験のある方、ぜひ最初の口コミを投稿してください
              </p>
            ) : (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
                <a href="/auth" style={{ color: "var(--royal)" }}>ログイン</a>すると口コミを投稿できます
              </p>
            )}
          </div>
        )}

        {submitted && (
          <div style={{ background: "var(--success-soft)", border: "1px solid #A7F3D0", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>口コミを送信しました</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>編集部の確認後に公開されます（通常1〜3営業日）</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px", background: "var(--bg-tint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <Stars value={r.rating_overall} />
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 700, background: r.employment_status === "current" ? "var(--royal-50)" : "var(--line-soft)", color: r.employment_status === "current" ? "var(--royal)" : "var(--ink-soft)" }}>
                  {r.employment_status === "current" ? "現役" : "OB/OG"}
                </span>
                {r.job_type && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "var(--line-soft)", color: "var(--ink-soft)" }}>
                    {r.job_type}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: "auto" }}>
                  {new Date(r.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short" })}
                </span>
              </div>
              {r.pros && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginRight: 6 }}>👍 良い点</span>
                  <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>{r.pros}</span>
                </div>
              )}
              {r.cons && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--error)", marginRight: 6 }}>💡 改善点</span>
                  <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>{r.cons}</span>
                </div>
              )}
              {!r.pros && !r.cons && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>—</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 投稿モーダル */}
      {showModal && (
        <ReviewModal
          companyId={companyId}
          companyName={companyName}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setSubmitted(true); setShowModal(false); }}
        />
      )}
    </section>
  );
}

function ReviewModal({ companyId, companyName, onClose, onSuccess }: {
  companyId: string;
  companyName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    employment_status: "current" as "current" | "alumni",
    job_type: "",
    rating_overall: 0,
    rating_culture: 0,
    rating_growth: 0,
    rating_wlb: 0,
    rating_compensation: 0,
    rating_leadership: 0,
    rating_business: 0,
    rating_welfare: 0,
    pros: "",
    cons: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!form.rating_overall) { setError("総合評価を選択してください"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/company-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, ...form }),
      });
      if (!res.ok) { setError("送信に失敗しました"); setSaving(false); return; }
      onSuccess();
    } catch {
      setError("送信に失敗しました");
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* ヘッダー */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>口コミを投稿</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>{companyName} — 匿名で公開されます</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--ink-mute)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 在籍状況 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 8 }}>在籍状況</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["current", "alumni"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, employment_status: s }))}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: `1.5px solid ${form.employment_status === s ? "var(--royal)" : "var(--line)"}`,
                    background: form.employment_status === s ? "var(--royal-50)" : "#fff",
                    color: form.employment_status === s ? "var(--royal)" : "var(--ink-soft)",
                    fontSize: 13, fontWeight: form.employment_status === s ? 700 : 400, cursor: "pointer",
                  }}
                >
                  {s === "current" ? "現役社員" : "OB/OG"}
                </button>
              ))}
            </div>
          </div>

          {/* 職種 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 8 }}>職種（任意）</label>
            <select
              value={form.job_type}
              onChange={(e) => setForm(f => ({ ...f, job_type: e.target.value }))}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, color: "var(--ink)", background: "#fff" }}
            >
              <option value="">選択しない</option>
              {JOB_TYPES.filter(t => !["エンジニア", "インサイドセールス", "事業開発・BizDev", "その他"].includes(t)).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 総合評価 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              総合評価 <span style={{ color: "var(--error)", marginLeft: 2 }}>*</span>
            </label>
            <StarPicker value={form.rating_overall} onChange={(v) => setForm(f => ({ ...f, rating_overall: v }))} />
          </div>

          {/* カテゴリ別 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 12 }}>カテゴリ別評価（任意）</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {RATING_AXES.map(({ key, label }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)", width: 84, flexShrink: 0 }}>{label}</span>
                  <StarPicker
                    value={(form as unknown as Record<string, number>)[key]}
                    onChange={(v) => setForm(f => ({ ...f, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 良い点・改善点 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>👍 良い点（任意）</label>
            <textarea
              value={form.pros}
              onChange={(e) => setForm(f => ({ ...f, pros: e.target.value }))}
              placeholder="この会社で働いて良かったこと、強みだと感じること..."
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, resize: "vertical", fontFamily: "var(--font-noto-sans)", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>💡 改善点（任意）</label>
            <textarea
              value={form.cons}
              onChange={(e) => setForm(f => ({ ...f, cons: e.target.value }))}
              placeholder="改善してほしい点、入社前に知っておきたかったこと..."
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, resize: "vertical", fontFamily: "var(--font-noto-sans)", boxSizing: "border-box" }}
            />
          </div>

          {error && <p style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>{error}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, cursor: "pointer", color: "var(--ink-soft)" }}>
              キャンセル
            </button>
            <button
              onClick={submit}
              disabled={saving}
              style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "送信中..." : "口コミを送信する"}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.6 }}>
            投稿内容は編集部が確認後に公開されます。個人を特定できる情報は含めないでください。
          </p>
        </div>
      </div>
    </div>
  );
}
