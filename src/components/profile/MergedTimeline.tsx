"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
/* ⚠️ 行の操作は `view/RowActions` に置く（セクション定義に依存させない） */
import { type RowActions, type CareerActions, RowActionButtons, AddRoleLink, PlusIcon } from "./view/RowActions";
import CompanyLogoImg, { LetterCircle } from "./CompanyLogoImg";
import SchoolLogoImg from "./SchoolLogoImg";
import { formatDuration } from "@/lib/profile/tenure";
import { rankLabel, EMPLOYMENT_TYPE_FIELD_ID } from "@/lib/constants/careerOptions";
import { buildOverlapMap } from "@/lib/profile/parallel";

// ─── 会社名を短縮: "株式会社LayerX" → "LayerX" ────────────────────────────────
function shortCompanyName(name: string): string {
  return name
    .replace(/^株式会社\s*/, "")
    .replace(/\s*株式会社$/, "")
    .replace(/^有限会社\s*/, "")
    .replace(/\s*有限会社$/, "")
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s*,\s*Inc\.?$/i, "")
    .replace(/\s+Inc\.?$/i, "")
    .replace(/\s+Japan$/i, "")
    .trim() || name;
}

/* ─── ExpandableDesc: 長い説明文を「3行」で折りたたむ ────────────────────────

   ⚠️ **文字数（80字）での打ち切りに戻さないこと（2026-08-23 に変更）。**

   実測（ow_experiences の description 11件）:
     中央値 127字 / 最大 153字 / **11件中10件（91%）が80字超**
   つまりほぼ全件に「続きを読む」が出ていた。

   さらに 2026-08-15 に説明文の固定幅（560/520px）を撤去した結果、
   1行に入る字数が **画面幅で 3倍違う**ようになった。

     1440px … 1行 約62字 → 80字 = **1.3行**で畳まれる（畳む意味がない）
     375px  … 1行 約20字 → 80字 = **4行**で畳まれる

   **1つの文字数では両方に合わない。** 行数で畳めば、どの幅でも
   「3行を超えたら畳む」という同じ意味になる。

   ⚠️ 実装は CSS の `-webkit-line-clamp`（`.tl-desc-clamp`）。
      本文は**常に全文を DOM に置く**ので、折りたたみ中でも
      検索・コピー・クローラから読める（slice していたときは読めなかった）。

   ⚠️ ボタンの出し分けは **実測**（`scrollHeight > clientHeight`）で行う。
      文字数から推測しない ── フォント・幅・改行で変わるため。
   ⚠️ 展開中は測らない。展開すると clientHeight が伸びて必ず false になり、
      「折りたたむ」ボタンが消えてしまう。

   ⚠️ **行数（3行）は globals.css の `.tl-desc-clamp` が持つ。**
      ここに定数を置くと CSS と二重管理になり、片方だけ直る形になる。
──────────────────────────────────────────────────────────────────────────── */

function ExpandableDesc({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const pRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (expanded) return; // 展開中は測らない（上のコメント参照）
    const el = pRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text, expanded]);

  return (
    <>
      <p
        ref={pRef}
        className={expanded ? undefined : "tl-desc-clamp"}
        style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}
      >
        {text}
      </p>
      {overflows && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            borderRadius: 100, cursor: "pointer",
            color: "var(--royal)", fontSize: 12, fontWeight: 600,
            padding: "3px 10px", marginTop: 6, fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}
        >
          {expanded ? "折りたたむ ▲" : "続きを読む ▼"}
        </button>
      )}
    </>
  );
}

// ─── Public types (re-exported for use in Commit C) ───────────────────────────

export interface CareerEntry {
  id: string;
  /** 企業マスタID（master 企業の場合のみ存在、custom/anon は null） */
  company_id?: string | null;
  /** 表示用企業名（匿名化済みの場合は "非公開" 等） */
  company_name: string;
  /** 企業ロゴ画像 URL（ow_companies.logo_url）。null = 未登録 */
  logo_url?: string | null;
  /** 企業ロゴイニシャル文字（ow_companies.logo_letter）。フォールバック表示に使用 */
  logo_letter?: string | null;
  /** 企業ロゴ背景グラデーション（ow_companies.logo_gradient）。フォールバック表示に使用 */
  logo_gradient?: string | null;
  /** ロールカテゴリのラベル（例: "フィールドセールス"） */
  role_label: string;
  /** 親カテゴリ（部門）ラベル（例: "営業"） */
  role_parent_name?: string | null;
  /** 自由記述の役職名（例: "AE 関西DX推進営業部"） */
  role_title?: string | null;
  /**
   * 部署名（例: "ネットワークリクルーティング事業部・Solution Sales1G"）。
   * 同社グループ内の主見出しに使う。
   *
   * ⚠️ **SELECT に含めていない画面では undefined。** /mypage は現在含めていないので、
   *    向こうの表示は従来どおり（役職名が主見出し）になる。
   */
  department?: string | null;
  /** 役職ランクの**生値**（"manager" 等）。描画時は必ず rankLabel() を通す */
  rank?: string | null;
  started_at: string;       // "YYYY-MM-DD"
  ended_at: string | null;  // "YYYY-MM-DD" | null when is_current
  is_current: boolean;
  description?: string | null;
  /** なぜこの会社を選んだか（任意） */
  join_reason?: string | null;
  employment_type?: string | null;
}

export interface EducationSchoolMaster {
  id: string;
  name: string;
  logo_letter: string | null;
  logo_gradient: string | null;
  logo_url: string | null;
}

export interface EducationEntry {
  id: string;
  school: string;
  school_id?: string | null;                    // Phase 3: FK to ow_schools (nullable)
  school_master?: EducationSchoolMaster | null; // Phase 3: JOIN result for logo display
  faculty?: string | null;
  degree?: string | null;
  enrolled_at: string;         // "YYYY-MM-DD"
  graduated_at: string | null; // "YYYY-MM-DD" | null when is_current
  is_current: boolean;
}

