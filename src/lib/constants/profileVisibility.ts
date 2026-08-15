/**
 * プロフィールの公開範囲（`ow_users.visibility`）。
 *
 * ⚠️ **文言をここ以外に書かない。** 設定画面のラジオと、右カラムの
 *    「企業からの見え方」の一文が同じ定義を読む。片方だけ直すと
 *    「設定では公開と書いてあるのに、別の場所では別の説明が出ている」形になる。
 *
 * ⚠️ **`desc` は同意の範囲そのもの。** いま取れている同意より広い意味に書き換えないこと
 *    （「設定の意味を後から拡大しない」2026-08-04）。
 *    現在は /people と /u/[id] が middleware でログイン必須のため public でも
 *    未ログインには出ないが、その制限が外れたときに意味が変わる設定なので、
 *    **いま同意を取るべき範囲**で書いてある。
 */
export const PROFILE_VISIBILITY_VALUES = ["public", "login_only", "private"] as const;

export type ProfileVisibility = (typeof PROFILE_VISIBILITY_VALUES)[number];

export const PROFILE_VISIBILITY_OPTIONS: {
  value: ProfileVisibility;
  /** 設定画面のラジオの見出し */
  label: string;
  /** 設定画面のラジオの説明。同意の範囲 */
  desc: string;
  /** 右カラムに添える1行。**現在の状態**を言い切る形にする */
  line: string;
}[] = [
  {
    value: "public",
    label: "公開",
    desc: "OPINIO にログインしている人が閲覧できます。将来この制限を外す場合は、事前にお知らせします（外れると、ログインしていない人や検索エンジンからも見える状態になります）。",
    line: "いまは OPINIO にログインしている人が閲覧できます。",
  },
  {
    value: "login_only",
    label: "ログインユーザーのみ（初期設定）",
    desc: "OPINIO にログインしている人だけが閲覧できます。ログインしていない人には、この制限が外れた後も表示されません。",
    line: "いまは OPINIO にログインしている人だけが閲覧できます。",
  },
  {
    value: "private",
    label: "非公開",
    desc: "自分だけが閲覧できます。企業の候補者検索にも表示されません。",
    line: "いまは自分だけが閲覧できます。企業の候補者検索にも出ません。",
  },
];

/**
 * 公開範囲に添える1行を返す。
 *
 * ⚠️ 決め打ちしないこと。知らない値・未設定のときは**言い切らない**
 *    （「値が無いことを、ある値に置き換えない」）。
 */
export function visibilityLine(value: string | null | undefined): string {
  return (
    PROFILE_VISIBILITY_OPTIONS.find((o) => o.value === value)?.line ??
    "公開範囲が未設定です。設定タブで選べます。"
  );
}
