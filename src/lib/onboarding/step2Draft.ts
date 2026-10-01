/**
 * オンボーディング2画面目の下書き（2026-09-28 / 柴さんの指示）。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * **「会社を登録する」はもう DB に書いているのに、リロードすると画面から消えていた。**
 * 2画面目の値は親の state だけが持っており、`ow_experiences` の行ができるのは
 * 「次へ」を押したときだけ。その前にリロードすると復元する元が無い。
 *
 * ⚠️★**実害は「打ち直しが面倒」ではなく、同じ会社をもう1社作ってしまうこと。**
 *    2026-09-28 に本番で実際に起きた（`株式会社テスト` が 03:59 と 05:43 の2行）。
 *    ⚠️ 重複検出は `is_test` の企業を候補から外すので、倒した1社目は「もしかして」に出ない。
 *
 * ── 鍵の決め方（★ここを崩さないこと）──────────────────────────────────────
 * ⚠️★**利用者ごとに分ける。** 同じブラウザで別のアカウントに入り替わったとき、
 *    前の人の下書きを復元すると**他人の勤務先が初期値に出る。**
 * ⚠️★**版（`v1`）を入れる。** 保存する項目を増やしたら版を上げる。
 *    `OnboardingGuard` で「条件を足したらキーに `.v2`」を一度踏んでいる。
 * ⚠️★**`sessionStorage` は使わない**（同上の注記）。`localStorage` にする。
 *
 * ── 消し方 ──────────────────────────────────────────────────────────────────
 * ⚠️★**サーバーに入った時点で消す。** `ow_experiences` の行ができたら、
 *    以降はそちらが正（`page.tsx` が引いて `currentExperience` で渡す）。
 *    残したままだと、**保存済みの値を古い下書きが上書きする**余地ができる。
 * ⚠️ 完了時（「後で設定する」を含む）にも消す。
 *
 * ⚠️ 読み書きは**必ず try/catch**。プライベートウィンドウや保存を止めている環境では
 *    `localStorage` に触るだけで例外になる（CLAUDE.md の Artifact 系と同じ扱い）。
 */

/** ⚠️ 項目を増やしたら `KEY_VERSION` を上げる */
const KEY_VERSION = "v2";  /* v2: 役職（rank / rankTitle）を足した（2026-10-01） */

/** ⚠️★`userKey` は利用者ごとに違う値（auth の id）。空のときは保存しない */
function storageKey(userKey: string): string {
  return `opinio.onboarding.step2.${KEY_VERSION}:${userKey}`;
}

export type Step2Draft = {
  /** 検索欄に打った社名（マスタを選んでいないときはこれが経歴に残る） */
  query: string;
  /** マスタから選んだ／作った企業。無ければ null */
  company: { id: string; name: string; isListed?: boolean } | null;
  department: string;
  roleId: string;
  roleTitle: string;
  /** 役職の5択（`ow_experiences.rank` の生値） */
  rank: string;
  /** 社内での役職名（自由入力）。⚠️ `rank` と別物 */
  rankTitle: string;
  startedYear: string;
  startedMonth: string;
};

/** 何も入っていない下書きは保存しない（空の行を復元しても意味が無い） */
function isEmpty(d: Step2Draft): boolean {
  return !d.query.trim() && !d.company && !d.department.trim()
    && !d.roleId && !d.roleTitle.trim() && !d.rank && !d.rankTitle.trim()
    && !d.startedYear && !d.startedMonth;
}

export function readStep2Draft(userKey: string): Step2Draft | null {
  if (!userKey) return null;
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Step2Draft>;
    /* ⚠️ 形が違うもの（版を上げ忘れた・手で壊された）は捨てる。
          既定値で埋めて復元すると、利用者が入れていない値が入る。 */
    if (typeof d.query !== "string") return null;
    return {
      query: d.query,
      company: d.company && typeof d.company.id === "string" && typeof d.company.name === "string"
        ? { id: d.company.id, name: d.company.name, isListed: d.company.isListed }
        : null,
      department: typeof d.department === "string" ? d.department : "",
      roleId: typeof d.roleId === "string" ? d.roleId : "",
      roleTitle: typeof d.roleTitle === "string" ? d.roleTitle : "",
      rank: typeof d.rank === "string" ? d.rank : "",
      rankTitle: typeof d.rankTitle === "string" ? d.rankTitle : "",
      startedYear: typeof d.startedYear === "string" ? d.startedYear : "",
      startedMonth: typeof d.startedMonth === "string" ? d.startedMonth : "",
    };
  } catch {
    /* ⚠️ 握り潰してよい唯一の場所。読めないだけで、利用者にできることが無い。
          ⚠️ ただし**書き込み側は握り潰さない**（下） */
    return null;
  }
}

export function writeStep2Draft(userKey: string, d: Step2Draft): void {
  if (!userKey) return;
  try {
    if (isEmpty(d)) { localStorage.removeItem(storageKey(userKey)); return; }
    localStorage.setItem(storageKey(userKey), JSON.stringify(d));
  } catch (err) {
    /* ⚠️ 失敗しても画面は止めない（下書きは補助）。ただしログには出す。 */
    console.error("[step2Draft] 保存に失敗:", err);
  }
}

export function clearStep2Draft(userKey: string): void {
  if (!userKey) return;
  try {
    localStorage.removeItem(storageKey(userKey));
  } catch (err) {
    console.error("[step2Draft] 削除に失敗:", err);
  }
}