export interface MergedTimelineProps {
  careers: CareerEntry[];
  educations: EducationEntry[];
  /**
   * ★行ごとの編集アフォーダンス（鉛筆・ゴミ箱）。`/mypage` だけが渡す。
   *
   * ⚠️ **渡さなければ DOM は1バイトも変わらない。** `/u/[id]` は渡さない。
   * ⚠️ 2-5 では**学歴の行にだけ**出している。職歴は `career` /
   *    `career-same-company` の**2経路**がある（`career-group` は 2026-08-26 に廃止）。
   */
  educationActions?: RowActions;
  /**
   * ★職歴の行ごとの編集アフォーダンス。`/mypage` だけが渡す（2026-08-16 / 2-6）。
   *
   * ⚠️ **職歴の行は2経路ある**（`career` / `career-same-company`）。
   *    1つ忘れると片方の行にだけ操作が出ない形になる。**2つとも足すこと。**
   *    （`career-group` は 2026-08-26 に廃止。3経路だった頃の記述を戻さないこと）
   * ⚠️ **企業グループの見出しには鉛筆を置かない。** グループは id を持たない。
   *    置けるのは「この会社に役割を追加」（`onAddRole`）だけで、これは
   *    グループ内のどれか1件の id を渡して呼ぶ。
   */
  careerActions?: CareerActions;
  /** ログイン済みかどうか（false の場合、経歴の詳細説明をゲート） */
  isAuthenticated?: boolean;
  /** この件数を超えた経歴を折りたたむ（未指定の場合は折りたたみなし） */
  collapseAfter?: number;
  /**
   * 職歴1件ごとに、行の下へ差し込むもの（経歴ストーリーのアコーディオン）。
   *
   * ⚠️ **渡されなければ何も描かない。** 公開プロフィール（`/u/[id]`）は渡さないこと。
   *    **「見ている人が本人か」で出し分けてはいけない。** それは「編集画面か」ではなく、
   *    **本人が自分の公開ページを見たときも true** になる。
   *
   * ⚠️ 2026-08-16 の 2-6（職歴を年表に作り直した回）で、`CareerHistoryEditor` の
   *    自前の一覧を差し替えたときに `<StoryAccordion>` が一緒に消え、
   *    **「経歴ストーリー」の入口が1週間なくなっていた**（コミットメッセージに言及なし）。
   *    親から渡す形にしてあるのは、次に一覧を作り直しても**渡し忘れれば型で気づける**ため。
   */
  renderCareerExtra?: (careerId: string) => React.ReactNode;
}

// ─── Internal discriminated union ─────────────────────────────────────────────

/** buildTimeline が返す中間型（並行グループ化前） */
type TimelineEntry =
  | { kind: "career";    data: CareerEntry }
  | { kind: "education"; data: EducationEntry };

/**
 * レンダリング用エントリ型。
 *
 * ⚠️ **`career-group`（同一開始月の並行職を1枚にまとめる箱）は廃止した**
 *    （2026-08-26 / フェーズ2-2）。理由は3つ。
 *    ① 見出しに出していた期間は**2社の期間の和集合**で、誰の在籍期間でもなかった
 *       （相川さんは「2016年4月 – 現在 · 10年5ヶ月」と出ていたが、そういう在籍は存在しない）
 *    ② 箱の中の経歴の開始年が**年マーカーから消えていた**
 *    ③ 判定が「開始月が同じか」だけで、**期間の重なりを見ていなかった**
 *    並行は箱ではなく**言葉で示す**（`lib/profile/parallel.ts`）。**箱に戻さないこと。**
 */
type RenderEntry =
  | { kind: "career";              data: CareerEntry }
  | { kind: "career-same-company"; items: CareerEntry[]; companyKey: string }
  | { kind: "education";           data: EducationEntry };


// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → "YYYY年M月" */
function formatYM(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 2) return dateStr;
  const month = parseInt(parts[1], 10); // "07" → 7（ゼロ除去）
  return `${parts[0]}年${month}月`;
}

// 期間文字列（"2年3ヶ月"）の計算は lib/profile/tenure.ts に移した（2026-08-07）。
// 社会人経験年数の自動計算が同じ式を使うため、2箇所に書き写さない。

/**
 * role_title の先頭に付いている部署名を落とす。
 *
 * 実データの role_title は部署を含んだ形で保存されている。
 *   department = "第6営業部"
 *   role_title = "第6営業部 / 電設資材営業（課長）"
 * 部署を主見出しに出すと、そのすぐ下に同じ文字列がもう一度出てしまう。
 *
 * ⚠️ **表示層だけの整形で、DB は触らない。** 区切り（/ ・ ｜ 全角スペース等）が
 *    続く場合のみ落とす。前方一致しなければ role_title をそのまま返す
 *    （勝手に文字を削らない）。
 */
function stripDepartmentPrefix(roleTitle: string, department: string | null | undefined): string {
  if (!department) return roleTitle;
  const dept = department.trim();
  const title = roleTitle.trim();
  if (!dept || !title.startsWith(dept)) return roleTitle;
  const rest = title.slice(dept.length).replace(/^[\s　]*[/／·・|｜-]?[\s　]*/, "");
  // 部署名しか入っていなかった場合は空文字を返す（呼び出し側が行ごと落とす）
  return rest;
}

/**
 * 同社グループ内の1在籍期間について、表示する行を組み立てる。
 *
 * 並び: 部署（主見出し） → 役職ランク → 役職名 → 職種
 *
 * ルール:
 * - **department が NULL の行は空の見出しを出さない。** 役職名 → 職種の順に繰り上げる
 * - 主見出しに使った文字列はサブ行に出さない（同じ語が2回出ない）
 * - 役職ランクは生値ではなく `rankLabel()` を通す。"none" と未知の値は出さない
 * - 役職名は `stripDepartmentPrefix` で部署の接頭辞を落としてから比較する
 *
 * ⚠️ 出せる文字列が1つも無いことは起きない（role_label は必須）。
 */
function buildPositionLines(c: CareerEntry): { heading: string; sub: string[] } {
  const dept = c.department?.trim() || null;
  // 部署を主見出しに出すぶん、役職名からは同じ接頭辞を落とす
  const title = (c.role_title ? stripDepartmentPrefix(c.role_title, dept) : "").trim() || null;
  const rank = rankLabel(c.rank);
  const role = c.role_label?.trim() || null;

  const parent = c.role_parent_name?.trim() || null;

  // 主見出し: 部署 → 役職名 → 職種 の順に繰り上げる
  const heading = dept || title || role || c.role_label;

  /* ⚠️ role_parent_name（職種の親カテゴリ。例「営業」）を落とさないこと。
        2026-08-15 にこの関数へ寄せたとき、いったん落としてしまった。
        department / rank を足す改修であって、既存の表示を減らす改修ではない。
        職種と同じ行に出す（縦に積むと親カテゴリだけで1行使い、
        在籍期間の縦線が間延びする）。これは改修前と同じ体裁。 */
  const sub: string[] = [];
  const push = (v: string | null) => { if (v && v !== heading && !sub.includes(v)) sub.push(v); };

  push(rank);
  push(title);
  if (role && role !== heading) {
    push([parent, role].filter(Boolean).join(" · "));
  } else if (role && role === heading) {
    // 職種が主見出しに繰り上がった場合、親カテゴリだけを下に残す
    push(parent);
  }

  return { heading, sub };
}

