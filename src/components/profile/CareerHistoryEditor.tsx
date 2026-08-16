"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EMPLOYMENT_TYPES, RANKS } from "@/lib/constants/careerOptions";
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";
import {
  JOIN_REASONS,
  LEAVE_REASONS,
  GAP_AXES,
  GAP_RATINGS,
} from "@/lib/constants/careerReasons";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import Image from "next/image";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import StoryAccordion from "./StoryAccordion";
import { formatEmployeeCount } from "@/lib/utils/employeeCount";


// ── Types ─────────────────────────────────────────────────────────────────────

export type Stint = {
  id: string;
  displayCompanyName: string;
  companyType: "master" | "custom" | "anon";
  companyId?: string;
  companyText?: string;
  companyAnonymized?: string;
  roleCategoryId: string;
  roleLabel: string;
  roleTitle?: string;
  department?: string;
  startedAt: string;   // YYYY-MM
  endedAt?: string;    // YYYY-MM
  isCurrent: boolean;
  description?: string;
  joinReason?: string;
  rank?: "none" | "leader" | "manager" | "general_manager" | "executive" | null;
  employmentType?: string;
  salaryBase?: number | null;
  salaryBonus?: number | null;
  salaryStock?: number | null;
  salaryMan?: number | null;
  /*
    ⚠️ 公開設定3列は **必須**（optional にしない）。
       PUT が無条件に上書きする列なので、取得元が拾い忘れると
       `?? "real"` / `?? true` で既定値に化け、
       「会社名を含めない」「入社理由を公開しない」を選んだ人の設定が
       別項目を直して保存しただけで**公開側へ反転する**。
       2026-08-12 まで実際にその状態で、実データ8行が該当していた。
       必須にしておけば、取得元が足し忘れた時点でビルドが落ちる。
    ⚠️ DB 側も NOT NULL（既定 'real' / 'real' / true）なので、
       値が無い状態は「取得漏れ」以外にありえない。
  */
  visibilityCompany: "real" | "masked" | "hidden";
  visibilityCompanyProfile: "real" | "masked" | "hidden";
  visibilityReason: boolean;
  /* ⚠️ visibility_salary は optional のまま。PUT が `"visibility_salary" in body` の
        ときだけ書き、エディタは送らないので往復の対象外（年収UIは 2026-08-06 に撤去）。 */
  visibilitySalary?: boolean;
  // ── 勤務地（表示する）
  prefecture?: string;
  remoteWorkStatus?: string;
  /* ── 理由データ（**非公開**。本人と集計のみ）
        ⚠️ 公開向けの型・クエリには絶対に入れないこと。
           /u/[id] /people 企業詳細 スカウト /biz/candidates のどこにも出さない。 */
  joinReasons?: string[];
  joinReasonPrimary?: string;
  leaveReasons?: string[];
  gaps?: { axis: string; rating: string }[];
};

// ── Group types and helpers ───────────────────────────────────────────────────

type StintGroup = {
  key: string;
  companyType: "master" | "custom" | "anon";
  companyId?: string;
  companyText?: string;
  companyAnonymized?: string;
  displayCompanyName: string;
  positions: Stint[];
  earliestStart: string;
  latestEnd: string | null;
  totalMonths: number;
};

function diffInMonths(startYM: string, endYM: string): number {
  const [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths}ヶ月`;
  if (remainingMonths === 0) return `${years}年`;
  return `${years}年${remainingMonths}ヶ月`;
}

function groupKey(s: Stint): string {
  if (s.companyType === "master" && s.companyId) return `m:${s.companyId}`;
  if (s.companyType === "custom" && s.companyText) return `c:${s.companyText}`;
  return `a:${s.companyAnonymized ?? s.displayCompanyName}`;
}

function groupStints(stints: Stint[]): StintGroup[] {
  if (stints.length === 0) return [];

  const groups: StintGroup[] = [];
  // 出戻りパターン対応: 同一 baseKey が複数グループになる場合に key を一意化するカウンタ
  const keyCount = new Map<string, number>();
  let i = 0;

  while (i < stints.length) {
    const first = stints[i];
    const baseKey = groupKey(first);
    // 連続する同一会社エントリを積む（非連続 = 出戻りは別ループで別グループになる）
    const positions: Stint[] = [first];
    let j = i + 1;
    while (j < stints.length && groupKey(stints[j]) === baseKey) {
      positions.push(stints[j]);
      j++;
    }

    // key 一意化: 出戻りで同一 baseKey が2度目以降に現れる場合は "#1", "#2" を付与
    const count = keyCount.get(baseKey) ?? 0;
    const uniqueKey = count === 0 ? baseKey : `${baseKey}#${count}`;
    keyCount.set(baseKey, count + 1);

    // positions は sortStints() 済みの順序をそのまま維持（追加ソート不要）
    const earliestStart = positions.reduce(
      (acc, p) => (p.startedAt < acc ? p.startedAt : acc),
      positions[0].startedAt
    );
    const hasCurrent = positions.some((p) => p.isCurrent);
    let latestEnd: string | null;
    if (hasCurrent) {
      latestEnd = null;
    } else {
      latestEnd = positions.reduce<string>((acc, p) => {
        const end = p.endedAt ?? p.startedAt;
        return end > acc ? end : acc;
      }, positions[0].endedAt ?? positions[0].startedAt);
    }
    const endForCalc = latestEnd ?? (() => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      return `${yyyy}-${mm}`;
    })();
    const totalMonths = diffInMonths(earliestStart, endForCalc);

    groups.push({
      key: uniqueKey,
      companyType: first.companyType,
      companyId: first.companyId,
      companyText: first.companyText,
      companyAnonymized: first.companyAnonymized,
      displayCompanyName: first.displayCompanyName,
      positions,
      earliestStart,
      latestEnd,
      totalMonths,
    });

    i = j;
  }

  // 現職グループを先頭、以降は earliestStart DESC（連続走査後の念のためソート）
  return groups.sort((a, b) => {
    const aHasCurrent = a.latestEnd === null;
    const bHasCurrent = b.latestEnd === null;
    if (aHasCurrent !== bHasCurrent) return aHasCurrent ? -1 : 1;
    return b.earliestStart.localeCompare(a.earliestStart);
  });
}

function isOverlapping(a: StintGroup, b: StintGroup): boolean {
  const aEnd = a.latestEnd ?? "9999-12";
  const bEnd = b.latestEnd ?? "9999-12";
  return a.earliestStart <= bEnd && b.earliestStart <= aEnd;
}

function buildTimelineRows(groups: StintGroup[]): StintGroup[][] {
  const rows: StintGroup[][] = [];
  const placed = new Set<string>();
  for (let i = 0; i < groups.length; i++) {
    if (placed.has(groups[i].key)) continue;
    const row: StintGroup[] = [groups[i]];
    placed.add(groups[i].key);
    for (let j = i + 1; j < groups.length; j++) {
      if (placed.has(groups[j].key)) continue;
      if (row.length < 2 && isOverlapping(groups[i], groups[j])) {
        row.push(groups[j]);
        placed.add(groups[j].key);
      }
    }
    rows.push(row);
  }
  return rows;
}

function formatGroupDateRange(group: StintGroup): string {
  const fmt = (ym: string) => ym.replace("-", ".");
  const start = fmt(group.earliestStart);
  const end = group.latestEnd === null ? "現在" : fmt(group.latestEnd);
  return `${start} 〜 ${end}`;
}

