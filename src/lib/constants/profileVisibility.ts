/**
 * プロフィールの公開範囲（`ow_users.visibility`）。
 *
 * ⚠️ **文言をここ以外に書かない。** 設定画面のラジオがこの定義を読む。
 *    同じ説明を画面側に書き写すと、片方だけ直したときに
 *    「設定では公開と書いてあるのに、別の場所では別の説明が出ている」形になる。
 *
 * ⚠️ **`desc` は同意の範囲そのもの。** いま取れている同意より広い意味に書き換えないこと
 *    （「設定の意味を後から拡大しない」2026-08-04）。
 *
 * ⚠️ **逆に、規約より狭く書き直さないこと**（2026-09-05）。
 *    利用規約 第7条2項・3項とプライバシーポリシー 5-2 は、public について
 *    **「誰でも閲覧できます。検索エンジンの検索結果に表示される場合があります」**と定めている。
 *    `desc` はそれより狭く書かれており（「ログインしている人が閲覧できます。将来この制限を
 *    外す場合は、事前にお知らせします」）、**規約に無い約束を UI だけが足していた**ので、
 *    同日に規約の範囲へ揃えた。
 *    ⚠️ **規約側を変えずに UI だけ狭めると、同じずれがまた生まれる。**
 *
 * ⚠️ **`desc` が指しているのは「データの見え方」であって、画面の見え方ではない。**
 *    現在は /people と /u/[id] が middleware でログイン必須なので、public でも
 *    **画面上は**未ログインに出ない。ただし PostgREST を直に叩く経路では
 *    RLS `ow_experiences_public_read` が発火し、**全職歴行が anon に開く**
 *    （現職1行ではない。`description` / `join_reason` / `prefecture` / 在籍期間を含む）。
 *    だから `desc` で職歴の範囲を限定しない。
 */
export const PROFILE_VISIBILITY_VALUES = ["public", "login_only", "private"] as const;

export type ProfileVisibility = (typeof PROFILE_VISIBILITY_VALUES)[number];

/**
 * ★本人が選べる値（2026-10-17 / 柴さんの指示で「非公開」を外した。LinkedIn にもプロフィール全体を
 *   自分だけにする設定は無い）。⚠️ `private` は DB の値として残す ——システムユーザーと、
 *   運営が /admin/candidates で非公開にした人が使う。**本人の設定画面と PUT /api/jobseeker/profile には出さない。**
 */
export const USER_SELECTABLE_VISIBILITIES = ["public", "login_only"] as const satisfies readonly ProfileVisibility[];

export const PROFILE_VISIBILITY_OPTIONS: {
  value: (typeof USER_SELECTABLE_VISIBILITIES)[number];
  /** 設定画面のラジオの見出し */
  label: string;
  /** 設定画面のラジオの説明。同意の範囲 */
  desc: string;
  /**
   * 公開範囲に添える1行。**現在の状態**を言い切る形にする。
   *
   * ⚠️ **2026-08-16 時点で読み手がいない。** 右カラムの「企業からの見え方」で
   *    使っていたが、そのカードごと外した（フェーズ3）。
   *    文言は残してある。同じ用途（現在の状態を1行で添える）を作るときに使うこと。
   */
  line: string;
}[] = [
  {
    value: "public",
    label: "公開",
    desc: "氏名・所属・職歴が、ログインしていない人や検索エンジンからも見える状態になります。",
    line: "氏名・所属・職歴が、ログインしていない人や検索エンジンからも見えます。",
  },
  {
    value: "login_only",
    /* ⚠️ 「（初期設定）」は 2026-08-20 に外した。**システムの都合であって、
          本人が選んだ結果ではない。** 選択肢のラベルに実装の事情を書かない。 */
    label: "ログインユーザーのみ",
    desc: "ログインしていない人や検索エンジンには表示されません。",
    line: "ログインしていない人や検索エンジンには表示されません。",
  },
  /* ⚠️★「非公開」（private）は 2026-10-17 に本人の選択肢から外した（`USER_SELECTABLE_VISIBILITIES`）。戻さないこと */
];

/** ★運営が非公開にした人の設定画面に出す1行（本人は変えられない） */
export const OPS_PRIVATE_NOTE = "運営の判断で、プロフィールを非公開にしています。変更をご希望の場合はお問い合わせください。";
