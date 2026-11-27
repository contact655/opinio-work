-- ★パランティアの正式社名（name）を登記上の社名に直す（2026-11-27 / 柴さんの指定）
--
-- 対象: be74d989-db8f-4be1-882c-40cf94e07fe2 の name だけ。
--   前: パランティア・テクノロジーズ
--   後: パランティア・テクノロジーズ・ジャパン株式会社
--       （2019年11月に SOMPO ホールディングスとの合弁で設立された、渋谷区神宮前の株式会社。合同会社の方ではない）
--
-- 出どころ: 前の値は archive/156_foreign_it_companies.sql（外資系IT企業の一括登録・2026-06-04）で入ったもの。
--   20260829170000（本社住所の登記照合）では「株式会社と合同会社の2つが実在し判別できない」として空のままにしていた。
--
-- 守ること:
--   ・今の name が「パランティア・テクノロジーズ」のときだけ更新する。違えば中止する
--   ・更新が1行でなければ中止する
--   ・ほかの列は書かない。⚠️ updated_at を自動で書くトリガーは ow_companies に無い
--   ⚠️ ただし trg_ow_companies_normalized_name が normalized_name と search_key（どちらも派生列）を作り直す
--      normalized_name: パランティアテクノロジーズ → パランティアテクノロジーズジャパン
--      （同じ値を持つ他社は0件・一意の索引は無い・この会社に紐づく職歴は0件、自由入力で一致する職歴も0件。2026-11-27 実測）
--
-- 表示名は変わらない: companyBrandName() は brand_name（空）→ 英語社名「Palantir Japan」→「Palantir」。
--   変わるのは企業詳細の見出しの下の正式社名・パンくず・<title> など、正式社名をそのまま出す場所。
--
-- 作業前ダンプ: .dumps/20261127-1443-ow_companies.sql（135行）
-- 戻し方:
--   update public.ow_companies set name = 'パランティア・テクノロジーズ'
--    where id = 'be74d989-db8f-4be1-882c-40cf94e07fe2' and name = 'パランティア・テクノロジーズ・ジャパン株式会社';

do $$
declare
  v_id      constant uuid := 'be74d989-db8f-4be1-882c-40cf94e07fe2';
  v_old     constant text := 'パランティア・テクノロジーズ';
  v_new     constant text := 'パランティア・テクノロジーズ・ジャパン株式会社';
  v_current text;
  v_updated int;
begin
  select name into v_current from public.ow_companies where id = v_id;
  if not found then
    raise exception '対象の会社 % が見つからない。中止', v_id;
  end if;
  if v_current is distinct from v_old then
    raise exception '今の name が「%」で、想定（%）と違う。中止', v_current, v_old;
  end if;

  update public.ow_companies
     set name = v_new
   where id = v_id and name = v_old;
  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception '更新した行が % 行（1行のはず）。中止してロールバックする', v_updated;
  end if;

  raise notice '正式社名を「%」→「%」に直した', v_old, v_new;
end
$$;
