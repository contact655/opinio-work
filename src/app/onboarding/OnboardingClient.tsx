"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import {
  useCompanyLookup,
  type CompanyLookupResult,
} from "@/components/companies/useCompanyLookup";
import { CompanyCreateDialog } from "@/components/companies/CompanyCreateDialog";
import { useRouter, useSearchParams } from "next/navigation";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
/* ⚠️★「転職について」の問い・説明・選択肢はこの部品にある。**ここに書き写さないこと。**
      `/onboarding/stance`（過去に登録を終えた人向けの1枚）と**同じ実装**を使う。
      なぜ入口が2つ要るかは、あの部品の冒頭に書いてある。 */
import { StanceQuestion } from "@/components/onboarding/StanceQuestion";
/* ⚠️★上限は定数1つ。**ここに 5 と書かないこと**（画面と API で食い違った前例がある）。 */
import { MAX_DESIRED_ROLES } from "@/lib/constants/careerPreferences";
import { safeNext, DEFAULT_AFTER_ONBOARDING } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/client";
/* ⚠️ 選択肢は1箇所から。ここに47件を直書きすると API の CHECK とずれる
      （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。 */
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";
/* ⚠️ 学歴の区分もここに直書きしない。API（educations POST）が `DEGREES` で検証しており、
      別の語彙を送ると 400 になる（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。 */
import { DEGREES, DEGREE_LABELS } from "@/lib/constants/careerOptions";
import {
  EXPERIENCE_CREATE_PATH,
  type CreateExperienceBody,
} from "@/lib/experiences/createExperience";

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


/* これまでの職歴（任意・複数）。
   ⚠️ 現職と同じく **会社・職種・開始年月の3点が揃った行だけ** を保存する。
      中途半端な行を作らない（2026-08-10 の方針をそのまま適用する）。 */
type PastJob = {
  key: number;
  company: CompanyLookupResult | null;
  companyText: string;
  roleId: string;
  /** 部署名（任意）。⚠★同一社内の異動を読めるようにするために要る（下記 `groupPastJobs`）。 */
  department: string;
  /**
   * 会社名が「この会社に役割を追加」等で**自動で入った**行かどうか。
   * ⚠️★これが無いと、自動で入った会社名だけで「入力しかけ」と判定してしまい、
   *    **何も触っていない行にオレンジの警告が出る**（2026-09-09 に実際にそうなっていた）。
   *    警告がエラーに見えるので、触っていない行には出さない。
   */
  prefilled: boolean;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
};

/* 学歴（任意・複数）。
   ⚠️ API が必須にしているのは `school` だけ。卒業年月は任意なので必須にしない
      （思い出せない人をここで止めない）。 */
type EducationRow = {
  key: number;
  school: string;
  /** `DEGREES` の値。空は未選択（API は空なら null にする）。 */
  degree: string;
  faculty: string;
  gradYear: string;
  gradMonth: string;
};

const emptyPastJob = (key: number): PastJob => ({
  key, company: null, companyText: "", roleId: "", department: "", prefilled: false,
  startYear: "", startMonth: "", endYear: "", endMonth: "",
});

/**
 * 「この会社に役割を追加」で作る行。**会社を値ごと写す**（参照で繋がない）。
 *
 * ⚠️★参照やIDで繋ぐと、**前の行を消したときに後ろの行が会社を失う。**
 *    値を持たせておけば、どの行を消しても残った行は自分だけで成立する。
 *    まとまって見えるかどうかは `groupPastJobs` が**値から導く**（下記）。
 * ⚠️ 役職・期間は引き継がない。異動なら必ず変わるので、埋めると誤りが残る
 *    （`CareerHistoryEditor` の「同じ会社への追加ポジションでも引き継がない」と同じ）。
 */
const pastJobAtSameCompany = (key: number, from: PastJob): PastJob => ({
  ...emptyPastJob(key),
  company: from.company,
  companyText: from.companyText,
  prefilled: true,
});

/**
 * 会社が同じかを判定するキー。**空文字は「まだ決まっていない」＝まとめない。**
 * ⚠️ `CareerHistoryEditor` の `groupKey` と同じ規約にしてある。割れると、
 *    入力中の見え方と保存後のタイムラインの見え方が食い違う。
 */
const pastJobGroupKey = (j: PastJob): string =>
  j.company ? `m:${j.company.id}` : (j.companyText.trim() ? `c:${j.companyText.trim()}` : "");

/**
 * ★現職ブロックの会社を、`pastJobGroupKey` と**同じ形のキー**にする（2026-09-11）。
 *
 * ⚠️★**規則をここに書き写さない。** `pastJobGroupKey` に `PastJob` の形で渡して導く。
 *    2つに割れると、「同じ会社なのに別グループ」または逆が起きる。
 */
const currentCompanyKey = (company: CompanyLookupResult | null, text: string): string =>
  pastJobGroupKey({ ...emptyPastJob(-1), company, companyText: company ? company.name : text.trim() });

/**
 * 連続する同じ会社の行を1グループにまとめる。
 *
 * ⚠️★**連続するものだけ**をまとめる。出戻り（A → B → A）は別グループのままにする。
 *    1つにまとめると在籍期間が嘘になる（`MergedTimeline` の
 *    `groupSameCompanyEntries` と同じ判断。あちらは表示側、ここは入力側）。
 * ⚠️ 会社が空の行は単独グループ。空同士をまとめると、新しく足した空行が
 *    直前の空行に吸い込まれる。
 */
function groupPastJobs(jobs: PastJob[]): PastJob[][] {
  const groups: PastJob[][] = [];
  for (const j of jobs) {
    const key = pastJobGroupKey(j);
    const last = groups[groups.length - 1];
    if (key && last && pastJobGroupKey(last[0]) === key) last.push(j);
    else groups.push([j]);
  }
  return groups;
}
const emptyEducation = (key: number): EducationRow => ({
  key, school: "", degree: "", faculty: "", gradYear: "", gradMonth: "",
});

/**
 * 保存できる過去の職歴か。
 * ⚠️ 退職年月も必須。`is_current = false` かつ `ended_at` が空の経歴は、
 *    企業ページの現役社員にも OB/OG にも出ない（OB 側が `ended_at is not null` を要求する）。
 */
/**
 * 候補・選択カードに出す社名。**企業一覧・企業ページと同じ表示名にする。**
 * ⚠️ ここで正規表現を書かない。`lib/companies/displayName.ts` を通す。
 */
/* ⚠️ 表示名は**サーバーが解決して返す**（`/api/companies/lookup`）。
      ここで組み立てない（2箇所で組むと片方だけ直る形になる）。 */
const companyLabel = (c: CompanyLookupResult) => c.name;

const pastJobReady = (j: PastJob) =>
  (!!j.company || j.companyText.trim().length > 0) &&
  !!j.roleId && !!j.startYear && !!j.startMonth && !!j.endYear && !!j.endMonth;

/**
 * POST して、落ちたら `failures` に積む。
 * ⚠️ 握り潰さない。`console.error` と画面表示の両方に出す
 *    （CLAUDE.md「エラーと失敗を握りつぶさない原則」）。
 */
async function postJson(
  url: string,
  body: Record<string, unknown>,
  label: string,
  failures: string[],
) {
  return sendJson("POST", url, body, label, failures);
}

/**
 * PUT 版。⚠️ 生年月日だけ **`ow_users`（別テーブル）** なので PUT の API を使う。
 * ⚠️ `postJson` と同じく**握り潰さない**（`console.error` と画面表示の両方に出す）。
 */
async function putJson(
  url: string,
  body: Record<string, unknown>,
  label: string,
  failures: string[],
) {
  return sendJson("PUT", url, body, label, failures);
}

/**
 * ★職歴の作成だけは型のある body を通す（2026-09-11）。
 * ⚠️★`postJson("/api/jobseeker/experiences", {...})` に戻さないこと。
 *    あの形は `Record<string, unknown>` なので、`visibility_company` を直書きできてしまう
 *    （実際にそれで「伏せている人の新しい職歴だけ実名で出る」を作った）。
 * ⚠️ 失敗の扱いは他と同じ `sendJson` に乗せる（`failures` に積んで画面に出す）。
 */
async function postExperienceJson(
  body: CreateExperienceBody,
  label: string,
  failures: string[],
) {
  return sendJson("POST", EXPERIENCE_CREATE_PATH, body, label, failures);
}

async function sendJson(
  method: "POST" | "PUT",
  url: string,
  /* ⚠️ ここは `JSON.stringify` に渡すだけなので `unknown` でよい。
        ⚠️★`Record<string, unknown>` にすると、型のある body を渡す側が
           **キャストを書くことになり、せっかく置いた型がそこで無効になる**
           （2026-09-11 に `as unknown as Record<string, unknown>` を書いて直した）。 */
  body: unknown,
  label: string,
  failures: string[],
) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error(`[onboarding] ${label}の保存に失敗`, res.status, j);
      failures.push(label);
      return null;
    }
    /* ★成功したら中身を返す（2026-09-11）。作成した職歴の `id` を覚えるのに要る。
       ⚠️ JSON でなくても落とさない。呼び出し側は `id` が無ければ何もしない。 */
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch (err) {
    console.error(`[onboarding] ${label}の保存に失敗`, err);
    failures.push(label);
  }
  return null;
}

// ─── Inner component (needs useSearchParams → wrapped in Suspense) ────────────

/** ⚠️ 2026-08-29 に `parent_id` を足した。親チップを押すと子だけを開くため。 */
export type OnboardingRole = { id: string; name: string; parent_id: string | null };

/**
 * ★2回目に来た人の既存の現職（2026-09-11）。`EXPERIENCE_EDITOR_COLS` で引いた行。
 * ⚠️ 使うのは1画面目に出す項目だけ。**他の列は触らない**（PUT は送られてこない列を
 *    変更しないので、送らなければ既存値が残る）。
 */
export type ExistingExperience = Record<string, unknown>;

/** 入社年の選択肢。⚠️ ビルド時ではなく描画時に現在年を取る */
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 51 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
/* 生年月日の選択肢。⚠️ `/profile/edit` の `ProfileTab` と同じ幅（101年 / 12ヶ月 / 31日）に揃える。
   ⚠️ 日は31固定。月ごとの日数に合わせない —— 不正な組み合わせは
      `PUT /api/jobseeker/profile` の `BIRTH_RE` と DB の DATE 型が弾く。 */
const BIRTH_YEARS = Array.from({ length: 101 }, (_, i) => CURRENT_YEAR - i);
const BIRTH_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

const selectStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: "10px 12px",
  border: "1px solid var(--line)", borderRadius: 10,
  fontSize: 14, fontFamily: "inherit", background: "#fff", color: "var(--ink)",
};

