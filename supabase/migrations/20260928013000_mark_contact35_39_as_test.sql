-- ★自社ドメインの検証用アカウント5件を is_test にする（2026-09-28 / 柴さんの指示）
--
-- **2026-09-14 に `contact+28`〜`+32` の5件を倒したのと、まったく同じ形。**
-- その後また5件（`contact+35`〜`+39`）が `is_test = false` のまま増えていた。
--
-- ⚠️★**実ユーザーの数え方が変わる。** CLAUDE.md の「実ユーザー N人」を引用するときは、
--    **この migration より前の日付の数字はこの5件を含んでいる**ことに注意する。
--
-- ── 対象（2026-09-28 実測）────────────────────────────────────────────────
--
-- | email | 氏名 | 作成 | 職歴 | 面談対応者 | 企業管理者 |
-- |---|---|---|---|---|---|
-- | contact+35 | 五十嵐 健二 | 09-19 | 1 | 0 | 0 |
-- | contact+36 | 安藤 誠司   | 09-19 | 1 | 0 | **1**（株式会社ZAP） |
-- | contact+37 | 山田 健二   | 09-21 | 1 | 0 | 0 |
-- | contact+38 | 鈴木 聡     | 09-23 | 1 | **1**（株式会社ZAP） | 0 |
-- | contact+39 | 山田 誠司   | 09-23 | 0 | 0 | 0 |
--
-- 5人とも `visibility = 'login_only'` ／ `auth_id` あり ／ 投稿0 ／ 保存0 ／ 提案0。
--
-- ── 倒すと動く数字（適用前に実測。**適用後にこの値で検算する**）──────────────
--
-- | 何が | 前 | 後 |
-- |---|---|---|
-- | 実ユーザー（is_test/is_system 除外・auth_id あり） | **13** | **8** |
-- | 職歴がある実ユーザー | **9** | **5** |
-- | `/people` の母集団（＋ visibility <> private） | **13** | **8** |
-- | ★**セールスフォース・ジャパンの現役社員** | **1** | **0** |
-- | セールスフォース・ジャパンの OB・OG | 3 | 3（変わらない） |
-- | 掲載中の面談対応者 | **4** | **4**（変わらない） |
--
-- ⚠️★**掲載中の企業に効くのは1件だけ**（セールスフォース・ジャパンの現役が 1 → 0）。
--    残りの職歴3件は `株式会社ZAP`（`listing_status='draft'`）なので求職者側には元から出ない。
-- ⚠️ `contact+38` の面談対応者の行も ZAP（draft）なので、**掲載中の面談対応者4名は減らない。**
--
-- ⚠️★**行は消さない。`is_test` を立てるだけ。**
--    `ow_users` を参照する FK 45列のうち29列が CASCADE なので、削除すると
--    職歴・投稿・会話まで巻き込む（CLAUDE.md「本番で検証用アカウントを作らない」）。
--
-- ⚠️★**企業行（株式会社ZAP / HR Tech / TYU / ゼクイース）には触っていない。**
--    それは別の判断（この migration の範囲外）。
--
-- ⚠️ 作業前ダンプ: .dumps/20260928-0122-ow_users-ow_experiences.sql
--    （66,090 バイト / ow_users 54行・ow_experiences 45行）
-- ⚠️★対象を email で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
--    ⚠️ `like 'contact+3%'` のようなパターンで倒さない —— 将来 `contact+3x` が
--       実在の用途で使われたときに巻き込む。

do $$
declare
  n bigint;
  before_users bigint;
  before_exp bigint;
  before_sf bigint;
