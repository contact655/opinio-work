"use client";

/**
 * `/profile/edit` の記録系エディタ（学歴・実績・受賞・メディア掲載）。
 *
 * ⚠️ **ProfileEditClient.tsx の 775〜2318 行をそのまま移しただけ**（2026-08-15）。
 *    挙動・state の持ち方・保存経路は1文字も変えていない。
 *    ロジックを直すのはここではなく、次のコミットで行う。
 */

import { useState, useCallback, useEffect, useRef } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import {
  type Education,
  type School,
  type Achievement,
  type Award,
  type MediaAppearance,
  EDU_YEAR_OPTS,
  parseDateToYM,
  formatYMToDate,
} from "./recordTypes";

type EducationDraft = {
  school:        string;
  school_id:     string | null;  // Phase 5: FK to ow_schools (null = フリー入力 or 未選択)
  faculty:       string;
  degree:        string;
  enrolledYear:  string;
  enrolledMonth: string;
  graduatedYear: string;
  graduatedMonth: string;
  isCurrent:     boolean;
};

const EMPTY_EDU_DRAFT: EducationDraft = {
  school: "", school_id: null, faculty: "", degree: "",
  enrolledYear: "", enrolledMonth: "",
  graduatedYear: "", graduatedMonth: "",
  isCurrent: false,
};

function draftFromEducation(edu: Education): EducationDraft {
  const enrolledYM  = parseDateToYM(edu.enrolled_at);
  const graduatedYM = parseDateToYM(edu.graduated_at);
  return {
    school:         edu.school,
    school_id:      edu.school_id ?? null,  // Phase 5: 既存の school_id を引き継ぐ
    faculty:        edu.faculty  ?? "",
    degree:         edu.degree   ?? "",
    enrolledYear:   enrolledYM.year,
    enrolledMonth:  enrolledYM.month,
    graduatedYear:  graduatedYM.year,
    graduatedMonth: graduatedYM.month,
    isCurrent:      edu.is_current,
  };
}

// ── EducationForm (edit / add mode) ──────────────────────────────────────────

