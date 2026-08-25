-- 招待の「承認する」が 500 で失敗していたのを直す（2026-08-25）
--
-- ── 何が起きていたか ────────────────────────────────────────────────────────
-- `POST /api/mypage/ambassador-invite`（会社からの招待を本人が承認する）が
-- **必ず 500** になっていた。`/api/biz/ambassador/invite` の「直接追加」も同じ。
--
-- どちらも `createAdminClient()`（service_role）で `display_consent` を書くため
-- `guard_member_consent` を通る。service_role には JWT のユーザーが無いので
-- `auth_ow_user_id()` は null を返し、
--
--     if new.user_id is distinct from public.auth_ow_user_id() then
--
-- が **true**（uuid と null は「異なる」）になり、admin ロールでもないので
-- `P0003 面談対応者の公開同意は、本人のみが変更できます` を投げていた。
--
-- ── ⚠️ これは 2026-08-24 の `20260824140000_member_self_publish.sql` の回帰 ──
-- それ以前の条件は `new.user_id <> auth.uid()` で、**null との比較は null**（＝偽）
-- になるため service_role は素通りしていた。ID 空間の取り違えを直すときに
-- `is distinct from`（null 安全）へ変えたことで、**素通りしていた経路が閉じた**。
--
-- ⚠️ **null 比較に頼っていた**ことが分かりにくさの本体。意図して通すのだと
--    条件に書く。`<>` に戻さないこと（本人判定が null で骨抜きになる形へ逆戻りする）。
--
-- ── 直し方 ──────────────────────────────────────────────────────────────────
-- **service_role（＝サーバー側の信頼できる経路）を明示的に許す。**
-- 呼び出し側が自分で認可している:
--   ・招待の承認 … `invite_token` が一致し、かつその行の `user_id` が
--                  ログイン中の本人であることを確かめてから更新している
--   ・直接追加   … 企業の管理者であることを確かめてから更新している
--
-- ⚠️ **本人のトグル（`PATCH /api/mypage/ambassador-visibility`）は
--    利用者自身のクライアントで書いている**ので、こちらは従来どおり
--    `auth_ow_user_id()` の一致で通る。ここを admin に寄せないこと。
--    寄せると、このトリガーが守るものが無くなる。
--
-- ⚠️ 直接 SQL（psql など）からは `auth.role()` が null なので**通らない**。
--    運営が手で直すときは admin ロールのセッションを使う。
--
-- ⚠️ 旧定義は `pg_get_functiondef` で控えてある（2026-08-25）。データは触らない。

create or replace function public.guard_member_consent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- 同意状態が変更されようとしている
  if new.display_consent is distinct from old.display_consent then
    -- 本人以外は変更できない
    -- ⚠️ `auth.uid()`（auth 空間）ではなく `auth_ow_user_id()`（ow_users 空間）と比べる。
    if new.user_id is distinct from public.auth_ow_user_id()
       -- ⚠️ サーバー側（service_role）は許す。呼び出し側が招待トークンか
       --    企業管理者であることを確かめている。**`SECURITY DEFINER` の中では
       --    `current_user` が所有者に化けるので使わない。** JWT の claim を見る。
       and coalesce(auth.role(), '') <> 'service_role'
    then
      -- ただし OPINIO の admin は例外（サポート対応のため）
      -- ⚠️ こちらは `ow_user_roles.user_id` が auth 空間なので `auth.uid()` のままが正しい。
      if not exists (
        select 1 from ow_user_roles
        where ow_user_roles.user_id = auth.uid()
          and ow_user_roles.role = 'admin'
      ) then
        raise exception '面談対応者の公開同意は、本人のみが変更できます'
          using errcode = 'P0003';
      end if;
    end if;

    -- 同意した場合は日時を記録する
    -- ⚠️ **取り下げても消さない**（2026-08-24 に変更）。`consent_at` を null に戻すと
    --    「招待されて未応答」と「一度ONにして自分でOFF」が区別できなくなり、
    --    自分でOFFにした人の画面に「会社から依頼が届いています」が出てしまう。
    --    意味は「**最後に同意した日時**」。
    if new.display_consent = true then
      new.consent_at := now();
    end if;
  end if;

  return new;
end;
$function$;
