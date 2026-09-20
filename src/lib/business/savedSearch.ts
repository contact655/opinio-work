/**
 * 候補者検索（`/biz/candidates`）の「保存した条件」。
 *
 * ── ★この型が1箇所であることが、この機能の唯一の歯止め ─────────────────────
 * 絞り込みの条件は 16 個あり、増える。条件を1つ足したときに
 * **保存だけ対応を忘れる**と、保存した条件を呼び出しても
 * **その1つだけ静かに効かない**（エラーも出ないし `tsc` も通る）。
 *
 * ⚠️★そこで画面側は「**`SavedCandidateFilters` のキーごとに setter を持つ表**」を作る
 *    （`CandidatesClient` の `FILTER_SETTERS`）。マップ型なので、
 *    **この型にキーを足すと setter 表が型エラーになる。**
 *    ＝ 足し忘れたらビルドが通らない。**この対応を崩さないこと。**
 *
 * ⚠️★`clearAllFilters` も `applyFilters(EMPTY_SAVED_FILTERS)` に統一してある。
 *    「空の条件」の定義が2つあると、**クリアしたのに1つだけ残る**形になる。
 *
 * ── ★古い行を読んで壊れないようにする ──────────────────────────────────────
 * DB には `filters jsonb` をそのまま入れる。列に割らないのは、条件が増減するたびに
 * migration が要る形を避けるため。代わりに読むときに
 * **知らないキーは捨て、欠けたキーは既定値で埋める**（`parseSavedFilters`）。
 * ⚠️ だから「条件を1つ廃止する」日も、古い行をそのまま読める。
 */

/** 保存する絞り込みの中身。⚠️ ここにキーを足すと `FILTER_SETTERS` が型エラーになる（意図どおり） */
export type SavedCandidateFilters = {
  /** フリーワード（スペース区切りで AND） */
  q: string;
  /** 除外ワード（スペース区切りで OR） */
  excludeQuery: string;
  roleQuery: string;
  companyQuery: string;
  topRoleId: string | null;
  childRoleId: string | null;
  employmentTypes: string[];
  workStyle: string;
  /** 万円単位。0 = 指定なし */
  salaryMin: number;
  /** 年収未設定の候補者も通すか。⚠️ 既定は true（落とさない側） */
  includeNoSalary: boolean;
  tenureBand: string;
  prefectures: string[];
  careerStance: string;
  stanceFreshness: string;
  hideAlreadyScouted: boolean;
  /** ⚠️ 並び替えも保存する。「どう見ていたか」まで戻せないと再現にならない */
  sort: string;
};

/**
 * 何も絞っていない状態。
 *
 * ⚠️★**「クリア」もこれを適用する。** 空の定義を2つ持たない。
 * ⚠️ `includeNoSalary` だけ `true` が既定。**年収未設定の人を落とさない側**が初期値で、
 *    `false` に変えると「まだ年収を書いていない人」が黙って消える。
 */
export const EMPTY_SAVED_FILTERS: SavedCandidateFilters = {
  q: "",
  excludeQuery: "",
  roleQuery: "",
  companyQuery: "",
  topRoleId: null,
  childRoleId: null,
  employmentTypes: [],
  workStyle: "",
  salaryMin: 0,
  includeNoSalary: true,
  tenureBand: "",
  prefectures: [],
  careerStance: "",
  stanceFreshness: "",
  hideAlreadyScouted: false,
  sort: "new",
};

const str = (v: unknown, d: string): string => (typeof v === "string" ? v : d);
const nullableStr = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const num = (v: unknown, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : d;

/**
 * DB の `filters` を画面の型に戻す。
 *
 * ⚠️★**知らないキーは捨て、欠けたキーは既定値で埋める。** 例外を投げない。
 *    保存した日と条件の顔ぶれが違っても、呼び出しが失敗しないようにするため。
 * ⚠️ 値の**妥当性**（存在する職種 id か等）はここで見ない。
 *    存在しない値は絞り込みが 0 件になるだけで、壊れはしない。
 */
export function parseSavedFilters(raw: unknown): SavedCandidateFilters {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return {
    q: str(o.q, ""),
    excludeQuery: str(o.excludeQuery, ""),
    roleQuery: str(o.roleQuery, ""),
    companyQuery: str(o.companyQuery, ""),
    topRoleId: nullableStr(o.topRoleId),
    childRoleId: nullableStr(o.childRoleId),
    employmentTypes: strArr(o.employmentTypes),
    workStyle: str(o.workStyle, ""),
    salaryMin: num(o.salaryMin, 0),
    includeNoSalary: bool(o.includeNoSalary, true),
    tenureBand: str(o.tenureBand, ""),
    prefectures: strArr(o.prefectures),
    careerStance: str(o.careerStance, ""),
    stanceFreshness: str(o.stanceFreshness, ""),
    hideAlreadyScouted: bool(o.hideAlreadyScouted, false),
    sort: str(o.sort, "new"),
  };
}

/** 1つも条件が入っていないか。⚠️ 条件ゼロのまま保存させないための判定 */
export function isEmptyFilters(f: SavedCandidateFilters): boolean {
  return JSON.stringify(f) === JSON.stringify(EMPTY_SAVED_FILTERS);
}

export type SavedSearch = {
  id: string;
  name: string;
  filters: SavedCandidateFilters;
  updatedAt: string;
};

/**
 * 1人・1社あたりの上限。
 *
 * ⚠️★**DB に CHECK は置いていない。** 件数の制約は行をまたぐのでトリガーが要り、
 *    CLAUDE.md「濃度（件数の上限）は UI と API の2層で担保する」に従った。
 * ⚠️★**したがって定数が1つであることが唯一の担保。**
 *    画面にローカル定数を書かないこと（2026-09-11 に希望職種で
 *    画面 5 / API 10 と食い違っていた前例がある）。
 */
export const MAX_SAVED_SEARCHES = 20;

/** 名前の長さ。⚠️ DB の CHECK（`saved_search_name_len`）と同じ値にすること */
export const MAX_SAVED_SEARCH_NAME = 60;
