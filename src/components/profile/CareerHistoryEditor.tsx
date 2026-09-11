"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useCompanyLookup,
  type CompanyLookupResult,
} from "@/components/companies/useCompanyLookup";
import { CompanyCreateDialog } from "@/components/companies/CompanyCreateDialog";
import { EMPLOYMENT_TYPES, RANKS, EMPLOYMENT_TYPE_FIELD_ID } from "@/lib/constants/careerOptions";
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";

import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import { ProfileEditModal } from "@/components/profile/editor/ProfileEditModal";
/* ★理由データの設問（2026-09-12 に職歴の編集モーダルから移した）。
      ⚠️ **設問をこのファイルに書き戻さないこと。** 入口が2つ（追加の直後 / カードのアイコン）
         あるので、割れると片方だけ直る形の不具合になる。 */
import {
  ExperienceReasonModal,
  reasonAnswersFrom,
  type ReasonAnswers,
} from "@/components/profile/editor/ExperienceReasonModal";
import {
  postExperience,
  type ExperienceCompanyBody,
  type ExperienceReasonBody,
} from "@/lib/experiences/createExperience";


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
  visibilitySalary: false,
  /* ⚠️★**既定は「出さない」**（2026-09-11 に `true` から変えた）。行ごとの設定なので、
        **選び忘れが同意なき公開にならない向き**に倒す。DB の既定も同日 `false` にした。
        ⚠️ **片方だけ戻さないこと**（CLAUDE.md「UI / API / DB を揃える」）。 */
  visibilityReason: false,
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
 * 保存 body 用（勤務地）。**編集と追加で同じ関数を使う。**
 * 片方にだけ書くと「追加時は保存されるが編集すると消える」が起きる。
 *
 * ⚠️★**理由データ（入社理由・決め手・離れた理由・ギャップ）はここに入れない**（2026-09-12）。
 *    設問は `ExperienceReasonModal` へ移した。職歴の編集保存から理由を送ると、
 *    **モーダルに入力欄が無いのに空で上書きする**ことになる。
 *    ⚠️ サーバー側も「キーが無ければ触らない」にしてある（二重の守り）。
 */
function buildLocationBody(d: StintDraft): ExperienceReasonBody {
  return {
    prefecture: d.prefecture || null,
    remote_work_status: d.remoteWorkStatus || null,
  };
}

/**
 * 保存 body 用（理由データ）。**`ExperienceReasonModal` の答えだけを送る。**
 *
 * ⚠️ 終了日が無い在籍には退職理由を送らない。画面にも出していないので、
 *    「現職に切り替えたら退職理由が残っていた」を作らない。
 * ⚠️★**`join_reasons` を送るときは `join_reason_primary` も必ず一緒に送る。**
 *    DB の CHECK（`ow_experiences_join_reason_primary_check`）が
 *    「決め手は選んだ理由の中の1つ」を要求するので、片方だけ更新すると 23514 になる。
 */
function buildReasonAnswerBody(a: ReasonAnswers, showLeave: boolean): ExperienceReasonBody {
  return {
    join_reasons: a.joinReasons,
    join_reason_primary: a.joinReasonPrimary || null,
    leave_reasons: showLeave ? a.leaveReasons : [],
    gaps: Object.entries(a.gaps).map(([axis, rating]) => ({ axis, rating })),
  };
}

/** 楽観的更新用。buildLocationBody と同じ値を Stint の形にする */
function optimisticLocationFields(d: StintDraft): Partial<Stint> {
  return {
    prefecture: d.prefecture || undefined,
    remoteWorkStatus: d.remoteWorkStatus || undefined,
  };
}

/** 楽観的更新用。buildReasonAnswerBody と同じ値を Stint の形にする */
function optimisticReasonAnswers(a: ReasonAnswers, showLeave: boolean): Partial<Stint> {
  return {
    joinReasons: a.joinReasons,
    joinReasonPrimary: a.joinReasonPrimary || undefined,
    leaveReasons: showLeave ? a.leaveReasons : [],
    gaps: Object.entries(a.gaps).map(([axis, rating]) => ({ axis, rating })),
  };
}