function OnboardingInner({
  roles, roleAliases, currentExperience, initialStance, initialDesiredRoleIds,
}: {
  roles: OnboardingRole[];
  roleAliases: Record<string, string[]>;
  /** ★2回目に来た人の既存の現職（`is_current` のうち最新の1件）。無ければ null */
  currentExperience: ExistingExperience | null;
  /** ★2画面目の初期値。⚠️ 既に答えている人に空を見せないため（1画面目と同じ扱い） */
  initialStance: string | null;
  initialDesiredRoleIds: string[];
}) {
  const router = useRouter();
  /* ★`?next=` を読む（2026-09-09 まで**読んでいなかった**。フェーズ0 の 0-4）。
     ⚠️★`safeNext` を必ず通す。素の値を `router.replace` に渡すと、
        `//evil.com` や `/\evil.com` で外部サイトへ飛ばせる（オープンリダイレクト）。
     ⚠️ 既定は `DEFAULT_AFTER_ONBOARDING` の1箇所だけ。ここに文字列を直書きしない。
     ⚠️ ここに入る値の主な出どころは `OnboardingGuard`（**利用者が見ようとしていたページ**）と
        `postAuth` / `/auth`（認証後の行き先）。 */
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"), DEFAULT_AFTER_ONBOARDING);

  /* ★★ステップ（2026-09-11）。**URL に置く**（`?step=`）。
     ⚠️★**`sessionStorage` に入れないこと。** `OnboardingGuard` で一度踏んでいる
        （`false` を覚えると無限ループ／条件を足したらキーに `.v2`）。同じ罠を別の場所で作らない。
     ⚠️ URL に置くのは**番号だけ**。会社名などの値は置かない（URL に出る）。
     ⚠️ 値は親の state が持つ。**リロードで消える**が、1画面目は「次へ」で保存済みなので
        失うのは2画面目の任意項目だけ。
     ⚠️★**ステップの総数は `STEPS` から出す。数字を直書きしないこと。** */
  const STEPS = ["直近のお勤め先", "転職について", "あとは任意"] as const;
  const rawStep = Number.parseInt(searchParams.get("step") ?? "1", 10);
  const step = Number.isInteger(rawStep) && rawStep >= 1 && rawStep <= STEPS.length ? rawStep : 1;
  const goStep = (n: number) => {
    /* ⚠️ `push`。**`replace` にしないこと** —— ブラウザの戻るで1つ前の画面に戻れる必要がある。 */
    router.push(`/onboarding?step=${n}&next=${encodeURIComponent(next)}`);
    window.scrollTo({ top: 0 });
  };

  /* 会社の検索・候補・ドロップダウンの状態は `CompanyPicker` の中にある。
     ここが持つのは「何が選ばれたか」だけ。 */
  /* ★★既存の現職があれば初期値にする（2026-09-11）。
     ⚠️★**`useState` の初期値として読む。** `useEffect` で後から入れると、
        利用者が打ち始めたあとに上書きする窓ができる。
     ⚠️ 会社は `company_id` を持っていても**この画面では名前しか出せない**ので、
        `company_text` が無いときは空にして選び直してもらう
        （名前を別に引くと `CompanyPicker` の2実装を増やすことになる）。 */
  const ex = currentExperience;
  const exStr = (k: string): string => {
    const v = ex?.[k];
    return typeof v === "string" ? v : "";
  };
  /** 既存の行の id。⚠️ あれば PUT（更新）、無ければ POST（作成） */
  const [experienceId, setExperienceId] = useState<string | null>(() => exStr("id") || null);

  /** ★マスタ紐づけの会社（サーバーが `__company` として渡す）。⚠️ 無ければ null */
  const exCompany = (ex?.__company ?? null) as CompanyLookupResult | null;
  const [query, setQuery] = useState(() => exCompany?.name ?? exStr("company_text"));
  const [selectedCompany, setSelectedCompany] = useState<CompanyLookupResult | null>(() => exCompany);
  /** ★社内での呼び方（`role_title`）。⚠️ `rank`（役職）とは別の列。混ぜないこと（2026-09-11） */
  const [roleTitle, setRoleTitle] = useState(() => exStr("role_title"));
  /** 「＋ 社内での呼び方・部署名」を開いているか。⚠️ 既に値があれば開いた状態で始める */
  const [showJobDetail, setShowJobDetail] = useState(() => !!exStr("role_title") || !!exStr("department"));
  const [saving, setSaving] = useState(false);
  /* 経歴として保存するために必要な3点のうち、会社以外の2つ。
     ⚠️ `ow_experiences` は company / role_category_id / started_at が必須。
        2026-08-10 まではここで会社名だけ聞いて**捨てていた**。 */
  /* ⚠️★親子を自前で分ける処理は削除した（2026-09-11）。`RoleSearchSelect` が
        グループ化も検索も別名も持っている。**ここで階層を組み直さないこと。**
     ⚠️ 「子まで選んでもらえると職種スキルが出る」（2026-08-29）は今も同じ。
        `selectableParent` を true にしてあるので、親のままでも保存は通る。 */

  /* 職種は複数選べる（2026-08-14）。
     ⚠️ 先頭が主職種になる。`ow_experiences.role_category_id` は1つしか持てないので、
        API が先頭をそこへ入れ、全部を `ow_experience_roles` に書く。
     ⚠️ 上限は API と同じ5件。ここだけ増やしても API が切り捨てる。 */
  /* ★職種は1つ（2026-09-11）。複数選択をやめた理由は下の `RoleSearchSelect` のコメント。 */
  const [roleId, setRoleId] = useState<string>(() => exStr("role_category_id"));

  /* ★★2画面目（2026-09-11）。**「転職について」＋「関心のある職種」。**
     ⚠️★`career_stance` は**答えるまで先へ進めない**（`/onboarding/stance` の方針を引き継ぐ）。
        既定値で埋めないことがこの列の要件で、未設定のままだと候補者検索にも出ない。
        ⚠️ 「答えない自由」は**4つ目の選択肢**（「今はいない」）が担保している。
           スキップは置かない。
     ⚠️ 関心のある職種は**任意**。上限は `MAX_DESIRED_ROLES`（定数1つ。ここに数字を書かない）。 */
  const [stance, setStance] = useState<string | null>(initialStance);
  const [desiredRoleIds, setDesiredRoleIds] = useState<string[]>(initialDesiredRoleIds);
  const [startedYear, setStartedYear] = useState<string>(() => exStr("started_at").slice(0, 4));
  const [startedMonth, setStartedMonth] = useState<string>(() => exStr("started_at").slice(5, 7));
  /* 在籍中かどうか。**離職中の人もここを通る**（2026-08-14 追加）。
     ⚠️ 既定は在籍中。大半は在職中で、外すと全員に退職年月を聞くことになる。
     ⚠️ 在籍中でないときは退職年月を**必須**にする。`is_current = false` かつ
        `ended_at` が空の経歴は、企業ページの現役社員にも OB/OG にも出ない
        （`getCompanyEmployees` の OB 側が `ended_at is not null` を要求する）。
        どこにも出ない行を黙って作らない。 */
  const [isCurrent, setIsCurrent] = useState(true);
  /* ★部署名（2026-09-09 追加・任意）。同一社内の異動を読めるようにするために要る。
     ⚠️ 「これまでの職歴」側にも同じ欄がある。片方だけにしないこと。 */
  const [department, setDepartment] = useState(() => exStr("department"));
  /* ★生年月日（2026-09-09 追加・任意）。
     ⚠️★保存先は **`ow_users.birth_date` の1系統だけ**。
        `ow_career_profiles.birth_year` には**書かない**（CLAUDE.md「生年は
        `ow_users.birth_date` の1系統に決めた」）。生年情報が2箇所ある状態を増やさない。
        ⚠️ 値が食い違う実ユーザーが1人いる件は本人確認が要る別件（docs/todo.md）。
           ここから統合しにいかない。
     ⚠️ 経歴（`ow_experiences`）ではなく**本人の属性**なので、現職のブロックの中に置かない
        （あのブロックは会社を選ぶまで描画されず、会社を入れない人には一生出ない）。 */
  const [birthYear, setBirthYear]   = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay]     = useState("");
  const [endedYear, setEndedYear] = useState<string>("");
  const [endedMonth, setEndedMonth] = useState<string>("");
  /* 勤務地・勤務形態（どちらも任意）。
     ⚠️ **後から追記してもらうのが最も難しいデータなので、入口で聞く。**
        「フルリモートと書いてある会社に、実際にリモートで働いている人がいるか」を
        検証するための材料で、あとから思い出して埋めてもらえる性質のものではない。
     ⚠️ 任意のまま。空でも先に進める（入口の摩擦を増やさない）。 */
  const [prefecture, setPrefecture] = useState<string>(() => exStr("prefecture"));
  const [remoteWorkStatus, setRemoteWorkStatus] = useState<string>(() => exStr("remote_work_status"));
  /*
    ⚠️★**社名を伏せる機能は持たない**（2026-08-14 にこの画面から、
       2026-09-02 に職歴エディタから撤去。柴さんの判断）。**戻さないこと。**

       伏せた経歴は企業ページにも検索にも出ないので、置いた分だけ選ばれ、
       この画面で集めたデータがそのまま使えなくなる。
       LinkedIn / Wantedly にも社名を伏せる設定は無く、実名が前提になっている。
       ⚠️ **社名を出したくない人の選択肢は「その職歴を登録しない」になる。**
          LinkedIn と同じで、これは承知のうえの判断。

    ⚠️★**2026-08-31 にここへ書いた「いま社名を伏せる手段は1つも無い」は誤りだった**
       （2026-09-02 に訂正）。当時は `visibility_company` の入力欄だけを探していたが、
       会社名の格納先は3経路の排他（`company_id` / `company_text` / `company_anonymized`）で、
       **職歴エディタの「非公開にする」チェック＝匿名経路が生きていた。**
       **1つの列の UI が無いことを、機能が無いことの根拠にしない。**
       → その匿名経路も 2026-09-02 に撤去したので、いまは本当に手段が無い（意図どおり）。

       実測（2026-09-02 / 本番 24件）: `company_anonymized` **0件** ／
       `visibility_company` **全件 `real`**（当時あった `visibility_company_profile` も同様。
       ⚠️ あちらは 2026-09-11 に `visibility_company` へ一本化し【廃止】列にした）。
       **撤去した時点で誰も使っていなかった。**

    ⚠️ 列（`company_anonymized` / `visibility_company`）と
       描画側のフィルタは**残してある。消していない。**
       読み手が多く（`/people`・`/companies/[id]`・`/u/[id]`・`/schools/[id]`・検索・LP・
       `/biz/employees`）、消すと壊れる。**新しく書き込む経路を足さないこと。**
  */
  /* これまでの職歴・学歴（どちらも任意・既定は0件）。
     ⚠️ 既定で行を1つ出さない。出すと「埋めなければいけない」に見えて入口が重くなる。 */
  const [pastJobs, setPastJobs] = useState<PastJob[]>([]);
  /** ★「揃っていません」を出したか。⚠️ 1回だけ止めて、2回目は進める（2026-09-11） */
  const [experienceWarned, setExperienceWarned] = useState(false);
  const [educations, setEducations] = useState<EducationRow[]>([]);
  const rowKeyRef = useRef(1);
  const [saveError, setSaveError] = useState<string | null>(null);

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
  }, [router]);

  /* 会社（マスタ or 自由入力）・職種・入社年月が揃って初めて保存できる。
     ⚠️ 任意入力のままにする。埋めなければ従来どおり onboarding_completed だけ記録する。 */
  const hasCompany = !!selectedCompany || query.trim().length > 0;
  const hasEnded = !!endedYear && !!endedMonth;
  const canSaveExperience =
    hasCompany && !!roleId && !!startedYear && !!startedMonth && (isCurrent || hasEnded);

  /* ★★「入れたつもり」で終わらせない（2026-09-11）。
     ── 何が起きていたか（実測）──────────────────────────────────────────────
     会社だけ選んで「登録して始める」を押すと、**エラーも警告も出ずに次へ進み、
     `ow_experiences` は0件**だった（3つ揃った行だけ送る作りのため）。
     ⚠️ 入力欄の「保存に必要」は**押す前**に気づかせるもので、**押した後は何も言わなかった。**

     ⚠️★**3つとも触っていない人は止めない。**「任意入力です」と言っている以上、
        素通りする人の邪魔をしない。止めるのは**途中まで入れた人だけ。**
     ⚠️★**2回目は必ず進める。** 進ませないのは「任意」と矛盾する。 */
  const missingForExperience = (() => {
    const touched = hasCompany || !!roleId || !!startedYear || !!startedMonth;
    if (!touched || canSaveExperience) return null;
    const missing: string[] = [];
    if (!hasCompany) missing.push("会社名");
    if (!roleId) missing.push("職種");
    if (!startedYear || !startedMonth) missing.push("入社年月");
    /* ⚠️ 「現職ではない」を選んだのに退職年月が無い場合も揃っていない */
    if (!isCurrent && !hasEnded) missing.push("退職年月");
    return missing;
  })();

  /* ★★1画面目の保存（2026-09-11 / (c) を採った）。
     ── なぜ1画面目だけ保存するか ──────────────────────────────────────────
     失って困るのは1画面目だけ。2画面目は任意項目で、あとから `/mypage` で入れられる。
     ⚠️★**職歴だけは入口で取れないと、そのあと誰も入れない**
        （実測: 実ユーザー11人中、職歴があるのは4人）。
     ⚠️★**`onboarding_completed` はここで立てない。** 最後に立てる。
        いまは直列保存の**先頭**で立てていたので、途中で落ちた人が
        「完了済み・データなし」になっていた（実データで4人）。順序を変えて起きなくする。
        ⚠️ 既存4人のデータは**触らない**（本人の状態であり、直すと来訪時の挙動が変わる）。

     ⚠️★**2回目は PUT（更新）。** `experienceId` があれば更新する。
        POST にすると**同じ職歴が2件**できる。
     ⚠️★**更新では `visibility_company` を送らない。** PUT は「送られてこない＝変更しない」
        なので、送らなければ本人の設定が残る。**作成側の型を更新に流用しないこと。** */
  const saveCurrentExperience = async (failures: string[]): Promise<void> => {
    if (!canSaveExperience) return;
    const company = selectedCompany
      ? { company_id: selectedCompany.id }
      : { company_text: query.trim() };
    const common = {
      role_category_id: roleId,
      started_at: `${startedYear}-${startedMonth}`,
      is_current: isCurrent,
      ...(isCurrent ? {} : { ended_at: `${endedYear}-${endedMonth}` }),
      ...(department.trim() ? { department: department.trim() } : {}),
      ...(roleTitle.trim() ? { role_title: roleTitle.trim() } : {}),
      ...(prefecture ? { prefecture } : {}),
      ...(remoteWorkStatus ? { remote_work_status: remoteWorkStatus } : {}),
    };

    if (experienceId) {
      /* ⚠️ PUT は**送った列だけ**を書く。`visibility_company` は送らない。 */
      await sendJson("PUT", `/api/jobseeker/experiences/${experienceId}`,
        { ...company, ...common }, "経歴", failures);
      return;
    }

    /* ⚠️ 作成は `postExperienceJson`（型に `visibility_company` が無い）を通す。 */
    const res = await postExperienceJson({ ...company, ...common }, "経歴", failures);
    /* 作成できたら id を覚える。⚠️ 覚えないと、戻って直したときに2件目ができる。 */
    if (res && typeof res === "object" && "id" in res) {
      setExperienceId((res as { id?: string }).id ?? null);
    }
  };

  /* ★★関心のある職種の候補（2026-09-11）。**1画面目で選んだ職種から出す。**
     ⚠️★**ゼロから探させない。** 検索欄だけだと、何を入れてよいか分からない。
     ⚠️ 並びは 自分 → 親 → 兄弟（`display_order` 順。`roles` の配列順がそれ）。
        ⚠️★**人気順にはできない。** `ow_profile_desired_roles` は **6人が各1件**しか無く
           （2026-09-11 実測）、順序を決める材料が無い。作り話の順にしない。
           ⚠️ **データが増えたら見直す目印。** 同じクエリで分布を測り、
              偏りが読めるようになったら「よく選ばれる順」に変えてよい。
     ⚠️★**8件で打ち切る。** 兄弟は最大14件（エンジニア）・営業12件・コーポレート13件あり
        （2026-09-11 実測）、全部出すと 375px でチップが5行を超えて、
        下の4択より目立ってしまう。**残りは検索欄から入れられる。** */
  /* ★CTA を色付きにする条件。**ステップごとに違う。**
     ⚠️ 1画面目は会社が空でも**押せる**（灰色のまま進める）。2画面目だけ本当に押せない。
     ⚠️ 3画面目は全項目が任意なので常に進める。 */
  const ctaReady = step === 1 ? !!(query.trim() || selectedCompany)
    : step === 2 ? !!stance
    : true;

  const CANDIDATE_LIMIT = 8;
  const candidateRoleIds = useMemo(() => {
    const self = roles.find((r) => r.id === roleId);
    if (!self) return [];
    const out: string[] = [self.id];
    if (self.parent_id) out.push(self.parent_id);
    /* 親を選んでいた人には**その子**を、子を選んでいた人には**同じ親の兄弟**を出す。 */
    const groupId = self.parent_id ?? self.id;
    for (const r of roles) {
      if (out.length >= CANDIDATE_LIMIT) break;
      if (r.parent_id === groupId && !out.includes(r.id)) out.push(r.id);
    }
    return out;
  }, [roleId, roles]);

  const roleNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of roles) m.set(r.id, r.name);
    return m;
  }, [roles]);

  /** 2画面目の「次へ」。⚠️ `career_stance` は選ぶまで押せないので、ここでは null を想定しない。 */
  const goNextFromStep2 = async () => {
    if (!stance) return;
    setSaving(true);
    setSaveError(null);
    const failures: string[] = [];
    /* ⚠️★保存は `PUT /api/jobseeker/career-preferences`。**新しいルートを作らない**
          （同じ列を書く経路が2つになる）。`/onboarding/stance` も `/mypage` も同じ経路。
       ⚠️ `desired_role_ids` は**毎回送る**。キーが無いと API は「変更なし」と読むので、
          全部外した人の変更が保存されない。 */
    await putJson("/api/jobseeker/career-preferences", {
      career_stance: stance,
      desired_role_ids: desiredRoleIds,
    }, "転職について", failures);
    if (failures.length > 0) {
      /* ⚠️★**ここで止めない。** 保存に失敗しても `career_stance` は空のままなので、
            登録を終えた直後に `OnboardingGuard` が `/onboarding/stance` へ送る
            （＝聞かれないままにはならない）。足止めより先へ通すほうが害が小さい。 */
      setSaveError("転職についての保存に失敗しました。あとでマイページから設定できます。");
    }
    setSaving(false);
    goStep(3);
  };

  /** 1画面目の「次へ」。⚠️ ④の警告はここに移した（3画面に割っても同じ保証が要る）。 */
  const goNextFromStep1 = async () => {
    if (missingForExperience && !experienceWarned) {
      setExperienceWarned(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const failures: string[] = [];
    await saveCurrentExperience(failures);
    if (failures.length > 0) {
      setSaveError("経歴の保存に失敗しました。プロフィール編集からあとで登録できます。");
    }
    setSaving(false);
    goStep(2);
  };

  const finish = async () => {
    /* ⚠️★④の警告は**1画面目の「次へ」に移した**（2026-09-11）。ここには置かない。
          現職の3点は1画面目で聞き終わっているので、この画面で止める理由が無い。 */
    setSaving(true);
    setSaveError(null);
    /* ⚠️ 失敗を握り潰さない。どれが落ちたかを画面にも出す（best-effort だが黙らない）。 */
    const failures: string[] = [];
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      /* ★★現職（1画面目の3点）はここでは保存しない（2026-09-11 / (c)）。
            「次へ」で既に保存済み。**ここで再度 POST すると2件目ができる。**
         ⚠️ ただし2画面目で勤務地・勤務形態を足した場合は反映が要るので、
            **`saveCurrentExperience` をもう一度呼ぶ**（`experienceId` があるので PUT になる）。 */
      await saveCurrentExperience(failures);

      /* これまでの職歴。
         ⚠️ 3点が揃った行だけ送る。`pastJobReady` は現職と同じ条件。
         ⚠️ **直列で送る**。experiences の POST は毎回 ow_users を引き直すので、
            並列にしても速くならないうえ、失敗した行の特定が難しくなる。 */
      for (const j of pastJobs) {
        if (!pastJobReady(j)) continue;
        await postExperienceJson({
          ...(j.company ? { company_id: j.company.id } : { company_text: j.companyText.trim() }),
          role_category_id: j.roleId,
          /* ⚠️ 空のときはキーごと送らない（他の任意項目と同じ扱い）。 */
          ...(j.department.trim() ? { department: j.department.trim() } : {}),
          started_at: `${j.startYear}-${j.startMonth}`,
          ended_at: `${j.endYear}-${j.endMonth}`,
          is_current: false,
          /* ⚠️★`visibility_company` は**型に無い**（`CreateExperienceBody`）。足さないこと。
                作成時の公開範囲は API が決める（既存の職歴から引き継ぐ）。 */
        }, "職歴", failures);
      }

      /* ★生年月日。⚠️ **経歴とは別のテーブル**（`ow_users`）なので別の API を呼ぶ。
         ⚠️★`PUT /api/jobseeker/profile` は `.update()` に **`.select()` を付けていない**。
            付けると PostgREST が全列を返そうとし、`birth_date` の SELECT 権限が
            `authenticated` に無いため **403（42501）** になる
            （CLAUDE.md「`PATCH` が 403 でも UPDATE が失敗したとは限らない」と同じ機構）。
            **あちらに `.select()` を足さないこと。**
         ⚠️ 3つ揃わなければ送らない。`BIRTH_RE` は `YYYY-MM-DD` を要求し、
            外れると 400 になる（黙って null にはならない）。 */
      if (birthYear && birthMonth && birthDay) {
        await putJson("/api/jobseeker/profile", {
          birth_date: `${birthYear}-${birthMonth}-${birthDay}`,
        }, "生年月日", failures);
      }

      /* 学歴。⚠️ 必須は学校名だけ（API 側も同じ）。 */
      for (const e of educations) {
        if (!e.school.trim()) continue;
        await postJson("/api/jobseeker/educations", {
          school: e.school.trim(),
          /* ⚠️ 空のときはキーごと送らない。API は不正値を 400 で弾く。 */
          ...(e.degree ? { degree: e.degree } : {}),
          ...(e.faculty.trim() ? { faculty: e.faculty.trim() } : {}),
          ...(e.gradYear && e.gradMonth ? { graduated_at: `${e.gradYear}-${e.gradMonth}` } : {}),
        }, "学歴", failures);
      }

      if (failures.length > 0) {
        setSaveError(
          `${Array.from(new Set(failures)).join("・")}の保存に失敗しました。プロフィール編集からあとで登録できます。`
        );
      }

      /* ★★`onboarding_completed` は**いちばん最後に立てる**（2026-09-11）。
         ⚠️★以前は直列保存の**先頭**で立てていたので、途中で落ちた人が
            「**完了済み・データなし**」になっていた。実データで4人がその状態
            （`onboarding_completed = false` の4人は全員データ0件＝離脱者。
             逆に「true なのに0件」の人が混ざる形だった）。
         ⚠️ **順序を戻さないこと。** 立てた時点で `OnboardingGuard` が
            `/onboarding` へ誘導しなくなる。 */
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

      // candidate ロールを付与
      await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "candidate" }),
      }).catch(() => {});
    }

    /* ★★そのまま `next` へ送る（2026-09-11）。
       ⚠️★以前はここから `/onboarding/stance` へ送っていたが、**stance は2画面目に入った**ので
          経由すると同じことを2回聞くことになる。
       ⚠️ 2画面目を飛ばした人（1画面目で「後で設定する」を押した人）は `career_stance` が
          空のままだが、**着地した先で `OnboardingGuard` が `/onboarding/stance` へ送る。**
          ＝「答えていない人は必ず聞かれる」は保たれている。**その出口を消さないこと。**
       ⚠️ 完了画面（行き先を3つ選ばせる画面）は 2026-09-09 に削除済み。下のコメントを参照。
       ⚠️★`setSaving(false)` を戻さないこと。遷移までボタンは「登録中...」のままにする。
          false に戻すと、遷移待ちのあいだ**もう一度押せてしまう。** */
    router.replace(next);
  };

  /* ★★完了画面（「ようこそ、OPINIO へ！」＋行き先3つ）は**削除した**（2026-09-09 / A案）。

     ── なぜ ──────────────────────────────────────────────────────────────────
     行き先を3つ選ばせる画面なのに、どれを押しても `OnboardingGuard` が直後に
     `/onboarding/stance` へ引き剥がしていた。**選ばせておいて選ばせない**ので、
     経由すること自体が矛盾していた。いまは `finish()` から直接 stance へ送る。

     ⚠️ 消えたリンクは3つ:
        ・「掲載中の企業を見てみる」→ `/companies`  … `next` の既定が同じ役割を果たす
        ・「プロフィールを設定する」→ `/mypage`     … ヘッダーのユーザーメニューから行ける
        ・「採用担当者・企業の方はこちら」→ `/biz/auth`
          ⚠️ **唯一の入口ではないことを確認済み**（2026-09-09）。求職者側ヘッダーの
             「企業の方はこちら」（→ `/business`）とフッターから入れる。
     ⚠️★戻すなら、`OnboardingGuard` が stance へ引き剥がす動きとどう両立させるかを
        先に決めること。決めずに戻すと、また「押しても行けない画面」になる。 */



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
            {/* ★★見出しは画面ごとに変える（2026-09-11）。
                   ⚠️★**1画面目のまま据え置かないこと。** ステップを分けた直後は
                      2画面目でも「直近のお勤め先を教えてください」と出ていた
                      ——**入力欄は任意項目なのに、見出しは必須の話をしている**状態。
                   ⚠️★**「任意」という語をここに書かないこと。** すぐ下のステップ表示が
                      既に「あとは任意」と言っている。2行のあいだで同じ語を2回出すのは、
                      2026-09-11 に「任意」を4回消したのと同じ形になる。
                      **ここは語ではなく“結果”（入れなくても登録できる）を言う。** */}
            {step === 1 ? "直近のお勤め先を教えてください"
              : step === 2 ? "転職について"
              : "ここから先は、入れなくても登録できます"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 24, lineHeight: 1.7 }}>
            {/*
              ⚠️ ここに「在籍中の企業の情報は、あなたには非表示になります。」という
                 一文があったが削除した（2026-08-13）。主語と目的語が入れ替わっていて
                 意味を成さないうえ、「勤務先には見られない」と読めてしまい、
                 下の「その企業のページに『現役社員』として表示されます」と正面から矛盾していた。
                 どこに出るかの説明は、実際に表示先が決まる下のブロックに一本化する。
            */}
            {/* ⚠️★**「任意入力です。」を戻さないこと**（2026-09-11 / 柴さんの指示で削除）。
                   最初の画面だけで「任意」が**4回**出ていた（ここ・職歴のボタン・学歴のボタン・
                   生年月日のバッジ）。同じことの繰り返しで、読む量が増えるだけだった。
                ⚠️ 「任意である」ことは**押さなくても進めること**と、下の「後で設定する」で伝わる。
                   ⚠️ 逆に「保存に必要」は**残す**。あちらは positive な印で、
                      印の無いものが任意だと分かる形にしてある。 */}
            あとから変更できます。
          </p>

          {/* ★ステップ表示（2026-09-11）。⚠️ **総数は `STEPS.length` から出す。**
                 「これからについて」を移してくると自動で3になる。数字を直書きしない。 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 10, letterSpacing: "0.04em" }}>
            {step} / {STEPS.length}　{STEPS[step - 1]}
          </div>

          {step === 1 && (<>
          {/* 会社の検索・選択。
              ⚠️ 実装は `CompanyPicker` の1つだけにする。これまでの職歴の行も同じ部品を使う。
                 ここに inline で書き直すと、片方だけ直る形の不具合が生まれる。 */}
          <CompanyPicker
            text={query}
            selected={selectedCompany}
            disabled={saving}
            autoFocus
            placeholder="例：セールスフォース、Salesforce、株式会社〇〇"
            onTextChange={(v) => { setQuery(v); setSelectedCompany(null); }}
            onSelect={(c) => { setSelectedCompany(c); setQuery(c.name); }}
            onClear={() => { setSelectedCompany(null); setQuery(""); }}
            onEnter={() => { if (!saving) finish(); }}
          />

          {/* ── 職種・入社年月 ────────────────────────────────────────────────
              ⚠️ 会社が決まってから出す。最初から3つ並べると入口が重くなる。
              ⚠️ ここまで埋めて初めて経歴として保存できる（3点が必須）。 */}
          {hasCompany && (
            <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
              {/* ★★並びは **会社名 → 部署 → 職種**（2026-09-09 / 柴さんの指示）。
                     大きいものから小さいものへ降りる順。⚠️ **職種を先に戻さないこと。**
                     ⚠️「これまでの職歴」の各行も同じ並びにしてある。**片方だけ変えない。** */}
              {/* ★★社内での呼び方（`role_title`）と部署名（`department`）を畳んだ（2026-09-11）。
                     ⚠️★**`rank`（役職）と `department` を1つの欄に混ぜないこと。** 別の列で、
                        タイムラインでも別に扱われる（`buildPositionLines` が
                        部署 → 役職名 → 職種 の順に主見出しへ繰り上げる）。
                     ⚠️ 1画面目は「保存に必要な3点」を主役にするので**既定で閉じる**。
                        既に値があるとき（2回目）は開いた状態で始める。
                     ⚠️★「これまでの職歴」の各行にも同じ欄がある。**片方だけにしないこと** ——
                        同一社内の異動（営業部 → 人事部）は、前後の両方に部署が入って初めて読める。
                     ⚠️ `role_title` は絞り込みには使わない。`/biz/candidates` の
                        **フリーワード検索の対象には既に入っている**（2026-09-11 実測）。 */}
              {!showJobDetail ? (
                <button
                  type="button"
                  onClick={() => setShowJobDetail(true)}
                  style={subAddBtnStyle}
                >
                  <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> 社内での呼び方・部署名
                </button>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
                    社内での呼び方
                  </div>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="例：アカウントエグゼクティブ、営業主任"
                    disabled={saving}
                    maxLength={100}
                    style={textInputStyle}
                    aria-label="社内での呼び方"
                  />

                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 16, marginBottom: 10 }}>
                    部署名
                  </div>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="例：営業部、第6営業部"
                    disabled={saving}
                    maxLength={100}
                    style={textInputStyle}
                    aria-label="部署名"
                  />
                </>
              )}

              {/* ★★職種は `RoleSearchSelect` に統一した（2026-09-11 / 柴さんの指示）。
                     ⚠️★**この部品はプロダクト全体で7箇所が使っている**（求人・職歴エディタ・
                        希望職種・運営の求人・企業の組織図）。**オンボーディングだけが
                        独自の入力を2つ持っていた**（現職＝親チップ＋子チップ、
                        これまでの職歴＝フラットな `<select>`）。1画面に3通りあった。

                  ── なぜこの形が正しいか（記録済みの経緯）────────────────────────
                  ⚠️ 2026-08-06: 2段 `<select>` だけだったころ、**求人20件が大分類と孫に偏り、
                     中間の子職種が1件も使われていなかった**。「105件から目視で探させる UI は
                     機能していない」と判断して**検索を足した**。
                  ⚠️ 2026-08-26: 柴さんの指示で**2段セレクトを併設**。
                     名前を知っている人は検索、知らない人は大分類18件から辿る。
                  ⇒ **検索欄を消して一覧だけに戻さないこと。** どちらの失敗も記録がある。

                  ⚠️★**複数選択をやめて1つにした**（2026-09-11）。`RoleSearchSelect` の
                     2段セレクトは**値が1つの欄でしか出せない**（複数追加式だと
                     「選んだ瞬間に追加」なのか「大分類→小分類」なのかが決まらない）。
                     入口は1つで足り、**あとから職歴エディタで増やせる**。
                     ⚠️ `MAX_ROLES_PER_EXPERIENCE` は API と職歴エディタが使うので残っている。
                  ⚠️ `selectableParent` は **true**。大分類のままでも保存できる
                     （職歴エディタと同じ。子まで選ばせると入力が止まる）。 */}
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 18, marginBottom: 4 }}>
                職種<span style={needLabelStyle}>保存に必要</span>
              </div>
              <RoleSearchSelect
                roles={roles}
                aliases={roleAliases}
                value={roleId}
                onSelect={setRoleId}
                selectableParent
                disabled={saving}
                ariaLabel="職種"
              />

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
                入社年月<span style={needLabelStyle}>保存に必要</span>
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

              {/* 在籍中かどうか（2026-08-14 追加）
                  ⚠️ **離職中の人もこの画面を通る。** 「現在お勤めの会社」しか聞かないと、
                     離職中の人は在籍していない会社を現職として登録するしかなかった。
                  ⚠️ 外したときは退職年月を必須にする。`is_current = false` かつ
                     `ended_at` が空の経歴は、企業ページの現役社員にも OB/OG にも出ない。 */}
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  現在も在籍中
                </span>
              </label>

              {!isCurrent && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 16, marginBottom: 10 }}>
                    退職年月
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={endedYear}
                      onChange={(e) => setEndedYear(e.target.value)}
                      style={selectStyle}
                      aria-label="退職年"
                    >
                      <option value="">年</option>
                      {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                    </select>
                    <select
                      value={endedMonth}
                      onChange={(e) => setEndedMonth(e.target.value)}
                      style={selectStyle}
                      aria-label="退職月"
                    >
                      <option value="">月</option>
                      {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                    </select>
                  </div>
                </>
              )}

            </div>
          )}
          </>)}

          {/* ── ★★2画面目（`?step=2`）＝「転職について」＋「関心のある職種」──────
                 ⚠️★**この画面だけ「次へ」が押せない状態がある**（`career_stance` 未選択）。
                    1・3画面目は全項目が任意で素通りできるので、ここだけ性質が違う。
                    ⚠️ だから**この画面では「後で設定する」を出さない**（下のCTAを参照）。
                       出すと、押せないようにした意味がその場で消える。
                 ⚠️★**`career_stance` はスカウトと候補者検索の唯一の必須条件。**
                    未設定のままだと本人にも企業にも何も起きない。他の任意項目と性質が違う。 */}
          {step === 2 && (<>
            <StanceQuestion value={stance} onChange={setStance} disabled={saving} />

            {/* ── 関心のある職種（任意）────────────────────────────────────
                ⚠️★**候補を先に出す。** 1画面目で選んだ職種と、その親・兄弟。
                   検索欄だけだと「何を入れる欄なのか」が伝わらない。
                ⚠️ 上限は `MAX_DESIRED_ROLES`。**数字を直書きしない。**
                ⚠️ ここは**任意**。1つも選ばずに次へ進める。 */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                関心のある職種
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
                いま見ている職種とは別でもかまいません。おすすめの求人に使います。
              </p>

              {/* 選んだもの。⚠️ 上に出す（何を選んだかが先に読めるように） */}
              {desiredRoleIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {desiredRoleIds.map((id) => (
                    <span
                      key={id}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 10px", borderRadius: 100,
                        border: "1px solid var(--royal)", background: "var(--royal-50)",
                        color: "var(--royal)", fontSize: 13, fontWeight: 700,
                      }}
                    >
                      {roleNameById.get(id) ?? id}
                      <button
                        type="button"
                        onClick={() => setDesiredRoleIds(desiredRoleIds.filter((r) => r !== id))}
                        aria-label={`${roleNameById.get(id) ?? id} を外す`}
                        style={{
                          background: "none", border: "none", padding: 0, lineHeight: 1,
                          color: "inherit", cursor: "pointer", fontSize: 14, fontFamily: "inherit",
                        }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* 候補チップ。⚠️ 既に選んだものは出さない（同じ語が2箇所に並ぶため） */}
              {candidateRoleIds.filter((id) => !desiredRoleIds.includes(id)).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {candidateRoleIds.filter((id) => !desiredRoleIds.includes(id)).map((id) => (
                    <button
                      key={id}
                      type="button"
                      disabled={desiredRoleIds.length >= MAX_DESIRED_ROLES}
                      onClick={() => setDesiredRoleIds([...desiredRoleIds, id])}
                      style={{
                        padding: "7px 13px", borderRadius: 100,
                        border: "1px dashed var(--line)", background: "#fff",
                        color: "var(--ink-soft)", fontSize: 13, fontWeight: 500,
                        cursor: desiredRoleIds.length >= MAX_DESIRED_ROLES ? "default" : "pointer",
                        opacity: desiredRoleIds.length >= MAX_DESIRED_ROLES ? 0.5 : 1,
                        fontFamily: "inherit",
                      }}
                    >
                      ＋ {roleNameById.get(id) ?? id}
                    </button>
                  ))}
                </div>
              )}

              {/* ⚠️ `clearOnSelect` は「選んだら入力欄を空に戻す」＝追加用。
                     ⚠️ この形のとき `RoleSearchSelect` は2段セレクトを出さない（追加ボタンが要るため）。
                        ここは候補チップがその役目を果たしている。 */}
              <RoleSearchSelect
                roles={roles}
                aliases={roleAliases}
                value=""
                onSelect={(id) => {
                  if (desiredRoleIds.includes(id)) return;
                  if (desiredRoleIds.length >= MAX_DESIRED_ROLES) return;
                  setDesiredRoleIds([...desiredRoleIds, id]);
                }}
                selectableParent
                clearOnSelect
                ariaLabel="関心のある職種を検索"
                disabled={saving || desiredRoleIds.length >= MAX_DESIRED_ROLES}
                placeholder={desiredRoleIds.length >= MAX_DESIRED_ROLES
                  ? `関心のある職種は ${MAX_DESIRED_ROLES} 件までです`
                  : "ほかの職種を検索（例: 法人営業、AE）"}
              />
            </div>
          </>)}

          {/* ── ★3画面目（`?step=3`）───────────────────────────────────────
                 ⚠️★1画面目は「保存に必要な3点」だけ。ここから下は
                    **押さなくても登録が終わる**もの。 */}
          {step === 3 && (<>
          {hasCompany && (
            <div>
              {/*
                勤務地・勤務形態（どちらも任意・2026-08-13 追加）
                ⚠️ **後から追記してもらうのが最も難しいデータなので、入口で聞く。**
                   「フルリモートと書いてある会社に、実際にリモートで働いている人がいるか」の
                   検証材料。編集画面に追いやると、実際には誰も戻ってこない。
                ⚠️ 任意。**空でも先に進める**（編集フォーム側の必須ゲートも同日に外した）。
                ⚠️ どちらも1タップで終わる形にしている。項目を増やしすぎない。
              */}
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 20, marginBottom: 10 }}>
                勤務地
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
                勤務形態
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

              {/*
                ★★「その企業のページに『現役社員』として表示されます。見えるのは OPINIO に
                   ログインしている人だけです。」は**外した**（2026-09-09 / 柴さんの判断）。
                   理由は入力欄のあいだに説明文が挟まって読みにくいこと。

                ⚠️★**外した結果、こうなっていることを承知しておくこと:**
                     ・「見えるのはログイン中の人だけ」→ **利用規約 第7条**と
                       プライバシーポリシーがカバーしている（初期設定「ログインユーザーのみ」）。
                     ・「**登録した会社の企業ページに『現役社員』として名前が出る**」
                       → **どこにも書いていない。** 規約・プライバシーポリシー・
                          アプリ内の本人向け画面のいずれにも無い（2026-09-09 に全文検索して確認）。
                   ⚠️ 2026-08-14 に「会社名は伏せる」チェックを外したとき、
                      ここが唯一の告知になった、という経緯がある。

                ⚠️★**戻すときは1文に縮めること。3文には戻さない**（2026-08-14 に一度縮めている）。
                   規約側に書き足す案もあるが、**規約の改定になるので改定日の告知が要る。**
              */}

              {/* ★★「この会社に役割を追加」（2026-09-09 / 柴さんの指摘で追加）。
                     ⚠️★**語は2つだけ。エディタ側（`/mypage/details/experience`）に合わせてある**
                        （2026-09-11 に統一）:
                          **役割** … 同じ会社の中で足す（`この会社に役割を追加` / `この会社での別の役割`）
                          **職歴** … 会社をまたいで足す（`職歴を追加`）
                        ⚠️ **「前の役割」「別の会社の職歴」のような独自の言い方を戻さないこと。**
                           4通りに増えていて、初見だと別々の機能に見えていた。
                     ⚠️★これが無いと、**現職の会社で部署異動した人が会社名を打ち直すことになる。**
                        「これまでの職歴」の『＋ この会社に役割を追加』は過去の会社にしか無く、
                        いま勤めている会社の1つ前の役割を足す手段が無かった。
                     ⚠️ 押すと「これまでの職歴」の**先頭**に、いまの会社を写した行が入る
                        （時系列で現職のすぐ下に来るのが自然なため）。
                     ⚠️ 役職・期間は引き継がない。異動なら必ず変わる。
                     ⚠️ 会社は**値ごと写す**。参照で繋がない（`pastJobAtSameCompany` と同じ理由）。 */}
              <button
                type="button"
                onClick={() => setPastJobs((prev) => [
                  {
                    ...emptyPastJob(rowKeyRef.current++),
                    company: selectedCompany,
                    companyText: selectedCompany ? selectedCompany.name : query.trim(),
                    prefilled: true,
                  },
                  ...prev,
                ])}
                style={{ ...subAddBtnStyle, marginTop: 14 }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> この会社に役割を追加
              </button>
            </div>
          )}

          {/* ── これまでの職歴（任意・複数）────────────────────────────────
              ⚠️ 既定では「＋ 職歴を追加」だけを出す。行を最初から出すと、
                 現職しか無い人にも「埋めるべき欄」に見えて入口が重くなる。
              ⚠️ 保存条件は現職と同じ3点（`pastJobReady`）。揃わない行は送らない。 */}
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
            {/* ★★0件のときは**見出しも説明も出さない**（2026-09-09）。ボタン1行だけにする。
                   ⚠️ 見出し＋「任意」＋説明＋ボタンで**4行**あり、しかも説明はボタンの文言と
                      同じことを言っていた。大半の人は職歴を足さずに進むので、
                      その人たちには**4行ぶんの余計な高さ**にしかなっていない。
                   ⚠️★~~文言に「任意」を残すこと~~ → **2026-09-11 に削除した。**
                      最初の画面で「任意」が4回出ており、繰り返しになっていた
                      （ページ冒頭の一文・職歴のボタン・学歴のボタン・生年月日のバッジ）。
                      **任意であることは、押さなくても進めることと「後で設定する」で伝わる。**
                   ⚠️ 行が1件でもあるときは見出しを出す（どこからどこまでが職歴か要る）。 */}
            {pastJobs.length > 0 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>これまでの職歴</div>
            )}

            {/* ★同じ会社の連続する行を1グループとして描く（2026-09-09）。
                   グループの中では**会社名を1回だけ**出し、役割を縦に並べる。
                   保存後の `MergedTimeline`（会社名1回・役割ごとに期間）と同じ形。
                ⚠️ まとまりは `groupPastJobs` が**行の値から導く**。行に親子を持たせない。 */}
            {groupPastJobs(pastJobs).map((group, gIdx) => {
              const head = group[0];
              const headKey = pastJobGroupKey(head);
              /* ★★グループの見出し（2026-09-11）。
                     ⚠️★**番号ではなく会社名を出す。** スクロール中に目に入るのが
                        「職歴 2」ではなく社名になるので、**どのブロックにいるか**が分かる。
                        保存後の `MergedTimeline`（会社名1回・役割ごとに期間）とも形が揃う。
                     ⚠️★**現職と同じ会社なら会社名を出さない。** 出すと**同じ社名の見出しが
                        2つ並び**、いまより分かりにくくなる（`この会社に役割を追加` で作った行は
                        現職と同じ会社なので必ずこうなる）。代わりに関係を言う。
                     ⚠️★文言は②の語法から外さない（**役割＝同じ会社の中**）。
                     ⚠️ 会社が未入力のグループは番号のまま（社名が無いので出しようがない）。 */
              const isSameAsCurrent = !!headKey && headKey === currentCompanyKey(selectedCompany, query);
              const groupLabel = isSameAsCurrent
                ? "この会社での前の役割"
                : (head.company ? head.company.name : head.companyText.trim()) || `職歴 ${gIdx + 1}`;
              return (
                <div key={head.key} style={rowCardStyle}>
                  {/* ⚠️ 見出しはグループの先頭に1回だけ。行ごとには出さない。
                      ⚠️★**削除ボタンをこの行に置く**（2026-09-11 に直した）。
                         先頭行のラベルを空にしたとき、行ヘッダーが**× だけの行**として
                         残り、見出しの下に意味の分からない × が浮いていた。 */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 8, marginBottom: 8,
                  }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, minWidth: 0,
                      color: isSameAsCurrent ? "var(--ink-soft)" : "var(--ink)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {groupLabel}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPastJobs((prev) => prev.filter((p) => p.key !== head.key))}
                      aria-label={`${groupLabel} を削除`}
                      className="btn-fixed-size"
                      style={removeBtnStyle}
                      disabled={saving}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  {group.map((j, posIdx) => {
                    const ready = pastJobReady(j);
                    /* ⚠️★自動で入った会社名は「触った」に数えない（`prefilled`）。
                          数えると、押した直後の空の行にいきなり警告が出て**エラーに見える。** */
                    const touched =
                      (!j.prefilled && (!!j.company || !!j.companyText.trim())) ||
                      !!j.roleId || !!j.department.trim() ||
                      !!j.startYear || !!j.startMonth || !!j.endYear || !!j.endMonth;
                    const isHead = posIdx === 0;
                    const upd = (patch: Partial<PastJob>) =>
                      setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, ...patch } : p));
                    return (
                      <div key={j.key} style={isHead ? undefined : {
                        /* 2つ目以降の役割。左の罫線で「同じ会社の続き」を示す。
                           ⚠️★**罫線ぶんを `marginLeft` の負値で外へ逃がしてある。**
                              逃がさないと `borderLeft + paddingLeft` の 14px だけ
                              **中の入力欄が狭くなる**（実測 422 → 408）。
                              2026-09-09 に「幅が揃っていない」を直したばかりなので、
                              階層を示すためにまた幅を割ってはいけない。
                           ⚠️ 逃がす先は外側の白いカードの padding（28px）の内側。
                              負値を大きくすると罫線がカードからはみ出す。
                           ⚠️ 入れ子のカード（枠・背景）にしないこと。同じ理由。 */
                        marginTop: 14, paddingTop: 12, paddingLeft: 12, marginLeft: -14,
                        borderTop: "1px dashed var(--line)",
                        borderLeft: "2px solid var(--line)",
                      }}>
                        {/* ⚠️★**行ヘッダーは2つ目以降の役割だけ。** 先頭行はグループの見出しが
                               兼ねる（ラベルを空にすると **× だけの行**が残る。2026-09-11 に直した）。 */}
                        {!isHead && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>
                              この会社での別の役割
                            </div>
                            <button
                              type="button"
                              onClick={() => setPastJobs((prev) => prev.filter((p) => p.key !== j.key))}
                              aria-label={`${groupLabel} の役割を削除`}
                              className="btn-fixed-size"
                              style={removeBtnStyle}
                              disabled={saving}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        )}

                        {/* ⚠️ 会社を選ぶのは**グループの先頭だけ**。2つ目以降は同じ会社に固定する。
                               ここに `CompanyPicker` を出すと、同じ会社を2回選ばせることになる。 */}
                        {isHead ? (
                          <CompanyPicker
                            text={j.companyText}
                            selected={j.company}
                            disabled={saving}
                            placeholder="会社名"
                            onTextChange={(v) => {
                              /* ⚠★会社を書き換えたら、**同じグループの後続も一緒に**書き換える。
                                    先頭だけ変えると、後続が古い会社のまま別グループへ分かれてしまう。 */
                              const keys = new Set(group.map((g) => g.key));
                              setPastJobs((prev) => prev.map((p) => keys.has(p.key) ? { ...p, companyText: v, company: null } : p));
                            }}
                            onSelect={(c) => {
                              const keys = new Set(group.map((g) => g.key));
                              setPastJobs((prev) => prev.map((p) => keys.has(p.key) ? { ...p, company: c, companyText: c.name } : p));
                            }}
                            onClear={() => {
                              const keys = new Set(group.map((g) => g.key));
                              setPastJobs((prev) => prev.map((p) => keys.has(p.key) ? { ...p, company: null, companyText: "" } : p));
                            }}
                          />
                        ) : null}

                        {/* ★★並びは **会社名 → 部署 → 職種**（2026-09-09 / 柴さんの指示）。
                               大きいものから小さいものへ降りる順。**職種を先に戻さないこと。**
                               ⚠️ 現職の欄も同じ並びにしてある。**片方だけ変えない。** */}
                        {/* ★部署名（2026-09-09 追加）。⚠️ 任意。
                               ⚠️★同じ職種のまま部署だけ変わる異動（営業部 → 人事部）は、
                                  これが無いと**同じ行が2つ並ぶだけ**になり、何が変わったのか読めない。 */}
                        <input
                          type="text"
                          value={j.department}
                          onChange={(e) => upd({ department: e.target.value })}
                          placeholder="部署名"
                          disabled={saving}
                          maxLength={100}
                          style={{ ...textInputStyle, marginTop: isHead ? 8 : 0 }}
                          aria-label={`職歴 ${gIdx + 1} の部署名`}
                        />

                        {/* ★★現職と同じ `RoleSearchSelect` に揃えた（2026-09-11）。
                               ⚠️★それまでは**フラットな `<select>`（親＋子で148件）**で、
                                  同じ「職種」を1画面で2通りの操作で聞いていた。
                               ⚠️ 148件を1つのリストに並べるのは 2026-08-06 に
                                  「機能していない」と判明した形そのもの。**戻さないこと。** */}
                        <div style={{ marginTop: 8 }}>
                          <RoleSearchSelect
                            roles={roles}
                            aliases={roleAliases}
                            value={j.roleId}
                            onSelect={(id) => upd({ roleId: id })}
                            selectableParent
                            disabled={saving}
                            ariaLabel={`職歴 ${gIdx + 1} の職種`}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                          <select
                            value={j.startYear}
                            onChange={(e) => upd({ startYear: e.target.value })}
                            style={selectStyle}
                            aria-label={`職歴 ${gIdx + 1} の入社年`}
                          >
                            <option value="">{isHead ? "入社年" : "開始年"}</option>
                            {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                          </select>
                          <select
                            value={j.startMonth}
                            onChange={(e) => upd({ startMonth: e.target.value })}
                            style={selectStyle}
                            aria-label={`職歴 ${gIdx + 1} の入社月`}
                          >
                            <option value="">月</option>
                            {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                          <select
                            value={j.endYear}
                            onChange={(e) => upd({ endYear: e.target.value })}
                            style={selectStyle}
                            aria-label={`職歴 ${gIdx + 1} の退職年`}
                          >
                            <option value="">{isHead ? "退職年" : "終了年"}</option>
                            {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                          </select>
                          <select
                            value={j.endMonth}
                            onChange={(e) => upd({ endMonth: e.target.value })}
                            style={selectStyle}
                            aria-label={`職歴 ${gIdx + 1} の退職月`}
                          >
                            <option value="">月</option>
                            {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                          </select>
                        </div>

                        {/* ⚠️ 揃っていない行は保存されない。黙って捨てない。 */}
                        {touched && !ready && (
                          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--warm-ink)", marginTop: 10, lineHeight: 1.7 }}>
                            会社名・職種・入社年月・退職年月がそろうと保存されます。
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* ★この会社に役割を追加（2026-09-09）。
                      ⚠️★会社が決まるまで出さない。空の行を複製しても意味が無い。
                      ⚠️ 既定では出さず、**押した人にだけ**役割が増える。入口の摩擦を増やさないため
                         （この画面は「会社を選ぶまで職種を出さない」等、一貫してそうしている）。
                      ⚠️ 挿入位置は**そのグループの直後**。末尾に足すと別グループに分かれる。 */}
                  {headKey && (
                    <button
                      type="button"
                      onClick={() => setPastJobs((prev) => {
                        const last = group[group.length - 1];
                        const at = prev.findIndex((p) => p.key === last.key);
                        const next = [...prev];
                        next.splice(at + 1, 0, pastJobAtSameCompany(rowKeyRef.current++, last));
                        return next;
                      })}
                      style={{ ...subAddBtnStyle, marginTop: 10 }}
                    >
                      <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> この会社に役割を追加
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setPastJobs((prev) => [...prev, emptyPastJob(rowKeyRef.current++)])}
              style={addBtnStyle}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>{" "}
              {/* ⚠️★**「（任意）」を戻さないこと**（2026-09-11）。2026-09-09 に
                     「0件のときは見出しの『任意』バッジが消えるので文言に残す」と決めたが、
                     **その後の画面では「任意」が4回出ていた**ので削った。 */}
              {pastJobs.length > 0 ? "職歴を追加" : "これまでの職歴を追加"}
            </button>
          </div>

          {/* ── 学歴（任意・複数）────────────────────────────────────────── */}
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
            {/* ★★0件のときは見出しも説明も出さない（職歴と同じ。2026-09-09）。 */}
            {educations.length > 0 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>学歴</div>
            )}

            {educations.map((e, idx) => (
              <div key={e.key} style={rowCardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>学歴 {idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => setEducations((prev) => prev.filter((p) => p.key !== e.key))}
                    aria-label={`学歴 ${idx + 1} を削除`}
                    className="btn-fixed-size"
                    style={removeBtnStyle}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={e.school}
                  onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, school: ev.target.value } : p))}
                  placeholder="学校名"
                  disabled={saving}
                  maxLength={100}
                  style={textInputStyle}
                  aria-label={`学歴 ${idx + 1} の学校名`}
                />
                {/* 学校区分。⚠️ 値は `DEGREES`（API の検証と同じ定数）、表示は `DEGREE_LABELS`。
                       小学校・中学校・高等学校・専門学校・短期大学・大学・大学院まで選べる。 */}
                <select
                  value={e.degree}
                  onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, degree: ev.target.value } : p))}
                  style={{ ...selectStyle, width: "100%", marginTop: 8 }}
                  aria-label={`学歴 ${idx + 1} の区分`}
                >
                  <option value="">区分</option>
                  {DEGREES.map((d) => <option key={d} value={d}>{DEGREE_LABELS[d]}</option>)}
                </select>
                <input
                  type="text"
                  value={e.faculty}
                  onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, faculty: ev.target.value } : p))}
                  placeholder="学部・学科"
                  disabled={saving}
                  maxLength={100}
                  style={{ ...textInputStyle, marginTop: 8 }}
                  aria-label={`学歴 ${idx + 1} の学部・学科`}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <select
                    value={e.gradYear}
                    onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, gradYear: ev.target.value } : p))}
                    style={selectStyle}
                    aria-label={`学歴 ${idx + 1} の卒業年`}
                  >
                    <option value="">卒業年</option>
                    {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                  </select>
                  <select
                    value={e.gradMonth}
                    onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, gradMonth: ev.target.value } : p))}
                    style={selectStyle}
                    aria-label={`学歴 ${idx + 1} の卒業月`}
                  >
                    <option value="">月</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                  </select>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setEducations((prev) => [...prev, emptyEducation(rowKeyRef.current++)])}
              style={addBtnStyle}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>{" "}
              {/* ⚠️ 「（任意）」を削ったので0件でも同じ文言。三項に戻さないこと（2026-09-11） */}
              学歴を追加
            </button>
          </div>

          {/* ── 生年月日（任意）────────────────────────────────────────────
              ★2026-09-09 追加。実ユーザー11人中7人が未入力で、あとから入れてもらうのが難しい。

              ⚠️★**経歴ではなく本人の属性**なので、現職のブロックの外に置く。
                 あのブロックは会社を選ぶまで描画されないので、中に入れると
                 会社を入れない人には一生出ない。
              ⚠️★保存は **`PUT /api/jobseeker/profile`**（`ow_users.birth_date`）。
                 経歴の POST（`/api/jobseeker/experiences`）に相乗りさせない。
              ⚠️★**`ow_career_profiles.birth_year` には書かない。** 生年情報を2箇所にしない。
              ⚠️ 3つ揃わなければ送らない（`BIRTH_RE` が `YYYY-MM-DD` を要求する）。 */}
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
              {/* ⚠️ 「任意」バッジは 2026-09-11 に削除。戻さないこと。 */}
              生年月日
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} style={selectStyle} aria-label="生年">
                <option value="">年</option>
                {BIRTH_YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
              </select>
              <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} style={selectStyle} aria-label="生月">
                <option value="">月</option>
                {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
              </select>
              <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} style={selectStyle} aria-label="生日">
                <option value="">日</option>
                {BIRTH_DAYS.map((d) => <option key={d} value={d}>{Number(d)}日</option>)}
              </select>
            </div>
            {/* ⚠️★**この一文を消さないこと。** 年齢は詳細ページにしか出さず、年齢での絞り込みも
                   作らないという方針（CLAUDE.md「年齢は詳細だけ」／労働施策総合推進法9条）の
                   説明がここにしか無い。
                ⚠️★**「登録ユーザー一覧に表示されます」と書かないこと。** 実態と逆で、
                   古い文言としてどこかに残っていた前例がある（2026-08-19）。 */}
            <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 8, lineHeight: 1.7 }}>
              ユーザー一覧には表示されません。年齢はプロフィールの詳細ページにだけ出ます。
            </p>
          </div>

          {saveError && (
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 14 }}>{saveError}</p>
          )}
          </>)}

          {/* ★主CTA。375px では**下端に貼る**（2026-09-09）。実体は globals.css の
                 `.onb-cta-sticky`（メディアクエリが要るのでインラインに書けない）。
              ⚠️★**「後で設定する」を一緒に貼らないこと。** 全項目が任意の画面で
                 離脱ボタンが常時見える状態になる。あちらはカードの外・下のまま。
              ⚠️ `marginTop` はこのラッパー側に移した。ボタンに残すと、貼ったときに
                 白い帯の中に 20px の余白が入って厚くなる。 */}
          <div className="onb-cta-sticky" style={{ marginTop: 20 }}>
            {/*
              ★★公開範囲の説明。**1画面目で会社を入れた人にだけ、CTA の直前に出す**
                 （2026-09-11 に位置を変えた。2026-09-09 は見出し直下に固定で出していた）。

              ── なぜここか ──────────────────────────────────────────────────
              ⚠️★**1画面目の「次へ」で職歴が保存される**（(c)）。実名掲載が確定するのは
                 この押下なので、**その手前に置く**。2画面目以降に出しても遅い。
              ⚠️★**2画面目・3画面目には出さない。** 同じことを繰り返すだけになる。
              ⚠️★**会社が空のときは出さない。** 掲載先が決まっていない段階で
                 実名掲載の話をしても意味がない（入口を重くするだけ）。
                 ⚠️ 逆に**自由入力でも出す** —— `hasCompany` は職種・入社年月を出す条件と
                    同じものを使っている。**別の条件を書き起こさないこと。**
              ⚠️★**sticky の帯の中に置く。** 375px では CTA が下端に貼り付くので、
                 帯の外に置くと**スクロール位置によっては一文が画面の外に出る。**
                 「伝えた内容とボタンが同時に見える」ことが要件。
              ⚠️★**入力欄ごとにバッジを散らさないこと。** 出すのはここ1箇所だけ。
                 2026-08-19 に「緑バッジと紫バッジが 1,138px 離れて同時に見えない」問題を踏んでいる。

              ⚠️★**1文にする。3文には戻さない**（2026-08-14 に3文→1文に縮めている）。
              ⚠️ 実測（2026-09-09 / 保存後のDB値）: `visibility_company` は **`real`** ＝**実名で出る**。
                 ここを「伏せられます」等に書き換えないこと。伏せる選択肢は入口から外してある。
              ⚠️ 「ログインしている人だけ」の側は利用規約 第7条とプライバシーポリシーにもあるが、
                 **「企業ページに実名で載る」ほうはどこにも書いていない**（2026-09-09 に全文検索）。
                 **この1行が唯一の告知。消すなら規約側に足すこと（改定日の告知が要る）。**
            */}
            {step === 1 && hasCompany && (
              <p style={{
                margin: "0 0 10px", padding: "9px 11px",
                fontSize: 12, fontWeight: 500, color: "var(--ink-soft)",
                background: "var(--bg-tint)", border: "1px solid var(--line-soft)",
                borderRadius: 8, lineHeight: 1.7,
              }}>
                選んだ会社の企業ページに、
                <strong style={{ color: "var(--ink)" }}>あなたの名前が実名で表示されます</strong>
                （見えるのは OPINIO にログインしている人だけです）。
              </p>
            )}
            {/* ★★押した人にだけ出す（2026-09-11）。⚠️ **ボタンの直上**に置く ——
                   375px でも**伝えた内容とボタンが同時に見える**必要がある
                   （sticky の帯の中なので、スクロール位置に関わらず一緒に見える）。
                ⚠️★**モーダルにしない。** 375px で本文が隠れ、何を直せばよいか分からなくなる。
                ⚠️★**何が足りないかを名指しする。** 「入力が不十分です」では直せない。
                ⚠️★**「このまま進むと会社名は保存されない」まで言う。** これを落とすと、
                   「警告は出たが、何が失われるか分からない」で終わる。
                ⚠️ もう一度押せば進む（`experienceWarned`）。**進ませないのは「任意」と矛盾する。** */}
            {experienceWarned && missingForExperience && (
              <p
                role="alert"
                style={{
                  margin: "0 0 10px", padding: "10px 12px", borderRadius: 8,
                  background: "var(--warm-soft)", border: "1px solid #FDE68A",
                  fontSize: 12.5, lineHeight: 1.75, color: "var(--warm-ink)",
                }}
              >
                <strong style={{ color: "var(--ink)" }}>
                  {missingForExperience.join("・")}が未入力です。
                </strong>
                <br />
                このまま進むと、直近のお勤め先は職歴として保存されません。
                もう一度押すとそのまま進みます。
              </p>
            )}
            {/* ★★2画面目だけ、選ぶまで押せない（2026-09-11）。
                   ⚠️★**押せない理由を必ず添える。** 灰色のボタンだけだと、
                      1・3画面目の「未入力でも押せる灰色」と見分けが付かない
                      （1画面目は会社が空でも押せる）。 */}
            {step === 2 && !stance && (
              <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 600, color: "var(--ink-mute)", textAlign: "center" }}>
                どれか1つ選ぶと、次へ進めます
              </p>
            )}
            {/* ⚠️★ステップで役割が変わる。1・2画面目は**保存して次へ**、最後は**完了**。
                   ⚠️ 1画面目の「次へ」でも保存する（(c)）。**押さずに閉じた人は残らない。**
                   ⚠️★**2画面目だけ `disabled`。** `career_stance` は既定値で埋めないことが
                      要件なので、選ばせずに通さない（`/onboarding/stance` と同じ）。 */}
            <button
              type="button"
              onClick={step === 1 ? goNextFromStep1 : step === 2 ? goNextFromStep2 : finish}
              disabled={saving || (step === 2 && !stance)}
              style={{
                width: "100%", padding: "13px 20px",
                background: ctaReady
                  ? "linear-gradient(135deg, var(--royal), #3B5FD9)"
                  : "var(--line)",
                color: ctaReady ? "#fff" : "var(--ink-mute)",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: saving ? "wait" : (step === 2 && !stance) ? "default" : "pointer",
                fontFamily: "inherit", transition: "all 0.2s",
              }}
            >
              {saving ? "保存中..." : step === STEPS.length ? "登録して始める →" : "次へ →"}
            </button>

            {/* ⚠️ 2画面目からは戻れるようにする。`goStep` は `push` なのでブラウザの戻るでも戻れる。 */}
            {step > 1 && (
              <button
                type="button"
                onClick={() => goStep(step - 1)}
                disabled={saving}
                style={{
                  width: "100%", marginTop: 8, padding: "10px 20px",
                  background: "none", border: "none", color: "var(--ink-soft)",
                  fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                ← 戻る
              </button>
            )}
          </div>
        </div>

        {/* スキップ。
            ⚠️★**2画面目には出さない**（2026-09-11）。あの画面は `career_stance` を
               選ぶまで進めない作りなので、ここに離脱口があると**その場で無効になる。**
            ⚠️ 1・3画面目には残す（全項目が任意で、押さずに閉じた人を作らないため）。
            ⚠️ 1画面目で押した人は `career_stance` が空のまま完了するが、
               直後に `OnboardingGuard` が `/onboarding/stance` へ送るので**聞かれないままにはならない。** */}
        {step !== 2 && (
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
        )}
      </div>
    </div>
  );
}

