/**
 * 住所文字列から都道府県を抽出する
 *
 * 対応フォーマット:
 * - "東京都渋谷区..." → "東京都"
 * - "大阪府大阪市..." → "大阪府"
 * - "北海道札幌市..." → "北海道"
 * - "京都府京都市..." → "京都府"
 * - "福岡県福岡市..." → "福岡県"
 * - "" / null / undefined → ""
 *
 * 特殊ケース:
 * - 北海道: 「県」が付かない
 * - 東京都・大阪府・京都府: 「県」ではなく「都」「府」
 * - その他 43 県: 「○○県」
 */
export function extractPrefecture(location: string | null | undefined): string {
  if (!location) return "";
  const m = location.match(/^(北海道|東京都|大阪府|京都府|.+?[県])/);
  return m?.[1] ?? "";
}

/**
 * 47 都道府県のマスタ (フィルタ <select> の options 用)
 * 北から南の順序で定義
 */
export const PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

/**
 * よく選ばれる都道府県。`<select>` の先頭に `<optgroup>` で出すためのもの。
 *
 * ⚠️ **`PREFECTURES` 本体の並び（北から南）は変えないこと。**
 *    `careerReasons.ts` の値検証（`VALID_PREFECTURES`）と
 *    `JobsClient` の絞り込みリストが同じ配列を見ており、
 *    そちらは地理順で出るのが正しい。並べ替えは表示側（select）で行う。
 *
 * ⚠️ 出すときは `OTHER_PREFECTURES` と組で使う。`PREFECTURES` 全件と並べると
 *    東京都が2回出て、選んだつもりの位置と選択位置がずれる。
 */
export const COMMON_PREFECTURES = ["東京都", "大阪府", "愛知県", "福岡県"] as const;

/** `COMMON_PREFECTURES` を除いた残り43件（北から南の順のまま）。 */
export const OTHER_PREFECTURES = PREFECTURES.filter(
  (p) => !(COMMON_PREFECTURES as readonly string[]).includes(p),
);

/**
 * 絞り込みに出す都道府県。**47件すべて**を2グループで返す。
 *
 * ⚠️★**該当が0件の都道府県も出す**（柴さんの判断・2026-09-06）。
 *    それまでは「実データにある都道府県だけ」を出しており、公開求人が
 *    東京都の2件しか無い `/jobs` は**選択肢が「東京都」1つ**になっていた。
 *    リポジトリの「0件の選択肢を出さない」とは逆向きだが、都道府県だけは
 *    **入力欄（職歴・オンボーディング）と同じ見た目に揃える**ことを優先する。
 *    ⚠️ この例外は**都道府県だけ**。フェーズ・事業領域・職種には広げないこと。
 *
 * ⚠️ 見出しは入力欄の `<optgroup>` と**同じ文言**にする
 *    （「よく選ばれる」「すべての都道府県」）。画面ごとに呼び方を変えない。
 *
 * ⚠️ `/companies` と `/jobs`（ピル・サイドバーの2箇所）が同じこれを使う。
 *    呼び出し側で `COMMON_PREFECTURES` を展開し直さないこと。
 */
export const PREFECTURE_FILTER_GROUPS: { group: string; prefectures: readonly string[] }[] = [
  { group: "よく選ばれる", prefectures: COMMON_PREFECTURES },
  { group: "すべての都道府県", prefectures: OTHER_PREFECTURES },
];

/** 本人が住まいとして選べる「都道府県以外」の値。⚠️ 絞り込みには出さない（下記）。 */
export const RESIDENCE_EXTRA_OPTIONS = ["海外", "非公開"] as const;

/**
 * ★本人が**自分の居住地を選ぶ**ときの選択肢（2026-09-15）。
 *
 * **47都道府県 ＋「海外」「非公開」。** `PREFECTURE_FILTER_GROUPS` から**導出する**。
 * ⚠️★**2つ目の一覧を手で書かないこと。** これを足した理由がまさにそれで、
 *    `/mypage` の「所在地」が `lib/profile/mockProfileData.ts` の `LOCATIONS`（**11件**）、
 *    `/mypage/settings` の「居住地」が `PREFECTURE_FILTER_GROUPS`（**47件**）を見ており、
 *    **同じ `ow_users.location` に別の語彙を書いていた**（2026-09-15 に発見）。
 *    38県は片方でしか選べず、「海外」「非公開」はもう片方でしか選べない。
 *    ⚠️ 前者を選ぶと `/mypage/settings` では**一致する option が無く空欄に見え**、
 *       そこで保存すると値が消える。**実害0件だったのは、実ユーザー3人の値が
 *       たまたま両方に入っている 東京都・埼玉県 だったから**（2026-09-15 実測）。
 *
 * ⚠️★**絞り込み（`/companies` `/jobs`）には使わないこと。** あちらは
 *    `PREFECTURE_FILTER_GROUPS` のまま。「非公開」は本人の意思表示であって
 *    企業の所在地ではなく、**検索条件として意味を持たない。**
 *
 * ⚠️ DB に CHECK は張っていない（自由記述の履歴がある。実測: `京都府京都市` が1件＝検証用）。
 *    ＝**語彙の担保は入力欄だけ**なので、**入力欄は必ずこの定数から出すこと。**
 *    ⚠️★この注記は 2026-09-23 まで「**3つ目の入力欄を作らないこと**」だった。
 *       同日にオンボーディング1画面目へ3つ目を足したので書き換えてある
 *       （柴さんの判断。実ユーザー13人中4人しか入っておらず、生年月日と同じ形で
 *       1画面目へ移した）。**心配していたのは箇所数ではなく語彙が割れること**で、
 *       3箇所とも定数を import していれば起きない。
 *
 * ⚠️★入力欄は**3箇所**。増やすときもここを使う:
 *      `/mypage`（`components/profile/editor/ProfileTab.tsx`）
 *      `/mypage/settings`（`BasicInfoSettings.tsx`）
 *      **オンボーディング1画面目**（`app/onboarding/OnboardingClient.tsx`。必須）
 *    ⚠️ 画面に出るラベルは**3箇所とも「お住まい」**に揃えてある（2026-09-23）。
 *       「所在地」に戻さないこと —— `/biz/company` と `/admin` が**会社の住所**に
 *       使っている。「居住地」は `/biz/candidates` の**企業向けの語**で、本人向けには使わない。
 *
 * ⚠️★**「非公開」を選択肢から外さないこと。** オンボーディング1画面目が
 *    この項目を**必須**にできているのは、出したくない人の逃げ道がここにあるから。
 */