function EducationForm({
  draft,
  onDraftChange,
  isSaving,
  justSaved,
  onSave,
  onCancel,
  schools,
}: {
  draft: EducationDraft;
  onDraftChange: (d: EducationDraft) => void;
  isSaving: boolean;
  justSaved?: boolean;
  onSave: () => void;
  onCancel: () => void;
  schools: School[];
}) {
  const set = useCallback(
    (key: keyof EducationDraft, val: string | boolean) =>
      onDraftChange({ ...draft, [key]: val }),
    [draft, onDraftChange],
  );

  const canSave = !!draft.school.trim() && !isSaving;
  const effectivelyDisabled = !canSave || !!justSaved;

  const ef = (): React.CSSProperties => ({
    width: "100%", border: "1.5px solid transparent", borderRadius: 8,
    padding: "13px 14px", fontSize: 14, color: "var(--ink)",
    background: "#F2F4F7", outline: "none", fontFamily: "inherit",
    boxSizing: "border-box", transition: "border-color 0.15s, background 0.15s",
  });
  const el = (): React.CSSProperties => ({
    display: "block", fontSize: 14, fontWeight: 700,
    color: "#111", marginBottom: 6,
  });
  const selectExtra: React.CSSProperties = {
    appearance: "none", paddingRight: 28,
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
  };

  return (
    <div style={{
      background: "var(--bg-tint)",
      border: "1.5px solid var(--royal)",
      borderRadius: 10, padding: "var(--space-4)",
      display: "flex", flexDirection: "column", gap: 14,
      boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
    }}>
      {/* 学校名 — Phase 5: datalist コンボボックス */}
      <div>
        <label htmlFor="edu-school" style={el()}>学校名 *</label>
        <input
          id="edu-school"
          type="text"
          list="school-options"
          value={draft.school}
          onChange={(e) => {
            let newSchool = e.target.value;
            // datalist の表示値は "name (name_kana)" 形式の場合があるため、
            // その形式と一致するマスターを先に探す（カナ検索でのマッチ）
            const displayMatched = schools.find((s) =>
              s.name_kana
                ? `${s.name} (${s.name_kana})` === newSchool
                : s.name === newSchool
            );
            if (displayMatched) {
              // カナ付き表示値 → クリーンな学校名に変換してから保存
              newSchool = displayMatched.name;
            }
            const matched =
              displayMatched ?? schools.find((s) => s.name === newSchool);
            onDraftChange({
              ...draft,
              school:    newSchool,
              school_id: matched?.id ?? null,
            });
          }}
          placeholder="例：○○大学（候補リストから選択または手動入力）"
          maxLength={100}
          disabled={isSaving}
          style={ef()}
        />
        <datalist id="school-options">
          {schools.map((s) => (
            <option
              key={s.id}
              value={s.name_kana ? `${s.name} (${s.name_kana})` : s.name}
            />
          ))}
        </datalist>
      </div>

      {/* 学位 */}
      <div>
        <label htmlFor="edu-degree" style={el()}>学校種別・学位（任意）</label>
        <select
          id="edu-degree"
          value={draft.degree}
          onChange={(e) => set("degree", e.target.value)}
          disabled={isSaving}
          style={{ ...ef(), ...selectExtra, cursor: isSaving ? "default" : "pointer" }}
        >
          <option value="">選択してください（任意）</option>
          <optgroup label="初等・中等教育">
            <option value="小学校卒">小学校卒</option>
            <option value="中学校卒">中学校卒</option>
            <option value="高校卒">高校卒</option>
          </optgroup>
          <optgroup label="高等教育">
            <option value="専門卒">専門卒</option>
            <option value="短大卒">短大卒</option>
            <option value="学士">学士</option>
            <option value="修士">修士</option>
            <option value="博士">博士</option>
          </optgroup>
          <option value="その他">その他</option>
        </select>
      </div>

      {/* 学部・学科 */}
      <div>
        <label htmlFor="edu-faculty" style={el()}>学部・学科（任意）</label>
        <input
          id="edu-faculty"
          type="text"
          value={draft.faculty}
          onChange={(e) => set("faculty", e.target.value)}
          placeholder="例：経済学部 経営学科"
          maxLength={100}
          disabled={isSaving}
          style={ef()}
        />
      </div>

      {/* 入学年月 */}
      <div>
        <label style={el()}>入学年月</label>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <select
            value={draft.enrolledYear}
            onChange={(e) => set("enrolledYear", e.target.value)}
            disabled={isSaving}
            aria-label="入学年"
            style={{ ...ef(), ...selectExtra, flex: "1 1 110px", width: "auto", cursor: isSaving ? "default" : "pointer" }}
          >
            <option value="">年</option>
            {EDU_YEAR_OPTS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <select
            value={draft.enrolledMonth}
            onChange={(e) => set("enrolledMonth", e.target.value)}
            disabled={isSaving}
            aria-label="入学月"
            style={{ ...ef(), ...selectExtra, flex: "0 0 72px", width: "auto", cursor: isSaving ? "default" : "pointer" }}
          >
            <option value="">月</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* 在学中チェックボックス */}
      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--ink-soft)", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={draft.isCurrent}
            onChange={(e) => set("isCurrent", e.target.checked)}
            style={{ accentColor: "var(--royal)", cursor: "pointer" }}
          />
          在学中
        </label>
      </div>

      {/* 卒業年月 */}
      <div style={{ opacity: draft.isCurrent ? 0.4 : 1, transition: "opacity 0.2s" }}>
        <label style={el()}>卒業年月</label>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <select
            value={draft.graduatedYear}
            onChange={(e) => set("graduatedYear", e.target.value)}
            disabled={isSaving || draft.isCurrent}
            aria-label="卒業年"
            style={{ ...ef(), ...selectExtra, flex: "1 1 110px", width: "auto", cursor: (isSaving || draft.isCurrent) ? "default" : "pointer" }}
          >
            <option value="">年</option>
            {EDU_YEAR_OPTS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <select
            value={draft.graduatedMonth}
            onChange={(e) => set("graduatedMonth", e.target.value)}
            disabled={isSaving || draft.isCurrent}
            aria-label="卒業月"
            style={{ ...ef(), ...selectExtra, flex: "0 0 72px", width: "auto", cursor: (isSaving || draft.isCurrent) ? "default" : "pointer" }}
          >
            <option value="">月</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: 2 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          style={{ padding: "7px 16px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isSaving ? "default" : "pointer", fontFamily: "inherit", opacity: isSaving ? 0.5 : 1 }}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={effectivelyDisabled ? undefined : onSave}
          disabled={effectivelyDisabled}
          style={{
            padding: "7px 18px", minWidth: 130,
            background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)",
            color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: effectivelyDisabled ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.2s",
          }}
        >
          {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ── SchoolRequestBanner ───────────────────────────────────────────────────────

function SchoolRequestBanner({
  schoolName,
  kana,
  onKanaChange,
  status,
  error,
  onSubmit,
  onClose,
}: {
  schoolName: string;
  kana: string;
  onKanaChange: (v: string) => void;
  status: "idle" | "submitting" | "success" | "error";
  error: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const bannerBase: React.CSSProperties = {
    marginBottom: "var(--space-4)",
    padding: "14px var(--space-4)",
    borderRadius: 10,
    fontSize: 12,
    lineHeight: 1.7,
  };

  if (status === "success") {
    return (
      <div style={{ ...bannerBase, background: "var(--success-soft)", border: "1px solid #6ee7b7", color: "var(--ink-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
          <span style={{ color: "var(--success)", fontWeight: 600 }}>
            ✓ 「{schoolName}」のマスター追加リクエストを送信しました
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0, padding: "3px 10px",
              background: "transparent", border: "1px solid var(--success)",
              borderRadius: 6, fontSize: 12, fontWeight: 500, color: "var(--success)",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...bannerBase, background: "var(--purple-soft)", border: "1px solid #c4b5fd", color: "var(--ink-soft)" }}>
      <div style={{ marginBottom: "var(--space-2)" }}>
        あなたの学校「<strong style={{ color: "var(--ink)" }}>{schoolName}</strong>」はマスターにありません。
        運営に追加リクエストを送信できます。
      </div>
      <div style={{ marginBottom: error ? 6 : 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ flexShrink: 0, color: "var(--ink-mute)" }}>ふりがな（任意）：</span>
          <input
            type="text"
            value={kana}
            onChange={(e) => onKanaChange(e.target.value)}
            placeholder="例: とうきょうだいがく"
            disabled={status === "submitting"}
            style={{
              flex: 1, minWidth: 0, padding: "4px var(--space-2)",
              border: "1px solid var(--line)", borderRadius: 6,
              fontSize: 12, fontFamily: "inherit",
              background: status === "submitting" ? "var(--bg-tint)" : "#fff",
            }}
          />
        </label>
      </div>
      {error && (
        <div style={{ marginBottom: 8, color: "var(--error)", fontSize: 12, fontWeight: 600 }}>
          エラー: {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={status === "submitting"}
          style={{
            padding: "5px 14px",
            background: "var(--purple)", border: "none",
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            color: "#fff", cursor: status === "submitting" ? "not-allowed" : "pointer",
            opacity: status === "submitting" ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {status === "submitting" ? "送信中..." : "リクエストを送る"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={status === "submitting"}
          style={{
            padding: "5px 14px",
            background: "transparent", border: "1px solid var(--line)",
            borderRadius: 6, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)",
            cursor: status === "submitting" ? "not-allowed" : "pointer",
            opacity: status === "submitting" ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          今は送らない
        </button>
      </div>
    </div>
  );
}

// ── EducationEditor ───────────────────────────────────────────────────────────

export function EducationEditor({
  educations,
  setEducations,
  schools,
  hideHeading = false,
  openAddNonce, openEditId, openDeleteId, onClosed,
}: {
  /** ★カードの見出しの「＋」から追加フォームを開く合図（2026-08-16）。値が変わるたびに開く */
  openAddNonce?: number;
  educations: Education[];
  setEducations: React.Dispatch<React.SetStateAction<Education[]>>;
  schools: School[];  // 段階6-7 Phase 1: ProfileEditClient トップレベルから受け取る
  /** ★見出しを描かない。`EditableSection` が描くときに true（2026-08-16）。
      ⚠️ 既定は false なので、他から呼ばれても見た目は変わらない */
  hideHeading?: boolean;
  /** ★外（公開部品の行の鉛筆）から編集を開く行の id。`null` で閉じる（2026-08-16 / 2-5） */
  openEditId?: string | null;
  /** ★外（行のゴミ箱）から削除確認を開く行の id。`null` で閉じる（2026-08-16 / 2-5） */
  openDeleteId?: string | null;
  /** フォームが閉じたことを親へ知らせる。★親はこれでカードを表示モードへ戻す */
  onClosed?: () => void;
}) {
  // Edit state
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<EducationDraft>(EMPTY_EDU_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  // Add state
  const [adding,      setAdding]      = useState(false);

  /* 見出しの「＋」から開く合図。★初回マウント時（undefined / 0）は開かない */
  /* ⚠️ **行の鉛筆・ゴミ箱から開いたときは追加フォームを出さない**（2026-08-16 / 2-5 で実測）。
        追加を1回でも使うと nonce が 0 でなくなるので、次にこのエディタが
        マウントされた瞬間（＝鉛筆やゴミ箱で開いたとき）に追加フォームまで開いてしまう。
        4つのエディタすべてが同じ形だったので同時に直した。 */
  useEffect(() => {
    if (openAddNonce && !openEditId && !openDeleteId) setAdding(true);
  }, [openAddNonce, openEditId, openDeleteId]);
  /* ⚠️ ref に逃がす理由は他のエディタと同じ（依存に入れると作り直される） */
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const [addDraft,    setAddDraft]    = useState<EducationDraft>(EMPTY_EDU_DRAFT);
  const [addSaving,   setAddSaving]   = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Education | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  // Toast
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");
  // School request banner state（段階6-8 Phase 3）
  const [bannerSchoolName, setBannerSchoolName] = useState<string | null>(null);
  const [bannerKana,       setBannerKana]       = useState<string>("");
  const [bannerStatus,     setBannerStatus]     = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [bannerError,      setBannerError]      = useState<string>("");

  const showToast = useCallback(
    (msg: string, variant: "default" | "error" = "default") => {
      setToastVariant(variant);
      setToastMsg(msg);
    },
    [],
  );

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const startEdit = useCallback((edu: Education) => {
    setEditingId(edu.id);
    setEditDraft(draftFromEducation(edu));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_EDU_DRAFT);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const trimmedSchool = editDraft.school.trim();
    if (!trimmedSchool) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/educations/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school:       trimmedSchool,
          school_id:    editDraft.school_id,  // Phase 5: 明示的に送信(null = クリア, uuid = セット)
          faculty:      editDraft.faculty.trim() || null,
          degree:       editDraft.degree || null,
          enrolled_at:  formatYMToDate(editDraft.enrolledYear, editDraft.enrolledMonth),
          graduated_at: editDraft.isCurrent ? null : formatYMToDate(editDraft.graduatedYear, editDraft.graduatedMonth),
          is_current:   editDraft.isCurrent,
        }),
      });
      if (!res.ok) throw new Error();
      const updated: Education = await res.json();
      setEducations((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...updated } : e)));
      showToast("学歴を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null);
      setEditDraft(EMPTY_EDU_DRAFT);
      setEditJustSaved(false);
      onClosedRef.current?.();  // ★保存できたらカードごと表示モードへ（2-2〜2-4 と同じ）
      // 段階6-8 Phase 3: school_id が null の場合、バナー表示
      if (updated.school_id === null && updated.school.trim().length > 0) {
        setBannerSchoolName(updated.school);
        setBannerKana("");
        setBannerStatus("idle");
        setBannerError("");
      }
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editDraft, setEducations, showToast]);

  // ── Add handlers ─────────────────────────────────────────────────────────────
  const cancelAdd = useCallback(() => {
    setAdding(false);
    setAddDraft(EMPTY_EDU_DRAFT);
  }, []);

  const saveAdd = useCallback(async () => {
    const trimmedSchool = addDraft.school.trim();
    if (!trimmedSchool) return;
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/educations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school:       trimmedSchool,
          school_id:    addDraft.school_id,   // Phase 5: datalist 選択時にセットされた id
          faculty:      addDraft.faculty.trim() || null,
          degree:       addDraft.degree || null,
          enrolled_at:  formatYMToDate(addDraft.enrolledYear, addDraft.enrolledMonth),
          graduated_at: addDraft.isCurrent ? null : formatYMToDate(addDraft.graduatedYear, addDraft.graduatedMonth),
          is_current:   addDraft.isCurrent,
        }),
      });
      if (!res.ok) throw new Error();
      const inserted: Education = await res.json();
      setEducations((prev) => [...prev, inserted]);
      showToast("学歴を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false);
      setAddDraft(EMPTY_EDU_DRAFT);
      setAddJustSaved(false);
      onClosedRef.current?.();
      // 段階6-8 Phase 3: school_id が null の場合、バナー表示
      if (inserted.school_id === null && inserted.school.trim().length > 0) {
        setBannerSchoolName(inserted.school);
        setBannerKana("");
        setBannerStatus("idle");
        setBannerError("");
      }
    } catch {
      showToast("追加に失敗しました。もう一度お試しください。", "error");
    } finally {
      setAddSaving(false);
    }
  }, [addDraft, setEducations, showToast]);

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/educations/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEducations((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("学歴を削除しました");
      onClosedRef.current?.();
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, setEducations, showToast]);

  /* ★外（`MergedTimeline` の学歴の行にある鉛筆・ゴミ箱）から開く（2026-08-16 / 2-5）。
        id は行ごとに変わるので nonce ではなく id そのものを見る。 */
  useEffect(() => {
    if (!openEditId) return;
    const target = educations.find((e) => e.id === openEditId);
    if (target) startEdit(target);
  }, [openEditId, educations, startEdit]);
  useEffect(() => {
    if (!openDeleteId) return;
    const target = educations.find((e) => e.id === openDeleteId);
    if (target) setDeleteTarget(target);
  }, [openDeleteId, educations]);

  // ── School request banner handlers（段階6-8 Phase 3）──────────────────────────
  const handleBannerSubmit = useCallback(async () => {
    if (!bannerSchoolName) return;
    setBannerStatus("submitting");
    setBannerError("");
    try {
      const res = await fetch("/api/jobseeker/school-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name:      bannerSchoolName,
          school_name_kana: bannerKana.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setBannerError(body.error ?? "リクエストの送信に失敗しました");
        setBannerStatus("error");
        return;
      }
      setBannerStatus("success");
    } catch {
      setBannerError("ネットワークエラーが発生しました");
      setBannerStatus("error");
    }
  }, [bannerSchoolName, bannerKana]);

  const handleBannerClose = useCallback(() => {
    setBannerSchoolName(null);
    setBannerKana("");
    setBannerStatus("idle");
    setBannerError("");
  }, []);

  return (
    <div style={{ marginTop: hideHeading ? 0 : "var(--space-8)" }}>
      {/* Section header — フラット（職歴と同じ構造、白カードなし）
          ⚠️ hideHeading のときは EditableSection が同じ見出しを描く。二重にしない */}
      {!hideHeading && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>
            学歴
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
            大学・大学院・専門学校・高校などを登録できます。新しい順に入力することをおすすめします。
          </div>
        </>
      )}
      {/* School request banner（段階6-8 Phase 3）— 教育リストの上に表示 */}
      {bannerSchoolName && (
        <SchoolRequestBanner
          schoolName={bannerSchoolName}
          kana={bannerKana}
          onKanaChange={setBannerKana}
          status={bannerStatus}
          error={bannerError}
          onSubmit={() => { void handleBannerSubmit(); }}
          onClose={handleBannerClose}
        />
      )}

      {/* Education list */}
      {/* ★編集フォームだけ（2026-08-16 / 2-5）。一覧・鉛筆・ゴミ箱・0件の1行は
             公開プロフィールと同じ `MergedTimeline`（学歴の行）が持つ。
             ここに一覧を戻すと同じ見た目が2箇所に生まれる。 */}
      {educations.filter((edu) => editingId === edu.id).map((edu) => (
        <EducationForm
          key={edu.id}
          draft={editDraft}
          onDraftChange={setEditDraft}
          isSaving={editSaving}
          justSaved={editJustSaved}
          onSave={() => { void saveEdit(); }}
          onCancel={() => { cancelEdit(); onClosedRef.current?.(); }}
          schools={schools}
        />
      ))}

      {/* Add form */}
      {adding && (
        <div style={{ marginTop: educations.length > 0 ? 12 : 0 }}>
          <EducationForm
            draft={addDraft}
            onDraftChange={setAddDraft}
            isSaving={addSaving}
            justSaved={addJustSaved}
            onSave={() => { void saveAdd(); }}
            onCancel={() => { cancelAdd(); onClosedRef.current?.(); }}
            schools={schools}
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="学歴を削除しますか？"
        message={
          deleteTarget
            ? `「${deleteTarget.school}」の学歴を削除します。この操作は取り消せません。`
            : ""
        }
        confirmLabel="削除する"
        confirmVariant="danger"
        isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => { setDeleteTarget(null); onClosedRef.current?.(); }}
      />

      {/* Toast */}
      {toastMsg && (
        <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />
      )}
    </div>
  );
}

// ─── 実績・受賞タブ — shared helpers ─────────────────────────────────────────

/** "2024-06-01" → "2024年6月" */
/** "<input type=month>" value ("2024-06") → "2024-06-01" or null */
function monthToDate(s: string): string | null {
  return s ? `${s}-01` : null;
}
/** "2024-06-01" → "2024-06" (for <input type=month>) */
function dateToMonth(s: string | null): string {
  return s ? s.slice(0, 7) : "";
}

// ── shared micro-components ──────────────────────────────────────────────────

const aef = (): React.CSSProperties => ({
  width: "100%", border: "1.5px solid var(--line)", borderRadius: 8,
  padding: "8px 10px", fontSize: "var(--text-sm)", color: "var(--ink)",
  background: "#fff", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box", transition: "border-color 0.15s",
});
const ael = (): React.CSSProperties => ({
  display: "block", fontSize: "var(--text-xs)", fontWeight: 700,
  color: "var(--ink-mute)", letterSpacing: "0.08em",
  textTransform: "uppercase", marginBottom: 4,
});
const formBox: React.CSSProperties = {
  background: "var(--bg-tint)", border: "1.5px solid var(--royal)", borderRadius: 10, padding: "var(--space-4)",
  display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
};
function AchieveFormActions({ isSaving, justSaved, canSave, onSave, onCancel }: {
  isSaving: boolean; justSaved?: boolean; canSave: boolean; onSave: () => void; onCancel: () => void;
}) {
  const effectivelyDisabled = !canSave || !!justSaved;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: 2 }}>
      <button type="button" onClick={onCancel} disabled={isSaving}
        style={{ padding: "7px 16px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isSaving ? "default" : "pointer", fontFamily: "inherit", opacity: isSaving ? 0.5 : 1 }}>
        キャンセル
      </button>
      <button type="button" onClick={effectivelyDisabled ? undefined : onSave} disabled={effectivelyDisabled}
        style={{
          padding: "7px 18px", minWidth: 130,
          background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)",
          color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: effectivelyDisabled ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.2s",
        }}>
        {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
      </button>
    </div>
  );
}
/* ⚠️ `AddSectionBtn`（「＋ 〇〇を追加」）は 2026-08-16 に削除した。
      追加の入口は公開部品の見出し行の「追加」1つに集約した（ルール⑧）。 */

// ─── AchievementEditor ────────────────────────────────────────────────────────

type AchievementDraft = {
  title: string; value: string; unit: string;
  description: string; period_start: string; period_end: string;
  /** 紐づける職歴。`""` は未選択（＝ どの職歴にも紐づけない）。2026-08-16 / 2-4 */
  experience_id: string;
};
const EMPTY_ACH_DRAFT: AchievementDraft = {
  title: "", value: "", unit: "", description: "", period_start: "", period_end: "", experience_id: "",
};
function draftFromAch(a: Achievement): AchievementDraft {
  return {
    title: a.title, value: a.value !== null ? String(a.value) : "",
    unit: a.unit ?? "", description: a.description ?? "",
    period_start: dateToMonth(a.period_start), period_end: dateToMonth(a.period_end),
    experience_id: a.experience_id ?? "",
  };
}

/** 紐づけセレクトの選択肢。★職歴の表示名だけを持つ（この部品は職歴の中身を知らない） */
export type ExperienceOption = { id: string; label: string };

/** 「紐づける職歴」セレクト。⚠️ 実績・受賞で同じものを使う（2箇所に書かない） */
function ExperienceSelect({
  value, onChange, options, disabled,
}: { value: string; onChange: (v: string) => void; options: ExperienceOption[]; disabled?: boolean }) {
  if (options.length === 0) return null;
  return (
    <div>
      <label style={ael()}>紐づける職歴（任意）</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={aef()}>
        <option value="">選択しない</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.7 }}>
        ⚠️ 職歴を削除しても、この実績は消えません（紐づけだけが外れます）。
      </div>
    </div>
  );
}

function AchievementForm({
  draft, onDraftChange, isSaving, justSaved, onSave, onCancel, experienceOptions = [],
}: { draft: AchievementDraft; onDraftChange: (d: AchievementDraft) => void; isSaving: boolean; justSaved?: boolean; onSave: () => void; onCancel: () => void; experienceOptions?: ExperienceOption[]; }) {
  const set = useCallback((k: keyof AchievementDraft, v: string) => onDraftChange({ ...draft, [k]: v }), [draft, onDraftChange]);
  const canSave = !!draft.title.trim() && !isSaving;
  return (
    <div style={formBox}>
      <div>
        <label style={ael()}>タイトル（実績の名称）*</label>
        <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)}
          placeholder="例：新規顧客獲得数 150%達成" maxLength={100} disabled={isSaving} style={aef()} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: "0 0 120px" }}>
          <label style={ael()}>数値（任意）</label>
          <input type="number" value={draft.value} onChange={(e) => set("value", e.target.value)}
            placeholder="例：150" disabled={isSaving} style={{ ...aef(), width: "100%" }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={ael()}>単位（任意）</label>
          <input type="text" value={draft.unit} onChange={(e) => set("unit", e.target.value)}
            placeholder="例：%、件、万円" maxLength={20} disabled={isSaving} style={aef()} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={ael()}>開始年月（任意）</label>
          <input type="month" value={draft.period_start} onChange={(e) => set("period_start", e.target.value)}
            disabled={isSaving} style={aef()} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={ael()}>終了年月（任意）</label>
          <input type="month" value={draft.period_end} onChange={(e) => set("period_end", e.target.value)}
            disabled={isSaving} style={aef()} />
        </div>
      </div>
      <div>
        <label style={ael()}>詳細（任意）</label>
        <textarea value={draft.description} onChange={(e) => set("description", e.target.value)}
          placeholder="達成背景や取り組み内容など" maxLength={500} rows={3} disabled={isSaving}
          aria-label="実績の詳細"
          style={{ ...aef(), resize: "vertical", minHeight: 72 }} />
      </div>
      <ExperienceSelect value={draft.experience_id} onChange={(v) => set("experience_id", v)}
        options={experienceOptions} disabled={isSaving} />
      <AchieveFormActions isSaving={isSaving} justSaved={justSaved} canSave={canSave} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

/* ⚠️ `AchievementCard`（行の表示・34行）は 2026-08-16 に削除した。
      一覧・鉛筆・ゴミ箱は公開プロフィールと同じ部品が持つ。ここに描き直さないこと。 */

/**
 * 数値実績の**編集フォームだけ**（2026-08-16 / 2-4）。
 *
 * ⚠️ **行の表示をここに書かないこと。** 一覧・鉛筆・ゴミ箱・0件の1行は
 *    公開プロフィールと同じ `ProfileAchievementsSection` が持つ。
 * ⚠️ **職歴カードの入れ子をやめた。** 以前は「どの職歴の下で開いたか」で
 *    `experience_id` を決めていたが、独立セクションになったのでフォームの
 *    セレクト（`ExperienceSelect`）で選ぶ形にした。
 */
export function AchievementEditor({
  achievements, setAchievements, openAddNonce, openEditId, openDeleteId, onClosed, experienceOptions = [],
}: {
  achievements: Achievement[];
  setAchievements: React.Dispatch<React.SetStateAction<Achievement[]>>;
  /** 見出しの「追加」から追加フォームを開く合図 */
  openAddNonce?: number;
  /** 行の鉛筆から編集を開く行の id */
  openEditId?: string | null;
  /** 行のゴミ箱から削除確認を開く行の id */
  openDeleteId?: string | null;
  /** フォームが閉じたことを親へ知らせる。★親はこれでカードを表示モードへ戻す */
  onClosed?: () => void;
  /** 紐づけセレクトの選択肢（職歴） */
  experienceOptions?: ExperienceOption[];
}) {
  const scoped = achievements;
  /* ⚠️ `onClosed` を useCallback の依存に入れると呼び出し側の再生成で作り直される。ref に逃がす */
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<AchievementDraft>(EMPTY_ACH_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [addDraft,     setAddDraft]     = useState<AchievementDraft>(EMPTY_ACH_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Achievement | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");
  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant); setToastMsg(msg);
  }, []);

  /* ⚠️ 紐づけは**フォームのセレクト**から取る（2026-08-16 / 2-4）。
        以前は「どの職歴カードの下で開いたか」から決めていたが、独立セクションに
        なったので、その手がかりが無い。`""` は「紐づけない」＝ null。 */
  const makeBody = (d: AchievementDraft) => ({
    experience_id: d.experience_id || null,
    title: d.title.trim(),
    value: d.value !== "" && !isNaN(parseInt(d.value, 10)) ? parseInt(d.value, 10) : null,
    unit: d.unit.trim() || null,
    description: d.description.trim() || null,
    period_start: monthToDate(d.period_start),
    period_end: monthToDate(d.period_end),
  });

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/achievements/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(editDraft)),
      });
      if (!res.ok) throw new Error();
      const updated: Achievement = await res.json();
      setAchievements((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a)));
      showToast("実績を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null); setEditDraft(EMPTY_ACH_DRAFT);
      setEditJustSaved(false);
      onClosedRef.current?.();  // ★保存できたらカードごと表示モードへ（2-2/2-3 と同じ）
    } catch { showToast("保存に失敗しました。もう一度お試しください。", "error"); }
    finally { setEditSaving(false); }
  }, [editingId, editDraft, setAchievements, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/achievements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(addDraft)),
      });
      if (!res.ok) throw new Error();
      const inserted: Achievement = await res.json();
      setAchievements((prev) => [...prev, inserted]);
      showToast("実績を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false); setAddDraft(EMPTY_ACH_DRAFT);
      setAddJustSaved(false);
      onClosedRef.current?.();
    } catch { showToast("追加に失敗しました。もう一度お試しください。", "error"); }
    finally { setAddSaving(false); }
  }, [addDraft, setAchievements, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/achievements/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAchievements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null); showToast("実績を削除しました");
      onClosedRef.current?.();
    } catch { showToast("削除に失敗しました。もう一度お試しください。", "error"); }
    finally { setDeleting(false); }
  }, [deleteTarget, setAchievements, showToast]);

  /* ★外から開く（2026-08-16 / 2-4）。公開部品の鉛筆・ゴミ箱・見出しの「追加」が呼ぶ */
  /* ⚠️ **行の鉛筆・ゴミ箱から開いたときは追加フォームを出さない**（2026-08-16 / 2-5 で実測）。
        追加を1回でも使うと nonce が 0 でなくなるので、次にこのエディタが
        マウントされた瞬間（＝鉛筆やゴミ箱で開いたとき）に追加フォームまで開いてしまう。
        4つのエディタすべてが同じ形だったので同時に直した。 */
  useEffect(() => {
    if (openAddNonce && !openEditId && !openDeleteId) setAdding(true);
  }, [openAddNonce, openEditId, openDeleteId]);
  useEffect(() => {
    if (!openEditId) return;
    const t = achievements.find((a) => a.id === openEditId);
    if (t) { setEditingId(openEditId); setEditDraft(draftFromAch(t)); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditId]);
  useEffect(() => {
    if (!openDeleteId) return;
    const t = achievements.find((a) => a.id === openDeleteId);
    if (t) setDeleteTarget(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDeleteId]);

  return (
    <div style={{ marginTop: 0 }}>
      {/* ★編集フォームだけ。一覧・鉛筆・ゴミ箱・0件の1行は
             `ProfileAchievementsSection`（公開と共通）が持つ。ここに戻さないこと。 */}
      {scoped.filter((item) => editingId === item.id).map((item) => (
        <AchievementForm key={item.id} draft={editDraft} onDraftChange={setEditDraft} isSaving={editSaving} justSaved={editJustSaved}
          experienceOptions={experienceOptions}
          onSave={() => { void saveEdit(); }}
          onCancel={() => { setEditingId(null); setEditDraft(EMPTY_ACH_DRAFT); onClosedRef.current?.(); }} />
      ))}
      {adding && (
        <AchievementForm draft={addDraft} onDraftChange={setAddDraft} isSaving={addSaving} justSaved={addJustSaved}
          experienceOptions={experienceOptions}
          onSave={() => { void saveAdd(); }}
          onCancel={() => { setAdding(false); setAddDraft(EMPTY_ACH_DRAFT); onClosedRef.current?.(); }} />
      )}
      <ConfirmDialog isOpen={!!deleteTarget} title="実績を削除しますか？"
        message={deleteTarget ? `「${deleteTarget.title}」を削除します。この操作は取り消せません。` : ""}
        confirmLabel="削除する" confirmVariant="danger" isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }} onCancel={() => { setDeleteTarget(null); onClosedRef.current?.(); }} />
      {toastMsg && <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />}
    </div>
  );
}

