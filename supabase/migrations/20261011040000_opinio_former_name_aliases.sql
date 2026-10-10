-- ════════════════════════════════════════════════════════════════════════
-- 株式会社Opinio の旧社名「Third Box」で引けるようにする（2026-10-11 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- 職歴の会社名に旧社名（Third Box / 株式会社Third Box / サードボックス）を打った人に、
-- 株式会社Opinio が候補に出るようにする。⚠️ 同名の「株式会社Third Box」の行は検証用（is_test）で、
-- 職歴の企業ピッカー（/api/companies/lookup）は is_test を返さないので候補には出ない。
--
-- ⚠️★**語の中の空白を落として書く**（ThirdBox / 株式会社ThirdBox）。
--    `search_aliases` は**空白区切りの各語**として `can_send_scout()` の自由入力の照合
--    （20261009040000 / 070000）にも使われる。「Third Box」とそのまま書くと「Box」が
--    1語として株式会社Opinio の別名になり、職歴に「Box」と書いた人（Box Japan 等）を
--    **株式会社Opinio の在籍者と見なして候補から外す**ことになる。
--    ⚠️ 検索は困らない。打った「Third Box」「株式会社Third Box」は normalize_company_name で
--       どちらも `thirdbox` になり、`search_key`（トリガーが作り直す）に当たる。
-- ⚠️ 既存の別名（オピニオ）は残して後ろに足す。
-- ⚠️ 作業前の控え: .dumps/20261011-0206-ow_companies.sql
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare v_before text; v_after text; v_key text; n int;
begin
  select search_aliases into v_before from public.ow_companies
   where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251' and name = '株式会社Opinio' and is_test = false;
  if not found then raise exception '株式会社Opinio が見つからない'; end if;
  if v_before is distinct from 'オピニオ' then
    raise exception '別名が想定と違う: %', coalesce(v_before, '(null)');
  end if;

  update public.ow_companies
     set search_aliases = 'オピニオ ThirdBox 株式会社ThirdBox サードボックス'
   where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '更新が1行でない: %', n; end if;

  select search_aliases, search_key into v_after, v_key from public.ow_companies
   where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';
  -- ★空白で分けた語に「Box」「Third」が無いこと（can_send_scout の照合）
  if exists (select 1 from regexp_split_to_table(v_after, '\s+') t(w)
              where public.normalize_company_name(w) in ('box', 'third')) then
    raise exception '別名に Box / Third が1語で入っている: %', v_after;
  end if;
  -- ★打った文字（正規化後）で search_key に当たること
  if v_key not ilike '%' || public.normalize_company_name('Third Box') || '%' then
    raise exception 'Third Box で当たらない: %', v_key; end if;
  if v_key not ilike '%' || public.normalize_company_name('株式会社Third Box') || '%' then
    raise exception '株式会社Third Box で当たらない: %', v_key; end if;
  if v_key not ilike '%' || public.normalize_company_name('サードボックス') || '%' then
    raise exception 'サードボックス で当たらない: %', v_key; end if;

  raise notice 'search_aliases = [%] / search_key = [%]', v_after, v_key;
end $$;

commit;

-- ★戻すとき: update public.ow_companies set search_aliases = 'オピニオ'
--             where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';
