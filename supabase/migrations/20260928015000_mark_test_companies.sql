-- ★検証用アカウントが作った企業4社を is_test にする（2026-09-28 / 柴さんの指示）
--
-- `20260928013000` で `contact+35`〜`+39` を `is_test` にした続き。
-- **人は倒したが、その人たちが作った企業行が `is_test = false` のまま残っていた。**
--
-- ⚠️★**残ると職歴の企業ピッカーに出続ける。** 4社とも
--    `listing_status='draft'` かつ `is_published=false` なので
--    **ディレクトリにも詳細ページにも出ていない**が、
--    ピッカーは**マスタの軸**（`/api/companies/lookup` は `is_test=false` だけで絞る）なので
--    **実在しない会社が選択肢に出たままになる。**
--
-- ── 対象（2026-09-28 実測）────────────────────────────────────────────────
--
-- | 企業 | source | 作成者 | 職歴 | 面談対応者 | 管理者 |
-- |---|---|---|---|---|---|
-- | 株式会社HR Tech   | biz_self | contact+18 | 0 | 0 | 1 |
-- | 株式会社TYU       | biz_self | contact+21 | 0 | 0 | 1 |
-- | 株式会社ゼクイース | biz_self | contact+22 | 0 | 0 | 1 |
-- | 株式会社ZAP       | user     | contact+36 | **3** | **1** | 1 |
--
-- 4社とも 求人0 ／ ♡0 ／ フォロー0 ／ 投稿0 ／ 記事0 ／ ページ非公開。
--
-- ⚠️★**ZAP の職歴3件の持ち主は全員 `is_test = true`**（`contact+36/37/38`。
--    `20260928013000` で倒した5人）。面談対応者1件も `contact+38`。
--    → **実ユーザーの職歴は 0件**。誰の画面も変わらない。
--
-- ⚠️★**登記でも裏が取れている**（⑩）。
--    ・ゼクイース … 「ゼクイース」「ゼクイ」とも**登記に0件**
--    ・HR Tech … 総ヒット49件に**商号が完全一致する法人は0社**
--    ・TYU … 36件中1社（大分市）。**同一である根拠は無い**
--    ・ZAP … 98件中17社（全国）。**特定できない**
--    ＝ **実在の法人を指していない行**と判断した。
--
-- ⚠️★**行は消さない。`is_test` を立てるだけ。**
--    `ow_companies` を参照する行（職歴3件・面談対応者1件・管理者4件）が
--    ぶら下がっており、消すと巻き込む。
--
-- ⚠️ `trg_guard_company_approval` は**掲載を立てる方向だけ**を止める。
--    `is_published` / `listing_status` は触らないので通る。
--
-- ── 倒すと動く数字（適用前に実測。**適用後にこの値で検算する**）──────────────
--
-- | 何が | 前 | 後 |
-- |---|---|---|
-- | 企業ピッカーの母集団（`is_test=false`） | **103** | **99** |
-- | `is_test = true` の企業 | **3** | **7** |
-- | 掲載中の企業 | **21** | **21**（変わらない） |
-- | 4社にぶら下がる実ユーザーの職歴 | **0** | **0** |
--
-- ⚠️ 作業前ダンプ: .dumps/20260928-0150-ow_companies.sql（215,527 バイト / 106行）
-- ⚠️★対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
--    ⚠️ 「作成者が `is_test` の企業をまとめて倒す」形にしない —— 検証用アカウントが
--       **実在の企業を登録した**場合に巻き込む。

do $$
declare
  n bigint;
  before_pool bigint;
  before_listed bigint;
  real_exp bigint;
