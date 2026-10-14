-- ============================================================================
-- 20261015090000_guard_member_consent_identity.sql を戻す
-- ★適用しないこと（必要になったときだけ柴さんの了承を得て当てる）。
--   関数本文は 2026-10-15 に本番から pg_dump --schema-only で取った原文そのまま。
-- ============================================================================
begin;
CREATE OR REPLACE FUNCTION public.guard_member_consent() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;

drop trigger if exists trg_guard_member_consent on public.ow_company_members;
create trigger trg_guard_member_consent
  before update on public.ow_company_members
  for each row execute function public.guard_member_consent();
commit;