/**
 * 職歴・学歴をマージしてソート済み配列を返す。
 * 順序: **start_date DESC → career first（同一日）→ id**
 *
 * ── ★`is_current` を並び順から外した（2026-08-26 / フェーズ2-1）──────────────
 * それまでの第1キーは `is_current DESC` で、**現職を必ず先頭に寄せていた。**
 * その結果、年表が時系列にならない:
 *   相川さんは「2016年開始の現職2件」が「2019年開始の退職済み1件」より**上**に来て、
 *   年マーカーが上から **2016 → 2019** と**古い順に**並んでいた。
 * 年表として読めることを優先し、**開始日だけで並べる。**
 *
 * ⚠️ 「在籍中」バッジは今までどおり出す。**現職であることはバッジで示し、位置では示さない。**
 *
 * ── ★最後のキーに `id` を足した（同上）────────────────────────────────────
 * ⚠️ **同着があると表示順が実行ごとに入れ替わる。** `/u/[id]` の SELECT にも
 *    最終キーが無く（`is_current` → `started_at` のみ）、同じ日に始まった2件の
 *    並びは PostgreSQL 側で不定。**実際に before/after の HTML で
 *    フィクスチャ I社 と G社 の位置が入れ替わっていた。**
 *    `is_current` を外すと同着はさらに増えるので、ここで必ず決着させる。
 * ⚠️ `id` は uuid なので順序に意味は無い。**意味ではなく「毎回同じ」ことが目的。**
 */
function buildTimeline(
  careers: CareerEntry[],
  educations: EducationEntry[],
): TimelineEntry[] {
  const careerEntries: TimelineEntry[] = careers.map((c) => ({
    kind: "career",
    data: c,
  }));

  const educationEntries: TimelineEntry[] = educations.map((e) => ({
    kind: "education",
    data: e,
  }));

  const combined = [...careerEntries, ...educationEntries];

  const startOf = (e: TimelineEntry) =>
    e.kind === "career" ? e.data.started_at : e.data.enrolled_at;
  const idOf = (e: TimelineEntry) => e.data.id;

  combined.sort((a, b) => {
    // start_date DESC
    const aKey = startOf(a);
    const bKey = startOf(b);
    if (bKey !== aKey) return bKey.localeCompare(aKey);

    // career before education tiebreak
    const kindOrder = (e: TimelineEntry) => (e.kind === "career" ? 0 : 1);
    if (kindOrder(a) !== kindOrder(b)) return kindOrder(a) - kindOrder(b);

    // ★最後は id。同着でも毎回同じ順になるようにする（意味は無い）
    return idOf(a).localeCompare(idOf(b));
  });

  return combined;
}

/**
 * 同社グループ化のためのキー生成。
 *
 * - master 企業（company_id あり）: `m:${company_id}` で確実に同一企業を識別
 * - custom 企業（company_id なし、company_text あり）: `c:${company_name}` で文字列一致
 * - anon 企業（company_anonymized）: `a:${id}` で個別扱い（"非公開企業"の誤統合を防ぐ）
 *
 * CareerHistoryEditor の groupStints と同じ規約。
 */
function getCompanyKey(c: CareerEntry): string {
  if (c.company_id) return `m:${c.company_id}`;
  // company_id なし & "非公開企業" 表記 = 匿名企業（XOR 制約により company_anonymized が NOT NULL）
  if (c.company_name === "非公開企業") return `a:${c.id}`;
  return `c:${c.company_name}`;
}

/**
 * RenderEntry[] を走査し、連続する同一会社の単独 career エントリを
 * "career-same-company" バリアントにまとめた RenderEntry[] を返す。
 *
 * 設計:
 * - 入力は buildTimeline の出力（時系列に並んだ配列）
 * - 単独 "career" エントリのうち、ソート順で連続する同社のものをグループ化
 * - 2件以上が連続する場合のみ "career-same-company" に集約、1件のみは "career" のまま
 * - 出戻りパターン（連続しない同社）は自然に別グループになる（意図通り）
 *
 * 注意: ソート順を変えない走査のため、is_current DESC → started_at DESC が維持される。
 */
function groupSameCompanyEntries(entries: RenderEntry[]): RenderEntry[] {
  const result: RenderEntry[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];

    // education は対象外、そのまま通過
    if (entry.kind !== "career") {
      result.push(entry);
      i++;
      continue;
    }

    const key = getCompanyKey(entry.data);
    const group: CareerEntry[] = [entry.data];
    let j = i + 1;
    while (j < entries.length) {
      const next = entries[j];
      if (next.kind === "career" && getCompanyKey(next.data) === key) {
        group.push(next.data);
        j++;
      } else {
        break;
      }
    }

    if (group.length >= 2) {
      result.push({ kind: "career-same-company", items: group, companyKey: key });
    } else {
      result.push(entry);
    }
    i = j;
  }
  return result;
}

/**
 * ★本体（`/mypage`）に出す職歴を、**表示単位で N 個**に絞る（2026-08-17 / フェーズ3）。
 *
 * ⚠️ **「行」ではなく「表示単位」で数える。** 同じ会社の複数の役割は1つのまとまりとして
 *    描かれるので、3件入っていても **1** と数える。行で数えると、
 *    1社しか無い人のカードが上限に達して「すべて表示」が出てしまう。
 *
 * ⚠️ **並べ替えは `MergedTimeline` と同じ関数を通す。** 呼び出し側で
 *    `slice` すると、`sort_order` のまま切って**いちばん新しい職歴が消える**
 *    （学歴で実際に踏んだ形）。
 *
 * 返すのは「絞った職歴の配列」と「隠した表示単位の数」。
 */
export function limitCareersForDisplay(
  careers: CareerEntry[],
  limit: number,
): { careers: CareerEntry[]; hiddenUnits: number } {
  const units = groupSameCompanyEntries(
    buildTimeline(careers, []),
  );
  if (units.length <= limit) return { careers, hiddenUnits: 0 };
  const ids = new Set<string>();
  for (const u of units.slice(0, limit)) {
    if (u.kind === "career") ids.add(u.data.id);
    else if (u.kind === "career-same-company") {
      for (const item of u.items) ids.add(item.id);
    }
  }
  return { careers: careers.filter((c) => ids.has(c.id)), hiddenUnits: units.length - limit };
}

// ─── Badge sub-components ─────────────────────────────────────────────────────

function CurrentBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "var(--success)",
        background: "var(--success-soft)",
        border: "1px solid #6ee7b7",
        borderRadius: 4,
        padding: "1px 6px",
        verticalAlign: "middle",
        marginLeft: 6,
        lineHeight: 1.6,
      }}
    >
      <span className="tl-pulse-dot" />
      在籍中
    </span>
  );
}

function EnrolledBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "var(--purple)",
        background: "var(--purple-soft)",
        border: "1px solid #ddd6fe",
        borderRadius: 4,
        padding: "1px 6px",
        verticalAlign: "middle",
        marginLeft: 6,
        lineHeight: 1.6,
      }}
    >
      在学中
    </span>
  );
}