type StintDraft = {
  companyName: string;
  companyId: string | null;  // 候補選択時のみ非null、＋登録・自由入力時は null
  isAnon: boolean;
  roleCategoryId: string;
  roleTitle: string;
  department: string;
  rank: string;
  /*
    ⚠️ 年と月は**別々に持つ**（2026-08-13 修正）。

    以前は `startedAt: string`（"YYYY-MM"）1本で持ち、年セレクトと月セレクトが
    互いの値をそこから読み合っていた。`buildYearMonth` は片方が空だと "" を返すので、
    **新規追加（startedAt = ""）では年を選んでも月を選んでも "" のまま**になり、
    どちらのセレクトも空に戻る。入社年月は必須なので、
    **この画面から経歴を1件も追加できない**状態だった（2d77b044 以降）。

    「片方だけ選んだ」は正当な途中状態なので、状態としてそのまま表現する。
    "YYYY-MM" は保存時に `draftStartedAt` / `draftEndedAt` で組み立てる。
  */
  startedYear: string;
  startedMonth: string;   // "1".."12"（0埋めしない。組み立て時に padStart する）
  endedYear: string;
  endedMonth: string;
  isCurrent: boolean;
  description: string;
  joinReason: string;
  employmentType: string;
  salaryBase: string;
  salaryBonus: string;
  salaryStock: string;
  salaryMan: string;           // 自動計算 = salaryBase + salaryBonus + salaryStock
  visibilityCompany: "real" | "masked" | "hidden";
  visibilityCompanyProfile: "real" | "masked" | "hidden";
  visibilitySalary: boolean;
  visibilityReason: boolean;
  prefecture: string;
  remoteWorkStatus: string;
  joinReasons: string[];
  joinReasonPrimary: string;
  leaveReasons: string[];
  /** 軸 → 評価。未回答の軸はキーごと持たない（DBでも行を作らない） */
  gaps: Record<string, string>;
};

// ── Select options ────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => CURRENT_YEAR - i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * "YYYY-MM" → { year, month }。**DB から来た値を draft に展開するときだけ使う。**
 * ⚠️ セレクトの value をここから毎回導出しないこと。それが 2026-08-13 に直したバグ。
 */
function parseYearMonth(ym: string): { year: string; month: string } {
  if (!ym) return { year: "", month: "" };
  const [y, m] = ym.split("-");
  return { year: y ?? "", month: m ? String(parseInt(m, 10)) : "" };
}
/** 年・月が**両方**揃ったときだけ "YYYY-MM" を返す。片方だけなら ""（＝未入力扱い） */
function toYearMonth(year: string, month: string): string {
  if (!year || !month) return "";
  return `${year}-${month.padStart(2, "0")}`;
}
/** 保存・バリデーション用。draft の年月から "YYYY-MM" を組み立てる */
function draftStartedAt(d: StintDraft): string {
  return toYearMonth(d.startedYear, d.startedMonth);
}
function draftEndedAt(d: StintDraft): string {
  return toYearMonth(d.endedYear, d.endedMonth);
}

/* ⚠️ 2026-08-15: 直書きをやめ careerOptions.ts の RANKS を参照するようにした。
      公開プロフィール（/u/[id]）が役職を表示するようになり、
      **入力側と表示側で同じ語彙を持つ**ことになったため。
      すぐ下の EMPLOYMENT_TYPE_OPTIONS のコメントが求めていたのと同じ扱い。 */
const RANK_OPTIONS = [
  { value: "", label: "選択してください" },
  ...RANKS,
];

/* ⚠️ 選択肢は src/lib/constants/careerOptions.ts と共有する。
      ここに直書きすると API 側の許容値とずれる（2026-07-01 に実際にずれ、
      「派遣社員」「アルバイト・パート」が保存されずに消えていた）。 */
const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "", label: "選択してください" },
  ...EMPLOYMENT_TYPES.map((v) => ({ value: v, label: v })),
];

const EMPTY_DRAFT: StintDraft = {
  companyName: "",
  companyId: null,
  isAnon: false,
  roleCategoryId: "",
  roleTitle: "",
  department: "",
  rank: "",
  startedYear: "",
  startedMonth: "",
  endedYear: "",
  endedMonth: "",
  isCurrent: false,
  description: "",
  joinReason: "",
  employmentType: "",
  salaryBase: "",
  salaryBonus: "",
  salaryStock: "",
  salaryMan: "",
  visibilityCompany: "real",
  visibilityCompanyProfile: "real",
  visibilitySalary: false,
  visibilityReason: true,
  prefecture: "",
  remoteWorkStatus: "",
  joinReasons: [],
  joinReasonPrimary: "",
  leaveReasons: [],
  gaps: {},
};

// ── 勤務地・理由データの送信ヘルパー ─────────────────────────────────────────

/**
 * 保存 body 用。**編集と追加で同じ関数を使う。**
 * 片方にだけ書くと「追加時は保存されるが編集すると消える」が起きる。
 *
 * ⚠️ 現職には退職理由を送らない。画面にも出していないので、
 *    「現職に切り替えたら退職理由が残っていた」を作らない。
 */
function buildReasonBody(d: StintDraft): Record<string, unknown> {
  return {
    prefecture: d.prefecture || null,
    remote_work_status: d.remoteWorkStatus || null,
    join_reasons: d.joinReasons,
    join_reason_primary: d.joinReasonPrimary || null,
    leave_reasons: d.isCurrent ? [] : d.leaveReasons,
    gaps: Object.entries(d.gaps).map(([axis, rating]) => ({ axis, rating })),
  };
}

/** 楽観的更新用。buildReasonBody と同じ値を Stint の形にする */
function optimisticReasonFields(d: StintDraft): Partial<Stint> {
  return {
    prefecture: d.prefecture || undefined,
    remoteWorkStatus: d.remoteWorkStatus || undefined,
    joinReasons: d.joinReasons,
    joinReasonPrimary: d.joinReasonPrimary || undefined,
    leaveReasons: d.isCurrent ? [] : d.leaveReasons,
    gaps: Object.entries(d.gaps).map(([axis, rating]) => ({ axis, rating })),
  };
}

// ── Company body helpers ──────────────────────────────────────────────────────

/** 保存 body 用: company_id / company_text / company_anonymized の3者排他を保証 */
function buildCompanyBody(
  draft: Pick<StintDraft, "isAnon" | "companyId" | "companyName">
): Record<string, string> {
  if (draft.isAnon) {
    return { company_anonymized: draft.companyName || "非公開企業" };
  } else if (draft.companyId) {
    // null も "" も falsy → company_text 経路へ
    return { company_id: draft.companyId };
  } else {
    return { company_text: draft.companyName };
  }
}

/** 楽観的更新用: StintDraft から Stint の会社名フィールドを組み立てる */
function optimisticCompanyFields(
  draft: Pick<StintDraft, "isAnon" | "companyId" | "companyName">
): Pick<Stint, "displayCompanyName" | "companyType" | "companyId" | "companyText" | "companyAnonymized"> {
  if (draft.isAnon) {
    return {
      displayCompanyName: draft.companyName || "非公開企業",
      companyType: "anon",
      companyId: undefined,
      companyText: undefined,
      companyAnonymized: draft.companyName || "非公開企業",
    };
  } else if (draft.companyId) {
    return {
      displayCompanyName: draft.companyName,
      companyType: "master",
      companyId: draft.companyId,
      companyText: undefined,
      companyAnonymized: undefined,
    };
  } else {
    return {
      displayCompanyName: draft.companyName,
      companyType: "custom",
      companyId: undefined,
      companyText: draft.companyName,
      companyAnonymized: undefined,
    };
  }
}

// ── Sort helper: isCurrent first, then startedAt DESC ────────────────────────

function sortStints(arr: Stint[]): Stint[] {
  return [...arr].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return b.startedAt.localeCompare(a.startedAt);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPeriod(startedAt: string, endedAt?: string, isCurrent?: boolean): string {
  const fmt = (ym: string) => ym.replace("-", ".");
  if (isCurrent) return `${fmt(startedAt)} 〜 現在`;
  if (endedAt) return `${fmt(startedAt)} 〜 ${fmt(endedAt)}`;
  return `${fmt(startedAt)} 〜`;
}

function fieldStyle(): React.CSSProperties {
  return {
    width: "100%",
    border: "1.5px solid transparent",
    borderRadius: 8,
    padding: "13px 14px",
    fontSize: 14,
    color: "var(--ink)",
    background: "#F2F4F7",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.15s, background 0.15s",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: 14,
    fontWeight: 700,
    color: "#111",
    marginBottom: 6,
  };
}

function RequiredMark() {
  return <span style={{ color: "#E53935", marginLeft: 3, fontWeight: 700 }}>*</span>;
}

/**
 * 理由データ用の選択チップ。**押すだけで済む形**にするための部品。
 *
 * ⚠️ 自由記述にしない。理由データは集計するために作った箱で、
 *    自由記述だと集計できず、書く側の負担も大きい。
 */
function ReasonChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        padding: "7px 14px",
        borderRadius: 100,
        border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
        background: active ? "var(--royal-50)" : "#fff",
        color: active ? "var(--royal)" : "var(--ink-soft)",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        lineHeight: 1.4,
        transition: "border-color 0.12s, background 0.12s, color 0.12s",
      }}
    >
      {label}
    </button>
  );
}

