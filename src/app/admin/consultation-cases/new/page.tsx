"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Mentor = { id: string; name: string };

const CATEGORIES = [
  "キャリアチェンジ",
  "年収交渉",
  "転職タイミング",
  "スタートアップ",
  "外資転職",
];

export default function AdminNewConsultationCase() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [mentorId, setMentorId] = useState("");
  const [consultedAt, setConsultedAt] = useState("");
  const [anonProfile, setAnonProfile] = useState("");
  const [worryCategory, setWorryCategory] = useState(CATEGORIES[0]);
  const [worrySummary, setWorrySummary] = useState("");
  const [insight, setInsight] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);

  useEffect(() => {
    async function fetchMentors() {
      const supabase = createClient();
      const { data } = await supabase
        .from("ow_mentors")
        .select("id, name")
        .order("display_order");
      if (data) {
        setMentors(data);
        if (data.length > 0) setMentorId(data[0].id);
      }
    }
    fetchMentors();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const supabase = createClient();
    const { error: insertErr } = await supabase
      .from("consultation_cases")
      .insert({
        mentor_id: mentorId,
        consulted_at: consultedAt,
        anon_profile: anonProfile,
        worry_category: worryCategory,
        worry_summary: worrySummary,
        insight,
        action_taken: actionTaken || null,
        is_published: true,
        consent_given: true,
        display_order: displayOrder,
      });

    if (insertErr) {
      setError(insertErr.message);
    } else {
      setSuccess(true);
      // Reset form
      setAnonProfile("");
      setWorrySummary("");
      setInsight("");
      setActionTaken("");
      setConsultedAt("");
      setDisplayOrder(0);
    }
    setLoading(false);
  }

  const inputClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";
  const labelClass = "block text-sm font-medium mb-1 text-gray-700";

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">相談事例を追加</h1>
        <p className="text-sm text-gray-500 mb-8">
          新しい相談事例を登録します（管理者用）
        </p>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            相談事例を追加しました
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-xl border border-gray-200">
          {/* Mentor */}
          <div>
            <label className={labelClass}>メンター</label>
            <select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              className={inputClass}
              required
            >
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={labelClass}>相談日</label>
            <input
              type="date"
              value={consultedAt}
              onChange={(e) => setConsultedAt(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          {/* Profile */}
          <div>
            <label className={labelClass}>相談者プロフィール（匿名）</label>
            <input
              type="text"
              value={anonProfile}
              onChange={(e) => setAnonProfile(e.target.value)}
              className={inputClass}
              placeholder="例: 28歳・SIer営業・3年目"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>悩みカテゴリ</label>
            <select
              value={worryCategory}
              onChange={(e) => setWorryCategory(e.target.value)}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Worry */}
          <div>
            <label className={labelClass}>相談内容</label>
            <textarea
              value={worrySummary}
              onChange={(e) => setWorrySummary(e.target.value)}
              className={inputClass}
              rows={3}
              placeholder="相談者の悩みを要約して記入"
              required
            />
          </div>

          {/* Insight */}
          <div>
            <label className={labelClass}>気づき・アドバイス</label>
            <textarea
              value={insight}
              onChange={(e) => setInsight(e.target.value)}
              className={inputClass}
              rows={4}
              placeholder="相談を通じて得た気づきやアドバイスの内容"
              required
            />
          </div>

          {/* Action */}
          <div>
            <label className={labelClass}>その後のアクション（任意）</label>
            <input
              type="text"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              className={inputClass}
              placeholder="例: SaaS企業3社に応募 → 2社から面接オファー"
            />
          </div>

          {/* Display order */}
          <div>
            <label className={labelClass}>表示順</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className={inputClass}
              min={0}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? "保存中..." : "事例を追加する"}
          </button>
        </form>
      </div>
    </main>
  );
}
