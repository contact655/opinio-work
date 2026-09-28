-- is_test を立て忘れていた検証用アカウント2件と、その企業1社を倒す（2026-09-29）
--
-- ── これで4回目 ──────────────────────────────────────────────────────────
-- 2026-09-14（contact+28〜+32）／ 09-17（contact+33・+34）／ 09-28（contact+35〜+39）
-- に続いて4回目。⚠️★**取り残しは別々に起きる。** 前回の数字が古い理由を
-- 「直近の取り残しのせい」と決めつけないこと（CLAUDE.md）。
--
-- ⚠️★**検知は効いていた。** `/admin` の要対応タスクが
-- 「is_test を立て忘れている行 2件 ／ contact+43 ・ contact+44」と既に出していた
-- （2026-09-29 に実画面で確認）。**仕組みではなく、倒す操作がされていなかっただけ。**
--
-- ⚠️ 企業側（`ow_company_creations` を見る検査）は、**作成者が既に `is_test` で
--    あること**を条件にしているので、人を倒すまで 株式会社テスト を拾えない。
--    ＝ 2段階になる。**同じ migration で両方倒すので、適用後は 0件 に戻る。**
--    ★この2段階を避けるためにメールの綴りを検査式へ持ち込まないこと（実在の
--      利用者を巻き込む形になる。CLAUDE.md「`source` の条件を外すと実在企業を拾う」）。
--
-- ── 倒すもの（★email / id を明示列挙する。まとめて倒さない）───────────────
--   contact+43@opinio.co.jp （2026-09-27 作成）
--   contact+44@opinio.co.jp （2026-09-28 作成）
--   株式会社テスト 69c3286a-4425-4cc3-b3f4-ae5866cb74e5（`source='user'`）
--     └ contact+43 が作り、contact+43 と contact+44 の職歴が指している
--
-- ⚠️★**行を消さない。`is_test` を立てるだけ。** `ow_users` を参照する FK 45列のうち
--    29列が ON DELETE CASCADE（CLAUDE.md）。
--
-- ── 実測（2026-09-29 / 適用前）──────────────────────────────────────────
--   2人にぶら下がるもの: 職歴 各1 ／ 企業の管理者 contact+44 のみ1 ／
--   面談対応者 0 ／ 投稿 0。**職歴2件とも勤務先は 株式会社テスト**で、
--   実在企業のページには一切出ていない。
--   ＝ **「2人倒す」＝「2人ぶん画面が変わる」ではない。** 掲載中21社は変わらない。
--
-- ── 直近に同じ列を触った migration ──────────────────────────────────────
--   `20260928043000`（株式会社テストを is_test に。**別の行**）／
--   `20260928015000`（検証用が作った企業4社）／ `20260928013000`（contact+35〜+39）。
--   **いずれも別の id / email を名指ししており、打ち消していない。**

begin;

-- ① 事前チェック：想定どおりの状態か
do $$
declare
  v_users int; v_company int;
  v_real_users int; v_real_with_exp int; v_listed int; v_picker int;
begin
  select count(*) into v_users from public.ow_users
   where email in ('contact+43@opinio.co.jp','contact+44@opinio.co.jp')
     and is_test is not true;
  if v_users <> 2 then
    raise exception '中止: 倒す対象の利用者が想定（2件）と違う（実際 %件）', v_users;
  end if;

  select count(*) into v_company from public.ow_companies
   where id = '69c3286a-4425-4cc3-b3f4-ae5866cb74e5' and is_test is not true and source = 'user';
  if v_company <> 1 then
    raise exception '中止: 倒す対象の企業が想定（1件）と違う（実際 %件）', v_company;
  end if;

  -- ★この企業に実ユーザーの職歴がぶら下がっていたら中止（1件でもあれば止める）
  if exists (
    select 1 from public.ow_experiences e join public.ow_users u on u.id = e.user_id
     where e.company_id = '69c3286a-4425-4cc3-b3f4-ae5866cb74e5'
       and u.is_test is not true and u.is_system is not true
       and u.email not in ('contact+43@opinio.co.jp','contact+44@opinio.co.jp')
  ) then
    raise exception '中止: この企業に、倒す2人以外の実ユーザーの職歴がある';
  end if;

  -- ★面談対応者が居たら中止（掲載中の企業ページに出る側）
  if exists (
    select 1 from public.ow_company_members
     where company_id = '69c3286a-4425-4cc3-b3f4-ae5866cb74e5' and is_public = true
  ) then
    raise exception '中止: この企業に掲載中の面談対応者がいる';
  end if;

  select count(*) into v_real_users from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  select count(*) into v_real_with_exp from public.ow_users u
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null
     and exists (select 1 from public.ow_experiences e where e.user_id = u.id);
  select count(*) into v_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  select count(*) into v_picker from public.ow_companies where is_test is not true;

  raise notice '適用前: 実ユーザー % ／ 職歴がある実ユーザー % ／ 掲載中 % ／ ピッカーの母集団 %',
    v_real_users, v_real_with_exp, v_listed, v_picker;

  if v_real_users <> 10 or v_real_with_exp <> 7 or v_listed <> 21 or v_picker <> 100 then
    raise exception '中止: 適用前の数が実測（10 / 7 / 21 / 100）と違う。差分を確認すること';
  end if;
end $$;

-- ② 倒す（★email / id を明示列挙する）
update public.ow_users set is_test = true
 where email in ('contact+43@opinio.co.jp','contact+44@opinio.co.jp');

update public.ow_companies set is_test = true
 where id = '69c3286a-4425-4cc3-b3f4-ae5866cb74e5';

-- ③ 事後チェック：想定どおりに動いたか
do $$
declare
  v_real_users int; v_real_with_exp int; v_listed int; v_picker int; v_left int;
begin
  select count(*) into v_real_users from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  select count(*) into v_real_with_exp from public.ow_users u
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null
     and exists (select 1 from public.ow_experiences e where e.user_id = u.id);
  select count(*) into v_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  select count(*) into v_picker from public.ow_companies where is_test is not true;

  raise notice '適用後: 実ユーザー % ／ 職歴がある実ユーザー % ／ 掲載中 % ／ ピッカーの母集団 %',
    v_real_users, v_real_with_exp, v_listed, v_picker;

  if v_real_users <> 8 or v_real_with_exp <> 5 or v_listed <> 21 or v_picker <> 99 then
    raise exception '中止: 適用後の数が想定（8 / 5 / 21 / 99）と違う（実際 % / % / % / %）',
      v_real_users, v_real_with_exp, v_listed, v_picker;
  end if;

  -- ★取り残しが 0 になっていること（利用者側）
  select count(*) into v_left from public.ow_users
   where email like 'contact+%@opinio.co.jp'
     and is_test is not true and is_system is not true and auth_id is not null;
  if v_left <> 0 then
    raise exception '中止: contact+ の取り残しが %件 残っている', v_left;
  end if;

  raise notice 'OK: 検証用2名と企業1社を is_test にした。取り残し0件';
end $$;

commit;

-- ── 戻し方 ────────────────────────────────────────────────────────────────
-- update public.ow_users set is_test = false
--  where email in ('contact+43@opinio.co.jp','contact+44@opinio.co.jp');
-- update public.ow_companies set is_test = false
--  where id = '69c3286a-4425-4cc3-b3f4-ae5866cb74e5';