// ─── AwardEditor ──────────────────────────────────────────────────────────────

type AwardDraft = { title: string; issuer: string; awarded_at: string; description: string; experience_id: string; };
const EMPTY_AWARD_DRAFT: AwardDraft = { title: "", issuer: "", awarded_at: "", description: "", experience_id: "" };
function draftFromAward(a: Award): AwardDraft {
  return { title: a.title, issuer: a.issuer ?? "", awarded_at: dateToMonth(a.awarded_at), description: a.description ?? "",
    experience_id: a.experience_id ?? "" };
}

function AwardForm({
  draft, onDraftChange, isSaving, justSaved, onSave, onCancel, experienceOptions = [],
}: { draft: AwardDraft; onDraftChange: (d: AwardDraft) => void; isSaving: boolean; justSaved?: boolean; onSave: () => void; onCancel: () => void; experienceOptions?: ExperienceOption[]; }) {
  const set = useCallback((k: keyof AwardDraft, v: string) => onDraftChange({ ...draft, [k]: v }), [draft, onDraftChange]);
  const canSave = !!draft.title.trim() && !isSaving;
  return (
    <div style={formBox}>
      <div>
        <label style={ael()}>受賞名 *</label>
        <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)}
          placeholder="例：社内MVP賞、〇〇業界アワード最優秀賞" maxLength={200} disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>授与機関（任意）</label>
        <input type="text" value={draft.issuer} onChange={(e) => set("issuer", e.target.value)}
          placeholder="例：株式会社○○、〇〇協会" maxLength={100} disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>受賞年月（任意）</label>
        <input type="month" value={draft.awarded_at} onChange={(e) => set("awarded_at", e.target.value)}
          disabled={isSaving} style={{ ...aef(), maxWidth: 180 }} />
      </div>
      <div>
        <label style={ael()}>詳細（任意）</label>
        <textarea value={draft.description} onChange={(e) => set("description", e.target.value)}
          placeholder="受賞の背景や内容など" maxLength={500} rows={3} disabled={isSaving}
          aria-label="受賞の詳細"
          style={{ ...aef(), resize: "vertical", minHeight: 72 }} />
      </div>
      <ExperienceSelect value={draft.experience_id} onChange={(v) => onDraftChange({ ...draft, experience_id: v })}
        options={experienceOptions} disabled={isSaving} />
      <AchieveFormActions isSaving={isSaving} justSaved={justSaved} canSave={canSave} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

