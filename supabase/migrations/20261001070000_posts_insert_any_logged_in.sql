-- ★投稿できるのを「ログインしている人」全員にする（2026-10-01 / 柴さんの判断）
--
-- それまでの `posts_insert_own` は `ow_company_members` に行があることを要求しており、
-- **実ユーザー25人のうち投稿できるのは6人だけ**だった（実測 2026-10-01）。
-- **コメントは元から全ログインユーザーに開いている**ので、投稿だけ閉じているのは
-- 同じ画面の中で不揃いだった。
--
-- ⚠️★**条件は3層ある。片方だけ直さないこと。**
--      ① コンポーザーの表示（/feed と /mypage）
--      ② API のガード（POST /api/jobseeker/posts）
--      ③ このポリシー
--    アプリ側は `src/lib/feed/canPost.ts` の1箇所に集約してある。
--
-- ⚠️★**元の条件が守っていたものは消えていない。** `ow_experiences` の在籍は
--    **自己申告**なので、「セールスフォース在籍」と書くだけで発信権限が付く。
--    いま効いている歯止めは4つだけ:
--      ・ログイン必須 ・毎時30件の上限 ・本文1,000字/画像はhttpsのみ
--      ・公開範囲は login_only 固定（未ログインと検索エンジンには出ない）
--    荒れたら**3層とも**条件を足す。
--
-- 戻すときの原文（2026-08-23 の 20260823040000 と同じ式）:
--   with check (
--     user_id = (select id from ow_users where auth_id = auth.uid())
--     and exists (
--       select 1 from ow_company_members m
--        where m.user_id = ow_posts.user_id
--          and not (coalesce(m.created_via,'') = 'self' and m.is_public = false)))

begin;

drop policy if exists posts_insert_own on public.ow_posts;

create policy posts_insert_own on public.ow_posts
  for insert to authenticated
  with check (
    user_id = (select id from public.ow_users where auth_id = auth.uid())
  );

-- 検算: ow_company_members への参照が消えていること
do $$
declare v text;
begin
  select pg_get_expr(polwithcheck, polrelid) into v
    from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relname = 'ow_posts' and p.polname = 'posts_insert_own';
  if v is null then
    raise exception 'posts_insert_own が無い';
  end if;
  if v like '%ow_company_members%' then
    raise exception 'まだ ow_company_members を見ている: %', v;
  end if;
  if v not like '%auth.uid()%' then
    raise exception '本人判定が消えている: %', v;
  end if;
  raise notice 'posts_insert_own = %', v;
end $$;

commit;
