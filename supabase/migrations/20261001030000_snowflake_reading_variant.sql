-- Snowflake の読みの揺れを別名に足す（スノーフレイク ／ スノーフレーク）
--
-- 正規化（`search_key`）で吸収できるのは **表記**の揺れまでで、
-- **読み**の揺れは音が違うので畳めない。実測（2026-10-01 / 本番）:
--   スノーフレ**イ**ク → ✅ ／ スノーフレ**ー**ク → ★0件
--
-- ⚠️★**正規化の規則で直そうとしないこと。** 「ー」を落とす集合に足すと
--    「コーヒー」と「コヒ」が同じになる（`normalize_company_name` の COMMENT）。
--    **こちらは別名に両方書くのが正しい。**
--
-- ⚠️ `search_aliases` を変えると `trg_ow_companies_normalized_name` が
--    `search_key` を作り直す（`20261001020000` でそう拡張した）。手で書かない。

begin;

do $$
declare v_id uuid; v_before text; v_after text;
begin
  select id, search_aliases into v_id, v_before
    from public.ow_companies where slug = 'snowflake' and is_test = false;
  if v_id is null then raise exception 'snowflake が見つからない'; end if;
  if v_before is distinct from 'スノーフレイク' then
    raise exception '別名が想定と違う: %', coalesce(v_before,'(null)');
  end if;

  update public.ow_companies
     set search_aliases = 'スノーフレイク スノーフレーク'
   where id = v_id;

  -- ★トリガーが search_key を作り直し、両方の読みで当たること
  select search_key into v_after from public.ow_companies where id = v_id;
  if v_after not ilike '%'||public.normalize_company_name('スノーフレーク')||'%' then
    raise exception 'スノーフレークで当たらない: %', v_after; end if;
  if v_after not ilike '%'||public.normalize_company_name('すのーふれいく')||'%' then
    raise exception 'ひらがなで当たらない: %', v_after; end if;

  raise notice 'snowflake の search_key = [%]', v_after;
end $$;

commit;
