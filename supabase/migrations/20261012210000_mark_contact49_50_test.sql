-- ════════════════════════════════════════════════════════════════════════
-- contact+49 / contact+50 を検証用（is_test）にする（2026-10-12 / 柴さんの判断）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★2つとも柴さんの検証用アカウント（2026-10-12 柴さん確認）。立て忘れで実ユーザーとして数えられていた。
--   ・contact+50 の職歴（株式会社セゾンテクノロジー・在籍中）は**消さない・直さない**。is_test で隠す
--   ・セゾンテクノロジーの会社データには一切触らない（下で前後を突き合わせる）
-- ⚠️ メールアドレスを名指しする（パターンで倒さない。CLAUDE.md「contact+NN が is_test のまま残らず増える」）
-- ⚠️ 行は消さない（ow_users を参照する FK の多くが CASCADE）
--
-- 事前の実測（2026-10-12）:
--   2人とも is_test = false。参照している行は ow_profiles / ow_user_roles / ow_experiences（contact+50 の1件）だけ
--   （応募・面談・メッセージ・会社の担当者・保存などは0件）
--   セゾンテクノロジーの現役社員（実ユーザー・在籍中の職歴）2人。うち1人が contact+50
-- ════════════════════════════════════════════════════════════════════════

begin;

create temp table _before on commit drop as
select
  (select count(*) from public.ow_experiences e join public.ow_users u on u.id = e.user_id
    where e.company_id = '4f2be18a-cb77-4981-a5cf-dce81d1c06e2' and e.is_current
      and u.is_test is not true and u.auth_id is not null) as saison_current,
  (select md5(row_to_json(c)::text) from public.ow_companies c where c.id = '4f2be18a-cb77-4981-a5cf-dce81d1c06e2') as saison_row,
  (select md5(string_agg(row_to_json(u)::text, '|' order by u.id)) from public.ow_users u
    where u.email not in ('contact+49@opinio.co.jp', 'contact+50@opinio.co.jp')) as other_users;

do $$
declare n int;
begin
  select count(*) into n from public.ow_users
   where email in ('contact+49@opinio.co.jp', 'contact+50@opinio.co.jp') and is_test is not true;
  if n <> 2 then raise exception '中止: 対象が想定と違う（is_test でない対象 % 行。2行のはず）', n; end if;
  if (select saison_current from _before) <> 2 then
    raise exception '中止: セゾンテクノロジーの現役社員が % 人（2人のはず）', (select saison_current from _before);
  end if;
end $$;

update public.ow_users set is_test = true
 where email in ('contact+49@opinio.co.jp', 'contact+50@opinio.co.jp');

do $$
declare n int; cur int;
begin
  select count(*) into n from public.ow_users
   where email in ('contact+49@opinio.co.jp', 'contact+50@opinio.co.jp') and is_test = true;
  if n <> 2 then raise exception '検算失敗: is_test になったのが % 行', n; end if;

  -- ほかのアカウントは1行も変わっていない
  if (select md5(string_agg(row_to_json(u)::text, '|' order by u.id)) from public.ow_users u
       where u.email not in ('contact+49@opinio.co.jp', 'contact+50@opinio.co.jp')) <> (select other_users from _before) then
    raise exception '検算失敗: ほかの ow_users の行が変わった';
  end if;

  -- セゾンテクノロジー: 現役社員は 2 → 1、会社の行は1バイトも変わっていない
  select count(*) into cur from public.ow_experiences e join public.ow_users u on u.id = e.user_id
   where e.company_id = '4f2be18a-cb77-4981-a5cf-dce81d1c06e2' and e.is_current
     and u.is_test is not true and u.auth_id is not null;
  if cur <> 1 then raise exception '検算失敗: セゾンテクノロジーの現役社員が % 人（1人のはず）', cur; end if;
  if (select md5(row_to_json(c)::text) from public.ow_companies c where c.id = '4f2be18a-cb77-4981-a5cf-dce81d1c06e2')
     <> (select saison_row from _before) then
    raise exception '検算失敗: セゾンテクノロジーの会社の行が変わった';
  end if;

  -- contact+50 の職歴は残っている
  if not exists (select 1 from public.ow_experiences e join public.ow_users u on u.id = e.user_id
                  where u.email = 'contact+50@opinio.co.jp' and e.company_id = '4f2be18a-cb77-4981-a5cf-dce81d1c06e2') then
    raise exception '検算失敗: contact+50 の職歴が見つからない';
  end if;
  raise notice '検算OK: 2行を is_test に。セゾンテクノロジーの現役社員 2 → 1、会社の行は変更なし';
end $$;

commit;