// ─── Shared styles & sub-components ──────────────────────────────────────────

const textInputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  border: "1px solid var(--line)", borderRadius: 10,
  fontSize: 14, color: "var(--ink)", fontFamily: "inherit",
  outline: "none", boxSizing: "border-box", background: "#fff",
};

/**
 * 「これまでの職歴」「学歴」の1件ぶん。
 *
 * ⚠️★**左右に padding を持たせないこと**（2026-09-09 / 柴さんの指摘で直した）。
 *    以前は `border: 1px` ＋ `padding: 14px` の色付きカードだったため、
 *    **中の入力欄だけが 30px 狭く**なり、すぐ上の「直近のお勤め先」の欄と
 *    幅が揃っていなかった（実測: 主 420px / 職歴 390px）。
 *    幅が違うと、同じフォームなのに**別のUIが差し込まれたように見える。**
 * ⚠️ 束ねているのは**上の細い罫線と「職歴 N」の見出し行**。これは
 *    「直近のお勤め先」が見出し＋全幅の欄で構成されているのと同じ形。
 *    ⚠️ **カード（枠・背景・角丸）に戻さないこと。** 戻すと幅がまた割れる。
 */
/**
 * 「これまでの職歴」の1グループ（＝1社）。
 *
 * ★入れ子を1段ぶん見せる（2026-09-11）。⚠️★**入力欄の幅を削らない。**
 *    2段目の役割と**同じやり方**で、`paddingLeft` のぶんを `marginLeft` の負値で
 *    外側のカードの padding（28px）へ逃がしてある。
 *    ⇒ 罫線とインデントは**カードの余白の側**に出て、中の入力欄の x は動かない。
 *    ⚠️ 逃がさずに `paddingLeft` だけ足すと、その 12px ぶん入力欄が狭くなる
 *       （2段目でその失敗をして直したばかり: 実測 422 → 408）。
 * ⚠️ 入れ子のカード（枠・背景）にしないこと。カードの中にカードが並ぶと、
 *    どちらが親か分からなくなる。
 */
