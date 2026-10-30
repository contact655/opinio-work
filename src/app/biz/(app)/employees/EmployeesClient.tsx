"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MEMBER_REPORT_REASONS, MEMBER_REPORT_NOTE_MAX, type MemberReportReason } from "@/lib/constants/memberReports";
import { SPLIT_MIN_WIDTH } from "@/lib/constants/splitView";
import { CandidateProfilePanel } from "@/components/candidates/CandidateProfilePanel";
import { FilterChip } from "@/components/common/FilterChip";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import type { BizEmployee } from "./page";

/**
 * ★社員・OB/OG（/biz/employees）。2026-10-12 に左右2画面にした（柴さんの指示）。
 *   1280px 以上 … 左に一覧（1人1行）、右に選んだ人の詳細。最初の1人を自動で選ぶ
 *   1279px 以下 … 一覧 → 押すと全幅の詳細（「一覧に戻る」）
 *
 * ── 守ること ────────────────────────────────────────────────────────────
 * ⚠️★右の詳細のプロフィールは `CandidateProfilePanel`（候補者を探す・メッセージと同じ部品）。
 *    中身は /u/[id] と同じ関数（UserProfileContent）で描き、**見せてよい範囲の判定も同じ1か所**。
 *    この画面のために取得の経路を足さないこと。
 * ⚠️ 一覧に出す人の条件は page.tsx（企業ページの `getCompanyEmployees` と同じ条件）。ここで足さない・削らない。
 * ⚠️ 状態はバッジにしない（灰色の文字）。⚠️「話を聞ける」の表示は 2026-10-16 に撤去した（面談OKの撤去）。
 * ⚠️ 選択は URL に残す（tab / dept / q / id）。`history.replaceState`（履歴を積まない。一覧を取り直さない）。
 * ⚠️ 企業から追加・削除はできない。在籍していない人は運営に報告する（報告の API・語彙は従来どおり）。
 */

type Tab = "current" | "alumni";

type Props = {
  current: BizEmployee[];
  alumni: BizEmployee[];
  /** 運営が企業ページから外した経歴 */
  hiddenExperienceIds: string[];
  /** 運営に報告済み（未対応）の経歴 */
  reportedExperienceIds: string[];
  /** 直近の対応が「却下」だった経歴と、運営が残した理由 */
  rejectedExperiences: { experienceId: string; note: string | null }[];
  companyName: string;
  companyId: string;
  /** ★部門・職種の設定の順（部門名）。一覧を部門ごとに並べる（2026-10-12） */
  deptOrder?: string[];
  /** ★会社の招待リンク（https://opinio.jp/join/<slug>）。案内文に入れる */
  joinUrl?: string;
  initialTab: Tab;
  initialDept: string;
  initialQuery: string;
  initialSelectedId: string | null;
  /** ⚠️ /dev/preview 用。false ならプロフィール欄を描かない（サーバーで DB を読む経路を preview から通さない） */
  renderProfile?: boolean;
};

/** 「2019年4月〜」／「2015年4月〜2019年3月」 */
function periodText(e: BizEmployee): string {
  const ym = (iso: string | null) => {
    if (!iso) return "";
    const [y, m] = iso.slice(0, 7).split("-");
    return `${y}年${Number(m)}月`;
  };
  return e.isCurrent ? `${ym(e.startedAt)}〜` : `${ym(e.startedAt)}〜${ym(e.endedAt)}`;
}

/** 「部門 › 職種」。職種は職種マスタの名前、無ければ本人の社内での呼び方。どちらも無ければ部門だけ */
function orgLine(e: BizEmployee): string {
  const role = e.roleName || e.roleTitle || "";
  if (e.departmentName && role) return `${e.departmentName} › ${role}`;
  return e.departmentName || role;
}

/** 入社年（現役）または在籍期間（OB・OG） */
function yearText(e: BizEmployee): string {
  return e.isCurrent ? `${e.startedAt.slice(0, 4)}年入社` : periodText(e);
}

/** ★社員に送る案内文。⚠️ 文面を変えるときは報告にも載せる。
 *  ★2026-10-12: URL を会社の招待リンク（/join/<slug>）にした。開くと「お勤め先」にこの会社が入った状態で始まる */