// ── Company body helpers ──────────────────────────────────────────────────────

/** 保存 body 用: company_id / company_text / company_anonymized の3者排他を保証 */
function buildCompanyBody(
  draft: Pick<StintDraft, "isAnon" | "companyId" | "companyName">
): ExperienceCompanyBody {
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
/* ⚠️★`ReasonChip` は 2026-09-12 に `ExperienceReasonModal` へ移した。
      **ここに書き戻さないこと**（同じチップが2つに割れる）。 */

// ── IconButton ────────────────────────────────────────────────────────────────

// ── CompanySearch ─────────────────────────────────────────────────────────────

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
  /* ⚠️ 取得は `useCompanyLookup` に寄せた（2026-09-05）。
        **デバウンスの 250ms は変えない** —— 揃えるとこの画面の挙動が変わる。 */
  const { results, loading, search, clear: clearResults } = useCompanyLookup({ debounceMs: 250 });
  const [open, setOpen] = useState(false);
  /** 選んだ企業の付随情報（業種など）。既存レコードを開いた直後は無いので名前だけ出す */
  const [selectedMeta, setSelectedMeta] = useState<CompanyLookupResult | null>(null);
  /* ⚠️ 「自由入力で確定した」ことを覚えておく。`companyId === null` だけでは
        「まだ入力している途中」と区別がつかず、確定前から未掲載の案内が出てしまう。
        既存レコードを開いたときは確定済みとして扱う（value があって id が無い＝自由入力）。 */
  const [freeConfirmed, setFreeConfirmed] = useState(
    () => companyId === null && value.trim().length > 0
  );
  /* ★「この会社をOPINIOに登録する」を開いているか（2026-09-05）。
        ⚠️ ダイアログは**ドロップダウンの代わりに**出す。重ねない。 */
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    setCreating(false);
    setOpen(true);
    /* ⚠️★叩くのは `/api/companies/lookup`（hook の中）。`/api/companies/search` は
          掲載中しか返さず、**マスタにある未掲載の企業を選べない**
          （実測: 「鹿島」で0件だった）。選べないと company_text に落ち、
          業界に結びつかない。 */
    search(q);
  }

  function handleSelect(c: CompanyLookupResult) {
    onChange(c.id, c.name);
    setSelectedMeta(c);
    setFreeConfirmed(false);
    clearResults();
    setOpen(false);
  }

  function handleNew() {
    onChange(null, value); // companyId=null、companyName=入力テキストで確定
    setSelectedMeta(null);
    setFreeConfirmed(true);
    clearResults();
    setOpen(false);
  }

  function clearSelection() {
    onChange(null, "");
    setSelectedMeta(null);
    setFreeConfirmed(false);
    clearResults();
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
            {/* ★選んだのが未掲載の企業なら、その旨をここでも出す。
                   ⚠️ 候補の行だけに出すと、選んだあとに消えて「掲載中を選んだ」と誤解される。 */}
            {selectedMeta && !selectedMeta.isListed && (
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                OPINIOに未掲載（企業ページはありません）
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
                {/* ⚠️ ロゴは出さない（lookup が返さない）。イニシャル＋固定色 */}
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: avatarColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                    {c.name.charAt(0)}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
                  {/* ★掲載中と未掲載を区別して出す。⚠️ 未掲載でも**選べる**（company_id で繋がる）。
                         「選べない」と誤解される表現にしないこと。 */}
                  {!c.isListed && (
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                      OPINIOに未掲載（企業ページはありません）
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ★① この会社をOPINIOに登録する（2026-09-05 追加）
              ⚠️ **自由入力より先・大きく出す。** 自由入力は業界に結びつかないので、
                 そちらが既定に見えると「業界に繋がらない経歴」が増える。 */}
          <div
            onMouseDown={(e) => { e.preventDefault(); setCreating(true); setOpen(false); }}
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
                「{value}」をOPINIOに登録する
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                会社名と業種だけ。あなたの経歴に会社として紐づきます
              </div>
            </div>
          </div>

          {/* ② 自由入力で確定 —— ⚠️ **消さない。** 企業作成は取り消せないが、
              自由入力は本人の職歴の中で完結する。失敗したときのコストが違うので
              逃げ道として残す（2026-09-05 / 柴さんの判断）。
              ⚠️ 「新規登録」と書かない。**企業マスタには何も作らない**。
                 保存先は ow_experiences.company_text だけ（2026-08-13 に文言を実態へ寄せた）。 */}
          <div
            onMouseDown={(e) => { e.preventDefault(); handleNew(); }}
            style={{
              padding: "8px 12px", display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", borderTop: "1px solid var(--line-soft)",
            }}
            className="ched-suggest-new"
          >
            <div style={{ width: 28, flexShrink: 0 }} />
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
              登録せず、「{value}」をこの名前のまま入力する
            </div>
          </div>
        </div>
      )}

      {/* ★作成ダイアログ。⚠️ 経歴編集とオンボーディングで**同じ部品**を使う */}
      {creating && !isMaster && (
        <CompanyCreateDialog
          initialName={value}
          onCancel={() => setCreating(false)}
          onCreated={(c) => { setCreating(false); handleSelect(c); }}
        />
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
  const set = useCallback(
    (key: keyof StintDraft, val: string | boolean) =>
      onDraftChange({ ...draft, [key]: val }),
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



      {/* ★★社内での呼び方は 2026-09-12 に**職種の直下**へ移した（柴さんの指示）。
             職種（マスタの分類）→ 社内での呼び方（その会社での呼称）と並べる。
             それまでは雇用形態の下にあり、何の呼び方か読めなかった。
          ⚠️ **表示順を変えただけ。** 送信内容・必須判定・バリデーションには触っていない。 */}
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
        <label style={labelStyle()}>社内での呼び方</label>
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

      {/* ⚠️★**理由ブロック（入社理由・いちばんの決め手・離れた理由・ギャップ）は
             2026-09-12 にここから外した（柴さんの指示）。戻さないこと。**
             置き場所は `ExperienceReasonModal`（新規追加の保存直後 ＋ 職歴カードのアイコン）。
             設問・選択肢・上限・スラッグは1文字も変えていない。

          ⚠️★**「選んだ理由を、自分の言葉で（任意）」（`join_reason`）と
             「公開プロフィールに表示」トグル（`visibility_reason`）も同日に外した。**
             列とデータは残してある（migration は作っていない）。
             ⚠️ **編集の保存でこの2列を送らない。** サーバー側が「キーが無ければ触らない」
                なので、送らなければ既存の値が残る（`PUT /api/jobseeker/experiences/[id]`）。
             ⚠️ 描画も止めた（`MergedTimeline` の `JoinReasonNote`）。
                入力欄が無い以上、本人が直せない値を公開し続けないため。 */}

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

      {/* 部署名 */}
      <div>
        <label style={labelStyle()}>部署名</label>
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
        <label style={labelStyle()}>勤務地</label>
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
        {/* ⚠️★黄色い案内バー（「現職の勤務地と勤務形態を入れると…」）は
               2026-09-12 に外した（柴さんの指示）。**入力欄はそのまま。**
               ⚠️ 勤務地は**どの経歴でも任意**という方針は変えていない（2026-08-13）。
                  保存は元から止めていないので、外しても保存の挙動は変わらない。 */}
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
             `visibilityCompany` / `visibilityReason` の
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
  openAddNonce, openEditId, openDeleteId, openAddRoleForCareerId, openReasonId, onClosed,
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
  /** ★外（職歴カードの吹き出しアイコン）から「理由」モーダルを開く行の id（2026-09-12）。
      ⚠️ 新規追加の保存直後は**この部品が自分で開く**（外から渡さなくてよい）。 */
  openReasonId?: string | null;
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

  /* ★理由モーダル（2026-09-12）。入口は2つ:
        ① 新規追加の保存直後（この部品が自分で開く）
        ② 職歴カードの吹き出しアイコン（`openReasonId`）
     ⚠️ **編集の保存後には開かない。** 既存の職歴を直すたびに設問が出ると、
        2026-08-19 に編集モーダルへ置いていたときと同じ形に戻る。 */
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [reasonSaving, setReasonSaving] = useState(false);
  const [reasonJustSaved, setReasonJustSaved] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

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
    visibilitySalary: false,
    /* ⚠️ 既定は「出さない」（`EMPTY_DRAFT` と同じ。理由はあちらのコメント） */
    visibilityReason: false,
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
  /* ★職歴カードの吹き出しアイコンから開く（2026-09-12） */
  useEffect(() => {
    if (!openReasonId) return;
    setReasonError(null);
    setReasonId(openReasonId);
  }, [openReasonId]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
    onClosedRef.current?.();
  }, []);

  /**
   * PUT の本体（理由データ以外）。**編集モーダルと理由モーダルが同じ関数を通る。**
   *
   * ⚠️★**理由モーダルからの保存でもこれを必ず一緒に送る。** `PUT` は
   *    `role_title` / `department` / `rank` / `description` / `employment_type` を
   *    **キーの有無に関わらず上書きする**（`s(body.x)` は undefined を null にする）ので、
   *    理由だけの最小 body を送ると**それらが全部消える。**
   */
  const buildPutCoreBody = useCallback((d: StintDraft): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      role_category_id: d.roleCategoryId,
      role_title: d.roleTitle || undefined,
      started_at: draftStartedAt(d),
      ended_at: d.isCurrent ? undefined : draftEndedAt(d) || undefined,
      is_current: d.isCurrent,
      description: d.description || undefined,
      /* ⚠️★`join_reason`（自由記述）と `visibility_reason` は送らない（2026-09-12）。
            入力欄を外したので、送ると**空で上書きする**。
            サーバーは「キーが無ければ触らない」ので、既存の値が残る。
            **列とデータは消していない**（migration を作っていない）。 */
      employment_type: d.employmentType || undefined,
      /* ⚠️ 年収系は送らない（2026-08-06 に入力UIを撤去）。
            送ると API 側で null に潰れ、既存の salary_man が消える。
            API は body にキーが無ければその列を更新しない作りにしてある。 */
      department: d.department || null,
      rank: d.rank || null,
      visibility_company: d.visibilityCompany,
      ...buildLocationBody(d),
    };
    Object.assign(body, buildCompanyBody(d));
    return body;
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const body = buildPutCoreBody(editDraft);

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
                employmentType: editDraft.employmentType || undefined,
                department: editDraft.department || undefined,
                rank: (editDraft.rank || null) as Stint["rank"],
                visibilityCompany: editDraft.visibilityCompany,
                ...optimisticLocationFields(editDraft),
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
  }, [editingId, editDraft, cancelEdit, showToast, buildPutCoreBody]);

  // ── Add handlers ─────────────────────────────────────────────────────────────
  const cancelAdd = useCallback(() => {
    setAddingForCompanyKey(null);
    setAddDraft(EMPTY_DRAFT);
    onClosedRef.current?.();
  }, []);

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      /* ⚠️★**作成は `postExperience()` だけを通す。** `fetch("/api/jobseeker/experiences")` を
            新しく書かないこと。⚠️★**オブジェクトリテラルを直接渡すこと**——
            `Record<string, unknown>` を組み立ててから渡すと、型の余剰プロパティ検査が
            素通りして `visibility_company` を直書きできてしまう（2026-09-11 にその形で踏んだ）。 */
      const res = await postExperience({
        ...buildCompanyBody(addDraft),
        role_category_id: addDraft.roleCategoryId,
        role_title: addDraft.roleTitle || undefined,
        started_at: draftStartedAt(addDraft),
        ended_at: addDraft.isCurrent ? undefined : draftEndedAt(addDraft) || undefined,
        is_current: addDraft.isCurrent,
        description: addDraft.description || undefined,
        /* ⚠️★`join_reason` と `visibility_reason` は送らない（2026-09-12）。入力欄を外した。
              送らなければ DB の既定（null / false）で入る。 */
        employment_type: addDraft.employmentType || undefined,
        display_order: stints.length,
        /* ⚠️ 年収系は送らない（2026-08-06 に入力UIを撤去）。
              送ると API 側で null に潰れ、既存の salary_man が消える。
              API は body にキーが無ければその列を更新しない作りにしてある。 */
        department: addDraft.department || null,
        rank: addDraft.rank || null,
        /* ⚠️★`visibility_company` は**型に無い**（`CreateExperienceBody`）。足さないこと。
              作成時の公開範囲は API が決める（既存の職歴から引き継ぐ）。
              ⚠️ 編集（PUT）は既存値をそのまま送る。あちらは消さないこと。 */
        ...buildLocationBody(addDraft),
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
        employmentType: addDraft.employmentType || undefined,
        visibilityCompany: addDraft.visibilityCompany,
        department: addDraft.department || undefined,
        rank: (addDraft.rank || null) as Stint["rank"],
        visibilityReason: addDraft.visibilityReason,
        ...optimisticLocationFields(addDraft),
      };

      setStints((prev) => sortStints([...prev, newStint]));
      showToast("職歴を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      cancelAdd();
      setAddJustSaved(false);
      /* ★保存できた**新規追加のときだけ**、理由を聞く別ステップを出す（2026-09-12）。
         ⚠️ **編集では出さない。** ⚠️ 失敗したときも出さない（この行は try の中）。 */
      setReasonError(null);
      setReasonId(id);
    } catch {
      showToast("追加に失敗しました。もう一度お試しください。", "error");
    } finally {
      setAddSaving(false);
    }
  }, [addDraft, stints.length, cancelAdd, showToast]);

  // ── 理由データの保存 ────────────────────────────────────────────────────────
  /**
   * ⚠️★**コア body を必ず一緒に送る。** `PUT` は役職・部署・業務内容などを
   *    キーの有無に関わらず上書きするので、理由だけの最小 body だと全部消える。
   * ⚠️ 既存の API・検証関数（`parseReasonFields`）・DB の CHECK をそのまま使う。
   *    選択肢・上限3つ・スラッグは変えていない。
   */
  const saveReasons = useCallback(async (answers: ReasonAnswers) => {
    const target = stints.find((x) => x.id === reasonId);
    if (!target) return;
    const d = draftFromStint(target);
    const showLeave = hasLeftCompany(d);
    setReasonSaving(true);
    setReasonError(null);
    try {
      const res = await fetch(`/api/jobseeker/experiences/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPutCoreBody(d),
          ...buildReasonAnswerBody(answers, showLeave),
        }),
      });
      if (!res.ok) throw new Error();
      setStints((prev) => prev.map((x) =>
        x.id === target.id ? { ...x, ...optimisticReasonAnswers(answers, showLeave) } : x
      ));
      showToast("回答を保存しました");
      setReasonJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setReasonId(null);
      setReasonJustSaved(false);
      onClosedRef.current?.();
    } catch {
      setReasonError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setReasonSaving(false);
    }
  }, [reasonId, stints, draftFromStint, buildPutCoreBody, showToast]);

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

  /* ★理由モーダルの対象。⚠️ 行が消えた（削除された）ら開かない */
  const reasonStint = reasonId ? stints.find((x) => x.id === reasonId) ?? null : null;

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

      {/* ★理由モーダル（2026-09-12）。⚠️ **職歴の編集モーダルとは別**。
             `key` で作り直すのは、開くたびに「ステップ1から・その行の既存の答えで」
             始めるため（回答済みなら復元した状態で開く）。 */}
      {reasonStint && (
        <ExperienceReasonModal
          key={reasonStint.id}
          open
          companyName={reasonStint.displayCompanyName}
          showLeave={hasLeftCompany(draftFromStint(reasonStint))}
          initial={reasonAnswersFrom(reasonStint)}
          saving={reasonSaving}
          justSaved={reasonJustSaved}
          error={reasonError}
          onSave={(a) => { void saveReasons(a); }}
          /* ⚠️ 「あとで答える」と ×。**何も保存しない**（仕様） */
          onClose={() => { setReasonId(null); setReasonError(null); onClosedRef.current?.(); }}
        />
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
        onCancel={() => { setDeleteTarget(null); onClosedRef.current?.(); }}
      />

      {/* Toast */}
      {toastMsg && (
        <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />
      )}

    </div>
  );
}
