"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EMPLOYMENT_TYPES, RANKS, EMPLOYMENT_TYPE_FIELD_ID } from "@/lib/constants/careerOptions";
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";
import {
  JOIN_REASONS,
  LEAVE_REASONS,
  GAP_AXES,
  GAP_RATINGS,
  REASON_MAX,
  groupReasonsByAxis,
} from "@/lib/constants/careerReasons";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import Image from "next/image";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import { ProfileEditModal } from "@/components/profile/editor/ProfileEditModal";
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
 * 「離れた理由」を出す／送る条件（2026-08-19）。
 *
 * ⚠️ **`is_current` ではなく「終了日が入っているか」で判定する。**
 *    `is_current = false` でも終了日が空の行は作れる（終了日は必須にしていない）。
 *    「離れた理由」は**終了した在籍**についての設問なので、終了日を基準にする。
 *    画面の出し分けと保存 body が**必ず同じ関数**を見るようにしてある。
 *    割れると「画面に出ていないのに保存される」「選んだのに送られない」が起きる。
 */
export function hasLeftCompany(d: StintDraft): boolean {
  return !d.isCurrent && !!draftEndedAt(d);
}

/**
 * 保存 body 用。**編集と追加で同じ関数を使う。**
 * 片方にだけ書くと「追加時は保存されるが編集すると消える」が起きる。
 *
 * ⚠️ 終了日が無い在籍には退職理由を送らない。画面にも出していないので、
 *    「現職に切り替えたら退職理由が残っていた」を作らない。
 */