/* ── ★雇用形態（2026-08-26 / フェーズ1-2）────────────────────────────────────
      **職歴の3経路が別々に描いていたのを、この1組にまとめた。**

      それまでの状態:
        career              … 淡いグレーのピル
        career-group        … `· 業務委託` の素テキスト（★この経路はフェーズ2-2で廃止）
        career-same-company … `· 正社員` の素テキスト（しかも**グループ代表を1つ**）
      同じ値が経路によって3通りに見えていた。**ここ以外に描かないこと。**
      （いま残っているのは `career` と `career-same-company` の2経路）

   ⚠️ **色は「種類が読める」ための色分けであって、良し悪しの序列ではない。**
      正社員が上位で業務委託が下位、という意味を持たせない。
   ⚠️ 語彙は `careerOptions.ts` の `EMPLOYMENT_TYPES`（6値）と DB の
      `ow_experiences_employment_type_check` に揃えてある。**値を足すときは3つとも直す。**
      ここに無い値が来ても落とさず、灰色で**値そのものを出す**（握りつぶさない）。
   ⚠️ 緑（在籍中）と橙（旧・並行バッジ）を避けた色にしてある。 */
const EMPLOYMENT_COLORS: Record<string, { fg: string; bg: string; border: string }> = {
  "正社員":             { fg: "#002366", bg: "#EFF3FC", border: "#DCE5F7" },
  "契約社員":           { fg: "#0F766E", bg: "#F0FDFA", border: "#99F6E4" },
  "派遣社員":           { fg: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
  "業務委託":           { fg: "#BE123C", bg: "#FFF1F2", border: "#FECDD3" },
  "アルバイト・パート": { fg: "#C2410C", bg: "#FFF7ED", border: "#FED7AA" },
  "その他":             { fg: "#475569", bg: "#F1F5F9", border: "#E2E8F0" },
};
const EMPLOYMENT_FALLBACK = { fg: "#475569", bg: "#F1F5F9", border: "#E2E8F0" };

function EmploymentBadge({ value }: { value: string }) {
  const c = EMPLOYMENT_COLORS[value] ?? EMPLOYMENT_FALLBACK;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: c.fg,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 4,
        padding: "1px 6px",
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      {value}
    </span>
  );
}

/**
 * モーダルが開いたあと、雇用形態の項目まで送る。
 *
 * ⚠️ **開くだけでは足りない。** モーダルは会社名から順に上から表示されるので、
 *    開いた直後の雇用形態は**画面に出ない**（1300×900 のスクリーンショットで確認）。
 *    「押したのに何も起きていない」ように見える。
 *
 * ⚠️ **1回呼ぶだけでは届かない。** モーダルは
 *    ① React の状態で後から描かれ、② 開くあいだレイアウトが動く。
 *    要素を見つけた最初の1回で `scrollIntoView` しても**そのあと動いて画面外へ戻る**
 *    （実測: 1回だけの版では雇用形態が一度も画面に出なかった）。
 *
 * ⚠️ **`requestAnimationFrame` を使わない。** 前面にないタブでは発火せず、
 *    **一度も動かない**（実測で 90 フレーム分ゼロ回）。`setTimeout` にする。
 *
 * ── ★止まり方（4つ。どれか1つで必ず終わる）────────────────────────────────
 *   ① 落ち着いて画面に入った  … 位置が2回続けて同じ、かつビューポート内
 *   ② **利用者が自分で動かした** … wheel / touchmove / キー操作を拾ったら即やめる
 *   ③ **モーダルが閉じた**      … 一度見つけた要素が消えたらやめる
 *   ④ 時間切れ                  … **経過時間で 1.5秒**（回数で切らない）
 *
 * ⚠️ **②と③が無いと実害が出る。** ②が無いと、押した直後の約1.5秒は
 *    利用者がスクロールするたびに引き戻す（位置が動く＝まだ落ち着いていない、と読むため）。
 *    ③が無いと、閉じたあとも1.5秒ぶん空回りする。
 *
 * ⚠️ **④は回数ではなく経過時間で切る。** 前面にないタブでは `setTimeout` が
 *    **1秒に間引かれる**ので、「25回 × 60ms」のつもりが**25秒**回り続ける
 *    （.claude/rules/ui-debugging.md ⑪）。
 *
 * ⚠️ 見つからなくても何もしない。モーダル自体は開いているので、黙って諦めてよい。
 */
function scrollToEmploymentField() {
  const deadline = Date.now() + 1500;
  let lastTop: number | null = null;
  let seen = false;
  let cancelled = false;

  const events = ["wheel", "touchmove", "keydown"] as const;
  const stopListening = () => {
    for (const e of events) window.removeEventListener(e, cancel);
  };
  /* ★利用者が自分で動かしたら、こちらは手を引く。`passive` で邪魔しない */
  function cancel() {
    cancelled = true;
    stopListening();
  }
  for (const e of events) window.addEventListener(e, cancel, { passive: true });

  const tick = () => {
    if (cancelled) return;
    const el = document.getElementById(EMPLOYMENT_TYPE_FIELD_ID) as HTMLSelectElement | null;
    if (el) {
      if (!seen) {
        seen = true;
        el.focus({ preventScroll: true });
      }
      const r = el.getBoundingClientRect();
      const settled = lastTop !== null && Math.abs(r.top - lastTop) < 1;
      const visible = r.top >= 0 && r.bottom <= window.innerHeight;
      if (settled && visible) return stopListening();   // ①
      el.scrollIntoView({ block: "center" });
      lastTop = el.getBoundingClientRect().top;
    } else if (seen) {
      return stopListening();                           // ③ 閉じた
    }
    if (Date.now() < deadline) setTimeout(tick, 60);    // ④
    else stopListening();
  };
  setTimeout(tick, 0);
}

/**
 * 未設定のときの「＋ 雇用形態を追加」。
 *
 * ⚠️ **本人にしか出さない。** 判定は `careerActions.onEditRow` の有無。
 *    「本人が見ているか」ではなく「**その画面が編集モーダルを持っているか**」で決める。
 *    本人が自分の `/u/[id]` を見たときは編集できないので、出してはいけない。
 *    渡されなければ `null` を返す＝**他人の DOM は1バイトも変わらない。**
 *
 * ⚠️ 押すと `onEditRow` が開くのは**その経歴の編集モーダル**。行の鉛筆と同じ入口で、
 *    雇用形態のセレクトはそのモーダルの中にある。専用の口を作らない。
 *
 * ⚠️ 当たり判定は `.tap-min-h`（767px 以下で 44px）。**枠線は内側の span が持つ**ので、
 *    高さを足しても点線の箱が 44px に膨らまない。
 */