begin
  select count(*) into n from public.ow_companies
   where id in ('2be4354f-43b4-460f-a111-74852d5bea90','08206d13-0f98-465c-adf9-982f6fbc520e',
                'b9a3b7e2-15b0-4c70-8993-1d2f5d445934','aa6beae7-3ef8-42e6-b6b2-d4acfec0a5fe')
     and is_test is not true
     and listing_status = 'draft'
     and is_published = false;
  if n <> 4 then
    raise exception '対象4社が「is_test でない / draft / 非公開」で見つからない（%件）。中止する', n;
  end if;

  -- ★実ユーザーの職歴がぶら下がっていないこと（1件でもあれば中止）
  select count(*) into real_exp from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
   where e.company_id in ('2be4354f-43b4-460f-a111-74852d5bea90','08206d13-0f98-465c-adf9-982f6fbc520e',
                          'b9a3b7e2-15b0-4c70-8993-1d2f5d445934','aa6beae7-3ef8-42e6-b6b2-d4acfec0a5fe')
     and u.is_test is not true and u.is_system is not true;
  if real_exp <> 0 then
    raise exception '実ユーザーの職歴が % 件ぶら下がっている。中止する', real_exp;
  end if;

  select count(*) into before_pool from public.ow_companies where is_test is not true;
  if before_pool <> 103 then
    raise exception '企業ピッカーの母集団が想定（103）と違う: %。中止する', before_pool;
  end if;

  select count(*) into before_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if before_listed <> 21 then
    raise exception '掲載中の企業が想定（21）と違う: %。中止する', before_listed;
  end if;
end $$;

update public.ow_companies
   set is_test = true
 where id in ('2be4354f-43b4-460f-a111-74852d5bea90',   -- 株式会社HR Tech
              '08206d13-0f98-465c-adf9-982f6fbc520e',   -- 株式会社TYU
              'b9a3b7e2-15b0-4c70-8993-1d2f5d445934',   -- 株式会社ZAP
              'aa6beae7-3ef8-42e6-b6b2-d4acfec0a5fe');  -- 株式会社ゼクイース

-- ⚠️ 検算。「4行更新した」だけでは足りないので、測った値が想定どおり動いたかを見る。
do $$
declare
  n_test bigint;
  after_pool bigint;
  after_listed bigint;
  n_rows bigint;
  still_published bigint;
begin
  select count(*) into n_test from public.ow_companies
   where id in ('2be4354f-43b4-460f-a111-74852d5bea90','08206d13-0f98-465c-adf9-982f6fbc520e',
                'b9a3b7e2-15b0-4c70-8993-1d2f5d445934','aa6beae7-3ef8-42e6-b6b2-d4acfec0a5fe')
     and is_test = true;
  if n_test <> 4 then
    raise exception '4社とも is_test になっていない（%件）', n_test;
  end if;

  select count(*) into after_pool from public.ow_companies where is_test is not true;
  if after_pool <> 99 then
    raise exception '企業ピッカーの母集団が想定（99）と違う: %', after_pool;
  end if;

  select count(*) into after_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if after_listed <> 21 then
    raise exception '掲載中の企業が想定（21）と違う: %。他社まで動いた可能性がある', after_listed;
  end if;

  -- ★行を消していないこと（is_test を立てただけ）
  select count(*) into n_rows from public.ow_companies
   where id in ('2be4354f-43b4-460f-a111-74852d5bea90','08206d13-0f98-465c-adf9-982f6fbc520e',
                'b9a3b7e2-15b0-4c70-8993-1d2f5d445934','aa6beae7-3ef8-42e6-b6b2-d4acfec0a5fe');
  if n_rows <> 4 then
    raise exception '行が消えている（%件）', n_rows;
  end if;

  -- ★掲載・公開の状態を動かしていないこと
  select count(*) into still_published from public.ow_companies
   where id in ('2be4354f-43b4-460f-a111-74852d5bea90','08206d13-0f98-465c-adf9-982f6fbc520e',
                'b9a3b7e2-15b0-4c70-8993-1d2f5d445934','aa6beae7-3ef8-42e6-b6b2-d4acfec0a5fe')
     and listing_status = 'draft' and is_published = false;
  if still_published <> 4 then
    raise exception '掲載・公開の状態が動いた（draft かつ非公開なのは %件）', still_published;
  end if;

  raise notice 'ピッカー母集団 103->% / 掲載 %（変化なし）/ is_test の企業 % 社',
    after_pool, after_listed, (select count(*) from public.ow_companies where is_test = true);
end $$;