function inviteText(companyName: string, joinUrl = "https://opinio.jp/auth?mode=signup"): string {
  return [
    `OPINIO（オピニオ）に、${companyName}の社員として経歴を登録していただけませんか。`,
    "",
    "1. 次のURLから無料で登録します（3分ほど）",
    `   ${joinUrl}`,
    `2. 経歴の「お勤め先」に「${companyName}」が入っていることを確かめて保存します`,
    "",
    /* ★2026-10-18（）: 「見えるのは OPINIO にログインしている人だけです」と
          「表示したくない場合は…非表示にできます」を外した。新規登録の初期値を「公開」にし、
          「非公開」も選べなくなる（非公開の廃止と同じ改定）ため、どちらも事実でなくなる */
    `登録すると、${companyName}の企業ページに社員として表示されます。`,
  ].join("\n");
}

// ── 報告（在籍していない場合）────────────────────────────────────────────────

function ReportBox({ emp, reported, rejectedNote, isPending, onReport }: {
  emp: BizEmployee;
  reported: boolean;
  /** 直近の対応が「却下」なら理由（理由なしは null）。却下でなければ undefined */
  rejectedNote?: string | null;
  isPending: boolean;
  onReport: (experienceId: string, reason: MemberReportReason, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<MemberReportReason | "">("");
  const [note, setNote] = useState("");

  /* ⚠️ `data-state` は検証で状態を読むための属性（文言の部分一致で判定しない）。装飾に使わない */
  if (reported) {
    return <div data-state="reported" style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 6 }}>運営に報告済み（確認中）</div>;
  }
  return (
    <div data-state={rejectedNote !== undefined ? "rejected" : "reportable"} style={{ marginTop: 6 }}>
      {rejectedNote !== undefined && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 6 }}>
          運営で確認しましたが、企業ページからは外していません。
          {rejectedNote && <div style={{ marginTop: 4, padding: "6px 10px", background: "var(--bg-tint)", borderRadius: 6, whiteSpace: "pre-wrap" }}>{rejectedNote}</div>}
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} data-state="report-link"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "var(--ink-soft)", textDecoration: "underline" }}>
        {open ? "閉じる" : "在籍していない場合は運営に報告"}
      </button>
      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            運営に報告します。<strong style={{ color: "var(--ink)" }}>この操作で企業ページからすぐに消えるわけではありません。</strong>
            運営が確認のうえ判断します。本人のプロフィールは変わりません。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* OB・OG には「すでに退職している」を出さない（もう退職済みとして出ているため） */}
            {MEMBER_REPORT_REASONS.filter((r) => emp.isCurrent || r.value !== "left").map((r) => (
              <label key={r.value} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--ink)", cursor: "pointer" }}>
                <input type="radio" name={`report-reason-${emp.experienceId}`} checked={reason === r.value} onChange={() => setReason(r.value)} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{r.label}<span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)" }}>{r.desc}</span></span>
              </label>
            ))}
          </div>
          <div>
            <label htmlFor={`report-note-${emp.experienceId}`} style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>
              補足（任意・{MEMBER_REPORT_NOTE_MAX}文字まで）
            </label>
            <textarea id={`report-note-${emp.experienceId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={MEMBER_REPORT_NOTE_MAX} rows={2}
              placeholder="例: 2024年3月に退職しています／同姓同名の別の方のようです"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 12, fontFamily: "inherit", border: "1px solid var(--line)", borderRadius: 6, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={isPending || reason === ""}
              onClick={() => { if (reason !== "") { onReport(emp.experienceId, reason, note); setOpen(false); } }}
              style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", border: "none", borderRadius: 6,
                background: reason === "" ? "var(--line-soft)" : "var(--royal)", color: reason === "" ? "var(--ink-mute)" : "#fff",
                cursor: reason === "" ? "not-allowed" : "pointer" }}>
              {isPending ? "送信中..." : "報告する"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              style={{ fontSize: 12, padding: "6px 12px", background: "none", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer" }}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 本体 ────────────────────────────────────────────────────────────────────

export function EmployeesClient({
  current, alumni, hiddenExperienceIds, reportedExperienceIds, rejectedExperiences, companyName,
  deptOrder = [], joinUrl, initialTab, initialDept, initialQuery, initialSelectedId, renderProfile = true,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dept, setDept] = useState(initialDept);
  const [query, setQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justReported, setJustReported] = useState<string[]>([]);

  const hiddenIds = useMemo(() => new Set(hiddenExperienceIds), [hiddenExperienceIds]);
  const reportedIds = useMemo(() => new Set([...reportedExperienceIds, ...justReported]), [reportedExperienceIds, justReported]);
  /* `has` で却下か、値の null で理由なしの却下か */
  const rejectedMap = useMemo(() => new Map(rejectedExperiences.map((r) => [r.experienceId, r.note])), [rejectedExperiences]);

  /* ★幅。⚠️ しきい値は lib/constants/splitView.ts（/companies・/jobs・/biz/candidates と同じ 1280px）。下の @media と手で合わせている */
  const [isWide, setIsWide] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${SPLIT_MIN_WIDTH}px)`);
    const on = () => setIsWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const base = tab === "current" ? current : alumni;
  /* ★部門の選択肢は、いまのタブにいる人の部門だけ */
  const deptOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of base) if (e.departmentName) set.add(e.departmentName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ja")).map((v) => ({ value: v, label: v }));
  }, [base]);
  const activeDept = deptOptions.some((d) => d.value === dept) ? dept : "";
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((e) => (!activeDept || e.departmentName === activeDept) && (!q || (e.name ?? "").toLowerCase().includes(q)));
  }, [base, activeDept, query]);

  /* ★部門ごとの見出しで並べる（2026-10-12）。部門・職種の設定の順 → 設定に無い部門名（五十音）→ 最後に「部門なし」 */
  const groups = useMemo(() => {
    const order = new Map(deptOrder.map((n, i) => [n, i]));
    const map = new Map<string, BizEmployee[]>();
    for (const e of list) {
      const k = e.departmentName ?? "";
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (!a) return 1; if (!b) return -1;
      const ia = order.get(a) ?? Infinity, ib = order.get(b) ?? Infinity;
      return ia !== ib ? ia - ib : a.localeCompare(b, "ja");
    });
    return keys.map((k) => ({ dept: k || null, people: map.get(k)! }));
  }, [list, deptOrder]);
  /* 一覧の上の1行（いまのタブ全員で数える。絞り込み・検索に関係なく） */
  const summary = useMemo(() => {
    const order = new Map(deptOrder.map((n, i) => [n, i]));
    const map = new Map<string, { n: number }>();
    for (const e of base) {
      const k = e.departmentName ?? "部門なし";
      const v = map.get(k) ?? { n: 0 };
      v.n++;
      map.set(k, v);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "部門なし") return 1; if (b === "部門なし") return -1;
      const ia = order.get(a) ?? Infinity, ib = order.get(b) ?? Infinity;
      return ia !== ib ? ia - ib : a.localeCompare(b, "ja");
    });
  }, [base, deptOrder]);
  /* 一覧の並び（部門ごと）に合わせた順 */
  const ordered = useMemo(() => groups.flatMap((g) => g.people), [groups]);

  /* ★右に出す人。明示的に選んだ人（いまの一覧にいれば）→ 無ければ 1280px 以上で先頭の人 */
  const explicit = selectedId ? list.find((e) => e.experienceId === selectedId) ?? null : null;
  const shown = explicit ?? (isWide ? ordered[0] ?? null : null);

  /* ★選択を URL に残す。⚠️ router.replace にしない（一覧を取り直すため） */
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const set = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
      set("tab", tab === "alumni" ? "alumni" : null);
      set("dept", activeDept || null);
      set("q", query.trim() || null);
      set("id", explicit?.experienceId ?? null);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch { /* URL を書けなくても表示は続ける */ }
  }, [tab, activeDept, query, explicit]);

  const handleReport = useCallback((experienceId: string, reason: MemberReportReason, note: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/biz/member-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId, reason, note }),
      });
      /* ⚠️ res.ok を見てから「報告済み」にする */
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "報告を記録できませんでした。時間をおいて試してください。");
        return;
      }
      setJustReported((prev) => [...prev, experienceId]);
      router.refresh();
    });
  }, [router]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteText(companyName, joinUrl));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("コピーできませんでした。ブラウザの設定をご確認ください。");
    }
  }

  const total = current.length + alumni.length;
  const narrowDetail = isWide === false && !!explicit;

  /** 企業ページでの見え方（灰色の文字） */
  const visibilityText = (e: BizEmployee) =>
    hiddenIds.has(e.experienceId) ? "企業ページには表示されていません"
    : "企業ページに表示されています";

  const segBtn = (key: Tab, label: string, n: number) => (
    <button key={key} type="button" role="tab" aria-selected={tab === key} data-tab={key} className="btn-fixed-size"
      onClick={() => { setTab(key); setSelectedId(null); }}
      style={{ height: 32, padding: "0 12px", border: "none", borderRadius: 7, fontFamily: "inherit", fontSize: 13, cursor: "pointer",
        fontWeight: tab === key ? 700 : 500, background: tab === key ? "#fff" : "transparent", color: tab === key ? "var(--ink)" : "var(--ink-soft)",
        boxShadow: tab === key ? "0 1px 2px rgba(15,23,42,0.12)" : "none" }}>
      {label} <span style={{ color: "var(--ink-mute)", fontWeight: 600 }}>{n}</span>
    </button>
  );

  return (
    <div className="emp-wrap">
      {/* ── 上部 ── */}
      {!narrowDetail && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>社員・OB/OG</h1>
          <span style={{ position: "relative" }}>
            <button type="button" aria-label="この画面について" aria-expanded={showInfo} onClick={() => setShowInfo((v) => !v)} className="btn-fixed-size"
              style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--line)", background: "#fff", color: "var(--ink-mute)", fontSize: 12, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>i</button>
            {showInfo && (
              <div role="note" data-state="employees-info" style={{ position: "absolute", top: 28, left: 0, zIndex: 30, width: 340, padding: "12px 14px", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                本人がプロフィールの経歴で{companyName}を選ぶと、自動でここと企業ページに表示されます。
                <strong style={{ color: "var(--ink)" }}>企業から追加・削除することはできません。</strong>
                在籍していない人が出ている場合は、その人の詳細から運営に報告してください。
              </div>
            )}
          </span>
          <div style={{ flex: 1 }} />
          <div role="tablist" aria-label="現役・OB・OG" style={{ display: "inline-flex", gap: 2, padding: 2, background: "var(--line-soft)", borderRadius: 9 }}>
            {segBtn("current", "現役", current.length)}
            {segBtn("alumni", "OB・OG", alumni.length)}
          </div>
          {deptOptions.length > 0 && (
            <FilterChip label="部門" value={activeDept} options={deptOptions}
              onSelect={(v) => { setDept(v ?? ""); setSelectedId(null); }}
              isOpen={openChip === "dept"} onToggle={() => setOpenChip(openChip === "dept" ? null : "dept")} />
          )}
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }} placeholder="名前で検索" aria-label="名前で検索"
            style={{ width: 180, height: 34, boxSizing: "border-box", padding: "0 12px", border: "1px solid var(--line)", borderRadius: 999, fontFamily: "inherit", fontSize: 13, background: "#fff", outline: "none" }} />
        </div>
      )}

      {!narrowDetail && base.length > 0 && (
        <div data-state="employees-summary" style={{ marginBottom: 12, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>{tab === "current" ? "現役" : "OB・OG"} {base.length}名</span>
          {"　"}
          {summary.map(([k, v], i) => (
            <span key={k}>{i > 0 && "・"}{k} {v.n}</span>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", background: "var(--error-soft)", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "var(--error-ink)" }}>{error}</div>
      )}

      {total === 0 ? (
        /* ★0人のとき（2026-10-12）。案内文をコピーして社員に渡せる */
        <div data-state="employees-empty" style={{ padding: "36px 28px", background: "#fff", border: "1px solid var(--line)", borderRadius: 14, maxWidth: 640 }}>
          <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--ink)", lineHeight: 1.9 }}>
            社員に OPINIO へ登録し、経歴にこの会社を選んでもらうと、ここと企業ページに表示されます。
          </p>
          <button type="button" onClick={copyInvite} data-state="copy-invite" className="btn-fixed-size"
            style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>
            {copied ? "コピーしました" : "社員に送る案内文をコピー"}
          </button>
          <pre style={{ margin: "14px 0 0", padding: "12px 14px", background: "var(--bg-tint)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, color: "var(--ink-soft)", whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{inviteText(companyName, joinUrl)}</pre>
        </div>
      ) : (
        <div className="emp-split">
          {/* ── 左: 一覧（1人1行）── */}
          {!narrowDetail && (
            <section aria-label={tab === "current" ? "現役社員" : "OB・OG"} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, minWidth: 0 }}>
              {list.length === 0 ? (
                <p style={{ margin: 0, padding: "28px 20px", fontSize: 13, color: "var(--ink-mute)" }}>
                  {base.length === 0 ? (tab === "current" ? "現役社員の登録はまだありません。" : "OB・OG の登録はまだありません。") : "条件に合う人はいません。"}
                </p>
              ) : groups.map((g, gi) => (
                <div key={g.dept ?? "__none__"} data-dept-group={g.dept ?? "部門なし"}>
                  <div style={{ padding: "10px 16px 6px", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", background: "var(--bg-tint)",
                    borderTop: gi === 0 ? "none" : "1px solid var(--line-soft)", borderRadius: gi === 0 ? "12px 12px 0 0" : 0 }}>
                    {g.dept ?? "部門なし"}（{g.people.length}）
                  </div>
                  {g.people.map((e) => {
                    const active = shown?.experienceId === e.experienceId;
                    return (
                      <div key={e.experienceId} role="button" tabIndex={0} data-item="employee" data-state={active ? "selected" : "idle"}
                        onClick={() => setSelectedId(e.experienceId)}
                        onKeyDown={(ev) => { if (ev.target === ev.currentTarget && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); setSelectedId(e.experienceId); } }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderTop: "1px solid var(--line-soft)",
                          background: active ? "var(--royal-50)" : "#fff", cursor: "pointer", minWidth: 0 }}>
                        <PersonAvatar name={e.name} url={e.avatarUrl} size={32} fontSize={13} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                            {/* ★名前を押すとプロフィール（/u/[id]）を新しいタブで開く。行を押すと右に詳細 */}
                            <a href={`/u/${e.userId}`} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()} data-state="employee-name-link"
                              style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.name ?? "名前未設定"}
                            </a>
                          </div>
                          <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={[orgLine(e), yearText(e)].filter(Boolean).join(" ・ ")}>
                            {[orgLine(e), yearText(e)].filter(Boolean).join(" ・ ")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
          )}

          {/* ── 右: 詳細 ── */}
          <aside className="emp-pane" data-open={narrowDetail ? "true" : "false"} aria-label="選んだ人の詳細">
            {narrowDetail && (
              <button type="button" onClick={() => setSelectedId(null)}
                style={{ display: "block", margin: "12px 16px 0", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--royal)" }}>
                ← 一覧に戻る
              </button>
            )}
            {shown ? (
              <div style={{ flex: 1, minHeight: 0 }}>
              {!renderProfile ? (
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{shown.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 4 }}>{[orgLine(shown), periodText(shown)].filter(Boolean).join(" ・ ")}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 6 }}>{visibilityText(shown)}</div>
                  <p style={{ fontSize: 12, color: "var(--ink-mute)" }}>（プレビューではプロフィール欄を描きません）</p>
                </div>
              ) : (
              <CandidateProfilePanel
                key={shown.experienceId}
                userId={shown.userId}
                name={shown.name ?? "名前未設定"}
                avatarUrl={shown.avatarUrl}
                headerRight={
                  <a href={`/u/${shown.userId}`} target="_blank" rel="noopener noreferrer" data-state="open-profile"
                    style={{ flexShrink: 0, alignSelf: "flex-start", height: 30, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textDecoration: "none", whiteSpace: "nowrap" }}>
                    プロフィールを見る ↗
                  </a>
                }
                meta={[orgLine(shown), periodText(shown)].filter(Boolean).join(" ・ ")}
                headerExtra={
                  <div style={{ marginTop: 6 }}>
                    <div data-state="employee-visibility" style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>{visibilityText(shown)}</div>
                    {/* ⚠️ 運営が外した人には報告を出さない（もう外れている） */}
                    {!hiddenIds.has(shown.experienceId) && (
                      <ReportBox emp={shown} isPending={isPending} onReport={handleReport}
                        reported={reportedIds.has(shown.experienceId)}
                        rejectedNote={rejectedMap.has(shown.experienceId) ? rejectedMap.get(shown.experienceId) ?? null : undefined} />
                    )}
                    {hiddenIds.has(shown.experienceId) && (
                      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>
                        戻すには <Link href="/business/contact" style={{ color: "var(--royal)", fontWeight: 600 }}>お問い合わせ</Link> ください。
                      </div>
                    )}
                  </div>
                }
                /* ⚠️ ✕ は出さない。1280px 以上は常に誰かを出し、1279px 以下は「一覧に戻る」で戻る */
              />
              )}
              </div>
            ) : isWide ? (
              <p style={{ margin: 0, padding: "28px 20px", fontSize: 13, color: "var(--ink-mute)" }}>一覧から選ぶと、ここにプロフィールが表示されます。</p>
            ) : null}
          </aside>
        </div>
      )}

      {/* ⚠️ style タグの中に不等号・バッククォートを書かない（ハイドレーションが壊れる） */}
      <style>{`
        .emp-wrap { max-width: 1400px; }
        .emp-pane { display: none; }
        .emp-pane[data-open=true] { display: flex; flex-direction: column; height: calc(100vh - var(--biz-header-h) - 32px); background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
        @media (min-width: 1280px) {
          .emp-split { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 16px; align-items: start; }
          .emp-pane { display: flex; flex-direction: column; position: sticky; top: calc(var(--biz-header-h) + 16px); height: calc(100vh - var(--biz-header-h) - 32px); overflow: hidden; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
        }
      `}</style>
    </div>
  );
}