function EmploymentAddCta({
  careerId,
  label,
  onEdit,
}: {
  careerId: string;
  label: string;
  onEdit: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="tap-min-h"
      onClick={() => {
        onEdit(careerId);
        scrollToEmploymentField();
      }}
      aria-label={`${label} の雇用形態を追加`}
      title="雇用形態を追加"
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink-mute)",
          border: "1px dashed var(--line)",
          borderRadius: 4,
          padding: "1px 6px",
          lineHeight: 1.6,
          whiteSpace: "nowrap",
        }}
      >
        <PlusIcon />
        雇用形態を追加
      </span>
    </button>
  );
}

/**
 * ★雇用形態の枠。**すべての経路がこれを呼ぶ。**
 *
 *   値がある   → バッジ
 *   値が無い   → 本人にだけ「＋ 雇用形態を追加」／他人には **null**
 *
 * （CLAUDE.md「値が無いことを、ある値に置き換えない」。既定値を出さない）
 */
function EmploymentSlot({
  data,
  actions,
  marginLeft,
}: {
  data: CareerEntry;
  actions?: CareerActions;
  /** 見出しの語に続けて置くときの左余白。★余白の span も「出すとき」しか作らない */
  marginLeft?: number;
}) {
  const inner = data.employment_type ? (
    <EmploymentBadge value={data.employment_type} />
  ) : actions?.onEditRow ? (
    <EmploymentAddCta careerId={data.id} label={data.company_name} onEdit={actions.onEditRow} />
  ) : null;

  /* ⚠️ **null のときはラッパーごと返さない。** 余白用の `<span>` だけ残すと、
        値が無い他人の `/u/[id]` に**空の span が増える**（実際に一度そうなった）。
        「渡さなければ DOM は1バイトも変わらない」を保つのはここ。 */
  if (!inner) return null;
  if (!marginLeft) return inner;
  return <span style={{ marginLeft, verticalAlign: "middle" }}>{inner}</span>;
}

/**
 * ★並行在籍を**言葉で**示す1行（2026-08-26 / フェーズ2-2）。
 *
 * 期間の**下**に置く。縦線は常に1本のままで、線の本数で並行を表さない
 * （重なりは鎖状につながるので線では描けない）。
 *
 *   相手が1社   → 「セールスフォース・ジャパンと並行」
 *   2社以上     → 「他2社と並行」
 *
 * ⚠️ **n は会社の数**であって職歴の件数ではない（`buildOverlapMap` が会社で束ねている）。
 * ⚠️ 渡されなければ何も描かない。**重なりが無い人の DOM は変わらない。**
 */
function ParallelNote({ companies }: { companies: string[] | undefined }) {
  if (!companies || companies.length === 0) return null;
  const label =
    companies.length === 1
      ? `${shortCompanyName(companies[0])}と並行`
      : `他${companies.length}社と並行`;
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--warm)",
        lineHeight: 1.4,
        marginTop: 2,
      }}
    >
      {label}
    </div>
  );
}

// ─── Icon circle sub-components ───────────────────────────────────────────────

/**
 * タイムラインのアイコン列（64px date col の右）に表示するアイコン円。
 *
 * 3 段階フォールバック（A-1 判断 C/D）:
 *   1. logo_url あり → CompanyLogoImg（画像 + onError fallback は Client Component）
 *   2. logo_url なし かつ logo_letter + logo_gradient あり → LetterCircle
 *   3. どちらもなし → Briefcase アイコン（段階6-3-2 と同一）
 *
 */
function CompanyLogoIcon({
  isCurrent,
  logo_url,
  logo_letter,
  logo_gradient,
  company_name,
  size = 64,
}: {
  isCurrent: boolean;
  logo_url?: string | null;
  logo_letter?: string | null;
  logo_gradient?: string | null;
  company_name?: string;
  /**
   * 一辺の px。既定 64（デスクトップのロゴ列）。
   * モバイルは企業名の行に 28px で並べる（ロゴ列を畳むため）。
   *
   * ⚠️ **フォールバックの分岐（非公開→鍵 / logo_url → 文字円 → イニシャル）を
   *    もう1つ書かないこと。** 同じ判定が2箇所に割れると、
   *    片方だけ「非」が出る・片方だけ鍵が出ない、が起きる。
   *    サイズだけ変えてこの関数を使い回す。
   */
  size?: number;
}) {
  // 64px のときの見た目を基準に比率で縮める（22/64, 18/64, 11/64）
  const iconPx = Math.round(size * 0.344);
  const fontPx = Math.round(size * 0.281);
  const wrapStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.172),
    flexShrink: 0,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  // ステップ 0: 非公開企業 → 鍵アイコン（logo_letter/gradient より先に判定）
  // timeline.ts が anon 企業に logo_letter="非" を設定するため、先に isAnonymous をチェックする
  const isAnonymous = company_name === "非公開企業" || company_name === "非公開" || company_name === "不明な企業";
  if (isAnonymous) {
    return (
      <div style={{ ...wrapStyle, background: "linear-gradient(135deg, #64748B 0%, #94A3B8 100%)" }}>
        <svg width={iconPx} height={iconPx} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
    );
  }

  // ステップ 1: logo_url あり → 画像ロゴ（onError は CompanyLogoImg が担当）
  if (logo_url) {
    return (
      <div style={wrapStyle}>
        <CompanyLogoImg
          logoUrl={logo_url}
          logoLetter={logo_letter ?? null}
          logoGradient={logo_gradient ?? null}
          size={size}
        />
      </div>
    );
  }

  // ステップ 2: logo_letter + logo_gradient あり → ブランド円
  if (logo_letter && logo_gradient) {
    return (
      <div style={wrapStyle}>
        <LetterCircle letter={logo_letter} gradient={logo_gradient} size={size} />
      </div>
    );
  }

  // ステップ 3: それ以外 → 会社名イニシャル円
  const fallbackLetter = company_name ? company_name.charAt(0) : "?";
  const fallbackGrad = isCurrent
    ? "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)"
    : "linear-gradient(135deg, #64748B 0%, #94A3B8 100%)";
  return (
    <div style={{ ...wrapStyle, background: fallbackGrad }}>
      <span style={{ color: "#fff", fontSize: fontPx, fontWeight: 700, fontFamily: "var(--font-inter), var(--font-noto)", lineHeight: 1 }}>
        {fallbackLetter}
      </span>
    </div>
  );
}
// EducationIcon は段階6-6 Phase 4 で SchoolLogoImg に完全置換（判断点 #9 案 a）

/* ★年マーカー（年チップ・年齢・同社グループ内の年ラベル）は 2026-08-29 に削除した。
      ⚠️ **戻さないこと**（柴さんの判断）。カード自身が「2016年4月 – 現在 · 10年5ヶ月」と
         期間を持っているので、年チップは同じ情報を2度出していた。
   ⚠️★**年齢の表示もこれで無くなった。** タイムラインは年齢を出していた唯一の場所で、
      CLAUDE.md「年齢は詳細だけ」の例外として認められていた箇所。
      年齢を出したくなったら**別の置き場所**を決めること。ここに戻すと年チップも一緒に戻る。 */

