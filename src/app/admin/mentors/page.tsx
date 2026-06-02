"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Mentor = {
  id: string;
  name: string;
  avatar_initial: string | null;
  avatar_color: string | null;
  photo_url: string | null;
  current_company: string | null;
  current_role: string | null;
  previous_career: string | null;
  current_career: string | null;
  bio: string | null;
  catchphrase: string | null;
  roles: string[] | null;
  question_tags: string[] | null;
  concerns: string[] | null;
  display_order: number | null;
  is_available: boolean;
};

const EMPTY_FORM = {
  name: "",
  avatar_initial: "",
  avatar_color: "#002366",
  current_company: "",
  current_role: "",
  previous_career: "",
  current_career: "",
  bio: "",
  catchphrase: "",
  roles: "",
  question_tags: "",
  concerns: "",
  display_order: "",
  is_available: true,
};

// テキストエリアの各行を配列に変換
function textToArray(text: string): string[] {
  return text.split("\n").map(s => s.trim()).filter(Boolean);
}

function AvatarCircle({ mentor, size = 56 }: { mentor: Mentor; size?: number }) {
  if (mentor.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mentor.photo_url}
        alt={mentor.name}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: "center top", display: "block", border: "2px solid var(--line)" }}
      />
    );
  }
  const bg = mentor.avatar_color
    ? `linear-gradient(135deg, ${mentor.avatar_color}99, ${mentor.avatar_color})`
    : "linear-gradient(135deg, #002366, #3B5FD9)";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.35,
      border: "2px solid var(--line)", flexShrink: 0,
    }}>
      {mentor.avatar_initial || mentor.name?.charAt(0) || "?"}
    </div>
  );
}

