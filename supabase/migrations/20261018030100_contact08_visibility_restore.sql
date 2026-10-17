-- ★検証用アカウント contact+08 の公開範囲を元に戻す（2026-10-18。20261018030000 の戻し）
--
-- 作業前の値（2026-10-18 実測）に戻す: visibility = 'login_only' ／ updated_at = 2026-08-19 18:07:46.51+00
-- ⚠️ 確かめ終わってから supabase/migrations/ へ移して当てる（20261018030000 と一緒に置くと db push で同時に当たる）。

begin;

update public.ow_users
   set visibility = 'login_only', updated_at = '2026-08-19 18:07:46.51+00'
 where id = '3009cf69-9761-46d5-ac79-75e8438c21b2' and email = 'contact+08@opinio.co.jp' and is_test = true;

do $$
begin
  if (select count(*) from public.ow_users where visibility = 'public') <> 0 then
    raise exception '「公開」の行が残っている。ロールバック';
  end if;
  if (select updated_at from public.ow_users where id = '3009cf69-9761-46d5-ac79-75e8438c21b2')
     is distinct from '2026-08-19 18:07:46.51+00'::timestamptz then
    raise exception 'updated_at が元に戻っていない。ロールバック';
  end if;
end $$;

commit;
