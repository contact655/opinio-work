-- ★株式会社Third Box（検証用の会社）の「ページ表示」を表示に戻す（2026-10-12 / 柴さんの指示）。
--   検証用アカウントにだけ検証用の会社を見せる仕組み（/t/companies・/t/jobs）で確かめるため。
--   ⚠️ 掲載（listing_status）は触らない。is_test = true なので一般の利用者の一覧・詳細・検索には出ない
--      （公開側は is_test を常に除外。ow_companies の RLS も検証用の会社は検証用アカウントにだけ返す）。
--   ⚠️ published_at は空なので、初回公開と同じく now() を入れる（publishedAtPatch と同じ規則）。
--   ⚠️ 対象は id を明示した1社だけ。is_test・is_approved を確かめて、違えば中止する。
do $$
declare n int;
begin
  update public.ow_companies
     set is_published = true,
         published_at = coalesce(published_at, now())
   where id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d'
     and is_test = true and is_approved = true and is_published = false;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '想定と違う（更新 % 行）。中止', n; end if;
end $$;
