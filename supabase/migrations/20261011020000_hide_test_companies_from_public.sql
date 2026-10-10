-- ════════════════════════════════════════════════════════════════════════
-- 検証用の企業（is_test）を、匿名・一般のログイン利用者から読めなくする（2026-10-11 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- それまで公開側の読み取りポリシーは is_test を見ておらず、画面は 404 でも
-- PostgREST を直接叩くと会社の行・企業ストーリー・ツール・部門名が読めた（株式会社エージェントで実測）。
--
-- ① ow_companies の公開読み取り … is_published に加えて is_test = false
-- ② 部門（ow_company_departments） … 親の会社が「公開かつ検証用でない」
-- ③ 企業ストーリー（ow_company_posts）・ツール（ow_company_tools）
--    … **その会社の行が読めること**を条件に足す（副問い合わせは呼んだ人の RLS で評価される）。
--    ⚠️ ここに is_test を直接書かない。検証用の会社の行は①で見えなくなるので、
--       NOT EXISTS で書くと逆に素通りする。「読めること」を条件にする。
--    ⚠️ 実在の企業への影響: 非公開の実在企業の公開ストーリー0件・ツール0件（2026-10-11 実測）。
--
-- ⚠️ 運営（auth_is_admin）・その会社の担当者（auth_is_company_member / _admin）・user_id の本人の
--    ポリシーは触らない。/biz の自社の画面はそのまま読める。
-- ⚠️ SECURITY DEFINER の関数は足していない（許可リストを増やさない）。
-- ════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "ow_companies_published_read" on public.ow_companies;
create policy "ow_companies_published_read" on public.ow_companies
  for select using (is_published = true and is_test = false);

drop policy if exists "public read published departments" on public.ow_company_departments;
create policy "public read published departments" on public.ow_company_departments
  for select using (exists (
    select 1 from public.ow_companies
     where ow_companies.id = ow_company_departments.company_id
       and ow_companies.is_published = true and ow_companies.is_test = false));

drop policy if exists "public_read_published_posts" on public.ow_company_posts;
create policy "public_read_published_posts" on public.ow_company_posts
  for select using (is_published = true and exists (
    select 1 from public.ow_companies c where c.id = ow_company_posts.company_id));

drop policy if exists "public read company tools" on public.ow_company_tools;
create policy "public read company tools" on public.ow_company_tools
  for select using (exists (
    select 1 from public.ow_companies c where c.id = ow_company_tools.company_id));

commit;

-- ★戻すとき（元の式）:
--   ow_companies_published_read … using (is_published = true)
--   public read published departments … using (exists (select 1 from ow_companies where id = company_id and is_published = true))
--   public_read_published_posts … using (is_published = true)
--   public read company tools … using (true)