const rowCardStyle: React.CSSProperties = {
  borderTop: "1px solid var(--line-soft)",
  borderLeft: "2px solid var(--line-soft)",
  paddingTop: 14, paddingLeft: 12, marginLeft: -14, marginBottom: 14,
};

/**
 * 「保存に必要」の小さな印。**黄色い警告バナーの置き換え**（2026-09-09 / 柴さんの指摘）。
 *
 * ── なぜ印を残すのか ────────────────────────────────────────────────────────
 * ⚠️★**`ow_experiences.role_category_id` と `started_at` は NOT NULL**（実測で確認）。
 *    会社名だけでは行を作れないので、埋めずに進むと**会社名は保存されない。**
 *    黙って捨てると、このリポジトリが3回踏んでいる「入力させたのに保存しない」に戻る
 *    （CLAUDE.md「エラーと失敗を握りつぶさない原則」の事例4・5・6）。
 * ⚠️ そこで**伝える場所を変えた**。以前は2行の黄色い箱で、しかも「このまま進めると
 *    会社名は保存されません」と**失敗の話から入っていた**のでエラーに見えていた。
 *    いまは要件を**欄の隣に5文字**で置くだけ。
 * ⚠️★**「必須」と書かないこと。** 空のままでも「登録して始める」は通る
 *    （この画面は全項目が任意）。嘘になる。
 * ⚠️ 隣の「（任意）」と対になる語にしてある。**片方だけ言い回しを変えないこと。**
 */
const needLabelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6,
};

/**
 * 「同じ会社の続き」を足すボタン。**枠を持たない文字のボタン**にしてある（2026-09-09）。
 *
 * ⚠️★`addBtnStyle`（破線の枠）と**見た目を分けること**。以前は4つとも同じ形で、
 *    「この会社での前の役割」「この会社に役割」「別の会社の職歴」「学歴」が
 *    **文言を読むまで見分けられなかった。**
 *    枠あり＝新しい塊を作る／枠なし＝いまの塊の続き、という対応にしてある。
 */
const subAddBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "6px 2px", borderRadius: 8,
  border: "none", background: "none",
  color: "var(--royal)", fontSize: 12, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
  whiteSpace: "nowrap",
};

const addBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 16px", borderRadius: 10,
  border: "1px dashed var(--line)", background: "#fff",
  color: "var(--royal)", fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
  whiteSpace: "nowrap",
};

/* ⚠️ `.btn-fixed-size` を付けて `globals.css` の `min-height: 36px` を外す。
      付けないと 26×26 のつもりが 26×36 の縦長になる
      （.claude/rules/ui-debugging.md「min-height は height に勝つ」）。 */
const removeBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
  background: "none", border: "none", cursor: "pointer",
  color: "var(--ink-mute)", padding: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};

