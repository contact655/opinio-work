-- ════════════════════════════════════════════════════════════════════════
-- 入社後レビュー：RLS で「会社が職歴の会社と一致すること」も見る（2026-10-26 / フェーズ1a-5）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★きっかけ: docs/phase0-decision-platform-20261026.md の A4。
--    ow_workplace_reviews の insert / update の WITH CHECK は「本人の行」と「本人の職歴」しか見ておらず、
--    company_id が職歴の会社と一致するかを見ていなかった。authenticated は PostgREST から直接書けるので、
--    本人は自分の行に**任意の company_id** を入れられた。
--    いまは本人の並び（lib/forYou）にしか使っていないが、会社ごとに集計し始めた日に値を汚される余地になる。
--
-- ★直し方: insert / update の WITH CHECK に「その職歴の company_id と一致（NULL どうしも一致）」を足す。
--    アプリ（lib/workplaceReview/server.ts）は admin クライアントで職歴の company_id を書くので影響しない。
--
-- 作業前の確認（2026-10-26 実測）: 全2行とも company_id は職歴の会社と一致（不一致 0 行）。
-- 作業前の控え: .dumps/20261026-1625-ow_users-ow_workplace_reviews.sql
--
-- 戻し方: 下の2本を、company_id の条件を外した元の式で作り直す（元の式はこのファイルの末尾に記録）。
-- データは変えない。
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  select count(*) into n
    from public.ow_workplace_reviews r
    join public.ow_experiences e on e.id = r.experience_id
   where r.company_id is distinct from e.company_id;
  if n <> 0 then
    raise exception '会社が職歴と一致しない行が % 行ある。先に確かめること', n;
  end if;
end $$;

drop policy if exists ow_workplace_reviews_insert on public.ow_workplace_reviews;
create policy ow_workplace_reviews_insert on public.ow_workplace_reviews
  for insert to authenticated
  with check (
    user_id = public.auth_ow_user_id()
    and exists (
      select 1 from public.ow_experiences e
       where e.id = ow_workplace_reviews.experience_id
         and e.user_id = public.auth_ow_user_id()
         and e.company_id is not distinct from ow_workplace_reviews.company_id
    )
  );

drop policy if exists ow_workplace_reviews_update on public.ow_workplace_reviews;
create policy ow_workplace_reviews_update on public.ow_workplace_reviews
  for update to authenticated
  using (user_id = public.auth_ow_user_id())
  with check (
    user_id = public.auth_ow_user_id()
    and exists (
      select 1 from public.ow_experiences e
       where e.id = ow_workplace_reviews.experience_id
         and e.user_id = public.auth_ow_user_id()
         and e.company_id is not distinct from ow_workplace_reviews.company_id
    )
  );

commit;

-- 元の式（戻すとき用）:
--   insert WITH CHECK: (user_id = auth_ow_user_id()) AND (EXISTS (SELECT 1 FROM ow_experiences e
--                        WHERE e.id = ow_workplace_reviews.experience_id AND e.user_id = auth_ow_user_id()))
--   update USING: (user_id = auth_ow_user_id())  WITH CHECK: insert と同じ
