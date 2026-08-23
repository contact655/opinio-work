/**
 * 面談対応者（`ow_company_members`）の許容値。**API と DB の CHECK が同じものを見る。**
 *
 * ⚠️ CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」。
 *    DB 側の CHECK は `ow_company_members_created_via_check`
 *    （migration `20260823040000_member_self_apply.sql`）。
 *    **値を足すときは、ここと DB の CHECK の両方を直すこと。**
 */

/** その行がどう作られたか */
export const MEMBER_CREATED_VIA = {
  /** 本人がマイページから申請した。**企業の承認（is_public）を得るまで公開されない** */
  SELF: "self",
  /** 企業が招待した */
  INVITE: "invite",
  /** 運営が作った */
  ADMIN: "admin",
  /** 移行で入れた */
  MIGRATION: "migration",
} as const;

export type MemberCreatedVia = (typeof MEMBER_CREATED_VIA)[keyof typeof MEMBER_CREATED_VIA];

export const MEMBER_CREATED_VIA_VALUES: readonly MemberCreatedVia[] = [
  MEMBER_CREATED_VIA.SELF,
  MEMBER_CREATED_VIA.INVITE,
  MEMBER_CREATED_VIA.ADMIN,
  MEMBER_CREATED_VIA.MIGRATION,
];

/**
 * 5つの状態。**行の有無と2つのフラグから導く。列は増やさない。**
 *
 * 軸は「**誰の対応待ちか**」で統一している（`pending_user` / `pending_company`）。
 *
 * ⚠️ **状態名に `self` を使わないこと。** `self` は `created_via = 'self'`（＝本人発）
 *    専用の語で、「本人待ち」の意味で使うと衝突する。
 *    本人待ちは `pending_user`。（`pending_self` から改名した / 2026-08-23）
 *
 * ⚠️ `pending_company` という語は**このファイル以外にも別の意味で存在する**。
 *    `user_metadata.pending_company` と `opinio_biz_pending_company`（sessionStorage）は
 *    企業登録時の「入力途中の会社名」で、**まったくの別物**。一括置換しないこと。
 *
 * ⚠️ `none` と `pending_company` を同じ見た目にしないこと。
 *    「まだ申請していない」と「申請したが承認待ち」は利用者にとって別のことで、
 *    混ぜると押し直すしかなくなる。
 */
export type MemberState =
  /** 行が無い＝まだ何もしていない（解除した後もここに戻る） */
  | "none"
  /** 企業が招待したが**本人**がまだ承認していない（display_consent=false） */
  | "pending_user"
  /** 本人が申請済み・**企業の承認待ち**（display_consent=true / is_public=false / created_via='self'） */
  | "pending_company"
  /** 本人は同意済みだが企業が非公開にしている（display_consent=true / is_public=false / created_via≠'self'） */
  | "unlisted"
  /** 公開中（display_consent=true / is_public=true） */
  | "listed";

/**
 * 行から状態を導く。**判定をここ以外に書かないこと。**
 *
 * ⚠️ `created_via` が NULL の行（この列より前に作られた行）を `pending_company` にしない。
 *    企業側が作った行なので、本人は既に同意している。未公開なのは**企業が非公開にしている**
 *    からで、本人が待たされているわけではない → `unlisted`。
 *    ⚠️ ここを `pending_user` にすると「本人がまだ承認していない」と誤って表示される。
 *
 * ⚠️★`pending_company` は「**まだ一度も承認されていない** self 行」だけ。
 *    承認後に企業が非公開へ戻した行は `unlisted`（`approved_at` で区別する）。
 *    2026-08-23 に列を足すまで、この2つは区別できなかった。
 */
export function memberState(
  row:
    | {
        display_consent: boolean;
        is_public: boolean;
        created_via: string | null;
        /** ⚠️ **必須**。省略可にすると、select し忘れた画面で「一度も承認されていない」と
         *     誤判定し、承認済みの人が「申請中」に出戻る（下の警告を参照）。
         *     取れないのは取得漏れなので、既定値に倒さず型で落とす。 */
        approved_at: string | null;
      }
    | null
    | undefined,
): MemberState {
  if (!row) return "none";
  if (!row.display_consent) return "pending_user";
  if (row.is_public) return "listed";
  if (row.created_via !== MEMBER_CREATED_VIA.SELF) return "unlisted";
  /* ★一度でも承認された行は、非公開に戻っても `unlisted`。`pending_company` に戻さない。
     ⚠️ ここを `is_public` だけで見ると、企業が公開⇄非公開を往復するたびに
        「本人からの申請（未承認）」に出戻り、承認通知も往復のたびに飛ぶ。 */
  return row.approved_at === null ? "pending_company" : "unlisted";
}

/**
 * 画面が扱う `ow_company_members` の1行。**`memberState()` が要求する3列を必ず含む。**
 *
 * ⚠️ この型を各画面で定義し直さないこと。列を足したときに片方だけ古くなる。
 * ⚠️ `"use client"` のコンポーネント側に置かない。サーバーコンポーネント
 *    （`/mypage` の page.tsx）からも参照するため。
 */
export type CompanyMemberRow = {
  id: string;
  company_id: string;
  company_name: string;
  role_title: string | null;
  display_consent: boolean;
  is_public: boolean;
  created_via: string | null;
  /** 企業（運営）が初回に承認した時刻。⚠️ **必須**（`memberState()` が使う）。
   *  ⚠️ 再掲載では更新しない。`null` は「一度も承認されていない」を意味する。 */
  approved_at: string | null;
  /** 本人が同意（＝申請）した時刻。⚠️ 企業の承認時刻は `updated_at`。混同しない。
   *  ⚠️ **任意**にしてある。申請日を出す画面（/mypage のカード）だけが必要とするので、
   *     この列を選んでいない呼び出し側に select を強制しない。 */
  consent_at?: string | null;
  /** 企業に招待されたが本人未承認のとき、既存の着地ページへ送るのに使う */
  invite_token: string;
};

/**
 * **企業側（`/biz`）の表示名。** 本人視点の名前をそのまま出さないこと。
 *
 * ⚠️★`memberState()` の名前は**本人視点**（誰を待っているか）で付いている。
 *    企業画面にそのまま出すと主語が反転して読めなくなる:
 *      `pending_company` = 本人から見て「会社の確認待ち」
 *                        = 企業から見ると **「あなたの確認待ち」**（待たせているのは自分たち）
 *      `pending_user`    = 本人から見て「あなたの確認待ち」
 *                        = 企業から見ると **「本人の確認待ち」**
 *    ⚠️ 片方の語をもう片方にコピーしない。**誰待ちか分からなくなる。**
 */
export const MEMBER_STATE_BIZ_LABEL: Record<MemberState, string> = {
  none: "—",
  pending_user: "本人の確認待ち",
  pending_company: "あなたの確認待ち",
  unlisted: "非掲載",
  listed: "掲載中",
};
