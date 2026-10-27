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
  /** フリーワード（スペース区切りで AND）。★先頭に "-" を付けた語は除外（1つでも当たれば落とす。2026-10-13 に一本化） */
  q: string;
  /* ⚠️★2026-10-13 に外したキー（読み込み時に変換・無視する。`parseSavedFilters`）:
        excludeQuery・roleQuery・companyQuery → q に入れる（除外は "-語"）
        workStyle・salaryMin・includeNoSalary → 無視（右欄に出さない値で絞れると、値が間接的に分かるため） */
  /** ★希望職種（関心のある職種）。複数は OR（2026-10-13 / ステップ5 で複数選択にした）。
   *  ⚠️ それまでは `topRoleId` / `childRoleId`（単一）。古い保存・URL は `parseSavedFilters` が
   *     `childRoleId ?? topRoleId` を1件の配列として読み替える（DB の JSON は書き換えない） */
  desiredRoleIds: string[];
  /** ★経験職種（職歴の職種。現職・前職すべて。複数は OR。親を選ぶと子も含む。2026-10-13） */
  expRoleIds: string[];
  employmentTypes: string[];
  tenureBand: string;
  /** ★年齢の下限・上限（2026-10-12）。0 = 指定なし。⚠️ 効くのは CANDIDATE_AGE_FILTER_ENABLED のときだけ */
  ageMin: number;
  ageMax: number;
  prefectures: string[];
  /** ★転職への意向（複数選択。2026-10-12 に単一の `careerStance` から変えた。古い保存は parse で配列に直す） */
  careerStances: string[];
  /* ⚠️ `hasTouchpoints`（合うところあり）は 2026-10-28 に外した。DB に残っている値は parseSavedFilters が捨てる */
  /** ★★（気になる）を付けた人だけ（2026-10-12。会社の管理者で共有） */
  starredOnly: boolean;
  /** ★最近の利用（"3d" / "1w" / "1m"。"" = 指定なし）。⚠️ 効くのは CANDIDATE_ACTIVITY_ENABLED のときだけ */
  activity: string;
  stanceFreshness: string;
  /* ⚠️ `hideAlreadyScouted`（スカウト済みを除く）は 2026-10-08 に外した（スカウト廃止）。
        DB に残っている値は下の `parseSavedFilters` が捨てる（知らないキーは捨てる約束）。 */
  /* ⚠️ `approachOnly`（メッセージを受け取る方のみ）は 2026-10-11 に外した（全員が最初から受け取る形にしたため）。
        DB に残っている値は下の `parseSavedFilters` が捨てる。 */
  /** ⚠️ 並び替えも保存する。「どう見ていたか」まで戻せないと再現にならない。
   *  ★既定は「意向が強い順」（2026-10-28）。⚠️ 保存した条件で sort が無いものは「最近更新した順」として読む（`parseSavedFilters` の missingSort） */
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
  desiredRoleIds: [],
  expRoleIds: [],
  employmentTypes: [],
  tenureBand: "",
  ageMin: 0,
  ageMax: 0,
  prefectures: [],
  careerStances: [],
  starredOnly: false,
  activity: "",
  stanceFreshness: "",
  sort: "stance_strength",
};

/* ★並び替えの古い値の読み替え（2026-10-28。DB の JSON は書き換えない）。並び替えを2つにしたため:
      合うところが多い順・社会人年数が長い順 → 意向が強い順 ／ 新着順・意向の更新が新しい順 → 最近更新した順 */
const LEGACY_SORT: Record<string, string> = { touchpoints: "stance_strength", tenure: "stance_strength", new: "updated", stance: "updated" };

