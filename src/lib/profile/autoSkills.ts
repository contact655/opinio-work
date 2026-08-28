/**
 * 職歴から自動で出すスキル（職種 × 年数 / 業界 × 年数）。
 *
 * ── なぜ自動にするか（2026-08-29）────────────────────────────────────────────
 * 標準スキル（`ow_skills` 48件）は**選んだ人が0人**だった。
 * 一方で職歴は **全24件に職種と開始日が入っている**ので、
 * 「どの職種を何年やったか」は**計算するだけで出せる**。
 *
 * ⚠️ **AI も外部APIも使わない。** 月数を足して帯に丸めるだけ。
 *
 * ── ★保存しない。都度計算する ───────────────────────────────────────────────
 * ⚠️ **列にもトリガーにもしないこと。** 職歴を1件足した瞬間に変わる値なので、
 *    保存すると必ず古くなる（CLAUDE.md「社会人年数は都度計算する」と同じ理由。
 *    `ow_profiles.experience_years` を自動計算に置き換えた 2026-08-07 の判断）。
 * ⚠️ したがって **`ow_user_skills` には入れない。** あちらは
 *    「本人が選んだツール」専用のまま。
 *
 * ── ★手動で上書きさせない ───────────────────────────────────────────────────
 * 上書きを許すと**同じ事実に2つの正**ができ、「職歴を直したのに表示が変わらない」
 * が起きる。生年が `ow_users` と `ow_career_profiles` の2箇所にあって
 * **5年ずれていた**のと同じ形（2026-08-29 に解消）。
 * ⚠️ 直したいときは**職歴を直す**。そうすればここも直る。
 *
 * ── ★表示は手動スキルと区別しない（案A・柴さんの判断 2026-08-29）─────────────
 * 「職歴から」といったラベルは付けない。**同じ枠に混ぜて出す。**
 * ⚠️ そのため利用者は自動値を**消せない**。承知のうえの判断。
 */

/** 職歴1件ぶんの入力。⚠️ 表示側の型に依存させない（この形だけを受ける） */
export type AutoSkillExperience = {
  /** "YYYY-MM" か "YYYY-MM-DD" */
  started_at: string | null;
  /** 同上。null なら在籍中として今日まで数える */
  ended_at: string | null;
  /** 職種名（`ow_roles.name`）。null なら職種の集計に入れない */
  roleName?: string | null;
  /** ★その職種の親の名前。子職種なら親名、親職種そのものなら null（2026-08-29） */
  roleParentName?: string | null;
  /** 主の事業領域名（`ow_business_domains.name`）。null なら業界の集計に入れない */
  domainName?: string | null;
};

export type AutoSkill = {
  /** 表示名（職種名 or 事業領域名） */
  label: string;
  /** ⚠️ `ow_skills.category`（product/method/sales_domain）とは**別の語彙** */
  kind: "role" | "domain";
  /** 帯のラベル（「3年以上」など） */
  band: string;
  /** 並べ替え用。⚠️ 画面には出さない（端数を見せない判断） */
  months: number;
};

/**
 * 年数の帯。⚠️ **YOUTRUST 相当の5段階**（柴さんの指定 2026-08-29）。
 *
 * ⚠️ **端数を出さないこと。** 実データには `12.3年` `0.5年` が出るが、
 *    職歴を見れば分かる情報なので重複するうえ、月が変わるたびに数字が動く。
 */
const BANDS: readonly (readonly [number, string])[] = [
  [120, "10年以上"],
  [60,  "5年以上"],
  [36,  "3年以上"],
  [12,  "1年以上"],
  /* ⚠️ 12ヶ月未満は `computeAutoSkills` が**行ごと落とす**ので、この帯には到達しない。
        表示規則を変えて 12ヶ月未満も出すことにしたら、ここが効き始める。 */
  [0,   "1年未満"],
];

export function bandOf(months: number): string {
  return BANDS.find(([min]) => months >= min)?.[1] ?? "1年未満";
}

/** "YYYY-MM" / "YYYY-MM-DD" → Date。⚠️ 不正な値は null（0 に倒さない） */
function parseYm(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 在籍月数。⚠️ 終わりが無ければ今日まで。負にはしない */
function monthsBetween(from: Date, to: Date): number {
  const n = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(0, n);
}

/**
 * 職歴から自動スキルを組み立てる。
 *
 * ⚠️ **同じ職種・同じ業界は月数を合算する**（転職をまたいでも1つにまとめる）。
 * ⚠️ 期間の重なりは**素直に足す**。副業や兼務で二重に数えうるが、
 *    帯（1年以上/3年以上…）に丸めるので実害が小さく、重なりを引く実装は
 *    「どちらを本業とみなすか」の判断が要るため入れない。
 *
 * @param now テスト用。省略時は現在
 */
export function computeAutoSkills(
  experiences: AutoSkillExperience[],
  now: Date = new Date(),
): AutoSkill[] {
  const roleMonths = new Map<string, number>();
  const domainMonths = new Map<string, number>();
  /* ★子が1つでもある親は、親そのものの行を落とす（2026-08-29 / 柴さんの規則）。
        「子が選ばれていればそれを使い、選ばれていなければ親を出す」。
     ⚠️ **親を無条件に落とさないこと。** オンボーディングは親のままでも進めるので、
        親しか無い人の職種スキルが**丸ごと消える**（実測: 経歴24件のうち親が10件）。 */
  const parentsHavingChild = new Set<string>();

  for (const e of experiences) {
    const from = parseYm(e.started_at);
    if (!from) continue;                       // ⚠️ 開始が無い行は数えない（0 にしない）
    const to = parseYm(e.ended_at) ?? now;
    const m = monthsBetween(from, to);
    if (m <= 0) continue;

    const role = (e.roleName ?? "").trim();
    if (role) {
      roleMonths.set(role, (roleMonths.get(role) ?? 0) + m);
      const parent = (e.roleParentName ?? "").trim();
      if (parent) parentsHavingChild.add(parent);   // この行は子職種だった
    }

    /* ⚠️ 在籍先に事業領域が設定されていない企業は**ここに来ない**。
          実測（2026-08-29）: 実ユーザー4名のうち1名は**全期間が未分類**で、
          業界スキルが1件も出ない。**「分類なし」という帯を作らないこと** ——
          値が無いことを、ある値に置き換えることになる。 */
    const domain = (e.domainName ?? "").trim();
    if (domain) domainMonths.set(domain, (domainMonths.get(domain) ?? 0) + m);
  }

  /* ⚠️ `[...map.entries()]` は tsconfig の target が古いと tsc が落ちる
        （TS2802 / downlevelIteration）。`Array.from` で受ける。 */
  /* ★子が選ばれている親は落とす。「営業 3年以上」と「インサイドセールス 3年以上」が
        並ぶと重複に見えるため（柴さんの判断 2026-08-29）。 */
  for (const parent of Array.from(parentsHavingChild)) roleMonths.delete(parent);

  /* ★12ヶ月未満は出さない（柴さんの判断 2026-08-29）。
     ⚠️ **0 に丸めて「0年」と出さないこと。** 出さないのは「短い」からであって、
        「経験が無い」からではない。行ごと落とす。 */
  const toRows = (map: Map<string, number>, kind: AutoSkill["kind"]): AutoSkill[] =>
    Array.from(map)
      .filter(([, months]) => months >= 12)
      .map(([label, months]) => ({ label, kind, band: bandOf(months), months }))
      .sort((a, b) => b.months - a.months);

  return [...toRows(roleMonths, "role"), ...toRows(domainMonths, "domain")];
}