function buildReasonBody(d: StintDraft): Record<string, unknown> {
  return {
    prefecture: d.prefecture || null,
    remote_work_status: d.remoteWorkStatus || null,
    join_reasons: d.joinReasons,
    join_reason_primary: d.joinReasonPrimary || null,
    leave_reasons: hasLeftCompany(d) ? d.leaveReasons : [],
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
    leaveReasons: hasLeftCompany(d) ? d.leaveReasons : [],
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
      /* ⚠️★**タップ領域を 44px にする**（2026-08-28）。
            直す前は **36px**（実測）で、44px の推奨タップ領域を満たしていなかった。
            375px の職歴モーダルにこのチップが46個並ぶ。

         ── ★`::after` で当たり判定だけ広げる案は捨てた（実測で動かなかった）──
         `position: absolute` の `::after` を上下 -4.5px で重ねたが、
         `elementFromPoint` で**拾えなかった**。`z-index: 0` を足しても、
         親の `gap` を 6 → 9px に広げても**下側が当たらないまま**だった。
         **疑似要素のヒットテストは当てにしない。**

         → **`min-height: 44px` で実体を大きくする。** 上下の余白は増えるが、
            `border-radius: 100` と背景色は変わらないので**見た目の印象は保たれる**。
         ⚠️ 46個並ぶので縦に伸びる。それでも**押せないより押せるほうがよい**。

         ⚠️ `reason-chip` に**当たる CSS は無い**。ブラウザで高さを測るための目印
            （`document.querySelectorAll(".reason-chip")`）。消すと再計測できなくなる。 */
      className="reason-chip"
      style={{
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "var(--font-inter), var(--font-noto)" }}>
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
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--success-ink)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
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

/**
 * ★この職歴を保存してよいか（2026-08-17 / フェーズ2）。
 * **フォームとモーダルのフッターが同じ判定を見るために関数へ出した。**
 * ⚠️ 片方だけに書くと「赤字は出ていないのに保存が押せない」がまた起きる。
 */
export function canSaveStint(draft: StintDraft): boolean {
  const startedAt = draftStartedAt(draft);
  const endedAt = draftEndedAt(draft);
  const periodInvalid = !draft.isCurrent && !!endedAt && !!startedAt && startedAt > endedAt;
  const descOver = draft.description.length > 500;
  return !!draft.companyName.trim() && !!draft.roleCategoryId && !!startedAt && !descOver && !periodInvalid;
}

/**
 * ★入力欄だけ。**保存行は持たない**（2026-08-17 / フェーズ2）。
 * 保存・閉じる・破棄の確認は `ProfileEditModal` のフッターが持つ。
 */
function StintForm({
  draft,
  onDraftChange,
  isSaving,
  roles,
  roleAliases,
  companyLocked = false,
}: {
  draft: StintDraft;
  onDraftChange: (d: StintDraft) => void;
  isSaving: boolean;
  roles: { id: string; name: string; parent_id: string | null; display_order: number }[];
  /** role_id → 別名。検索でヒットさせるために使う（ow_role_aliases） */
  roleAliases?: Record<string, string[]>;
  companyLocked?: boolean;
}) {
  /** 上限（`REASON_MAX`）に当たったことを伝える短い注記。次の操作で消える（2026-08-19）。 */
  const [limitNote, setLimitNote] = useState<null | "join" | "leave">(null);

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
      /* ⚠️ 上限に達していたら**選ばせない**（2026-08-19）。
            既存の選択を押し出す形にすると、利用者が選んだものが黙って消える。
            代わりに短い注記を出す。注記は次の操作で消える。
            ⚠️ 同じ上限を API（parseReasonFields）と DB の CHECK でも見ている。
               ここだけ直すと「選べないのに保存はできる」形になる。 */
      if (!cur.includes(value) && cur.length >= REASON_MAX) {
        setLimitNote(key === "joinReasons" ? "join" : "leave");
        return;
      }
      setLimitNote(null);
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/*
        会社名

        ⚠️★**「非公開にする」チェックは 2026-09-02 に撤去した（柴さんの判断）。戻さないこと。**
           社名を伏せる機能は持たない、という製品判断。LinkedIn も同じで、あちらで社名を
           伏せる方法は「その職歴を載せない」だけ（職歴に会社を書けば社名は必ず出るし、
           会社ページの社員一覧にも載る）。
           ⚠️ **したがって、社名を出したくない人の選択肢は「その職歴を登録しない」になる。**
              これは承知のうえの判断であって、実装漏れではない。
           実測（2026-09-02 / 本番 24件）: `company_anonymized` は **0件**で、
           撤去した時点で誰も使っていなかった。

        ⚠️ **`draft.isAnon` と下の分岐は残してある。** 既存の匿名行（本番0件）を編集したとき、
           `CompanySearch` に流し込んで保存すると **`company_text` へ黙って変わる**。
           「値が無い」ではなく「別の値に化ける」形なので、経路ごと消さずに読み書きを保つ。
           ⚠️ **新しく `isAnon` を true にする経路を足さないこと。** 選ぶ手段が無いのが今の仕様。
      */}
      <div>
        <div style={{ marginBottom: 6 }}>
          <label style={labelStyle()}>会社名<RequiredMark /></label>
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
        {/* ★大分類のままなら、より細かい職種を選べることを伝える（2026-08-30）
            ⚠️★**これは「直せ」ではない。** `selectableParent` は意図して true で、
               過去の非IT職は「営業」「販売・サービス」で十分（上のコメント）。
               **止めない・赤くしない・保存もできる。**
            ⚠️ **現職のときだけ出す。** 過去の職歴まで促すと上の方針と衝突する。
               実測（2026-08-30）: 大分類のままの職歴10件のうち**現職が8件**。
            ⚠️ 効果は2つ。①「職種×年数」の自動集計は**子職種だけを見る**ので、
               親のままだとスキルとして出ない。②求人との突き合わせが具体的になる。
               **理由を書かずに促さない。**
            ⚠️ バナーにしない。/mypage のバナーは3回とも「同じ操作への入口が2つ」に
               なって撤去されている（MypageClient のコメント）。**入口はここ1つ。** */}
        {draft.isCurrent && draft.roleCategoryId
          && roles.some((r) => r.parent_id === draft.roleCategoryId) && (
          <p style={{
            margin: "6px 0 0", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)",
            fontFamily: "var(--font-inter), var(--font-noto)",
          }}>
            大分類のままです。より近い職種を選ぶと、スキルの年数や求人との一致が具体的になります（任意）。
          </p>
        )}
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
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 4, fontFamily: "var(--font-inter), var(--font-noto)" }}>
            退職年月は入社年月以降に設定してください
          </div>
        )}
      </div>

      {/*
        入社・退職の背景（選択式）

        ⚠️ **すべて非公開。** 本人と集計にしか使わない。公開トグルは出さない。

        ⚠️ **位置は「会社・職種・期間」の直下**（2026-08-19 に自由記述の上から移した）。
           それまではフォームの下から2番目にあり、追加モーダルでは本文 2,105px
           （1280px 幅）のうち **1,086px 目**＝約2画面ぶん下だった。実データが0件
           だった主因はここだと判断している。**チップは入力負荷が軽いので、
           重い自由記述（業務内容・なぜこの会社を選んだか）より前に置く。**

        ⚠️ **見出しに「任意」と書かない。** 任意と書かれた項目は飛ばされる。
           代わりに「答えると何が起きるか」を1行で書く。

        ⚠️ 軸（仕事の中身・裁量・役割…）は**小見出しとして置くだけ**。
           押して降りる階層にしない。**タップ対象は選択肢だけ**にする。

        ⚠️ 選べるのは `REASON_MAX`（3つ）まで。**同じ上限を API と DB の CHECK でも見る**
           （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
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
              この会社を選んだ理由と、離れた理由
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--success-ink)",
                background: "var(--success-soft)",
                padding: "2px 8px",
                borderRadius: 100,
                letterSpacing: "0.03em",
              }}
            >
              この内容は公開されません
            </span>
          </div>
          {/* ⚠️ **まだ無い機能を約束しない**（2026-08-20）。
                 一度「同じ選び方をした人や会社が見つかるようになります」と書いたが、
                 サジェストは未実装で、集計も閾値（退職5件・入社3件）を満たす企業が
                 **現時点で0社**。最初に入力してくれた人の信用を落とすので差し替えた。
              ⚠️ **サジェストが実際に動いたら、ここを書き換える。**
                 そのときは「何ができるようになるか」を書いてよい。 */}
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: "var(--ink-mute)" }}>
            あなた以外には表示されません。企業ごとの傾向を集計するために使います。
          </p>
        </div>

        {/* 入社理由（軸ごと・3つまで） */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
            この会社に入った理由
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 10 }}>
            {REASON_MAX}つまで選べます（{draft.joinReasons.length} / {REASON_MAX}）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groupReasonsByAxis(JOIN_REASONS).map((g) => (
              /* ⚠️ 軸のラベルとチップを横並びにしない。狭い画面でラベルを固定幅にすると
                    はみ出しの原因になる（CLAUDE.md「横はみ出しは flex-shrink: 0 を疑う」）。 */
              <div key={g.axis} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>
                  {g.axisLabel}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9, minWidth: 0 }}  /* ⚠️ チップは minHeight 44px。隣接しすぎると押し間違えるので gap は 9 */>
                  {g.options.map((o) => (
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
            ))}
          </div>
          {limitNote === "join" && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8 }}>
              {REASON_MAX}つまでです。ほかを外してから選んでください。
            </div>
          )}
        </div>

        {/* 決め手（選んだ理由の中から1つ） */}
        {draft.joinReasons.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              その中で、いちばんの決め手は
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}  /* ⚠️ 上と同じ理由で 9 */>
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

        {/* 退職理由 — ★終了日がある在籍にだけ出す（現職・終了日未入力には出さない） */}
        {hasLeftCompany(draft) && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
              この会社を離れた理由
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 10 }}>
              {REASON_MAX}つまで選べます（{draft.leaveReasons.length} / {REASON_MAX}）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groupReasonsByAxis(LEAVE_REASONS).map((g) => (
                <div key={g.axis} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>
                    {g.axisLabel}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, minWidth: 0 }}  /* ⚠️ チップは minHeight 44px。隣接しすぎると押し間違えるので gap は 9 */>
                    {g.options.map((o) => (
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
              ))}
            </div>
            {limitNote === "leave" && (
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8 }}>
                {REASON_MAX}つまでです。ほかを外してから選んでください。
              </div>
            )}
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9, minWidth: 0 }}  /* ⚠️ チップは minHeight 44px。隣接しすぎると押し間違えるので gap は 9 */>
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

      {/* ★「選んだ理由を、自分の言葉で」— 2026-08-20 にここへ移した。
             それまではフォームの最下部にあり、上の理由チップと**同じことを2回聞く**形だった。
             理由ブロックの直下に置いて、チップの補足であることを位置で示す。

          ⚠️ **ラベルを「補足」にしない。** 何の補足か分からず、結局チップと同じ内容が書かれる。
             「自分の言葉で」＝チップでは表せない具体的な経緯を書く欄だと分かる言い方にする。

          ⚠️ ★**紫バッジ「公開プロフィールに表示」は必ず残す。**
             すぐ上のチップ群は緑バッジ「この内容は公開されません」で、
             **公開範囲が正反対のものが隣り合っている。**
             バッジを外すと、非公開のつもりで公開の欄に書かれる。
             ⚠️ **「2つのバッジが同時に目に入る」ことは期待できない**（2026-08-27 に実測）。
                実際には 1,138px（1280px）/ 1,430px（375px）離れており、
                入力する時点で緑バッジは画面の外にある。
                **同時視認をあてにせず、囲み・間隔・直下の1行の3つで伝える。** */}
      {/* ★公開側の囲み（2026-08-27）。すぐ上の非公開ブロックと**対比**させる。
             ⚠️ 構造は変えていない。**この div は元からあった**もので、
                背景・枠・余白を足しただけ。中身の並び（ラベル→注記→入力欄→字数）も
                バッジの位置以外そのまま。

          ── なぜ囲みが要るか（2026-08-27 実測）─────────────────────────────
          自由記述欄は**もともと非公開ブロックの外**にあり、DOM も見た目もそうなっていた。
          それでも「同じブロックの中にある」と読まれた原因は**余白の付き方**だった。

            フォームの**ブロック間** gap … **14px**（この上の親 div）
            非公開ブロックの**内側**  gap … **16px**

          **外側の区切りのほうが内側より狭い。** これだと近接の原則が逆に働き、
          「囲みが終わった」ことより「まだ続いている」ことのほうが強く見える。
          しかも緑バッジと紫バッジは **1,138px（1280px）/ 1,430px（375px）離れている**ので、
          入力する瞬間に緑バッジは画面外にある。

          → **囲みで所属を示し、間隔を内側より広げて切れ目を作る。**

          ⚠️ **間隔は 28px**（親の gap 14px ＋ ここの marginTop 14px）。
             内側の 16px より広く、かつ 14px の刻みを崩さない最小の値として選んだ。
             **16px より広いことが要件**で、28 という数字自体に意味は無い。

          ⚠️ **背景は白のまま、枠だけ紫にする。** 面を `--purple-soft` で塗ると、
             同じ色を背景に持つ「公開プロフィールに表示」バッジが**囲みに溶けて消える。**
             非公開側が「グレーの塗り＋グレーの枠」なので、
             「白＋紫の枠」との対比で十分に分かれる。

          ⚠️ **緑バッジ側には一切触っていない。** あちらは現に効いている表示。 */}
      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: "1px solid var(--purple-soft)",
          borderRadius: 10,
          padding: "14px 16px",
        }}
      >
        {/* ★バッジは囲みの先頭。見出しの横に置くと「この項目の注記」に見え、
               囲み全体の公開範囲を表しているのか判別できない。 */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--purple)", background: "var(--purple-soft)", padding: "1px 7px", borderRadius: 100, letterSpacing: "0.04em" }}>
            公開プロフィールに表示
          </span>
        </div>
        <label style={labelStyle()}>
          <span>選んだ理由を、自分の言葉で（任意）</span>
        </label>
        {/* ⚠️ ★バッジだけでは足りない（2026-08-20 実測）。
               緑バッジ（この内容は公開されません）と紫バッジは **1,138px 離れており**、
               1280px の本文表示領域（688px）に**同時には入らない**。
               入力する瞬間に「ここは公開される」と分かるよう、1行で言い直す。 */}
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.6, marginBottom: 6 }}>
          上の選択肢と違い、この欄に書いた内容は公開プロフィールに出ます。
        </div>
        <textarea
          aria-label="選んだ理由を、自分の言葉で"
          value={draft.joinReason}
          onChange={(e) => set("joinReason", e.target.value)}
          placeholder="例: 面接の帰り道に、ここでならあと10年やれると思った"
          disabled={isSaving}
          rows={2}
          style={{ ...fieldStyle(), resize: "vertical", lineHeight: 1.7, borderColor: "var(--purple-soft)" }}
        />
        {/* ⚠️ 300字は UI / POST / PUT の3つで揃えている（2026-08-20）。
               以前は UI 300 / PUT 2000 / POST 5000 と3つとも違い、
               画面の警告を無視すれば黙って長い文が保存できた。 */}
        <div style={{ fontSize: 12, fontWeight: 600, color: draft.joinReason.length > 300 ? "var(--error)" : "var(--ink-mute)", textAlign: "right", marginTop: 2, fontFamily: "var(--font-inter), var(--font-noto)" }}>
          {draft.joinReason.length > 300 ? `${draft.joinReason.length - 300} 文字超過` : `残り ${300 - draft.joinReason.length} 文字`}
        </div>
      </div>

      {/* ★役職 / 雇用形態 / 社内での呼び方 / 部署名 は、
            2026-08-20 に「この会社を選んだ理由と、離れた理由」の**下**へ移した。
            どれも無くても職歴として成立する補助項目で、これらが上にあると
            背景ブロックが約2画面ぶん下に沈んでいた（実測 836px）。
         ⚠️ **表示順を変えただけ。** 送信内容・必須判定・バリデーションには触っていない。 */}
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
          id={EMPLOYMENT_TYPE_FIELD_ID}
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

      {/*
        勤務地・勤務形態
        ⚠️ 本人の**居住地**（ow_users.location）とは別物。ここは「その期間どこで働いたか」。
        ⚠️ **どの経歴でも任意。** 現職も含めて必須にしない（2026-08-13 に方針変更）。
           必須ゲートは「勤務地と関係ない編集まで保存できない」行き止まりを作るだけで、
           入力を促す仕掛けとして機能していなかった。案内に置き換えている。
      */}
      <div>
        {/* ⚠★「勤務地」だけだと**会社の所在地**と読まれる（2026-08-29）。
               入れてほしいのは**本人が実際に働いていた場所**。東京の会社に京都から
               リモートで勤めていたなら「京都府 ＋ フルリモート」になる。
            ⚠ 2軸あるので**どちらか一方を選ばせない。** 説明文をここから消さないこと。 */}
        <label style={labelStyle()}>
          勤務地
          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>（任意）</span>
        </label>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: -2, marginBottom: 6, lineHeight: 1.5 }}>
          会社の所在地ではなく、<strong style={{ fontWeight: 700 }}>あなたが実際に働いていた場所</strong>を選んでください。
          東京の会社に京都から在宅で勤めていたなら「京都府 ＋ フルリモート」です。
        </div>
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
            fontSize: 12, fontWeight: 600, color: "var(--warm-ink)",
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
        <div style={{ fontSize: 12, fontWeight: 600, color: descOver ? "var(--error)" : "var(--ink-mute)", textAlign: "right", marginTop: 2, fontFamily: "var(--font-inter), var(--font-noto)" }}>
          {descOver ? `${descLen - 500} 文字超過` : `残り ${500 - descLen} 文字`}
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

    </div>
  );
}