begin
  select count(*) into n from public.ow_users
   where email in ('contact+35@opinio.co.jp','contact+36@opinio.co.jp','contact+37@opinio.co.jp',
                   'contact+38@opinio.co.jp','contact+39@opinio.co.jp')
     and is_test is not true and is_system is not true;
  if n <> 5 then
    raise exception '対象5件が「is_test でない」状態で見つからない（%件）。中止する', n;
  end if;

  -- ★倒す前の値を確かめる。想定と違えば中止（別セッションが先に触っていた場合など）
  select count(*) into before_users from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  if before_users <> 13 then
    raise exception '実ユーザーが想定（13）と違う: %。中止する', before_users;
  end if;

  select count(*) into before_exp from public.ow_users u
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null
     and exists(select 1 from public.ow_experiences e where e.user_id = u.id);
  if before_exp <> 9 then
    raise exception '職歴がある実ユーザーが想定（9）と違う: %。中止する', before_exp;
  end if;

  select count(*) into before_sf from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
    join public.ow_companies c on c.id = e.company_id
   where c.name = '株式会社セールスフォース・ジャパン' and e.is_current
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  if before_sf <> 1 then
    raise exception 'セールスフォースの現役が想定（1）と違う: %。中止する', before_sf;
  end if;
end $$;

update public.ow_users
   set is_test = true
 where email in ('contact+35@opinio.co.jp','contact+36@opinio.co.jp','contact+37@opinio.co.jp',
                 'contact+38@opinio.co.jp','contact+39@opinio.co.jp');

-- ⚠️ 検算。**「5行更新した」だけでは足りない**ので、上で測った値が想定どおり動いたかを見る
--    （ui-debugging ⑱「集合が一致するだけでは足りない」）。
do $$
declare
  n_test bigint;
  after_users bigint;
  after_exp bigint;
  after_sf bigint;
  after_ob bigint;
  after_members bigint;
begin
  select count(*) into n_test from public.ow_users
   where email in ('contact+35@opinio.co.jp','contact+36@opinio.co.jp','contact+37@opinio.co.jp',
                   'contact+38@opinio.co.jp','contact+39@opinio.co.jp')
     and is_test = true;
  if n_test <> 5 then
    raise exception '5件とも is_test になっていない（%件）', n_test;
  end if;

  select count(*) into after_users from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  if after_users <> 8 then
    raise exception '実ユーザーが想定（8）と違う: %', after_users;
  end if;

  select count(*) into after_exp from public.ow_users u
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null
     and exists(select 1 from public.ow_experiences e where e.user_id = u.id);
  if after_exp <> 5 then
    raise exception '職歴がある実ユーザーが想定（5）と違う: %', after_exp;
  end if;

  select count(*) into after_sf from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
    join public.ow_companies c on c.id = e.company_id
   where c.name = '株式会社セールスフォース・ジャパン' and e.is_current
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  if after_sf <> 0 then
    raise exception 'セールスフォースの現役が想定（0）と違う: %', after_sf;
  end if;

  -- ★OB・OG は変わらないはず（倒した5人は現役の行しか持っていない）
  select count(*) into after_ob from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
    join public.ow_companies c on c.id = e.company_id
   where c.name = '株式会社セールスフォース・ジャパン' and not e.is_current
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  if after_ob <> 3 then
    raise exception 'セールスフォースの OB・OG が想定（3）と違う: %。行き過ぎている', after_ob;
  end if;

  -- ★掲載中の面談対応者は変わらないはず（該当の1件は draft の企業）
  select count(*) into after_members from public.ow_company_members m
    join public.ow_companies c on c.id = m.company_id
   where m.is_public and m.display_consent and c.listing_status = 'listed';
  if after_members <> 4 then
    raise exception '掲載中の面談対応者が想定（4）と違う: %', after_members;
  end if;

  -- ★行を消していないこと（is_test を立てただけ）
  select count(*) into n_test from public.ow_users
   where email in ('contact+35@opinio.co.jp','contact+36@opinio.co.jp','contact+37@opinio.co.jp',
                   'contact+38@opinio.co.jp','contact+39@opinio.co.jp');
  if n_test <> 5 then
    raise exception '行が消えている（%件）', n_test;
  end if;

  raise notice '実ユーザー 13->% / 職歴あり 9->% / SF現役 1->% / SF OB %（変化なし）/ 掲載中の面談対応者 %（変化なし）',
    after_users, after_exp, after_sf, after_ob, after_members;
end $$;