/* ⚠️ `AwardCard`（行の表示・28行）は 2026-08-16 に削除した。
      一覧・鉛筆・ゴミ箱は公開プロフィールと同じ部品が持つ。ここに描き直さないこと。 */

/**
 * 受賞・表彰の**編集フォームだけ**（2026-08-16 / 2-4）。詳細は `AchievementEditor` と同じ。
 */
export function AwardEditor({
  awards, setAwards, openAddNonce, openEditId, openDeleteId, onClosed, experienceOptions = [],
}: {
  awards: Award[];
  setAwards: React.Dispatch<React.SetStateAction<Award[]>>;
  /** このエディタが担当する職歴。`null` は「その他」、`undefined` は全件（従来の形） */
  openAddNonce?: number;
  openEditId?: string | null;
  openDeleteId?: string | null;
  onClosed?: () => void;
  experienceOptions?: ExperienceOption[];
}) {
  const scoped = awards;
  /* ⚠️ ref に逃がす理由は AchievementEditor と同じ */
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<AwardDraft>(EMPTY_AWARD_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [addDraft,     setAddDraft]     = useState<AwardDraft>(EMPTY_AWARD_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Award | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");
  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant); setToastMsg(msg);
  }, []);

  const makeBody = (d: AwardDraft) => ({
    experience_id: d.experience_id || null,
    title: d.title.trim(), issuer: d.issuer.trim() || null,
    awarded_at: monthToDate(d.awarded_at), description: d.description.trim() || null,
  });

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/awards/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(editDraft)),
      });
      if (!res.ok) throw new Error();
      const updated: Award = await res.json();
      setAwards((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a)));
      showToast("受賞歴を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null); setEditDraft(EMPTY_AWARD_DRAFT); onClosedRef.current?.();
      setEditJustSaved(false);
    } catch { showToast("保存に失敗しました。もう一度お試しください。", "error"); }
    finally { setEditSaving(false); }
  }, [editingId, editDraft, setAwards, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/awards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(addDraft)),
      });
      if (!res.ok) throw new Error();
      const inserted: Award = await res.json();
      setAwards((prev) => [...prev, inserted]);
      showToast("受賞歴を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false); setAddDraft(EMPTY_AWARD_DRAFT); onClosedRef.current?.();
      setAddJustSaved(false);
    } catch { showToast("追加に失敗しました。もう一度お試しください。", "error"); }
    finally { setAddSaving(false); }
  }, [addDraft, setAwards, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/awards/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAwards((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null); showToast("受賞歴を削除しました"); onClosedRef.current?.();
    } catch { showToast("削除に失敗しました。もう一度お試しください。", "error"); }
    finally { setDeleting(false); }
  }, [deleteTarget, setAwards, showToast]);

  /* ★外から開く（2026-08-16 / 2-4） */
  /* ⚠️ **行の鉛筆・ゴミ箱から開いたときは追加フォームを出さない**（2026-08-16 / 2-5 で実測）。
        追加を1回でも使うと nonce が 0 でなくなるので、次にこのエディタが
        マウントされた瞬間（＝鉛筆やゴミ箱で開いたとき）に追加フォームまで開いてしまう。
        4つのエディタすべてが同じ形だったので同時に直した。 */
  useEffect(() => {
    if (openAddNonce && !openEditId && !openDeleteId) setAdding(true);
  }, [openAddNonce, openEditId, openDeleteId]);
  useEffect(() => {
    if (!openEditId) return;
    const t = awards.find((a) => a.id === openEditId);
    if (t) { setEditingId(openEditId); setEditDraft(draftFromAward(t)); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditId]);
  useEffect(() => {
    if (!openDeleteId) return;
    const t = awards.find((a) => a.id === openDeleteId);
    if (t) setDeleteTarget(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDeleteId]);

  return (
    <div style={{ marginTop: 0 }}>
      {/* ★編集フォームだけ。一覧・鉛筆・ゴミ箱・0件の1行は `ProfileAwardsSection` が持つ */}
      {scoped.filter((item) => editingId === item.id).map((item) => (
        <AwardForm key={item.id} draft={editDraft} onDraftChange={setEditDraft} isSaving={editSaving} justSaved={editJustSaved}
          experienceOptions={experienceOptions}
          onSave={() => { void saveEdit(); }}
          onCancel={() => { setEditingId(null); setEditDraft(EMPTY_AWARD_DRAFT); onClosedRef.current?.(); }} />
      ))}
      {adding && (
        <AwardForm draft={addDraft} onDraftChange={setAddDraft} isSaving={addSaving} justSaved={addJustSaved}
          experienceOptions={experienceOptions}
          onSave={() => { void saveAdd(); }}
          onCancel={() => { setAdding(false); setAddDraft(EMPTY_AWARD_DRAFT); onClosedRef.current?.(); }} />
      )}
      <ConfirmDialog isOpen={!!deleteTarget} title="受賞歴を削除しますか？"
        message={deleteTarget ? `「${deleteTarget.title}」を削除します。この操作は取り消せません。` : ""}
        confirmLabel="削除する" confirmVariant="danger" isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }} onCancel={() => { setDeleteTarget(null); onClosedRef.current?.(); }} />
      {toastMsg && <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />}
    </div>
  );
}