/**
 * ★在籍期間を示す1行（2026-08-29）。
 *
 * ── なぜ部品にしたか ────────────────────────────────────────────────────────
 * `{開始} – {終了} · {期間}` を**3箇所が別々に書いていた**（単独カード・学歴・
 * 同社グループの中）。1箇所だけ直すと、同じ画面の中で書式が割れる。
 *
 * ── ★在籍年数をピルにした理由 ───────────────────────────────────────────────
 * 素の中黒だと「2023年6月 – 2024年1月 · 8ヶ月」が**数字の連なりに見え、
 * どこまでが日付でどこからが在籍年数か見分けがつかない**（柴さんの指摘）。
 * 日付と在籍年数は**別の種類の値**なので、囲って区別する。
 *
 * ⚠️ **色は付けない。** `--line-soft` の中間色ピル（タブの件数バッジと同じ形）。
 *    色に意味を持たせない（`.claude/skills/ui-conventions`「色の役割」）。
 * ⚠️ **押せるものにしない。** 見分けるための囲みであって、操作ではない。
 * ⚠️ 中黒（`·`）はピルが区切りになるので**置かない**。両方あると二重になる。
 */
function PeriodLine({ start, end, duration, marginBottom = 0 }: {
  start: string;
  /** 「現在」や空文字が来る。⚠️ 空でも `–` は出す（終わりが不明であることを示す） */
  end: string;
  /** 「8ヶ月」。無ければピルごと出さない */
  duration?: string | null;
  marginBottom?: number;
}) {
  return (
    <div style={{
      fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 500,
      color: "var(--ink-mute)", marginBottom, lineHeight: 1.4,
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    }}>
      <span>{start} – {end}</span>
      {duration && <DurationPill>{duration}</DurationPill>}
    </div>
  );
}

/**
 * 在籍年数のピル。⚠️ 期間の行と、同社グループの見出し（会社名の右）で**同じ形**を使う。
 * 片方だけ変えると「同じ値なのに見た目が違う」になる。
 */
function DurationPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 11, fontWeight: 600,
      color: "var(--ink-mute)", background: "var(--line-soft)",
      borderRadius: 100, padding: "2px 8px", lineHeight: 1.5,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

// ─── Description gate (未ログイン時) ─────────────────────────────────────────

function DescriptionGate() {
  return (
    <div style={{ position: "relative", marginTop: 8, borderRadius: 8, overflow: "hidden" }}>
      {/* Blurred dummy text */}
      <p style={{
        fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75, margin: 0,
        filter: "blur(4px)", userSelect: "none", pointerEvents: "none",
        whiteSpace: "pre-wrap",
      }}>
        {"業務内容の詳細は登録後にご覧いただけます。\nこの経歴での具体的な職務内容・成果・担当領域について確認できます。"}
      </p>
      {/* Overlay CTA */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(248,250,252,0.7)", backdropFilter: "blur(1px)",
      }}>
        <a href="/auth" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 16px", borderRadius: 100,
          background: "var(--royal)", color: "#fff",
          fontSize: 12, fontWeight: 600, textDecoration: "none",
          boxShadow: "0 2px 8px rgba(0,35,102,0.25)",
          whiteSpace: "nowrap",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          登録して続きを読む
        </a>
      </div>
    </div>
  );
}

// ─── Content sub-components ───────────────────────────────────────────────────

function CareerContent({
  data,
  parallelWith,
  isAuthenticated = true,
  actions,
}: {
  data: CareerEntry;
  /** 1ヶ月以上重なっている他社の名前。無ければ何も描かない */
  parallelWith?: string[];
  isAuthenticated?: boolean;
  /** ★雇用形態が未設定のときの「＋ 雇用形態を追加」に使う。渡さなければ出さない */
  actions?: CareerActions;
}) {
  const duration = formatDuration(data.started_at, data.ended_at);
  const startLabel = formatYM(data.started_at);
  const endLabel = data.is_current ? "現在" : data.ended_at ? formatYM(data.ended_at) : "";
  const hasDesc = !!data.description;

  /* 主見出しとサブ行。同社グループ（career-same-company）と**同じ組み立てを使う**。
     1社1行の人と複数在籍の人とで、部署・役職の出方が変わらないようにするため。 */
  const lines = buildPositionLines(data);

  return (
    <div className="tl-content" style={{ paddingTop: 10, paddingBottom: 22 }}>
      {/* 会社名 + 雇用形態 + バッジ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6, lineHeight: 1.35 }}>
        {/* モバイル専用のインラインロゴ。デスクトップは左のロゴ列が出すので CSS で隠す */}
        <span className="tl-inline-logo">
          <CompanyLogoIcon
            isCurrent={data.is_current}
            logo_url={data.logo_url}
            logo_letter={data.logo_letter}
            logo_gradient={data.logo_gradient}
            company_name={data.company_name}
            size={28}
          />
        </span>
        {data.company_id ? (
          <Link href={`/companies/${data.company_id}`} className="company-name-link"
            style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>
            {shortCompanyName(data.company_name)}
          </Link>
        ) : (
          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
            {shortCompanyName(data.company_name)}
          </span>
        )}
        <EmploymentSlot data={data} actions={actions} />
        {data.is_current && <CurrentBadge />}
      </div>

      {/* 主見出し: 部署名。無ければ役職名 → 職種の順に繰り上げる */}
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 2, lineHeight: 1.4, overflowWrap: "anywhere" }}>
        {lines.heading}
      </div>

      {/* 役職ランク → 役職名 → 職種。空の行は出さない */}
      {lines.sub.map((line, i) => (
        <div key={i} style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.45, overflowWrap: "anywhere" }}>
          {line}
        </div>
      ))}

      {/* 期間 */}
      <PeriodLine start={startLabel} end={endLabel} duration={duration} marginBottom={hasDesc ? 12 : 0} />
      {/* ★並行は期間の下に1行。バッジではなく言葉で示す（フェーズ2-2） */}
      <ParallelNote companies={parallelWith} />

      {/* 業務内容
          ⚠️ **固定の maxWidth を戻さないこと（2026-08-15 に 560px を撤去）。**
             サイドバー撤去で本文カラムが 728→1020px に広がったのに、この 560px が
             取り残されて **1440px 実測で 882px 中 560px しか使わず 322px（37%）が空いていた**
             （1行 40字。同じページの自己紹介は 63字で組んでいる）。
             行長の上限はページ外枠の maxWidth 1060 が担う。ここに2つ目の上限を置かない。
          ⚠️ ui-debugging.md「レスポンシブで変えたい値をインラインstyleに書かない」の
             対象そのもの（width / maxWidth）。狭幅で縮められなくなる。 */}
      {data.description && (
        isAuthenticated ? (
          <ExpandableDesc text={data.description} />
        ) : (
          <DescriptionGate />
        )
      )}
    </div>
  );
}

