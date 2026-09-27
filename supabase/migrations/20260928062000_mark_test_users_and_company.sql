-- ★検証用アカウント3件と、そこから作られた企業1社を is_test にする（2026-09-28 / 柴さんの指示）
--
-- ⚠️★★**同じ日に4本目。** `20260928013000`（人5件）→ `20260928015000`（企業4社）
--    → `20260928043000`（企業1社）→ これ。
--    **注意書きを書いた当日に、書いた本人が3回追加で踏んでいる。**
--    ＝ **文章では防げない。** 作ったその場で倒すか、検査を自動で回すしかない。
--
-- ── 対象（2026-09-28 実測）────────────────────────────────────────────────
--
-- | 対象 | 作成 | 職歴 | 企業管理者 | 面談対応者 | 投稿 |
-- |---|---|---|---|---|---|
-- | contact+40@opinio.co.jp | 03:28 | 0 | 0 | 0 | 0 |
-- | contact+41@opinio.co.jp | 04:09 | 0 | 0 | 0 | 0 |
-- | contact+42@opinio.co.jp | 05:36 | 0 | 0 | 0 | 0 |
-- | 株式会社テスト（e01ea632…） | 05:43 | — | — | — | — |
--
-- ⚠️★**柴さんの依頼は「contact+42 と企業1社」だったが、測ったら +40 / +41 も
--    同じ状態だった。** 1件ずつ潰すのを繰り返さないよう3件まとめて倒す。
--
-- ⚠️★**企業にぶら下がる行は `ow_company_creations` の1件だけ**（FK 49本を全表横断で実測）。
--    職歴・求人・管理者・面談対応者・♡・フォローは0件。
--    ⚠️ 作成記録は**残す**（`is_test` を立てるだけなので消えない）。
--       むしろこの1社は「今朝入れた記録が本番で初めて効いた」実例で、
--       **contact+42 が取り残しだと分かったのはこの記録のおかげ。**
--
-- ⚠️★**行は消さない。`is_test` を立てるだけ。**
--    `ow_users` を参照する FK 45列のうち29列が CASCADE。
--
-- ── 倒すと動く数字（適用前に実測。**適用後にこの値で検算する**）──────────────
--
-- | 何が | 前 | 後 |
-- |---|---|---|
-- | 実ユーザー（is_test/is_system 除外・auth_id あり） | **11** | **8** |
-- | 職歴がある実ユーザー | **5** | **5**（変わらない。3人とも職歴0） |
-- | 企業ピッカーの母集団 | **100** | **99** |
-- | `is_test` の企業 | **8** | **9** |
-- | 掲載中の企業 | **21** | **21**（変わらない） |
-- | 企業の行数 / 利用者の行数 | 108 / 57 | **108 / 57**（消さない） |
--
-- ⚠️ 作業前ダンプ: .dumps/20260928-0614-ow_users-ow_companies.sql
--    （248,823 バイト / ow_users 57行・ow_companies 108行）
-- ⚠️★対象を email と id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
--    ⚠️ `like 'contact+4%'` で倒さない —— 将来 `contact+4x` が実在の用途で使われたときに巻き込む。

do $$
declare
  n_u bigint; n_c bigint;
  before_users bigint; before_exp bigint;
  before_pool bigint; before_listed bigint;
  refs bigint;
begin
  select count(*) into n_u from public.ow_users
   where email in ('contact+40@opinio.co.jp','contact+41@opinio.co.jp','contact+42@opinio.co.jp')
     and is_test is not true and is_system is not true;
  if n_u <> 3 then
    raise exception '対象3件が「is_test でない」状態で見つからない（%件）。中止する', n_u;
  end if;

  -- ★3人とも職歴・管理者・面談対応者・投稿が0であること（1件でもあれば中止して中身を見る）
  select count(*) into n_u from public.ow_users u
   where u.email in ('contact+40@opinio.co.jp','contact+41@opinio.co.jp','contact+42@opinio.co.jp')
     and (exists(select 1 from public.ow_experiences e where e.user_id = u.id)
       or exists(select 1 from public.ow_company_admins a where a.user_id = u.id)
       or exists(select 1 from public.ow_company_members m where m.user_id = u.id)
       or exists(select 1 from public.ow_posts p where p.user_id = u.id));
  if n_u <> 0 then
    raise exception '対象のうち % 件が何かを持っている。中止する（中身を確かめてから判断する）', n_u;
  end if;

  select count(*) into n_c from public.ow_companies
   where id = 'e01ea632-bd66-4d2a-ba54-04b073dfec5b' and name = '株式会社テスト'
     and is_test is not true and listing_status = 'draft' and is_published = false;
  if n_c <> 1 then
    raise exception '対象の企業が「株式会社テスト / is_test でない / draft / 非公開」で見つからない（%件）', n_c;
  end if;

  -- ★企業にぶら下がる行は ow_company_creations の1件だけであること
  select coalesce(sum((xpath('/row/cnt/text()', x))[1]::text::int), 0) into refs
    from (
      select query_to_xml(format('select count(*) as cnt from public.%I where %I = %L',
               c.relname, a.attname, 'e01ea632-bd66-4d2a-ba54-04b073dfec5b'), false, true, '') as x
        from pg_constraint k join pg_class c on c.oid = k.conrelid
        join unnest(k.conkey) with ordinality as u(attnum, ord) on true
        join pg_attribute a on a.attrelid = c.oid and a.attnum = u.attnum
       where k.contype = 'f' and k.confrelid = 'public.ow_companies'::regclass
         and c.relnamespace = 'public'::regnamespace
         and c.relname <> 'ow_company_creations'
    ) s;
  if refs <> 0 then
    raise exception '企業に（作成記録以外の）行が % 件ぶら下がっている。中止する', refs;
  end if;

  select count(*) into before_users from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  if before_users <> 11 then
    raise exception '実ユーザーが想定（11）と違う: %。中止する', before_users;
  end if;

  select count(*) into before_exp from public.ow_users u
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null
     and exists(select 1 from public.ow_experiences e where e.user_id = u.id);
  if before_exp <> 5 then
    raise exception '職歴がある実ユーザーが想定（5）と違う: %。中止する', before_exp;
  end if;

  select count(*) into before_pool from public.ow_companies where is_test is not true;
  if before_pool <> 100 then
    raise exception '企業ピッカーの母集団が想定（100）と違う: %。中止する', before_pool;
  end if;

  select count(*) into before_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if before_listed <> 21 then
    raise exception '掲載中の企業が想定（21）と違う: %。中止する', before_listed;
  end if;