export default function AdminMentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, Partial<typeof EMPTY_FORM>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [addSaving, setAddSaving] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const showFlash = useCallback((msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  }, []);

  const _fetchMentors = useCallback(async () => {
    const res = await fetch("/api/admin/mentors-list");
    if (!res.ok) {
      // フォールバック: Supabase クライアントで直接取得
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("ow_mentors")
        .select("id, name, avatar_initial, avatar_color, photo_url, current_company, current_role, previous_career, current_career, bio, catchphrase, roles, question_tags, concerns, display_order, is_available")
        .order("display_order", { nullsFirst: false });
      setMentors((data as Mentor[]) ?? []);
      return;
    }
    const data = await res.json();
    setMentors(data);
  }, []);

  useEffect(() => {
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("ow_mentors")
        .select("id, name, avatar_initial, avatar_color, photo_url, current_company, current_role, previous_career, current_career, bio, catchphrase, roles, question_tags, concerns, display_order, is_available")
        .order("display_order", { nullsFirst: false });
      setMentors((data as Mentor[]) ?? []);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 写真アップロード
  const handlePhotoUpload = async (mentorId: string, file: File) => {
    setUploadingId(mentorId);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/mentors/${mentorId}/photo`, { method: "POST", body: fd });
    setUploadingId(null);
    if (res.ok) {
      const { photo_url } = await res.json();
      setMentors(prev => prev.map(m => m.id === mentorId ? { ...m, photo_url } : m));
      showFlash("写真をアップロードしました");
    } else {
      showFlash("アップロード失敗", false);
    }
  };

  // 受付状況トグル
  const toggleAvailable = async (mentorId: string, current: boolean) => {
    setSaving(mentorId);
    const res = await fetch(`/api/admin/mentors/${mentorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_available: !current }),
    });
    setSaving(null);
    if (res.ok) {
      setMentors(prev => prev.map(m => m.id === mentorId ? { ...m, is_available: !current } : m));
      showFlash(!current ? "受付開始しました" : "受付停止しました");
    } else {
      showFlash("更新失敗", false);
    }
  };

  // 詳細編集フォームの初期化
  const openEdit = (mentor: Mentor) => {
    if (expandedId === mentor.id) { setExpandedId(null); return; }
    setExpandedId(mentor.id);
    setEditForms(prev => ({
      ...prev,
      [mentor.id]: {
        name: mentor.name || "",
        avatar_initial: mentor.avatar_initial || "",
        avatar_color: mentor.avatar_color || "#002366",
        current_company: mentor.current_company || "",
        current_role: mentor.current_role || "",
        previous_career: mentor.previous_career || "",
        current_career: mentor.current_career || "",
        bio: mentor.bio || "",
        catchphrase: mentor.catchphrase || "",
        roles: (mentor.roles || []).join("\n"),
        question_tags: (mentor.question_tags || []).join("\n"),
        concerns: (mentor.concerns || []).join("\n"),
        display_order: mentor.display_order != null ? String(mentor.display_order) : "",
        is_available: mentor.is_available,
      },
    }));
  };

  // 詳細編集保存
  const saveEdit = async (mentorId: string) => {
    const form = editForms[mentorId];
    if (!form) return;
    setSaving(mentorId);
    const payload = {
      name: form.name,
      avatar_initial: form.avatar_initial || null,
      avatar_color: form.avatar_color || null,
      current_company: form.current_company || null,
      current_role: form.current_role || null,
      previous_career: form.previous_career || null,
      current_career: form.current_career || null,
      bio: form.bio || null,
      catchphrase: form.catchphrase || null,
      roles: form.roles ? textToArray(form.roles) : [],
      question_tags: form.question_tags ? textToArray(form.question_tags) : [],
      concerns: form.concerns ? textToArray(form.concerns) : [],
      display_order: form.display_order ? parseInt(form.display_order, 10) : null,
      is_available: form.is_available,
    };
    const res = await fetch(`/api/admin/mentors/${mentorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(null);
    if (res.ok) {
      setMentors(prev => prev.map(m => m.id === mentorId ? { ...m, ...payload } as Mentor : m));
      setExpandedId(null);
      showFlash("保存しました");
    } else {
      showFlash("保存失敗", false);
    }
  };

  // 新規メンター追加
  const handleAddMentor = async () => {
    if (!addForm.name.trim()) { showFlash("名前は必須です", false); return; }
    setAddSaving(true);
    const payload = {
      name: addForm.name,
      avatar_initial: addForm.avatar_initial || addForm.name.charAt(0),
      avatar_color: addForm.avatar_color || "#002366",
      current_company: addForm.current_company || null,
      current_role: addForm.current_role || null,
      previous_career: addForm.previous_career || null,
      current_career: addForm.current_career || null,
      bio: addForm.bio || null,
      catchphrase: addForm.catchphrase || null,
      roles: addForm.roles ? textToArray(addForm.roles) : [],
      question_tags: addForm.question_tags ? textToArray(addForm.question_tags) : [],
      concerns: addForm.concerns ? textToArray(addForm.concerns) : [],
      display_order: addForm.display_order ? parseInt(addForm.display_order, 10) : null,
      is_available: addForm.is_available,
    };
    const res = await fetch("/api/admin/mentors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setAddSaving(false);
    if (res.ok) {
      const { id } = await res.json();
      setMentors(prev => [...prev, { ...payload, id, photo_url: null, roles: payload.roles, question_tags: payload.question_tags, concerns: payload.concerns }]);
      setAddForm({ ...EMPTY_FORM });
      setShowAddForm(false);
      showFlash("メンターを追加しました");
    } else {
      const e = await res.json();
      showFlash(e.error || "追加失敗", false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="skeleton-shimmer" style={{ height: 32, borderRadius: 8, maxWidth: 300, marginBottom: 24 }} />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />
        ))}
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid var(--line)", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none",
    color: "var(--ink)", fontFamily: "inherit", background: "var(--bg-tint)",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--ink-soft)",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block",
  };

  const availableCount = mentors.filter(m => m.is_available).length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>メンター管理</h1>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", background: "var(--error)", color: "#fff", padding: "2px 7px", borderRadius: 4 }}>ADMIN</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
            写真・プロフィール・受付状況を管理します
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right", fontSize: 13, color: "var(--ink-soft)" }}>
            全 <strong style={{ color: "var(--ink)", fontFamily: "Inter" }}>{mentors.length}</strong> 名
            <span style={{ color: "var(--success)", fontWeight: 600, marginLeft: 8 }}>受付中 {availableCount}名</span>
          </div>
          <button
            onClick={() => setShowAddForm(v => !v)}
            style={{
              padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: showAddForm ? "var(--line-soft)" : "var(--royal)", color: showAddForm ? "var(--ink)" : "#fff",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {showAddForm ? "✕ キャンセル" : "＋ 新規追加"}
          </button>
        </div>
      </div>

      {/* ── Flash toast ── */}
      {flash && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: flash.ok ? "#065F46" : "var(--error)", color: "#fff",
          padding: "12px 28px", borderRadius: 12, fontSize: 14, fontWeight: 500,
          zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {flash.ok
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          }
          {flash.msg}
        </div>
      )}

      {/* ── 新規追加フォーム ── */}
      {showAddForm && (
        <div style={{ background: "#fff", border: "2px solid var(--royal)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--royal)", margin: "0 0 20px" }}>新規メンター追加</h2>
          <MentorForm form={addForm} onChange={f => setAddForm(prev => ({ ...prev, ...f }))} inputStyle={inputStyle} labelStyle={labelStyle} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button onClick={() => setShowAddForm(false)} style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--line-soft)", color: "var(--ink)", border: "none", cursor: "pointer" }}>
              キャンセル
            </button>
            <button
              onClick={handleAddMentor}
              disabled={addSaving}
              style={{ padding: "9px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: addSaving ? "var(--ink-mute)" : "var(--royal)", color: "#fff", border: "none", cursor: addSaving ? "not-allowed" : "pointer" }}
            >
              {addSaving ? "追加中..." : "追加する"}
            </button>
          </div>
        </div>
      )}

      {/* ── メンターリスト ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mentors.map(mentor => (
          <div
            key={mentor.id}
            style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", transition: "box-shadow 0.15s" }}
          >
            {/* ── 概要行 ── */}
            <div style={{ padding: "14px 20px", display: "flex", gap: 16, alignItems: "center" }}>

              {/* 写真（クリックでアップロード） */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <AvatarCircle mentor={mentor} size={56} />
                <button
                  onClick={() => fileInputRefs.current[mentor.id]?.click()}
                  disabled={uploadingId === mentor.id}
                  title="写真を変更"
                  style={{
                    position: "absolute", bottom: -2, right: -2,
                    width: 22, height: 22, borderRadius: "50%",
                    background: uploadingId === mentor.id ? "var(--ink-mute)" : "var(--royal)",
                    border: "2px solid #fff", cursor: uploadingId === mentor.id ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0,
                  }}
                >
                  {uploadingId === mentor.id ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  )}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  ref={el => { fileInputRefs.current[mentor.id] = el; }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handlePhotoUpload(mentor.id, f);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* 名前・会社 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: 15 }}>{mentor.name}</span>
                  {mentor.current_company && (
                    <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{mentor.current_company}</span>
                  )}
                  {mentor.current_role && (
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", padding: "1px 8px", borderRadius: 100, background: "var(--line-soft)", border: "1px solid var(--line)" }}>
                      {mentor.current_role}
                    </span>
                  )}
                  {mentor.display_order != null && (
                    <span style={{ fontSize: 10, color: "var(--ink-mute)", fontFamily: "Inter" }}>#{mentor.display_order}</span>
                  )}
                </div>
                {mentor.catchphrase && (
                  <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    「{mentor.catchphrase}」
                  </p>
                )}
              </div>

              {/* ボタン群 */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                {/* 受付トグル */}
                <button
                  onClick={() => toggleAvailable(mentor.id, mentor.is_available)}
                  disabled={saving === mentor.id}
                  style={{
                    padding: "5px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    border: mentor.is_available ? "1px solid #A7F3D0" : "1px solid var(--line)",
                    cursor: saving === mentor.id ? "not-allowed" : "pointer",
                    background: mentor.is_available ? "var(--success-soft)" : "var(--line-soft)",
                    color: mentor.is_available ? "var(--success)" : "var(--ink-mute)",
                    transition: "all 0.15s",
                  }}
                >
                  {mentor.is_available ? "受付中" : "停止中"}
                </button>
                {/* 編集ボタン */}
                <button
                  onClick={() => openEdit(mentor)}
                  style={{
                    padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: expandedId === mentor.id ? "var(--royal)" : "var(--line-soft)",
                    color: expandedId === mentor.id ? "#fff" : "var(--ink)",
                    border: "none", cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {expandedId === mentor.id ? "▲ 閉じる" : "✎ 編集"}
                </button>
              </div>
            </div>

            {/* ── 詳細編集フォーム（展開時） ── */}
            {expandedId === mentor.id && editForms[mentor.id] && (
              <div style={{ borderTop: "1px solid var(--line)", padding: 24, background: "var(--bg-tint)" }}>
                <MentorForm
                  form={editForms[mentor.id] as typeof EMPTY_FORM}
                  onChange={f => setEditForms(prev => ({ ...prev, [mentor.id]: { ...prev[mentor.id], ...f } }))}
                  inputStyle={inputStyle}
                  labelStyle={labelStyle}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                  <button
                    onClick={() => setExpandedId(null)}
                    style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--line-soft)", color: "var(--ink)", border: "none", cursor: "pointer" }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => saveEdit(mentor.id)}
                    disabled={saving === mentor.id}
                    style={{
                      padding: "9px 28px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: saving === mentor.id ? "var(--ink-mute)" : "var(--royal)",
                      color: "#fff", border: "none", cursor: saving === mentor.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving === mentor.id ? "保存中..." : "保存する"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── 共通フォームコンポーネント ──────────────────────────────────────────────
function MentorForm({
  form,
  onChange,
  inputStyle,
  labelStyle,
}: {
  form: typeof EMPTY_FORM;
  onChange: (f: Partial<typeof EMPTY_FORM>) => void;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
}) {
  const ta: React.CSSProperties = { ...inputStyle, resize: "vertical", minHeight: 80 };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

      {/* 名前 */}
      <div>
        <label style={labelStyle}>名前 *</label>
        <input style={inputStyle} value={form.name} onChange={e => onChange({ name: e.target.value })} placeholder="柴 久人" />
      </div>

      {/* アバター */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>イニシャル</label>
          <input style={inputStyle} value={form.avatar_initial} onChange={e => onChange({ avatar_initial: e.target.value })} placeholder="柴" maxLength={2} />
        </div>
        <div>
          <label style={labelStyle}>カラー</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="color" value={form.avatar_color} onChange={e => onChange({ avatar_color: e.target.value })}
              style={{ width: 40, height: 38, borderRadius: 6, border: "1.5px solid var(--line)", cursor: "pointer", padding: 2 }} />
            <input style={{ ...inputStyle, width: 100 }} value={form.avatar_color} onChange={e => onChange({ avatar_color: e.target.value })} placeholder="#002366" />
          </div>
        </div>
      </div>

      {/* 会社 */}
      <div>
        <label style={labelStyle}>現在の会社</label>
        <input style={inputStyle} value={form.current_company} onChange={e => onChange({ current_company: e.target.value })} placeholder="OPINIO" />
      </div>

      {/* 役職 */}
      <div>
        <label style={labelStyle}>現在の役職</label>
        <input style={inputStyle} value={form.current_role} onChange={e => onChange({ current_role: e.target.value })} placeholder="代表取締役" />
      </div>

      {/* 前職 */}
      <div>
        <label style={labelStyle}>前職（career breadcrumb 左）</label>
        <input style={inputStyle} value={form.previous_career} onChange={e => onChange({ previous_career: e.target.value })} placeholder="Salesforce Japan（IS→FS）" />
      </div>

      {/* 現職 */}
      <div>
        <label style={labelStyle}>現職（career breadcrumb 右）</label>
        <input style={inputStyle} value={form.current_career} onChange={e => onChange({ current_career: e.target.value })} placeholder="OPINIO（代表取締役）" />
      </div>

      {/* キャッチコピー（全幅） */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>キャッチコピー（カード内斜体テキスト）</label>
        <input style={inputStyle} value={form.catchphrase} onChange={e => onChange({ catchphrase: e.target.value })} placeholder="SaaS営業 → 起業" />
      </div>

      {/* Bio（全幅） */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>プロフィール（bio）</label>
        <textarea style={ta} value={form.bio} onChange={e => onChange({ bio: e.target.value })} placeholder="詳細プロフィールを入力..." />
      </div>

      {/* roles */}
      <div>
        <label style={labelStyle}>ロール（1行1つ）</label>
        <textarea style={{ ...ta, minHeight: 100 }} value={form.roles} onChange={e => onChange({ roles: e.target.value })} placeholder={"法人営業\nSaaS営業\nIS（インサイドセールス）"} />
      </div>

      {/* question_tags */}
      <div>
        <label style={labelStyle}>相談テーマ（1行1つ）</label>
        <textarea style={{ ...ta, minHeight: 100 }} value={form.question_tags} onChange={e => onChange({ question_tags: e.target.value })} placeholder={"営業キャリアアップ\n独立・起業"} />
      </div>

      {/* concerns（全幅） */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>こんな方におすすめ（1行1つ）</label>
        <textarea style={{ ...ta, minHeight: 100 }} value={form.concerns} onChange={e => onChange({ concerns: e.target.value })} placeholder={"SaaS営業のキャリアを考えている方\n起業・独立を視野に入れている方"} />
      </div>

      {/* 表示順 + 受付状況 */}
      <div>
        <label style={labelStyle}>表示順（数字）</label>
        <input type="number" style={inputStyle} value={form.display_order} onChange={e => onChange({ display_order: e.target.value })} placeholder="1" min={1} />
      </div>

      <div>
        <label style={labelStyle}>受付状況</label>
        <div style={{ display: "flex", gap: 8 }}>
          {[true, false].map(v => (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange({ is_available: v })}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${form.is_available === v ? (v ? "var(--success)" : "var(--error)") : "var(--line)"}`,
                background: form.is_available === v ? (v ? "var(--success-soft)" : "var(--error-soft)") : "#fff",
                color: form.is_available === v ? (v ? "var(--success)" : "var(--error)") : "var(--ink-mute)",
                cursor: "pointer",
              }}
            >
              {v ? "受付中" : "停止中"}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