// ── Main: CareerHistoryEditor ─────────────────────────────────────────────────

export default function CareerHistoryEditor({
  initialExperiences = [],
  roles = [],
  roleAliases = {},
  onSavedCountChange,
  onExperienceDeleted,
  openAddNonce, openEditId, openDeleteId, openAddRoleForCareerId, onClosed,
  onStintsChange,
}: {
  initialExperiences?: Stint[];
  roles?: { id: string; name: string; parent_id: string | null; display_order: number }[];
  roleAliases?: Record<string, string[]>;
  /** 保存済みの職歴件数。**API が成功したときだけ**変わる（stints は楽観更新ではなく成功後に更新している）。
      親の完成度がこれを見る。渡さなくても動く。 */
  onSavedCountChange?: (count: number) => void;
  /** 職歴を削除したときに呼ぶ。★DB 側は ON DELETE SET NULL で実績を残すので、
      呼び出し側は手元の実績・受賞の experience_id も null に落とす必要がある
      （やらないと、再読み込みするまで画面から消えたように見える） */
  onExperienceDeleted?: (experienceId: string) => void;
  /** ★カードの見出しにある「＋」から追加モーダルを開くための合図（2026-08-16）。
      値が変わるたびに開く。⚠️ ref を渡さない（この部品の内部状態を外に晒さないため）。 */
  openAddNonce?: number;
  /** ★外（公開部品の行の鉛筆）から編集モーダルを開く行の id（2026-08-16 / 2-6） */
  openEditId?: string | null;
  /** ★外（行のゴミ箱）から削除確認を開く行の id */
  openDeleteId?: string | null;
  /** ★外（会社グループの「この会社に役割を追加」）から開く。値はその会社の職歴の**どれか1件の id** */
  openAddRoleForCareerId?: string | null;
  /** モーダルが閉じたことを親へ知らせる */
  onClosed?: () => void;
  /** ★保存済みの職歴そのもの。**親が表示（`MergedTimeline`）に使う。**
      ⚠️ `onSavedCountChange` と同じく `res.ok` の後にしか変わらない。 */
  onStintsChange?: (stints: Stint[]) => void;
}) {
  const [stints, setStints] = useState<Stint[]>(() => sortStints(initialExperiences));

  /* 見出しの「＋」から開く。★初回マウント時（undefined / 0）は開かない。
     ⚠️ **nonce は消費しても 0 に戻らない**（`.claude/rules/ui-debugging.md` ⑭）。
        他の意図（行の鉛筆・ゴミ箱・役割追加）で開いたときは発火させない。 */
  /* ⚠️ **nonce は値が変わったときだけ発火させる**（ルール⑭・2026-08-17）。
        副条件（`!openEditId` など）を混ぜると、**その id が null に戻った瞬間に**
        nonce がまだ立っていることで再発火し、編集を閉じた直後に追加が開く。 */
  const lastAddNonce = useRef(openAddNonce);
  useEffect(() => {
    if (openAddNonce === undefined || openAddNonce === lastAddNonce.current) return;
    lastAddNonce.current = openAddNonce;
    setAddDraft(EMPTY_DRAFT);
    setAddingForCompanyKey("__new__");
  }, [openAddNonce]);

  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  /* 保存済み件数を親へ返す。⚠️ 3箇所の setStints はいずれも `res.ok` の後なので、
     ここで通知される件数は「保存済み」を意味する。 */
  useEffect(() => { onSavedCountChange?.(stints.length); }, [stints.length, onSavedCountChange]);
  /* ★一覧の描画に使うので中身ごと返す（2026-08-16 / 2-6） */
  useEffect(() => { onStintsChange?.(stints); }, [stints, onStintsChange]);

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

  /* ★外（公開部品の行）から開く（2026-08-16 / 2-6）。id は行ごとに変わるので nonce ではなく id を見る */
  useEffect(() => {
    if (!openEditId) return;
    const t = stints.find((s) => s.id === openEditId);
    if (t) startEdit(t);
  }, [openEditId, stints, startEdit]);
  useEffect(() => {
    if (!openDeleteId) return;
    const t = stints.find((s) => s.id === openDeleteId);
    if (t) setDeleteTarget(t);
  }, [openDeleteId, stints]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
    onClosedRef.current?.();
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
    onClosedRef.current?.();
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

  /* ⚠️ Esc の処理は `ProfileEditModal` が持つ（2026-08-17）。**ここに置かない。**
        自前のモーダルをやめたあとも残っていて、**未保存でも確認を出さずに閉じていた**
        （モーダル側の確認より先に window で拾って閉じてしまう）。 */

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
      onClosedRef.current?.();
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, showToast, onExperienceDeleted]);

  // ── Render ───────────────────────────────────────────────────────────────────

  /* ⚠️ `groups` は一覧の描画用ではなく、**「この会社に役割を追加」で会社を引き当てる**ために要る。
        年区切り・並行在籍の横並びは公開部品が持つので、ここでは組まない。 */
  const groups = groupStints(stints);

  /* ★外（会社グループの「この会社に役割を追加」）から開く。
        渡ってくるのは**その会社の職歴のうち1件の id**。会社のキー文字列ではない
        （`MergedTimeline` とこの部品でキーの作り方が違い、匿名企業で食い違うため）。 */
  useEffect(() => {
    if (!openAddRoleForCareerId) return;
    const g = groups.find((gr) => gr.positions.some((p) => p.id === openAddRoleForCareerId));
    if (!g) return;
    setAddDraft(draftFromGroup(g));
    setAddingForCompanyKey(g.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddRoleForCareerId]);

  /* ★モーダルに渡す値（2026-08-17）。
        ⚠️ 差分の基準は**いま保存されている職歴**（ルール⑦）。
           「この会社に役割を追加」は会社名だけ埋まった状態で開くので、
           その状態を基準にする（開いた瞬間に保存が押せないように）。
        ⚠️ 保存できるかの判定（必須・期間の前後・文字数）は `canSaveStint` に集約した。 */
  const careerIsEditing = editingId !== null;
  const careerDraft = careerIsEditing ? editDraft : addDraft;
  const careerBase = careerIsEditing
    ? (() => { const st = stints.find((x) => x.id === editingId); return st ? draftFromStint(st) : EMPTY_DRAFT; })()
    : (() => {
        const g = addingForCompanyKey && addingForCompanyKey !== "__new__"
          ? groups.find((gr) => gr.key === addingForCompanyKey) : undefined;
        return g ? draftFromGroup(g) : EMPTY_DRAFT;
      })();
  const careerDirty = canSaveStint(careerDraft)
    && JSON.stringify(careerDraft) !== JSON.stringify(careerBase);

  return (
    <div>
      <style>{`
        .career-row { display: flex; gap: 12px; }
        @media (max-width: 640px) { .career-row { flex-direction: column; } }
      `}</style>

      {/* ★一覧・鉛筆・ゴミ箱・0件の1行・「＋」は公開部品（`MergedTimeline`）が持つ（2026-08-16 / 2-6）。
             ここはモーダル（追加・編集フォーム）と削除確認だけ。
             一覧を戻すと同じ見た目が2箇所に生まれる。 */}

      {/* ★フォームモーダル（編集・追加共通）。
             2026-08-17 に自前のモーダルをやめ、他のセクションと同じ
             `ProfileEditModal` に寄せた（保存は右下の1つだけ・破棄の確認つき）。 */}
      <ProfileEditModal
        open={careerIsEditing || addingForCompanyKey !== null}
        title={careerIsEditing ? "職歴を編集" : addingForCompanyKey && addingForCompanyKey !== "__new__" ? "この会社に役割を追加" : "職歴を追加"}
        dirty={careerDirty}
        saving={careerIsEditing ? editSaving : addSaving}
        justSaved={careerIsEditing ? editJustSaved : addJustSaved}
        error={null}
        onSave={() => { if (careerIsEditing) void saveEdit(); else void saveAdd(); }}
        onClose={() => { if (careerIsEditing) cancelEdit(); else cancelAdd(); }}
      >
        <StintForm
          draft={careerDraft}
          onDraftChange={careerIsEditing ? setEditDraft : setAddDraft}
          isSaving={careerIsEditing ? editSaving : addSaving}
          roles={roles}
          roleAliases={roleAliases}
          companyLocked={!careerIsEditing && addingForCompanyKey !== null && addingForCompanyKey !== "__new__"}
        />
      </ProfileEditModal>

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
        onCancel={() => { setDeleteTarget(null); onClosedRef.current?.(); }}
      />

      {/* Toast */}
      {toastMsg && (
        <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />
      )}

    </div>
  );
}