const str = (v: unknown, d: string): string => (typeof v === "string" ? v : d);
/** 雇用形態の旧キー → DB の値（2026-10-13） */
const LEGACY_EMPLOYMENT: Record<string, string> = { full_time: "正社員", contract: "契約社員", part_time: "アルバイト・パート", freelance: "業務委託" };
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
 * ★2026-10-13 の読み替え（DB の JSON は書き換えない。読むときだけ）:
 *    - roleQuery・companyQuery の語は q に足す。excludeQuery の語は "-語" にして q に足す
 *      ⚠️ 意味は少し広がる（その欄だけ → 名前・職種・会社・居住地のどれか）。2026-10-13 時点で値の入った保存は0件
 *    - workStyle・salaryMin・includeNoSalary は捨てる
 *    - 職種（topRoleId・childRoleId）は「希望職種」のまま（意味を変えない）
 *    - ★希望職種は複数選択になった（desiredRoleIds）。単一の topRoleId / childRoleId は1件の配列に読み替える
 * @param opts.missingSort sort が無いときの値。**DB の保存した条件は "new"**（保存した人の意図を変えない）。
 *        URL（`?f=`）は既定値（合うところが多い順）。既定値のキーは URL に書かない作りのため
 */
export function parseSavedFilters(raw: unknown, opts: { missingSort?: string } = {}): SavedCandidateFilters {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const words = (v: unknown) => str(v, "").split(/\s+/).filter(Boolean);
  const q = [
    ...words(o.q),
    ...words(o.roleQuery),
    ...words(o.companyQuery),
    ...words(o.excludeQuery).map((w) => (w.startsWith("-") ? w : `-${w}`)),
  ].join(" ");
  return {
    q,
    /* ⚠️ 2026-10-13 より前の保存・URL は単一の topRoleId / childRoleId。子を優先して1件の配列にする
          （それまでの絞り込みが `childRoleId ?? topRoleId` を見ていたのと同じ値） */
    desiredRoleIds: Array.isArray(o.desiredRoleIds)
      ? strArr(o.desiredRoleIds)
      : (() => { const one = nullableStr(o.childRoleId) ?? nullableStr(o.topRoleId); return one ? [one] : []; })(),
    expRoleIds: strArr(o.expRoleIds),
    /* ⚠️ 2026-10-13 より前の選択肢は英語のキーで、DB の値（日本語）と一致せず0人になっていた。日本語に読み替える
          （インターンは職歴の選択肢に無いので、そのまま残す＝0人のまま） */
    employmentTypes: Array.from(new Set(strArr(o.employmentTypes).map((v) => LEGACY_EMPLOYMENT[v] ?? v))),
    tenureBand: str(o.tenureBand, ""),
    ageMin: num(o.ageMin, 0),
    ageMax: num(o.ageMax, 0),
    prefectures: strArr(o.prefectures),
    /* ⚠️ 2026-10-12 より前の保存は `careerStance`（文字列1つ）。配列に直す */
    careerStances: Array.isArray(o.careerStances) ? strArr(o.careerStances) : (typeof o.careerStance === "string" && o.careerStance ? [o.careerStance] : []),
    starredOnly: bool(o.starredOnly, false),
    activity: str(o.activity, ""),
    /* ⚠️ 2026-10-12 に帯を 7日／30日／90日 にした。古い値（1d/1w → 7d、1m → 30d、3m → 90d）は読み替える */
    stanceFreshness: ({ "1d": "7d", "1w": "7d", "1m": "30d", "3m": "90d" } as Record<string, string>)[str(o.stanceFreshness, "")] ?? str(o.stanceFreshness, ""),
    sort: (() => { const v = str(o.sort, opts.missingSort ?? EMPTY_SAVED_FILTERS.sort); return LEGACY_SORT[v] ?? v; })(),
  };
}

/** 1つも条件が入っていないか。⚠️ 条件ゼロのまま保存させないための判定 */
export function isEmptyFilters(f: SavedCandidateFilters): boolean {
  /* ⚠️ キーごとに比べる（JSON.stringify の丸ごと比較はキーの並び順で食い違う。2026-10-12 に踏んだ） */
  return (Object.keys(EMPTY_SAVED_FILTERS) as (keyof SavedCandidateFilters)[])
    .every((k) => JSON.stringify(f[k]) === JSON.stringify(EMPTY_SAVED_FILTERS[k]));
}

export type SavedSearch = {
  id: string;
  name: string;
  filters: SavedCandidateFilters;
  updatedAt: string;
  /* ★2026-10-10（段3）。一覧の API が返す */
  ownerName?: string | null;
  isShared?: boolean;
  notifyFrequency?: "daily" | "weekly" | "none";
  isMine?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** 新着の人数。undefined = 数えていない（?counts=1 のときだけ）／null = 数えられなかった */
  newCount?: number | null;
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