end $$;

update public.ow_users
   set is_test = true
 where email in ('contact+40@opinio.co.jp','contact+41@opinio.co.jp','contact+42@opinio.co.jp');

update public.ow_companies
   set is_test = true
 where id = 'e01ea632-bd66-4d2a-ba54-04b073dfec5b';   -- 株式会社テスト（2つ目）

-- ⚠️ 検算。「4行更新した」だけでは足りないので、測った値が想定どおり動いたかを見る。
do $$
declare
  n bigint;
  after_users bigint; after_exp bigint;
  after_pool bigint; after_listed bigint;
  n_rows_u bigint; n_rows_c bigint;
  still_draft bigint; n_creation bigint;
  leftovers bigint;
begin
  select count(*) into n from public.ow_users
   where email in ('contact+40@opinio.co.jp','contact+41@opinio.co.jp','contact+42@opinio.co.jp')
     and is_test = true;
  if n <> 3 then raise exception '3件とも is_test になっていない（%件）', n; end if;

  select count(*) into n from public.ow_companies
   where id = 'e01ea632-bd66-4d2a-ba54-04b073dfec5b' and is_test = true;
  if n <> 1 then raise exception '企業が is_test になっていない'; end if;

  select count(*) into after_users from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  if after_users <> 8 then raise exception '実ユーザーが想定（8）と違う: %', after_users; end if;

  select count(*) into after_exp from public.ow_users u
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null
     and exists(select 1 from public.ow_experiences e where e.user_id = u.id);
  if after_exp <> 5 then
    raise exception '職歴がある実ユーザーが想定（5）と違う: %。行き過ぎている', after_exp;
  end if;

  select count(*) into after_pool from public.ow_companies where is_test is not true;
  if after_pool <> 99 then raise exception '企業ピッカーの母集団が想定（99）と違う: %', after_pool; end if;

  select count(*) into after_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if after_listed <> 21 then
    raise exception '掲載中の企業が想定（21）と違う: %。他社まで動いた可能性がある', after_listed;
  end if;

  -- ★行を消していないこと
  select count(*) into n_rows_u from public.ow_users;
  select count(*) into n_rows_c from public.ow_companies;
  if n_rows_u <> 57 or n_rows_c <> 108 then
    raise exception '行が消えている（利用者 % / 企業 %）', n_rows_u, n_rows_c;
  end if;

  -- ★掲載・公開の状態を動かしていないこと
  select count(*) into still_draft from public.ow_companies
   where id = 'e01ea632-bd66-4d2a-ba54-04b073dfec5b'
     and listing_status = 'draft' and is_published = false;
  if still_draft <> 1 then raise exception '掲載・公開の状態が動いた'; end if;

  -- ★作成記録は残っていること（is_test は行を消さない）
  select count(*) into n_creation from public.ow_company_creations
   where company_id = 'e01ea632-bd66-4d2a-ba54-04b073dfec5b';
  if n_creation <> 1 then raise exception '作成記録が消えている（%件）', n_creation; end if;

  -- ★contact+NN の取り残しが0になったこと
  select count(*) into leftovers from public.ow_users
   where email like 'contact+%@opinio.co.jp'
     and is_test is not true and is_system is not true and auth_id is not null;
  if leftovers <> 0 then
    raise exception 'contact+NN の取り残しが % 件残っている', leftovers;
  end if;

  raise notice '実ユーザー 11->% / 職歴あり %（変化なし）/ ピッカー母集団 100->% / 掲載 %（変化なし）/ contact+NN の取り残し 0',
    after_users, after_exp, after_pool, after_listed;
end $$;