// ── IconButton ────────────────────────────────────────────────────────────────

function IconButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: hovered
          ? danger ? "var(--error-soft)" : "var(--line-soft)"
          : "transparent",
        borderRadius: 5,
        fontSize: 13,
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: "pointer",
        transition: "background 0.12s",
        padding: 0,
        fontFamily: "inherit",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── CompanySearch ─────────────────────────────────────────────────────────────

type CompanySuggestion = {
  id: string;
  name: string;
  logo_url: string | null;
  industry: string | null;
  employee_count: string | null;
};

const AVATAR_COLORS = ["#4F46E5", "var(--success)", "#DC2626", "#D97706", "#0891B2", "#7C3AED"];
function getAvatarColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/*
  ⚠️ 選んだのか選び損ねたのかが**画面から分からない**状態だった（2026-08-13 修正）。

  マスタを選んでも、自由入力のままでも、入力欄にはただ会社名が残るだけで
  見た目が同じだった。選び損ねると `company_id` が付かず自由入力で保存されるが、
  **本人には何も見えない**（企業ページの現役社員に出ない・遷移の集計に乗らない、
  という形で後から効いてくる）。実際に通し点検で2回踏んだ。

  オンボーディングには「✓ OPINIOに掲載中の企業と連携します」という確認表示が
  すでにあるので、**新しいデザインを作らずそれを持ってくる**。
    選択済み  → 正式名称のカード（× で解除）＋ ✓ の確認行
    自由入力  → 未掲載であることを明記する行
*/
function CompanySearch({
  value,
  companyId,
  disabled,
  onChange,
}: {
  value: string;
  /** 非 null ならマスタと紐づいている。表示の分岐にも使う */
  companyId: string | null;
  disabled: boolean;
  onChange: (companyId: string | null, companyName: string) => void;
}) {
  const [results, setResults] = useState<CompanySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  /** 選んだ企業の付随情報（業種など）。既存レコードを開いた直後は無いので名前だけ出す */
  const [selectedMeta, setSelectedMeta] = useState<CompanySuggestion | null>(null);
  /* ⚠️ 「自由入力で確定した」ことを覚えておく。`companyId === null` だけでは
        「まだ入力している途中」と区別がつかず、確定前から未掲載の案内が出てしまう。
        既存レコードを開いたときは確定済みとして扱う（value があって id が無い＝自由入力）。 */
  const [freeConfirmed, setFreeConfirmed] = useState(
    () => companyId === null && value.trim().length > 0
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 入力が空になったら確定状態も捨てる（キャンセル→追加で持ち越さないため）
  useEffect(() => {
    if (value.trim().length === 0) setFreeConfirmed(false);
  }, [value]);

  // Click outside → close dropdown
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    onChange(null, q); // companyId をキーストローク毎にリセット
    setSelectedMeta(null);
    setFreeConfirmed(false);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/companies/search?q=${encodeURIComponent(q.trim())}&limit=10`
        );
        if (res.ok) {
          const data = (await res.json()) as { results?: CompanySuggestion[] };
          setResults(data.results ?? []);
        }
      } catch {
        // fetch 失敗時も ＋新規登録行は維持するため results を空のままにする
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function handleSelect(c: CompanySuggestion) {
    onChange(c.id, c.name);
    setSelectedMeta(c);
    setFreeConfirmed(false);
    setResults([]);
    setOpen(false);
  }

  function handleNew() {
    onChange(null, value); // companyId=null、companyName=入力テキストで確定
    setSelectedMeta(null);
    setFreeConfirmed(true);
    setResults([]);
    setOpen(false);
  }

  function clearSelection() {
    onChange(null, "");
    setSelectedMeta(null);
    setFreeConfirmed(false);
    setResults([]);
    setOpen(false);
  }

  const isMaster = companyId !== null;
  const showDropdown = !isMaster && open && value.trim().length > 0;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <style>{`
        .ched-suggest-row:hover { background: var(--royal-50) !important; }
        .ched-suggest-new:hover { background: var(--royal-50) !important; }
      `}</style>
      {isMaster ? (
        /* 選択済みチップ（オンボーディングと同じ形） */
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "11px 14px",
          border: "2px solid var(--royal)",
          borderRadius: 10, background: "var(--royal-50)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value}
            </div>
            {selectedMeta?.industry && (
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                {selectedMeta.industry}
              </div>
            )}
          </div>
          {!disabled && (
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
          )}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={handleInput}
          onFocus={() => { if (value.trim().length > 0) setOpen(true); }}
          placeholder="株式会社〇〇"
          disabled={disabled}
          style={fieldStyle()}
        />
      )}
      {showDropdown && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(15,23,42,0.1)", zIndex: 30,
          maxHeight: 260, overflowY: "auto",
        }}>
          {/* ローディング表示（結果0件かつロード中のみ） */}
          {loading && results.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
              検索中…
            </div>
          )}

          {/* 候補リスト */}
          {results.map((c) => {
            const avatarColor = getAvatarColor(c.name);
            return (
              <div
                key={c.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
                style={{
                  padding: "9px 12px", display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", borderBottom: "1px solid var(--line-soft)",
                }}
                className="ched-suggest-row"
              >
                {/* アバター: logo_url があれば画像、無ければイニシャル+固定色 */}
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  overflow: "hidden",
                  background: c.logo_url ? "#f5f7fa" : avatarColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {c.logo_url ? (
                    <Image src={c.logo_url} alt={c.name} width={36} height={36} style={{ objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                      {c.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
                  {(c.industry || c.employee_count) && (
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                      {[c.industry, formatEmployeeCount(c.employee_count)].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ＋ 自由入力で確定 — 入力がある限り常時表示
              ⚠️ 「新規登録」と書かない。**企業マスタには何も作らない**。
                 保存先は ow_experiences.company_text だけ（2026-08-13 に文言を実態へ寄せた）。 */}
          <div
            onMouseDown={(e) => { e.preventDefault(); handleNew(); }}
            style={{
              padding: "9px 12px", display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer",
              borderTop: results.length > 0 ? "1px solid var(--line-soft)" : "none",
            }}
            className="ched-suggest-new"
          >
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: "var(--royal-50)", border: "1.5px dashed var(--royal)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>
                「{value}」をこの名前のまま入力する
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                OPINIO 未掲載の企業として記録します
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 選んだのかどうかを必ず出す ────────────────────────────────────
          ⚠️ 「変わらないこと」でしか失敗に気づけない状態を作らない。 */}
      {isMaster && (
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--success)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          OPINIOに掲載中の企業と連携します
        </p>
      )}
      {!isMaster && freeConfirmed && (
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 8 }}>
          OPINIO 未掲載の企業として、この名前のまま記録します（企業ページには紐づきません）
        </p>
      )}
    </div>
  );
}

// ── StintForm ─────────────────────────────────────────────────────────────────

function StintForm({
  draft,
  onDraftChange,
  isSaving,
  justSaved,
  onSave,
  onCancel,
  roles,
  roleAliases,
  companyLocked = false,
}: {
  draft: StintDraft;
  onDraftChange: (d: StintDraft) => void;
  isSaving: boolean;
  justSaved?: boolean;
  onSave: () => void;
  onCancel: () => void;
  roles: { id: string; name: string; parent_id: string | null; display_order: number }[];
  /** role_id → 別名。検索でヒットさせるために使う（ow_role_aliases） */
  roleAliases?: Record<string, string[]>;
  companyLocked?: boolean;
}) {
  const set = useCallback(
    (key: keyof StintDraft, val: string | boolean) =>
      onDraftChange({ ...draft, [key]: val }),
    [draft, onDraftChange]
  );

  /* 入社理由・退職理由のチェック切り替え。
     ⚠️ 入社理由を外したら「決め手」も一緒に外す。DB の CHECK
        （ow_experiences_join_reason_primary_check）が「決め手は選んだ理由の中の1つ」を
        要求しており、揃っていないと保存が 400 になるため、UI 側で常に整合させる。
        ⚠️ 黙って捨てているのではない。ラジオの選択が画面上で消えるので本人に見える。 */
  const toggleReason = useCallback(
    (key: "joinReasons" | "leaveReasons", value: string) => {
      const cur = draft[key];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      if (key === "joinReasons") {
        const primary =
          draft.joinReasonPrimary && next.includes(draft.joinReasonPrimary)
            ? draft.joinReasonPrimary
            : "";
        onDraftChange({ ...draft, joinReasons: next, joinReasonPrimary: primary });
      } else {
        onDraftChange({ ...draft, leaveReasons: next });
      }
    },
    [draft, onDraftChange]
  );

  /* ギャップ。同じ選択肢をもう一度押すと未回答（キーごと削除）に戻す。
     ⚠️ "未回答" という値を作らない。未回答は行が無いことで表す。 */
  const setGap = useCallback(
    (axis: string, rating: string) => {
      const next = { ...draft.gaps };
      if (next[axis] === rating) delete next[axis];
      else next[axis] = rating;
      onDraftChange({ ...draft, gaps: next });
    },
    [draft, onDraftChange]
  );

  // 職種カテゴリー（親）ローカル state — StintDraft には保存しない
  /* ⚠️ 親セレクト用の parentId / handleParentChange は 2026-08-06 に削除した。
        検索セレクトが親も子もフラットに出すので、親を別 state で持つ必要がなくなった。
        draft.roleCategoryId が唯一の状態。 */

  const descLen = draft.description.length;
  const descOver = descLen > 500;
  /* ⚠️ 年・月が**両方**揃うまで "" のまま。片方だけ選んだ状態を
        「未入力」として扱う（不正な期間として赤字を出さない）。 */
  const startedAt = draftStartedAt(draft);
  const endedAt = draftEndedAt(draft);
  // 期間バリデーション: ended_at が入力済みかつ現職フラグなし の場合のみ started_at <= ended_at を検証
  // YYYY-MM 文字列の辞書順比較で正しく動作（例: "2024-04" > "2023-04"）
  const periodInvalid = !draft.isCurrent && !!endedAt && !!startedAt && startedAt > endedAt;
  /*
    勤務地は**直近（現職）だけ**入力を求める。それ以前は任意。
    ⚠️ 必須にしているのはこの UI 層だけ。DB は NOT NULL にしておらず、API も必須にしていない。
       オンボーディングが勤務地なしで is_current=true の行を作るため、
       そちらを 400 で落とさないようにしている（登録の入口の摩擦を増やさない）。
    ⚠️ 既存の現職レコードを編集すると、勤務地が未入力なのでここで止まる。これは意図どおり。
       追記を促す形にするために必須にしている。
  */
  const locationMissing = draft.isCurrent && (!draft.prefecture || !draft.remoteWorkStatus);
  /* ⚠️ `locationMissing` は**案内を出すためだけ**に使う。保存は止めない（2026-08-13）。
        必須にしていた頃は、勤務地と無関係な編集（役職を直すだけ等）まで保存できず、
        オンボーディング直後の人が全員そこで詰まっていた。
        行き止まりを作っても入力は増えない。通してから誘う。 */
  const isValid = !!draft.companyName.trim() && !!draft.roleCategoryId && !!startedAt;
  const canSave = isValid && !descOver && !periodInvalid && !isSaving;
  const effectivelyDisabled = !canSave || !!justSaved;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Company name + anon toggle */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={labelStyle()}>会社名<RequiredMark /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: companyLocked ? "var(--ink-mute)" : "var(--ink-soft)", cursor: companyLocked ? "default" : "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={draft.isAnon}
              disabled={companyLocked}
              onChange={(e) =>
                // isAnon 切替時に companyId もリセット（XOR整合のため）
                onDraftChange({ ...draft, isAnon: e.target.checked, companyId: null })
              }
              style={{ accentColor: "var(--royal)" }}
            />
            非公開にする
          </label>
        </div>
        {draft.isAnon ? (
          /* 匿名経路: company_anonymized に保存 → プレーン input のまま */
          <input
            type="text"
            value={draft.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="非公開企業（任意）"
            disabled={isSaving || companyLocked}
            style={fieldStyle()}
          />
        ) : (
          /* マスタ/カスタム経路: company_id or company_text に保存 */
          <CompanySearch
            value={draft.companyName}
            companyId={draft.companyId}
            disabled={isSaving || companyLocked}
            onChange={(id, name) =>
              onDraftChange({ ...draft, companyId: id, companyName: name })
            }
          />
        )}
      </div>

      {/*
        職種
        ⚠️ 2026-08-06 に親→子の2段セレクトから検索セレクトに置き換えた。
           105件を目視で探させるUIが機能していなかった。
        ⚠️ selectableParent は true。大分類そのものも選べる。
           過去の非IT職は「営業」「販売・サービス」で十分なことが多く、
           子まで選ばせると入力が止まる（求人側は false のままで、こちらだけ許す）。
        ⚠️ 渡す roles は mypage/page.tsx（2026-08-16 に移設）で is_active=true に絞ったうえで
           「現在選択中の職種＋その親」を足し戻したもの。ここでは絞らない。
      */}
      <div>
        <label style={labelStyle()}>職種<RequiredMark /></label>
        <RoleSearchSelect
          roles={roles}
          aliases={roleAliases}
          value={draft.roleCategoryId}
          onSelect={(id) => set("roleCategoryId", id)}
          selectableParent
          disabled={isSaving}
          ariaLabel="職種"
        />
      </div>


      {/* 役職 */}
      <div>
        <label style={labelStyle()}>役職</label>
        <select
          value={draft.rank}
          onChange={(e) => set("rank", e.target.value)}
          disabled={isSaving}
          style={fieldStyle()}
        >
          {RANK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 雇用形態 */}
      <div>
        <label style={labelStyle()}>雇用形態</label>
        <select
          value={draft.employmentType}
          onChange={(e) => set("employmentType", e.target.value)}
          disabled={isSaving}
          style={fieldStyle()}
        >
          {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/*
        社内での呼び方（ow_experiences.role_title）

        ⚠️ 2026-08-06 に定義を「社内での呼び方」に一本化した。
           それまでの説明文は「M2、シニアアソシエイトなど社内で規定されているグレード・等級名」で、
           等級を入れさせる文面だった。等級は隣の役職セレクト（rank）の守備範囲であり、
           2つの軸が1つの欄に混ざっていた。実データでも部署名が混入している
           （例:「金融営業本部 営業第1部 / 法人営業（アカウント営業）」）。
        ⚠️ 保存先カラム（role_title）は変えていない。既存データの移行もしていない。
           定義を先に正して、これから入る値をきれいにするのが目的。
        ⚠️ この欄はフェーズ2で「会社独自の呼称」を集める入口になる。
           ow_company_job_roles（company_id + name + standard_role_id）が受け皿。
      */}
      <div>
        <label style={labelStyle()}>社内での呼び方（任意）</label>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 6, lineHeight: 1.4 }}>
          社内で使われている呼称を入力してください（例: アカウントエグゼクティブ、CXデザイナー）
        </div>
        <input
          type="text"
          value={draft.roleTitle}
          onChange={(e) => set("roleTitle", e.target.value)}
          placeholder="例: アカウントエグゼクティブ"
          disabled={isSaving}
          style={fieldStyle()}
        />
      </div>

      {/* 部署名 */}
      <div>
        <label style={labelStyle()}>部署名（任意）</label>
        <input
          type="text"
          value={draft.department}
          onChange={(e) => set("department", e.target.value)}
          placeholder="例: エンタープライズ営業本部"
          disabled={isSaving}
          style={fieldStyle()}
          maxLength={100}
        />
      </div>

      {/* Period — 年/月 separate selects */}
      <div>
        <label style={labelStyle()}>入社年月<RequiredMark /></label>
        <div style={{ display: "flex", gap: 8 }}>
          {/* ⚠️ 年と月は独立した state。互いの値から導出しないこと（2026-08-13 修正） */}
          <select
            value={draft.startedYear}
            onChange={(e) => set("startedYear", e.target.value)}
            disabled={isSaving}
            style={{ ...fieldStyle(), flex: 1 }}
          >
            <option value="">年</option>
            {YEAR_OPTIONS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <select
            value={draft.startedMonth}
            onChange={(e) => set("startedMonth", e.target.value)}
            disabled={isSaving}
            style={{ ...fieldStyle(), flex: 1 }}
          >
            <option value="">月</option>
            {MONTH_OPTIONS.map((m) => <option key={m} value={String(m)}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* 現職 or 退職年月 */}
      <div>
        <label style={labelStyle()}>現職 or 退職年月<RequiredMark /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13, color: "var(--ink-soft)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={draft.isCurrent}
            onChange={(e) => set("isCurrent", e.target.checked)}
            style={{ accentColor: "var(--royal)" }}
          />
          現在も勤務している
        </label>
        {!draft.isCurrent && (
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={draft.endedYear}
              onChange={(e) => set("endedYear", e.target.value)}
              disabled={isSaving}
              style={{ ...fieldStyle(), flex: 1 }}
            >
              <option value="">年</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
            </select>
            <select
              value={draft.endedMonth}
              onChange={(e) => set("endedMonth", e.target.value)}
              disabled={isSaving}
              style={{ ...fieldStyle(), flex: 1 }}
            >
              <option value="">月</option>
              {MONTH_OPTIONS.map((m) => <option key={m} value={String(m)}>{m}月</option>)}
            </select>
          </div>
        )}
        {periodInvalid && (
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
            退職年月は入社年月以降に設定してください
          </div>
        )}
      </div>

      {/*
        勤務地・勤務形態
        ⚠️ 本人の**居住地**（ow_users.location）とは別物。ここは「その期間どこで働いたか」。
        ⚠️ **どの経歴でも任意。** 現職も含めて必須にしない（2026-08-13 に方針変更）。
           必須ゲートは「勤務地と関係ない編集まで保存できない」行き止まりを作るだけで、
           入力を促す仕掛けとして機能していなかった。案内に置き換えている。
      */}
      <div>
        <label style={labelStyle()}>
          勤務地
          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>（任意）</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            aria-label="勤務地（都道府県）"
            value={draft.prefecture}
            onChange={(e) => set("prefecture", e.target.value)}
            disabled={isSaving}
            style={{ ...fieldStyle(), flex: 1 }}
          >
            <option value="">都道府県</option>
            {/* ⚠️ オンボーディングと同じ並び。片方だけ変えないこと（同じ項目の入力欄）。 */}
            <optgroup label="よく選ばれる">
              {COMMON_PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </optgroup>
            <optgroup label="すべての都道府県">
              {OTHER_PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </optgroup>
          </select>
          <select
            aria-label="勤務形態"
            value={draft.remoteWorkStatus}
            onChange={(e) => set("remoteWorkStatus", e.target.value)}
            disabled={isSaving}
            style={{ ...fieldStyle(), flex: 1 }}
          >
            <option value="">勤務形態</option>
            {REMOTE_WORK_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {locationMissing && (
          /* ⚠️ **目立つが、操作は止めない。** 保存ボタンは有効なまま。
                何のために要るのかを書く（「入力してください」だけでは動機にならない）。
                既存レコードを編集した人にとっては新しく増えた項目なので、咎める語調にしない。 */
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 7,
            fontSize: 12, fontWeight: 600, color: "#92400E",
            background: "var(--warm-soft)", border: "1px solid #FDE68A",
            borderRadius: 8, padding: "9px 11px", marginTop: 8, lineHeight: 1.65,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" />
            </svg>
            <span>現職の勤務地と勤務形態を入れると、同じ条件で働く人を探せるようになります。</span>
          </div>
        )}
      </div>

      {/* Description (業務内容) */}
      <div>
        <label style={labelStyle()}>業務内容</label>
        <textarea
          aria-label="業務内容"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="業務内容や成果、チームの規模など"
          disabled={isSaving}
          rows={3}
          style={{ ...fieldStyle(), resize: "vertical", lineHeight: 1.7 }}
        />
        <div style={{ fontSize: 12, fontWeight: 600, color: descOver ? "var(--error)" : "var(--ink-mute)", textAlign: "right", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
          {descOver ? `${descLen - 500} 文字超過` : `残り ${500 - descLen} 文字`}
        </div>
      </div>

      {/*
        入社・退職の背景（選択式）
        ⚠️ **すべて非公開。** 本人と集計にしか使わない。公開トグルは出さない。
        ⚠️ 選択式をこの位置（自由記述の**上**）に置く。自由記述は撤去予定で、
           並存は一時的なもの。上下を入れ替えないこと。
        ⚠️ すべて任意。押すだけで済む形にし、自由記述欄は作らない。
      */}
      <div
        style={{
          background: "var(--bg-tint)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em" }}>
              入社・退職の背景（すべて任意）
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--success)",
                background: "var(--success-soft)",
                padding: "2px 8px",
                borderRadius: 100,
                letterSpacing: "0.03em",
              }}
            >
              この内容は公開されません
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: "var(--ink-mute)" }}>
            あなた以外には表示されません。企業にも、ほかの登録者にも出ません。
            どの会社にどんな傾向があるかを集計するためだけに使います。
          </p>
        </div>

        {/* 入社理由（複数選択可） */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            この会社に入った理由（複数選べます）
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {JOIN_REASONS.map((o) => (
              <ReasonChip
                key={o.value}
                label={o.label}
                active={draft.joinReasons.includes(o.value)}
                disabled={isSaving}
                onClick={() => toggleReason("joinReasons", o.value)}
              />
            ))}
          </div>
        </div>

        {/* 決め手（選んだ理由の中から1つ） */}
        {draft.joinReasons.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              その中で、いちばんの決め手は
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {JOIN_REASONS.filter((o) => draft.joinReasons.includes(o.value)).map((o) => (
                <ReasonChip
                  key={o.value}
                  label={o.label}
                  active={draft.joinReasonPrimary === o.value}
                  disabled={isSaving}
                  /* もう一度押すと未選択に戻す */
                  onClick={() => set("joinReasonPrimary", draft.joinReasonPrimary === o.value ? "" : o.value)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 退職理由 — 現職には出さない */}
        {!draft.isCurrent && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              この会社を離れた理由（複数選べます）
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LEAVE_REASONS.map((o) => (
                <ReasonChip
                  key={o.value}
                  label={o.label}
                  active={draft.leaveReasons.includes(o.value)}
                  disabled={isSaving}
                  onClick={() => toggleReason("leaveReasons", o.value)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 入社前後のギャップ（6軸 × 3択。未回答可） */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
            入る前の想像と、実際のギャップ
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
            答えたい項目だけで大丈夫です。選んだものをもう一度押すと未回答に戻ります。
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GAP_AXES.map((axis) => (
              /* ⚠️ ラベルとチップを横並びにしない。狭い画面でラベルを固定幅にすると
                    はみ出しの原因になる（CLAUDE.md「横はみ出しは flex-shrink: 0 を疑う」）。
                    縦積みなら幅の取り合いが起きない。 */
              <div key={axis.value} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>
                  {axis.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 }}>
                  {GAP_RATINGS.map((r) => (
                    <ReasonChip
                      key={r.value}
                      label={r.label}
                      active={draft.gaps[axis.value] === r.value}
                      disabled={isSaving}
                      onClick={() => setGap(axis.value, r.value)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Join reason (なぜこの会社を選んだか) */}
      <div>
        <label style={labelStyle()}>
          <span>なぜこの会社を選んだか（任意）</span>
          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: "var(--purple)", background: "var(--purple-soft)", padding: "1px 7px", borderRadius: 100, letterSpacing: "0.04em" }}>
            公開プロフィールに表示
          </span>
        </label>
        <textarea
          aria-label="なぜこの会社を選んだか"
          value={draft.joinReason}
          onChange={(e) => set("joinReason", e.target.value)}
          placeholder="例: 〇〇な課題を解決したくて。前職でできなかった〇〇に挑戦するため"
          disabled={isSaving}
          rows={2}
          style={{ ...fieldStyle(), resize: "vertical", lineHeight: 1.7, borderColor: "var(--purple-soft)" }}
        />
        <div style={{ fontSize: 12, fontWeight: 600, color: draft.joinReason.length > 300 ? "var(--error)" : "var(--ink-mute)", textAlign: "right", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
          {draft.joinReason.length > 300 ? `${draft.joinReason.length - 300} 文字超過` : `残り ${300 - draft.joinReason.length} 文字`}
        </div>
      </div>

      {/*
        年収（内訳）の入力欄は 2026-08-06 に外した。
        ユーザー投稿の給与データを畳む方針（ow_salary_reports の削除）に合わせ、
        公開プロフィールに年収を載せない。
        ⚠️ salary_man / visibility_salary の**列とデータは残してある**。
           既存3件（うち公開設定 true が2件）はそのまま。
           get_public_career_steps() や anon への列単位 GRANT にも手を付けていない。
           入力欄が無いので、保存時は既存値がそのまま送られる（下の toMan 参照）。
      */}

      {/* ⚠️ **「公開設定（この職歴を、どの画面に出すか）」の入力欄は 2026-08-16 に外した。**
             `visibilityCompany` / `visibilityCompanyProfile` / `visibilityReason` の
             **列とデータは残している**。入力欄が無いので、保存時は
             `draft` が持つ既存値がそのまま送られる（年収の `visibility_salary` と同じ扱い）。

          ⚠️ **画面側のフィルタは生きている。** `queries.ts` は
             `visibility_company = 'hidden'` の職歴を企業ページの現役社員 / OB・OG から
             除外し、`directory.ts` は社名の出し方に使う。**消さないこと。**

          ⚠️ ★入力欄が無い＝**本人が掲載を断る手段が無い**。掲載可否を本人が選べる形に
             戻すときは、ここに戻すのではなく「職歴全体をどう見せるか」の1設定として
             設定タブに置くこと（1件ずつ選ばせると、選び忘れが同意なき公開になる）。 */}

      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
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

// ── StintCard ─────────────────────────────────────────────────────────────────

function StintCard({
  stint,
  onEdit,
  onDelete,
  extras,
}: {
  stint: Stint & { showCurrentBadge?: boolean };
  onEdit: () => void;
  onDelete: () => void;
  /** 職歴の下に足す差し込み（フェーズ4-2 の実績・受賞）。渡されなければ何も描かない */
  extras?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "12px 14px",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid var(--line)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Role + 現在 badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {stint.roleTitle || stint.roleLabel}
            </span>
            {stint.showCurrentBadge && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em", flexShrink: 0 }}>
                現在
              </span>
            )}
          </div>
          {/* Period */}
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
            {formatPeriod(stint.startedAt, stint.endedAt, stint.isCurrent)}
          </div>
          {/* Employment type badge */}
          {stint.employmentType && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              fontSize: 12, fontWeight: 600, color: "var(--ink-soft)",
              background: "var(--bg-tint)", border: "1px solid var(--line)",
              padding: "1px 7px", borderRadius: 100,
              marginTop: 4,
            }}>
              {stint.employmentType}
            </span>
          )}
          {/* Description snippet */}
          {stint.description && (
            <div
              style={{
                fontSize: 12, fontWeight: 500,
                color: "var(--ink-soft)",
                marginTop: 6,
                paddingLeft: 8,
                borderLeft: "2px solid var(--line)",
                lineHeight: 1.65,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {stint.description}
            </div>
          )}
          {/* Join reason snippet */}
          {stint.joinReason && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "flex-start", gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--purple)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {stint.joinReason}
              </span>
            </div>
          )}
        </div>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0.45, transition: "opacity 0.15s", flexShrink: 0 }}>
          <IconButton onClick={onEdit} title="編集">✎</IconButton>
          <IconButton onClick={onDelete} title="削除" danger>×</IconButton>
        </div>
      </div>
      {/* ストーリーアコーディオン */}
      <StoryAccordion experienceId={stint.id} />
      {/* 実績・受賞（4-2）。★ここに直接 UI を書かない。中身は呼び出し側が渡す */}
      {extras}
    </div>
  );
}

// ── Main: CareerHistoryEditor ─────────────────────────────────────────────────

export default function CareerHistoryEditor({
  initialExperiences = [],
  roles = [],
  roleAliases = {},
  birthDate,
  onSavedCountChange,
  renderStintExtras,
  onExperienceDeleted,
  openAddNonce,
}: {
  initialExperiences?: Stint[];
  roles?: { id: string; name: string; parent_id: string | null; display_order: number }[];
  roleAliases?: Record<string, string[]>;
  birthDate?: string | null;
  /** 保存済みの職歴件数。**API が成功したときだけ**変わる（stints は楽観更新ではなく成功後に更新している）。
      親の完成度がこれを見る。渡さなくても動く。 */
  onSavedCountChange?: (count: number) => void;
  /** 各職歴の下に差し込むもの（4-2 の実績・受賞）。この部品は中身を知らない */
  renderStintExtras?: (experienceId: string) => React.ReactNode;
  /** 職歴を削除したときに呼ぶ。★DB 側は ON DELETE SET NULL で実績を残すので、
      呼び出し側は手元の実績・受賞の experience_id も null に落とす必要がある
      （やらないと、再読み込みするまで画面から消えたように見える） */
  onExperienceDeleted?: (experienceId: string) => void;
  /** ★カードの見出しにある「＋」から追加モーダルを開くための合図（2026-08-16）。
      値が変わるたびに開く。⚠️ ref を渡さない（この部品の内部状態を外に晒さないため）。 */
  openAddNonce?: number;
}) {
  const [stints, setStints] = useState<Stint[]>(() => sortStints(initialExperiences));

  /* 見出しの「＋」から開く。★初回マウント時（undefined / 0）は開かない */
  useEffect(() => {
    if (!openAddNonce) return;
    setAddDraft(EMPTY_DRAFT);
    setAddingForCompanyKey("__new__");
  }, [openAddNonce]);

  /* 保存済み件数を親へ返す。⚠️ 3箇所の setStints はいずれも `res.ok` の後なので、
     ここで通知される件数は「保存済み」を意味する。 */
  useEffect(() => { onSavedCountChange?.(stints.length); }, [stints.length, onSavedCountChange]);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<StintDraft>(EMPTY_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);

  // Add state
  const [addingForCompanyKey, setAddingForCompanyKey] = useState<string | null>(null);
  const [addDraft,     setAddDraft]     = useState<StintDraft>(EMPTY_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Stint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");



  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback(
    (msg: string, variant: "default" | "error" = "default") => {
      setToastVariant(variant);
      setToastMsg(msg);
    },
    []
  );

  // ── Draft from stint ─────────────────────────────────────────────────────────
  const draftFromStint = useCallback((s: Stint): StintDraft => ({
    companyName: s.companyType === "anon" ? (s.companyAnonymized ?? "非公開企業") : s.displayCompanyName,
    companyId: s.companyType === "master" ? (s.companyId ?? null) : null,
    isAnon: s.companyType === "anon",
    roleCategoryId: s.roleCategoryId,
    roleTitle: s.roleTitle ?? "",
    department: s.department ?? "",
    rank: s.rank ?? "",
    startedYear: parseYearMonth(s.startedAt).year,
    startedMonth: parseYearMonth(s.startedAt).month,
    endedYear: parseYearMonth(s.endedAt ?? "").year,
    endedMonth: parseYearMonth(s.endedAt ?? "").month,
    isCurrent: s.isCurrent,
    description: s.description ?? "",
    joinReason: s.joinReason ?? "",
    employmentType: s.employmentType ?? "",
    salaryBase: s.salaryBase != null ? String(s.salaryBase) : "",
    salaryBonus: s.salaryBonus != null ? String(s.salaryBonus) : "",
    salaryStock: s.salaryStock != null ? String(s.salaryStock) : "",
    salaryMan: s.salaryMan != null ? String(s.salaryMan) : "",
    /* ⚠️ `?? "real"` / `?? true` で埋めないこと。DB が NOT NULL なので
          値が無い＝取得元の SELECT 漏れであり、既定値に倒すと
          「本人の非公開設定が公開側に反転した」ことに誰も気づけない。
          Stint 側で必須にしてあるので、ここは素通しでよい。 */
    visibilityCompany: s.visibilityCompany,
    visibilityCompanyProfile: s.visibilityCompanyProfile,
    visibilityReason: s.visibilityReason,
    visibilitySalary: s.visibilitySalary ?? false,
    /* ⚠️ ここで拾い忘れると、編集して保存した瞬間に値が消える
          （draft の空値がそのまま PUT で送られるため）。
          サーバー側（mypage/page.tsx・2026-08-16 に移設）の SELECT と対で見ること。 */
    prefecture: s.prefecture ?? "",
    remoteWorkStatus: s.remoteWorkStatus ?? "",
    joinReasons: s.joinReasons ?? [],
    joinReasonPrimary: s.joinReasonPrimary ?? "",
    leaveReasons: s.leaveReasons ?? [],
    gaps: Object.fromEntries((s.gaps ?? []).map((g) => [g.axis, g.rating])),
  }), []);

  const draftFromGroup = useCallback((group: StintGroup): StintDraft => ({
    companyName: group.companyType === "anon"
      ? (group.companyAnonymized ?? "非公開企業")
      : group.displayCompanyName,
    companyId: group.companyType === "master" ? (group.companyId ?? null) : null,
    isAnon: group.companyType === "anon",
    roleCategoryId: "",
    roleTitle: "",
    department: "",
    rank: "",
    // そのグループの開始年月をプリフィル
    startedYear: parseYearMonth(group.earliestStart).year,
    startedMonth: parseYearMonth(group.earliestStart).month,
    // 現職グループは "" (isCurrent チェックで制御)
    endedYear: parseYearMonth(group.latestEnd ?? "").year,
    endedMonth: parseYearMonth(group.latestEnd ?? "").month,
    isCurrent: false,
    description: "",
    joinReason: "",
    employmentType: "",
    salaryBase: "",
    salaryBonus: "",
    salaryStock: "",
    salaryMan: "",
    visibilityCompany: "real",
    visibilityCompanyProfile: "real",
    visibilitySalary: false,
    visibilityReason: true,
    /* ⚠️ 同じ会社への追加ポジションでも勤務地・理由は引き継がない。
          異動で勤務地が変わることがあり、前の値を既定にすると
          「確認していない値」がそのまま保存される（CLAUDE.md「推測値を投入しない」）。 */
    prefecture: "",
    remoteWorkStatus: "",
    joinReasons: [],
    joinReasonPrimary: "",
    leaveReasons: [],
    gaps: {},
  }), []);

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const startEdit = useCallback((s: Stint) => {
    setEditingId(s.id);
    setEditDraft(draftFromStint(s));
  }, [draftFromStint]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        role_category_id: editDraft.roleCategoryId,
        role_title: editDraft.roleTitle || undefined,
        started_at: draftStartedAt(editDraft),
        ended_at: editDraft.isCurrent ? undefined : draftEndedAt(editDraft) || undefined,
        is_current: editDraft.isCurrent,
        description: editDraft.description || undefined,
        join_reason: editDraft.joinReason || undefined,
        employment_type: editDraft.employmentType || undefined,
        /* ⚠️ 年収系は送らない（2026-08-06 に入力UIを撤去）。
              送ると API 側で null に潰れ、既存の salary_man が消える。
              API は body にキーが無ければその列を更新しない作りにしてある。 */
        department: editDraft.department || null,
        rank: editDraft.rank || null,
        visibility_company: editDraft.visibilityCompany,
        visibility_company_profile: editDraft.visibilityCompanyProfile,
        visibility_reason: editDraft.visibilityReason,
        ...buildReasonBody(editDraft),
      };
      Object.assign(body, buildCompanyBody(editDraft));

      const res = await fetch(`/api/jobseeker/experiences/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();

      // Optimistic update + re-sort
      setStints((prev) =>
        sortStints(prev.map((s) =>
          s.id === editingId
            ? {
                ...s,
                ...optimisticCompanyFields(editDraft),
                roleCategoryId: editDraft.roleCategoryId,
                roleLabel: roles.find((r) => r.id === editDraft.roleCategoryId)?.name ?? editDraft.roleCategoryId,
                roleTitle: editDraft.roleTitle || undefined,
                startedAt: draftStartedAt(editDraft),
                endedAt: editDraft.isCurrent ? undefined : draftEndedAt(editDraft) || undefined,
                isCurrent: editDraft.isCurrent,
                description: editDraft.description || undefined,
                joinReason: editDraft.joinReason || undefined,
                employmentType: editDraft.employmentType || undefined,
                department: editDraft.department || undefined,
                rank: (editDraft.rank || null) as Stint["rank"],
                visibilityCompany: editDraft.visibilityCompany,
                visibilityCompanyProfile: editDraft.visibilityCompanyProfile,
                visibilityReason: editDraft.visibilityReason,
                ...optimisticReasonFields(editDraft),
              }
            : s
        ))
      );
      showToast("職歴を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      cancelEdit();
      setEditJustSaved(false);
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editDraft, cancelEdit, showToast]);

  // ── Add handlers ─────────────────────────────────────────────────────────────
  const cancelAdd = useCallback(() => {
    setAddingForCompanyKey(null);
    setAddDraft(EMPTY_DRAFT);
  }, []);

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const body: Record<string, unknown> = {
        role_category_id: addDraft.roleCategoryId,
        role_title: addDraft.roleTitle || undefined,
        started_at: draftStartedAt(addDraft),
        ended_at: addDraft.isCurrent ? undefined : draftEndedAt(addDraft) || undefined,
        is_current: addDraft.isCurrent,
        description: addDraft.description || undefined,
        join_reason: addDraft.joinReason || undefined,
        employment_type: addDraft.employmentType || undefined,
        display_order: stints.length,
        /* ⚠️ 年収系は送らない（2026-08-06 に入力UIを撤去）。
              送ると API 側で null に潰れ、既存の salary_man が消える。
              API は body にキーが無ければその列を更新しない作りにしてある。 */
        department: addDraft.department || null,
        rank: addDraft.rank || null,
        visibility_company: addDraft.visibilityCompany,
        visibility_company_profile: addDraft.visibilityCompanyProfile,
        visibility_reason: addDraft.visibilityReason,
        ...buildReasonBody(addDraft),
      };
      Object.assign(body, buildCompanyBody(addDraft));

      const res = await fetch("/api/jobseeker/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const { id } = (await res.json()) as { id: string };

      const newStint: Stint = {
        id,
        ...optimisticCompanyFields(addDraft),
        roleCategoryId: addDraft.roleCategoryId,
        roleLabel: roles.find((r) => r.id === addDraft.roleCategoryId)?.name ?? addDraft.roleCategoryId,
        roleTitle: addDraft.roleTitle || undefined,
        startedAt: draftStartedAt(addDraft),
        endedAt: addDraft.isCurrent ? undefined : draftEndedAt(addDraft) || undefined,
        isCurrent: addDraft.isCurrent,
        description: addDraft.description || undefined,
        joinReason: addDraft.joinReason || undefined,
        employmentType: addDraft.employmentType || undefined,
        visibilityCompany: addDraft.visibilityCompany,
        department: addDraft.department || undefined,
        rank: (addDraft.rank || null) as Stint["rank"],
        visibilityCompanyProfile: addDraft.visibilityCompanyProfile,
        visibilityReason: addDraft.visibilityReason,
        ...optimisticReasonFields(addDraft),
      };

      setStints((prev) => sortStints([...prev, newStint]));
      showToast("職歴を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      cancelAdd();
      setAddJustSaved(false);
    } catch {
      showToast("追加に失敗しました。もう一度お試しください。", "error");
    } finally {
      setAddSaving(false);
    }
  }, [addDraft, stints.length, cancelAdd, showToast]);

  // Escape キーでモーダルを閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editingId !== null) cancelEdit();
      else if (addingForCompanyKey !== null) cancelAdd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, addingForCompanyKey, cancelEdit, cancelAdd]);

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/experiences/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setStints((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      onExperienceDeleted?.(deleteTarget.id);
      setDeleteTarget(null);
      showToast("職歴を削除しました");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, showToast, onExperienceDeleted]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const groups = groupStints(stints);
  const rows = buildTimelineRows(groups);

  // 年区切り用ヘルパー
  function rowStartYear(row: StintGroup[]): number | null {
    const earliest = row.reduce((e, g) => (g.earliestStart < e ? g.earliestStart : e), row[0].earliestStart);
    const y = parseInt(earliest.slice(0, 4), 10);
    return isNaN(y) ? null : y;
  }
  function ageAtYear(year: number): number | null {
    if (!birthDate) return null;
    const birthYear = parseInt(birthDate.slice(0, 4), 10);
    const age = year - birthYear;
    return age > 0 && age < 100 ? age : null;
  }

  return (
    <div>
      <style>{`
        .career-row { display: flex; gap: 12px; }
        @media (max-width: 640px) { .career-row { flex-direction: column; } }
      `}</style>

      {/* グループ一覧（並行在籍は横並び） */}
      {rows.map((row, rowIdx) => {
        const year = rowStartYear(row);
        const prevYear = rowIdx > 0 ? rowStartYear(rows[rowIdx - 1]) : null;
        const showYearSep = year !== null && year !== prevYear;
        const age = year !== null ? ageAtYear(year) : null;
        return (
        <div key={row.map(g => g.key).join("|")}>
          {showYearSep && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              margin: rowIdx === 0 ? "0 0 10px" : "4px 0 10px",
            }}>
              <div style={{
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 100,
                padding: "2px 9px",
                fontSize: 12, fontWeight: 700,
                color: "var(--royal)",
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}>
                {year}年
              </div>
              {age !== null && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                  {age}歳
                </span>
              )}
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
          )}
          <div
            className="career-row"
            style={{ marginBottom: rowIdx < rows.length - 1 ? 14 : 0 }}
          >
          {row.map((group) => {
            const showBadgeId = group.positions[0]?.isCurrent ? group.positions[0].id : null;
            const avatarColor = getAvatarColor(group.displayCompanyName);
            const avatarInitial = group.displayCompanyName.charAt(0);

            return (
              <div
                key={group.key}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
                }}
              >
                {/* グループヘッダー: アバター + 会社名 + 期間 */}
                <div
                  style={{
                    padding: "16px 18px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 16,
                      color: "#fff",
                      fontFamily: "Inter, sans-serif",
                      flexShrink: 0,
                      boxShadow: `0 2px 8px ${avatarColor}55`,
                    }}
                  >
                    {avatarInitial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.3 }}>
                      {group.displayCompanyName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
                        {formatGroupDateRange(group)}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: "var(--royal)", background: "var(--royal-50)",
                        borderRadius: 100, padding: "1px 9px",
                        fontFamily: "Inter, sans-serif", flexShrink: 0,
                      }}>
                        {formatDuration(group.totalMonths)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ポジション群 */}
                <div style={{ padding: "0 18px 16px" }}>
                  {group.positions.map((s, pIdx) => (
                    <div key={s.id} style={{ marginBottom: pIdx < group.positions.length - 1 ? 8 : 0 }}>
                      <StintCard
                        stint={{ ...s, showCurrentBadge: s.id === showBadgeId }}
                        onEdit={() => startEdit(s)}
                        onDelete={() => setDeleteTarget(s)}
                        extras={renderStintExtras?.(s.id)}
                      />
                    </div>
                  ))}

                  {/* 「+ このポジションに役割を追加」テキストリンク */}
                  {(
                    <button
                      type="button"
                      onClick={() => {
                        setAddDraft(draftFromGroup(group));
                        setAddingForCompanyKey(group.key);
                      }}
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 10px",
                        background: "var(--royal-50)",
                        border: "1px dashed var(--royal-100)",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--royal)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
                      このポジションに役割を追加
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      );
      })}

      {/* Empty state
          ⚠️ 記入例カード（GhostExample）はやめた（2026-08-16）。表示モードでは
             「登録済みの1件」に見えてしまうため。何を書くかは編集モードの
             placeholder が担う。文言の型は写真・SNS と揃える。 */}
      {stints.length === 0 && addingForCompanyKey === null && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
          まだ職歴を登録していません。
          <button
            type="button"
            onClick={() => { setAddDraft(EMPTY_DRAFT); setAddingForCompanyKey("__new__"); }}
            style={{
              background: "none", border: "none", padding: 0, marginLeft: 6, cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "var(--royal)", fontFamily: "inherit",
              textDecoration: "underline", textUnderlineOffset: 2,
            }}
          >
            職歴を追加する
          </button>
        </p>
      )}

      {/* 新規会社用「+ 経歴を追加」ボタン */}
      {/* ⚠️ 0件のときは出さない。すぐ上の空状態が同じ操作の入口を既に出しているため
             （同じ操作の入口を2つ縦に並べない。2026-08-16） */}
      {addingForCompanyKey === null && stints.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setAddDraft(EMPTY_DRAFT);
            setAddingForCompanyKey("__new__");
          }}
          style={{
            marginTop: stints.length > 0 ? 10 : 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            padding: "8px 14px",
            width: "100%",
            background: "transparent",
            border: "1px dashed var(--line)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-soft)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
          経歴を追加
        </button>
      )}

      {/* フォームモーダル（編集・追加共通） */}
      {(editingId !== null || addingForCompanyKey !== null) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* バックドロップ */}
          <div
            onClick={editingId !== null ? cancelEdit : cancelAdd}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
          />
          {/* モーダルカード */}
          <div style={{
            position: "relative", zIndex: 1, background: "#fff",
            borderRadius: 16, width: "min(760px, 96vw)", maxHeight: "92vh",
            overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          }}>
            {/* ヘッダー */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                {editingId !== null ? "職歴を編集" : "職歴を追加"}
              </div>
              <button
                onClick={editingId !== null ? cancelEdit : cancelAdd}
                style={{ width: 28, height: 28, border: "none", background: "var(--line-soft)", borderRadius: 6, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", flexShrink: 0 }}
              >×</button>
            </div>
            {/* ボディ（スクロール可能） */}
            <div style={{ overflow: "auto", flex: 1, padding: "20px 24px" }}>
              {editingId !== null ? (
                <StintForm
                  draft={editDraft}
                  onDraftChange={setEditDraft}
                  isSaving={editSaving}
                  justSaved={editJustSaved}
                  onSave={() => { void saveEdit(); }}
                  onCancel={cancelEdit}
                  roles={roles}
                  roleAliases={roleAliases}
                />
              ) : (
                <StintForm
                  draft={addDraft}
                  onDraftChange={setAddDraft}
                  isSaving={addSaving}
                  justSaved={addJustSaved}
                  onSave={() => { void saveAdd(); }}
                  onCancel={cancelAdd}
                  roles={roles}
                  roleAliases={roleAliases}
                  companyLocked={addingForCompanyKey !== null && addingForCompanyKey !== "__new__"}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="職歴を削除しますか？"
        /* ⚠️ 実績・受賞の行方を**常に**書く（2026-08-15 / フェーズ4-2）。
              DB は ON DELETE SET NULL なので消えないが、削除ダイアログが職歴の話しか
              していないと「一緒に消えた」と読まれる。
           ★件数は出さない。件数を出すために、この部品に実績への依存を作らない
              （紐づく実績が0件のときにも出るが、事実として誤りではなく害もない）。
           ⚠️ **文言を 2026-08-16 に直した。** 実績・受賞が独立セクションになり、
              「その他の実績・受賞」という**移り先が無くなった**ため。
              実体（SET NULL で残る）は変えていない。 */
        message={
          deleteTarget
            ? `「${deleteTarget.displayCompanyName}」での職歴を削除します。この操作は取り消せません。\nこの職歴に紐づけた実績・受賞は削除されません（紐づけだけが外れます）。`
            : ""
        }
        confirmLabel="削除する"
        confirmVariant="danger"
        isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Toast */}
      {toastMsg && (
        <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />
      )}

    </div>
  );
}
