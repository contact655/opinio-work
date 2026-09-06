-- 取材記事の**本文**に残っていた「IT/SaaS」を「IT」にする（2026-09-06）。
--
-- ⚠️★**取りこぼしの後始末。** 直前の 20260906100000 は text / varchar 列しか
--    走査しておらず、**jsonb 列を見ていなかった**。記事本文は
--    `body_blocks` / `qa_blocks`（どちらも jsonb）に入っているので漏れた。
--    → DB の文字列を洗うときは **jsonb / json / ARRAY も対象にする**。
--
-- 対象は 20260906100000 と同じ記事1本だけ（slug: opinio-founding-story-it-career）。
-- body_blocks 2箇所 / qa_blocks 2箇所。
--
-- ⚠️ **qa_blocks はインタビューの一問一答**で、柴さん本人の発言を含む。
--    発言の書き換えになるため、柴さんの明示の指示（「記事も変更してほしい」）に
--    もとづいて実施している。**第三者の発言を含む記事には同じことをしないこと。**
--
-- ⚠️ jsonb を ::text にして replace し、jsonb へ戻している。
--    「IT/SaaS」「IT・SaaS」は JSON のエスケープ対象文字を含まないので、
--    この往復で構造は壊れない（適用後に jsonb_typeof でも確かめる）。
--
-- ⚠️ replace() なので冪等。

begin;

do $$
declare
  n int;
begin
  select count(*) into n from ow_articles
   where id = '5a47a261-2e2a-47ac-aff3-db0fdf2e50ef'
     and (body_blocks::text ~ 'IT[/・]SaaS' or qa_blocks::text ~ 'IT[/・]SaaS');
  if n <> 1 then
    raise exception '対象記事が想定と違う: % 件（期待 1）', n;
  end if;
end $$;

update ow_articles
   set body_blocks = replace(replace(body_blocks::text, 'IT/SaaS', 'IT'), 'IT・SaaS', 'IT')::jsonb,
       qa_blocks   = replace(replace(qa_blocks::text,   'IT/SaaS', 'IT'), 'IT・SaaS', 'IT')::jsonb
 where id = '5a47a261-2e2a-47ac-aff3-db0fdf2e50ef';

-- ── 事後チェック: 旧表記が消え、かつ JSON の型が壊れていないこと ──────────
do $$
declare
  leftovers int;
  body_type text;
  qa_type   text;
begin
  select count(*) into leftovers from ow_articles
   where id = '5a47a261-2e2a-47ac-aff3-db0fdf2e50ef'
     and (body_blocks::text ~ 'IT[/・]SaaS' or qa_blocks::text ~ 'IT[/・]SaaS');
  if leftovers <> 0 then
    raise exception '旧表記が残っている';
  end if;

  select jsonb_typeof(body_blocks), jsonb_typeof(qa_blocks) into body_type, qa_type
    from ow_articles where id = '5a47a261-2e2a-47ac-aff3-db0fdf2e50ef';
  if body_type <> 'array' or qa_type <> 'array' then
    raise exception 'jsonb の型が変わった: body=% qa=%（期待 array/array）', body_type, qa_type;
  end if;
end $$;

commit;
