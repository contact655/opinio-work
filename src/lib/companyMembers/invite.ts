/**
 * 面談対応者の「招待」と「承諾」で書き込む値（2026-10-15）。
 *
 * ── 決まり ──────────────────────────────────────────────────────────────────
 * ★**`display_consent` を true にしてよいのは、本人が承諾したときだけ。**
 *   企業の担当者が招待するときは、相手の指定が user_id でもメールアドレスでも、
 *   **作るのは「本人への依頼」だけ**（`display_consent=false` / `is_public=false`）。
 *
 * ⚠️★2026-10-15 まで、`POST /api/biz/ambassador/invite` は user_id を直接指定されると
 *    `display_consent=true` / `is_public=true` で**本人の同意なしに即時公開**していた
 *    （2026-07-25 の `76723e49` / `f0a26f5e`）。画面のトースト「招待メールを送信しました」とも
 *    食い違っていた（メールは送っていなかった）。**その形に戻さないこと。**
 *
 * ⚠️ このファイルは import を持たない（`node --test` から直接読むため）。
 *    `created_via` の値は `lib/constants/companyMembers.ts` の `MEMBER_CREATED_VIA.INVITE` と
 *    同じであることをテストで確かめている。
 */

/** 企業が招待したときに作る行。**指定の仕方（user_id / email）で値を変えない。** */
export function newInviteRow(p: {
  companyId: string;
  userId: string;
  roleTitle: string;
  invitedByAuthId: string | null;
  now: string;
}) {
  return {
    company_id: p.companyId,
    user_id: p.userId,
    /* ★本人が承諾するまで false。ここを変えると同意なしの公開になる */
    display_consent: false as const,
    /* `check_public_requires_consent`（is_public=false OR display_consent=true）とも揃う */
    is_public: false as const,
    created_via: "invite" as const,
    role_title: p.roleTitle,
    invited_at: p.now,
    invited_by: p.invitedByAuthId,
  };
}

/**
 * 本人が招待を承諾したときに当てる値。**承諾した人がその行の本人でなければ `null`。**
 *
 * ⚠️ 呼び出し側（`POST /api/mypage/ambassador-invite`）は admin クライアントで書くので、
 *    DB の `guard_member_consent` は service_role を素通しする。**本人確認はここが本体。**
 */
export function acceptInvitePatch(p: {
  /** 招待の行の `user_id`（ow_users 空間） */
  memberUserId: string;
  /** 承諾ボタンを押した人の `ow_users.id`（セッションから引いたもの） */
  actorOwUserId: string;
  roleTitle: string | null | undefined;
  newToken: string;
  now: string;
}) {
  if (!p.memberUserId || p.memberUserId !== p.actorOwUserId) return null;
  return {
    display_consent: true as const,
    consent_at: p.now,
    is_public: true as const,
    role_title: p.roleTitle?.trim() || undefined,
    invite_token: p.newToken,
  };
}