function EducationContent({ data }: { data: EducationEntry }) {
  /* ⚠️★**卒業年月も「在学中」も無い行がある**（2026-08-28 実測: 学歴12件中1件）。
        フォームが止めていないので誰でも作れる。

     直す前はこうなっていた:
       endLabel   … 空文字 → 「2005年4月 – 」と**終わりが欠けたまま**出る
       duration   … `formatDuration(start, null)` が **今日まで**で数えるので
                    「· 21年4ヶ月」と**毎月伸び続ける**

     ⚠️ **「現在」と書かない。** それは `is_current` の人にだけ言えること。
        卒業したかどうか分からない行を「在学中」に見せるのは、
        CLAUDE.md「値が無いことを、ある値に置き換えない」に反する。
     ⚠️ **期間も出さない。** 終わりが分からないのに月数だけ出すと、
        伸び続ける数字を事実として見せることになる。 */
  const endUnknown = !data.is_current && !data.graduated_at;

  const duration = endUnknown ? "" : formatDuration(data.enrolled_at, data.graduated_at);
  const startLabel = formatYM(data.enrolled_at);
  const endLabel = data.is_current
    ? "現在"
    : data.graduated_at
      ? formatYM(data.graduated_at)
      : "卒業年月 未入力";

  return (
    <div className="tl-content tl-content-edu" style={{ paddingTop: 8, paddingBottom: 18 }}>
      {/* School + badge */}
      <div style={{ marginBottom: 3, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="tl-inline-logo">
          <SchoolLogoImg schoolMaster={data.school_master ?? null} size={28} />
        </span>
        {data.school_id ? (
          <Link
            href={`/schools/${data.school_id}`}
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--ink)",
              textDecoration: "none",
            }}
            className="school-name-link"
          >
            {data.school}
          </Link>
        ) : (
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {data.school}
          </span>
        )}
        {data.is_current && <EnrolledBadge />}
      </div>

      {/* Faculty / Degree */}
      {(data.faculty || data.degree) && (
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.4 }}>
          {[data.faculty, data.degree].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* Date + duration — always inline */}
      <PeriodLine start={startLabel} end={endLabel} duration={duration} />
    </div>
  );
}

/**
 * 並行グループ内の個別カード（d-2 スタイル）。
 * CareerContent と同内容だが、padding 規則と border-left は CSS クラスで制御する。
 * H-iii: グループアイコン列はそのまま維持し、各カードの会社名左に 24px 小ロゴを表示する。
 */
// ─── Main component ───────────────────────────────────────────────────────────