// ─── MediaAppearanceEditor ────────────────────────────────────────────────────

type MediaAppearanceDraft = {
  title: string; media_name: string; url: string;
  thumbnail_url: string; appeared_at: string; description: string;
};
const EMPTY_MA_DRAFT: MediaAppearanceDraft = {
  title: "", media_name: "", url: "", thumbnail_url: "", appeared_at: "", description: "",
};
function draftFromMA(m: MediaAppearance): MediaAppearanceDraft {
  return {
    title: m.title, media_name: m.media_name ?? "", url: m.url ?? "",
    thumbnail_url: m.thumbnail_url ?? "", appeared_at: dateToMonth(m.appeared_at),
    description: m.description ?? "",
  };
}

function MediaAppearanceForm({
  draft, onDraftChange, isSaving, justSaved, onSave, onCancel,
}: { draft: MediaAppearanceDraft; onDraftChange: (d: MediaAppearanceDraft) => void; isSaving: boolean; justSaved?: boolean; onSave: () => void; onCancel: () => void; }) {
  const set = useCallback((k: keyof MediaAppearanceDraft, v: string) => onDraftChange({ ...draft, [k]: v }), [draft, onDraftChange]);
  const canSave = !!draft.title.trim() && !isSaving;
  return (
    <div style={formBox}>
      <div>
        <label style={ael()}>掲載タイトル *</label>
        <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)}
          placeholder="例：○○CEOインタビュー「SaaSの未来」" maxLength={200} disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>媒体名（任意）</label>
        <input type="text" value={draft.media_name} onChange={(e) => set("media_name", e.target.value)}
          placeholder="例：Forbes Japan、日経ビジネス" maxLength={100} disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>掲載年月（任意）</label>
        <input type="month" value={draft.appeared_at} onChange={(e) => set("appeared_at", e.target.value)}
          disabled={isSaving} style={{ ...aef(), maxWidth: 180 }} />
      </div>
      <div>
        <label style={ael()}>URL（任意）</label>
        <input type="url" value={draft.url} onChange={(e) => set("url", e.target.value)}
          placeholder="https://..." disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>サムネイル URL（任意）</label>
        <input type="url" value={draft.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)}
          placeholder="https://..." disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>詳細（任意）</label>
        <textarea value={draft.description} onChange={(e) => set("description", e.target.value)}
          placeholder="掲載の背景や内容など" maxLength={500} rows={3} disabled={isSaving}
          aria-label="メディア掲載の詳細"
          style={{ ...aef(), resize: "vertical", minHeight: 72 }} />
      </div>
      <AchieveFormActions isSaving={isSaving} justSaved={justSaved} canSave={canSave} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