export const RESIDENCE_OPTION_GROUPS: { group: string; prefectures: readonly string[] }[] = [
  ...PREFECTURE_FILTER_GROUPS,
  { group: "その他", prefectures: RESIDENCE_EXTRA_OPTIONS },
];

/* ───────────────────────────────────────────────────────────────────────────
 * ★居住地の判定（2026-10-12 / 候補者を探すの居住地の絞り込み）。
 *
 *   `ow_users.location` は自由記述の列（DB の CHECK なし）。値は書き換えず、
 *   **読むときに**都道府県か「海外」へ対応づける。対応づけられないものは null（＝未設定扱い）。
 *     「東京」「東京都渋谷区」→ 東京都 ／「海外」「海外（アメリカ）」→ 海外 ／「非公開」・空 → null
 *   ⚠️ 絞り込み・候補者カード・入力欄の初期値が、この関数1つを通る。書き写さないこと。
 * ─────────────────────────────────────────────────────────────────────────── */

/** 「海外」。入力では「海外（国名）」の形で国名を添えられる */
export const OVERSEAS = "海外" as const;

/** 地方ごとのまとまり（絞り込みの表示順）。⚠️ 47件の中身は `PREFECTURES` と同じ */
export const PREFECTURE_REGIONS: { region: string; prefectures: readonly string[] }[] = [
  { region: "北海道・東北", prefectures: ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"] },
  { region: "関東", prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"] },
  { region: "中部", prefectures: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"] },
  { region: "近畿", prefectures: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { region: "中国・四国", prefectures: ["鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県"] },
  { region: "九州・沖縄", prefectures: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"] },
];

/** 都道府県名の「都・府・県」を外した呼び方 → 正式名（「東京」→「東京都」）。北海道はそのまま */
const SHORT_TO_PREF = new Map<string, string>(
  PREFECTURES.map((p) => [p === "北海道" ? p : p.replace(/[都府県]$/, ""), p]),
);

/** 居住地の文字列 → 都道府県（正式名）か「海外」。読めなければ null */
export function residenceKey(location: string | null | undefined): string | null {
  const s = (location ?? "").trim();
  if (!s) return null;
  if (s.startsWith(OVERSEAS)) return OVERSEAS;
  const full = (PREFECTURES as readonly string[]).find((p) => s.startsWith(p));
  if (full) return full;
  /* 「東京」「大阪市北区」のような書き方。長い名前から当てる（「京都」より先に「東京」を見ないと誤る組は無いが、念のため） */
  const shorts = Array.from(SHORT_TO_PREF.keys()).sort((a, b) => b.length - a.length);
  const hit = shorts.find((k) => s.startsWith(k));
  return hit ? (SHORT_TO_PREF.get(hit) as string) : null;
}

/** 入力の値を組み立てる（「海外」のときだけ国名を添える）。⚠️ 国名は任意 */
export function buildResidence(choice: string, country: string): string {
  if (choice !== OVERSEAS) return choice;
  const c = country.trim();
  return c ? `${OVERSEAS}（${c}）` : OVERSEAS;
}

/** 保存された値を入力欄の形に分ける。選択肢に当てはまらない古い値は choice を "" にして raw に残す */
export function parseResidence(location: string | null | undefined): { choice: string; country: string; raw: string | null } {
  const s = (location ?? "").trim();
  if (!s) return { choice: "", country: "", raw: null };
  if (s.startsWith(OVERSEAS)) {
    /* 「海外（アメリカ）」の形。それ以外の書き方（「海外 アメリカ」）も国名を落とさない */
    const m = s.match(/^海外[（(](.*)[）)]$/);
    const country = m ? m[1] : s.slice(OVERSEAS.length).replace(/^[\s・:：/-]+/, "");
    return { choice: OVERSEAS, country: country.trim(), raw: null };
  }
  if ((RESIDENCE_EXTRA_OPTIONS as readonly string[]).includes(s)) return { choice: s, country: "", raw: null };
  /* 都道府県の正式名ちょうど → そのまま。それ以外（「東京」「東京都渋谷区」）は対応づけた県を選んだ状態で開く（次に保存すると選択式の値になる） */
  const key = residenceKey(s);
  if (key && key !== OVERSEAS) return { choice: key, country: "", raw: key === s ? null : s };
  return { choice: "", country: "", raw: s };
}