export default function MergedTimeline({
  careers,
  educations,
  renderCareerExtra,
  educationActions,
  careerActions,
  isAuthenticated = true,
  collapseAfter,
}: MergedTimelineProps) {
  /* ★並行の判定。**箱でまとめず、経歴1件ごとに「重なっている他社」を持つ**
        （`lib/profile/parallel.ts`）。同じ会社の複数役割どうしは数えない。 */
  const overlapMap = buildOverlapMap(careers, getCompanyKey);
  const entries = buildTimeline(careers, educations);
  const renderEntries = groupSameCompanyEntries(entries);

  const [isExpanded, setIsExpanded] = useState(false);
  // education entries are always visible; only career entries count toward the collapse limit
  const alwaysVisibleEntries = renderEntries.filter((e) => e.kind === "education");
  const collapsibleEntries = renderEntries.filter((e) => e.kind !== "education");
  const hasMore = collapseAfter !== undefined && collapsibleEntries.length > collapseAfter;
  const hiddenCount = hasMore ? collapsibleEntries.length - collapseAfter : 0;
  const visibleCollapsible = hasMore && !isExpanded
    ? collapsibleEntries.slice(0, collapseAfter)
    : collapsibleEntries;
  const visibleSet = new Set([...alwaysVisibleEntries, ...visibleCollapsible]);
  const visibleEntries = hasMore && !isExpanded
    ? renderEntries.filter((e) => visibleSet.has(e))
    : renderEntries;

  if (renderEntries.length === 0) return null;

  return (
    <>
      {/* Scoped responsive styles */}

      <div className="merged-timeline">
        {visibleEntries.map((entry, _idx) => {
          if (entry.kind === "career") {
            const c = entry.data;

            return (
              <div key={`career-${c.id}`} className={["tl-row", c.is_current && "tl-row-current"].filter(Boolean).join(" ")}>
                <div
                  className="tl-icon-cell"
                  style={{
                    paddingTop: 8,
                  }}
                >
                  <CompanyLogoIcon
                    isCurrent={c.is_current}
                    logo_url={c.logo_url}
                    logo_letter={c.logo_letter}
                    logo_gradient={c.logo_gradient}
                    company_name={c.company_name}
                  />
                </div>
                {/* ⚠️ `.tl-row` は2列グリッド。鉛筆・ゴミ箱を3つ目の子として置くと
                       次の行の1列目（アイコン列の下）に回り込む。**同じセルに入れる。**
                    ⚠️ 渡されなければ `CareerContent` を裸で置く＝他人の DOM は不変 */}
                {careerActions ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 4, minWidth: 0, flex: 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <CareerContent data={c} parallelWith={overlapMap.get(c.id)} isAuthenticated={isAuthenticated} actions={careerActions} />
                      {careerActions.onAddRole && (
                        <AddRoleLink careerId={c.id} onAddRole={careerActions.onAddRole} />
                      )}
                      {renderCareerExtra?.(c.id)}
                    </div>
                    <RowActionButtons id={c.id} label={c.company_name} actions={careerActions} />
                  </div>
                ) : (
                  <CareerContent data={c} parallelWith={overlapMap.get(c.id)} isAuthenticated={isAuthenticated} />
                )}
              </div>
            );
          }

          if (entry.kind === "career-same-company") {
            const items = entry.items;
            const head = items[0];
            const anyIsCurrent = items.some((c) => c.is_current);

            const earliestStart = items.reduce((earliest, c) =>
              c.started_at < earliest ? c.started_at : earliest, items[0].started_at);
            const latestEnd = anyIsCurrent
              ? null
              : items.reduce<string | null>((latest, c) => {
                  if (!c.ended_at) return latest;
                  return !latest || c.ended_at > latest ? c.ended_at : latest;
                }, null);

            const duration = formatDuration(earliestStart, latestEnd);
            /* ⚠️ **会社の見出しには雇用形態を出さない**（2026-08-26 / フェーズ1-2）。
                  それまでは「グループ全体から最初の非 NULL を1つ」代表として出しており、
                  **同じ会社で正社員 → 業務委託 に変わった人が全部『正社員』に見えていた。**
                  いまは役割ごとの行が自分の値を出す（下の `EmploymentSlot`）。 */

            return (
              <div key={`same-company-${entry.companyKey}`} className={`tl-row${anyIsCurrent ? " tl-row-current" : ""}`}>
                <div className="tl-icon-cell" style={{ paddingTop: 8 }}>
                  <CompanyLogoIcon
                    isCurrent={anyIsCurrent}
                    logo_url={head.logo_url}
                    logo_letter={head.logo_letter}
                    logo_gradient={head.logo_gradient}
                    company_name={head.company_name}
                  />
                </div>
                <div className="tl-content" style={{ paddingTop: 10, paddingBottom: 28 }}>
                  {/* 会社名ヘッダー */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap", lineHeight: 1.3 }}>
                    <span className="tl-inline-logo">
                      <CompanyLogoIcon
                        isCurrent={anyIsCurrent}
                        logo_url={head.logo_url}
                        logo_letter={head.logo_letter}
                        logo_gradient={head.logo_gradient}
                        company_name={head.company_name}
                        size={28}
                      />
                    </span>
                    {head.company_id ? (
                      <Link href={`/companies/${head.company_id}`} className="company-name-link"
                        style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>
                        {shortCompanyName(head.company_name)}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                        {shortCompanyName(head.company_name)}
                      </span>
                    )}
                    {/* ⚠️ 期間の行と**同じピル**を使う。同じ値なので見た目を揃える */}
                    {duration && <DurationPill>{duration}</DurationPill>}
                    {anyIsCurrent && <CurrentBadge />}
                  </div>

                  {/* ポジションリスト — LinkedIn スタイル（縦線＋ドット） */}
                  <div style={{ position: "relative", paddingLeft: 20 }}>
                    {/* 縦線 */}
                    <div style={{
                      position: "absolute", left: 5, top: 8, bottom: 8,
                      width: 2, background: "var(--royal-100)",
                    }} />

                    {items.map((c, idx) => {
                      const posDuration = formatDuration(c.started_at, c.ended_at);
                      const isLast = idx === items.length - 1;
                      // 表示するポジション名: role_title > role_label の優先順
                      const lines = buildPositionLines(c);

                      return (
                        <div key={c.id} style={{ position: "relative", paddingBottom: isLast ? 0 : 20 }}>
                          {/* ドットマーカー */}
                          <div style={{
                            position: "absolute", left: -20 + 5 - 4, top: 6,
                            width: 8, height: 8, borderRadius: "50%",
                            background: c.is_current ? "var(--success)" : "var(--royal-100)",
                            border: `2px solid ${c.is_current ? "var(--success)" : "var(--royal)"}`,
                            zIndex: 1,
                          }} />

                          {/* 主見出し: 部署名。無ければ役職名 → 職種の順に繰り上げる
                              ⚠️ 3経路のうちの3つ目。**会社名の見出しではなくポジション行に置く**
                                 （会社の見出しは id を持たない） */}
                          {careerActions && (
                            <span style={{ float: "right", marginLeft: 8 }}>
                              <RowActionButtons id={c.id} label={`${head.company_name}（${lines.heading}）`} actions={careerActions} />
                            </span>
                          )}
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                            {lines.heading}
                            {/* ★雇用形態は**役割ごと**。会社の見出しには出さない（3経路のうちの3つ目）。
                                   ⚠️ 同じ会社でも役割ごとに違いうる（正社員 → 業務委託）。
                                      グループ代表を1つ出す形に戻さないこと。
                                   ⚠️ 余白は `marginLeft` で渡す。**ここで span で包まない**
                                      （値が無いとき空の span が残る）。 */}
                            <EmploymentSlot data={c} actions={careerActions} marginLeft={6} />
                            {c.is_current && items.length > 1 && (
                              <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", border: "1px solid #6ee7b7", borderRadius: 4, padding: "1px 6px", verticalAlign: "middle", lineHeight: 1.6 }}>
                                在籍中
                              </span>
                            )}
                          </div>

                          {/* 役職ランク → 役職名 → 職種。空の行は出さない */}
                          {lines.sub.map((line, i) => (
                            <div key={i} style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 3, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                              {line}
                            </div>
                          ))}

                          {/* 期間 */}
                          <PeriodLine
                            start={formatYM(c.started_at)}
                            end={c.is_current ? "現在" : c.ended_at ? formatYM(c.ended_at) : ""}
                            duration={posDuration}
                            marginBottom={c.description ? 8 : 0}
                          />
                          {/* ★同社グループの中でも並行は出す。
                                 ⚠️ **同じ会社の役割どうしは数えていない**（`buildOverlapMap`）。
                                    ここに出るのは「この役割と重なっている**他社**」だけ。 */}
                          <ParallelNote companies={overlapMap.get(c.id)} />

                          {/* 業務内容
                              ⚠️ 520px の固定幅を撤去した（2026-08-15）。理由は
                                 単独カード側（CareerContent）の同じコメントを参照。
                                 こちらは 854px 中 520px で **334px（39%）が空いていた**。 */}
                          {c.description && (
                            isAuthenticated ? (
                              <ExpandableDesc text={c.description} />
                            ) : (
                              <DescriptionGate />
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* ⚠️ ポジションごとに1つずつ。会社単位ではない（ストーリーは職歴 id に紐づく） */}
                  {renderCareerExtra && items.map((c) => (
                    <div key={`story-${c.id}`}>{renderCareerExtra(c.id)}</div>
                  ))}
                  {careerActions?.onAddRole && (
                    <AddRoleLink careerId={head.id} onAddRole={careerActions.onAddRole} />
                  )}
                </div>
              </div>
            );
          }

          if (entry.kind === "education") {
            const e = entry.data;

            return (
              <div key={`edu-${e.id}`} className="tl-row">
                <div
                  className="tl-icon-cell"
                  style={{
                    paddingTop: 8,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <SchoolLogoImg schoolMaster={e.school_master ?? null} size={64} />
                </div>
                {/* ⚠️ 本人のときだけ。渡されなければ `EducationContent` を裸で置く＝他人の DOM は不変。
                       ⚠️ `.tl-row` は **2列のグリッド**（80px 1fr）。ここに3つ目の子を置くと
                          次の行の1列目（アイコン列の下）に回り込む。**同じセルに入れること。** */}
                {(educationActions?.onEditRow || educationActions?.onDeleteRow) ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}><EducationContent data={e} /></div>
                    <RowActionButtons id={e.id} label={e.school} actions={educationActions} />
                  </div>
                ) : (
                  <EducationContent data={e} />
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
      {hasMore && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 4, padding: "8px 0",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "var(--royal)",
            textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          すべての経歴を見る ({hiddenCount}件)
        </button>
      )}
      {isExpanded && hasMore && (
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 4, padding: "8px 0",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "var(--ink-mute)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          折りたたむ
        </button>
      )}
    </>
  );
}