/**
 * 会社名の検索・選択。**現職の欄と「これまでの職歴」の各行が同じ部品を使う。**
 *
 * ⚠️ 候補・検索中・ドロップダウンの状態はこの中に閉じる。呼び出し側が持つのは
 *    「入力された文字列」と「選ばれた企業」だけ。
 * ⚠️ 見つからないときの説明文もここに置く。呼び出し側に書くと、
 *    行ごとに文言が割れる（CLAUDE.md「実装が3箇所に割れていた」の再発）。
 */
function CompanyPicker({
  text, selected, disabled, placeholder, autoFocus,
  onTextChange, onSelect, onClear, onEnter,
}: {
  text: string;
  selected: CompanyLookupResult | null;
  disabled?: boolean;
  placeholder: string;
  autoFocus?: boolean;
  onTextChange: (v: string) => void;
  onSelect: (c: CompanyLookupResult) => void;
  onClear: () => void;
  onEnter?: () => void;
}) {
  /* ⚠️ 取得は `useCompanyLookup` に寄せた（2026-09-05）。
        **デバウンスの 280ms は変えない** —— 揃えるとこの画面の挙動が変わる。
        ⚠️ 取得できたらドロップダウンを開くのは**この画面だけ**の作法なので、
           コールバックで受ける（経歴編集は `open` を自前で持っている）。 */
  const [showDropdown, setShowDropdown] = useState(false);
  /* ★「この会社をOPINIOに登録する」を開いているか（2026-09-05）。
        ⚠️ ダイアログは**ドロップダウンの代わりに**出す。重ねない。 */
  const [creating, setCreating] = useState(false);
  const { results, loading: searching, search, clear: clearResults } = useCompanyLookup({
    debounceMs: 280,
    onResults: () => setShowDropdown(true),
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 100);
  }, [autoFocus]);

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


  const showFreeTextOption = text.trim().length >= 1 && !selected && results.length < 8;
  /* ⚠️ 表示名でも完全一致を見る。候補に「Salesforce」と出ているのに
        「Salesforce」と打つと『この名前のまま入力する』が出る、を防ぐ。 */
  const exactMatch = results.some(
    (r) => r.name === text.trim()
  );

  return (
    <>
      <div style={{ position: "relative" }}>
        {selected ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 14px",
            border: "2px solid var(--royal)",
            borderRadius: 10, background: "var(--royal-50)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {companyLabel(selected)}
              </div>
              {/* ★選んだのが未掲載の企業なら、その旨をここでも出す。
                     ⚠️ 候補の行だけに出すと、選んだあとに消えて誤解される。 */}
              {!selected.isListed && (
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                  OPINIOに未掲載（企業ページはありません）
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                clearResults();
                onClear();
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="btn-fixed-size"
              style={removeBtnStyle}
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
              value={text}
              onChange={(e) => {
                onTextChange(e.target.value);
                search(e.target.value);
                setCreating(false);
                // ⚠️ 空にしたらドロップダウンも畳む（切り出し前と同じ挙動）
                if (e.target.value.trim().length === 0) setShowDropdown(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowDropdown(false);
                if (e.key === "Enter" && !showDropdown) onEnter?.();
              }}
              placeholder={placeholder}
              disabled={disabled}
              style={{
                ...textInputStyle,
                padding: "13px 40px 13px 16px",
                background: disabled ? "var(--bg-tint)" : "#fff",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--royal)";
                if (results.length > 0 || text.trim()) setShowDropdown(true);
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
                onMouseDown={(e) => { e.preventDefault(); onSelect(c); setShowDropdown(false); }}
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
                  {companyLabel(c).charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {companyLabel(c)}
                  </div>
                  {/* ★掲載中と未掲載を区別して出す（2026-09-04）。
                         ⚠️ 未掲載でも**選べる**（company_id で繋がる）。
                            「選べない」と誤解される表現にしないこと。
                         ⚠️★`phase` を戻さないこと（2026-08-29）。生値（listed / unicorn /
                            series_d …）がそのまま出ていた前例がある。
                         ⚠️ 業種も出さない（`lookup` が返さない。未掲載企業の業種まで
                            出すことになるため）。 */}
                  {!c.isListed && (
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                      OPINIOに未掲載（企業ページはありません）
                    </div>
                  )}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            ))}

            {/* ★① この会社をOPINIOに登録する（2026-09-05 追加）
                ⚠️ **自由入力より先・大きく出す。** 自由入力は業界に結びつかないので、
                   そちらが既定に見えると「業界に繋がらない経歴」が増える。 */}
            {showFreeTextOption && !exactMatch && text.trim().length > 0 && (
              <>
                {results.length > 0 && <div style={{ height: 1, background: "var(--line)", margin: "0 12px" }} />}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setCreating(true); setShowDropdown(false); }}
                  style={{
                    width: "100%", textAlign: "left", background: "none", border: "none",
                    padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--royal-50)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "var(--royal-50)", border: "1px dashed var(--royal)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)" }}>
                      「{text.trim()}」をOPINIOに登録する
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                      会社名と業種だけ。あなたの経歴に会社として紐づきます
                    </div>
                  </div>
                </button>
              </>
            )}

            {/* ② 自由入力のまま進む（マスタに完全一致が無い場合）
                ⚠️ **消さない。** 企業作成は取り消せないが、自由入力は本人の職歴の中で
                   完結する。失敗したときのコストが違うので逃げ道として残す
                   （2026-09-05 / 柴さんの判断）。 */}
            {showFreeTextOption && !exactMatch && text.trim().length > 0 && (
              <>
                <div style={{ height: 1, background: "var(--line)", margin: "0 12px" }} />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setShowDropdown(false); }}
                  style={{
                    width: "100%", textAlign: "left", background: "none", border: "none",
                    padding: "11px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                  <div style={{ width: 32, flexShrink: 0 }} />
                  {/* ⚠️ 「登録」と書かない。企業マスタには何も作らず、
                         ow_experiences.company_text に名前が入るだけ（2026-08-13）。
                      ⚠️ 「企業として保存します」も書かない（2026-08-14）。
                         ow_companies に行は作られないので、企業ページも検索候補も増えない。
                         作られると読める文言は、この画面で実際に誤解された。 */}
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                    登録せず、「{text.trim()}」をこの名前のまま入力する
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ★作成ダイアログ。⚠️ 経歴編集とオンボーディングで**同じ部品**を使う */}
      {creating && !selected && (
        <CompanyCreateDialog
          initialName={text.trim()}
          onCancel={() => setCreating(false)}
          onCreated={(c) => { setCreating(false); clearResults(); onSelect(c); }}
        />
      )}

      {/* ⚠️ 選択後の「OPINIOに掲載中の企業と連携します」は出さない（2026-08-15 削除）。
             選ばれた企業はカード（社名＋業種）で見えているので、それ以上の説明は要らない。
             「掲載」は運営側の事情で、本人の職歴を書く欄には関係が無い。 */}
      {/*
        ⚠️ ここを「候補が見つかりません」に戻さないこと（2026-08-13 変更）。
           「見つかりません」は検索の失敗＝自分のミスとして読まれ、
           入力し直しか離脱を誘う。IT 以外の企業では普通に起きる。
           **まず「このまま進めて大丈夫」と言い切ること。**

        ⚠️ 「掲載」を持ち出さないこと（2026-08-14 変更）。
           ここは本人の職歴を書く欄で、OPINIO に企業ページがあるかどうかは
           運営側の事情。入力する人には関係が無く、説明が増えるだけ迷う。

        ⚠️ 「紐づきません」のような実装語も使わない。何を失うのかが伝わらない。
      */}
      {!selected && text.trim() && !searching && results.length === 0 && (
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 8, lineHeight: 1.8 }}>
          <strong style={{ color: "var(--ink-soft)" }}>このまま進めて大丈夫です。</strong>
          入力した社名がそのまま経歴に残ります。
          <br />
          あとからプロフィール編集で選び直せます。
        </p>
      )}
    </>
  );
}

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

export default function OnboardingPage({
  roles, roleAliases, currentExperience, initialStance, initialDesiredRoleIds,
}: {
  roles: OnboardingRole[];
  roleAliases: Record<string, string[]>;
  currentExperience: ExistingExperience | null;
  initialStance: string | null;
  initialDesiredRoleIds: string[];
}) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-tint)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--royal-100)", borderTopColor: "var(--royal)", animation: "spin 0.8s linear infinite" }} />
      </div>
    }>
      <OnboardingInner
        roles={roles}
        roleAliases={roleAliases}
        currentExperience={currentExperience}
        initialStance={initialStance}
        initialDesiredRoleIds={initialDesiredRoleIds}
      />
    </Suspense>
  );
}