/* ⚠️ `MediaAppearanceCard`（行の表示・約30行）は 2026-08-16 に削除した。
      一覧・鉛筆・ゴミ箱は公開プロフィールと同じ `ProfileMediaSection` が持つ。
      ここに描き直さないこと。 */

export function MediaAppearanceEditor({
  mediaAppearances, setMediaAppearances, hideHeading = false, openAddNonce, openEditId, openDeleteId, onClosed,
}: {
  /** ★カードの見出しの「＋」から追加フォームを開く合図（2026-08-16） */
  openAddNonce?: number;
  mediaAppearances: MediaAppearance[];
  setMediaAppearances: React.Dispatch<React.SetStateAction<MediaAppearance[]>>;
  /** ★見出しを描かない。`EditableSection` が描くときに true（2026-08-16） */
  hideHeading?: boolean;
  /** ★外（公開部品の行の鉛筆）から編集を開く行の id。`null` で開かない（2026-08-16 / 2-3） */
  openEditId?: string | null;
  /** ★外（公開部品の行のゴミ箱）から削除確認を開く行の id */
  openDeleteId?: string | null;
  /** フォームが閉じたことを親へ知らせる。★親はこれでカードを表示モードへ戻す */
  onClosed?: () => void;
}) {
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<MediaAppearanceDraft>(EMPTY_MA_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  const [adding,       setAdding]       = useState(false);
  /* ⚠️ `onClosed` を useCallback の依存に入れると呼び出し側の再生成で毎回作り直される。
        ref に逃がす（挙動は変えない）。 */
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  /* 見出しの「＋」から開く合図。★初回マウント時（undefined / 0）は開かない */
  /* ⚠️ **行の鉛筆・ゴミ箱から開いたときは追加フォームを出さない**（2026-08-16 / 2-5 で実測）。
        追加を1回でも使うと nonce が 0 でなくなるので、次にこのエディタが
        マウントされた瞬間（＝鉛筆やゴミ箱で開いたとき）に追加フォームまで開いてしまう。
        4つのエディタすべてが同じ形だったので同時に直した。 */
  useEffect(() => {
    if (openAddNonce && !openEditId && !openDeleteId) setAdding(true);
  }, [openAddNonce, openEditId, openDeleteId]);
  /* ★外から行の編集を開く（2026-08-16 / 2-3）。公開部品の行の鉛筆が呼ぶ。
     ⚠️ 値が変わるたびに開く。閉じるのは `null` を渡すのではなく、
        フォーム側のキャンセル・保存（`onClosed` で親へ通知）。 */
  useEffect(() => {
    if (!openEditId) return;
    const target = mediaAppearances.find((m) => m.id === openEditId);
    if (!target) return;
    setEditingId(openEditId);
    setEditDraft(draftFromMA(target));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditId]);
  /* ★外から削除確認を開く。⚠️ 確認ダイアログはこのエディタが持っているので、
        表示側は id を渡すだけにする（同じダイアログを2つ作らない）。 */
  useEffect(() => {
    if (!openDeleteId) return;
    const target = mediaAppearances.find((m) => m.id === openDeleteId);
    if (target) setDeleteTarget(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDeleteId]);
  const [addDraft,     setAddDraft]     = useState<MediaAppearanceDraft>(EMPTY_MA_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAppearance | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");
  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant); setToastMsg(msg);
  }, []);

  const makeBody = (d: MediaAppearanceDraft) => ({
    title: d.title.trim(), media_name: d.media_name.trim() || null,
    url: d.url.trim() || null, thumbnail_url: d.thumbnail_url.trim() || null,
    appeared_at: monthToDate(d.appeared_at), description: d.description.trim() || null,
  });

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/media-appearances/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(editDraft)),
      });
      if (!res.ok) throw new Error();
      const updated: MediaAppearance = await res.json();
      setMediaAppearances((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...updated } : m)));
      showToast("メディア掲載を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null); setEditDraft(EMPTY_MA_DRAFT);
      setEditJustSaved(false);
      /* ★保存できたらカードごと表示モードへ戻す（2026-08-16 / 2-3）。
            戻さないと編集モードの枠が残り、**直した行が画面から消えたように見える**
            （2-2 の発信コンテンツで踏んだのと同じ形）。 */
      onClosedRef.current?.();
    } catch { showToast("保存に失敗しました。もう一度お試しください。", "error"); }
    finally { setEditSaving(false); }
  }, [editingId, editDraft, setMediaAppearances, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/media-appearances", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(addDraft)),
      });
      if (!res.ok) throw new Error();
      const inserted: MediaAppearance = await res.json();
      setMediaAppearances((prev) => [...prev, inserted]);
      showToast("メディア掲載を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false); setAddDraft(EMPTY_MA_DRAFT);
      setAddJustSaved(false);
      /* ★追加も同じ。1件足したら一覧（表示モード）に戻して結果を見せる。
            ⚠️ 発信コンテンツは「続けて足せる」ために閉じない作りだが、
               こちらは元から1件ずつ追加する形なので閉じる方に揃える。 */
      onClosedRef.current?.();
    } catch { showToast("追加に失敗しました。もう一度お試しください。", "error"); }
    finally { setAddSaving(false); }
  }, [addDraft, setMediaAppearances, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/media-appearances/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMediaAppearances((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null); showToast("メディア掲載を削除しました");
      onClosedRef.current?.();
    } catch { showToast("削除に失敗しました。もう一度お試しください。", "error"); }
    finally { setDeleting(false); }
  }, [deleteTarget, setMediaAppearances, showToast]);

  return (
    <div style={{ marginTop: hideHeading ? 0 : 36 }}>
      {/* ⚠️ hideHeading のときは EditableSection が同じ見出しを描く。二重にしない */}
      {!hideHeading && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>メディア掲載</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
            取材・インタビュー・記事掲載・登壇などを登録できます。
          </div>
        </>
      )}
      {/* ★行の一覧はここでは描かない（2026-08-16 / 2-3）。
             一覧・鉛筆・ゴミ箱は公開プロフィールと同じ `ProfileMediaSection` が持つ。
             ここは**編集フォームだけ**。ここに一覧を戻さないと、
             同じ見た目が2箇所に生まれる。 */}
      {mediaAppearances.filter((item) => editingId === item.id).map((item) => (
        <div key={item.id}>
          <MediaAppearanceForm draft={editDraft} onDraftChange={setEditDraft} isSaving={editSaving} justSaved={editJustSaved}
            onSave={() => { void saveEdit(); }} onCancel={() => { setEditingId(null); setEditDraft(EMPTY_MA_DRAFT); onClosed?.(); }} />
        </div>
      ))}
      {/* ⚠️ 0件の1行（「まだメディア掲載を登録していません」）も公開部品側に移した。
             ここに戻すと表示モードと編集モードで二重になる。 */}
      {adding && (
        <div style={{ marginTop: mediaAppearances.length > 0 ? 12 : 0 }}>
          <MediaAppearanceForm draft={addDraft} onDraftChange={setAddDraft} isSaving={addSaving} justSaved={addJustSaved}
            onSave={() => { void saveAdd(); }} onCancel={() => { setAdding(false); setAddDraft(EMPTY_MA_DRAFT); onClosedRef.current?.(); }} />
        </div>
      )}
      {/* ⚠️ 0件のときは出さない（理由は学歴と同じ） */}
      {/* ⚠️ 「＋ メディア掲載を追加」はここから外した（2026-08-16 / 2-3）。
             追加の入口は**公開部品の見出し行の「追加」1つ**にする。
             編集モードにこのボタンを残すと、入口が2つになる（ルール⑧）。 */}
      <ConfirmDialog isOpen={!!deleteTarget} title="メディア掲載を削除しますか？"
        message={deleteTarget ? `「${deleteTarget.title}」を削除します。この操作は取り消せません。` : ""}
        confirmLabel="削除する" confirmVariant="danger" isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }} onCancel={() => { setDeleteTarget(null); onClosedRef.current?.(); }} />
      {toastMsg && <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export type RoleItem = {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
};

