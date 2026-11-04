-- 検証用アカウントが作った企業「株式会社IIDA」を is_test にする（2026-11-04）
--
-- ⚠️★まだ本番に当てていない。柴さんの了承を得てから supabase/migrations/ へ移して当てる（supabase/pending/README.md）。
--
-- ── 見つけた経緯 ──────────────────────────────────────────────────────────
-- 日次の check-test-leftovers（2026-11-03 21:00 UTC）が「1件 / 株式会社IIDA」を出した。
-- 判定は lib/admin/testLeftovers.ts（作成者が is_test・企業が is_test でない・source が biz_self / user）。
--
-- ── 倒すもの（★id を明示列挙する。まとめて倒さない）──────────────────────
--   株式会社IIDA 4fad74d7-8271-4c30-a10c-f70dd4dddc5a
--     source='biz_self' ／ 2026-10-18 作成 ／ 作成者・唯一の担当者は contact+51@opinio.co.jp（is_test）
--     listing_status='draft'（一覧には出ていない）／ is_published=true（ページは開ける・職歴の企業ピッカーに出る）
--
-- ⚠️★「作成者が is_test の企業をまとめて倒す」形にしないこと。検証用アカウントが実在の企業を
--    登録した場合に巻き込む（CLAUDE.md）。この1社だけを名指しする。
-- ⚠️★行を消さない。is_test を立てるだけ。
--
-- ── 実測（2026-11-04 / 適用前）──────────────────────────────────────────
--   この企業の職歴 0件（実ユーザー 0）／ 求人 0件 ／ 面談対応者 0件 ／ 担当者 1（contact+51・is_test）
--   職歴の企業ピッカーの母集団（is_test でない企業）119 ／ 掲載中 22 ／ 企業側の取り残し 1
--   → 適用後の想定: 母集団 118 ／ 掲載中 22（変わらない）／ 取り残し 0
--
-- ── 動くトリガー ─────────────────────────────────────────────────────────
--   trg_ow_companies_propagate_is_test … 求人へ is_test を写す（求人0件なので何も変わらない）
--   trg_guard_company_approval … is_test を見ていない（本文を確認済み）。公開の状態は触らないので止まらない
--
-- ── 直近に同じ列を触った migration ──────────────────────────────────────
--   20260929020000（株式会社テスト 69c3286a…）／ 20260928043000 ／ 20260928015000（ZAP ほか4社）。
--   いずれも別の id を名指ししており、打ち消していない。
--
-- ── 作業前ダンプ ─────────────────────────────────────────────────────────
--   .dumps/20261104-1702-ow_companies.sql（133行・この企業の行を含む。コミットしない）
--
-- ⚠️ データだけの migration なので、当てたあとコミット・push してデプロイを走らせる（企業ページは ISR）。

begin;

-- ① 事前チェック：想定どおりの状態か
do $$
declare
  v_target int; v_picker int; v_listed int; v_left int;
begin
  select count(*) into v_target from public.ow_companies
   where id = '4fad74d7-8271-4c30-a10c-f70dd4dddc5a'
     and name = '株式会社IIDA' and is_test is not true and source = 'biz_self';
  if v_target <> 1 then
    raise exception '中止: 倒す対象の企業が想定（1件）と違う（実際 %件）', v_target;
  end if;

  -- ★作成者が検証用であること（違えば実在の利用者が作った企業なので止める）
  if not exists (
    select 1 from public.ow_company_creations cr join public.ow_users u on u.id = cr.created_by_ow_user_id
     where cr.company_id = '4fad74d7-8271-4c30-a10c-f70dd4dddc5a'
       and u.email = 'contact+51@opinio.co.jp' and u.is_test = true
  ) then
    raise exception '中止: 作成者が contact+51（is_test）ではない';
  end if;

  -- ★実ユーザーの職歴・求人・面談対応者が1件でもあれば止める
  if exists (
    select 1 from public.ow_experiences e join public.ow_users u on u.id = e.user_id
     where e.company_id = '4fad74d7-8271-4c30-a10c-f70dd4dddc5a' and u.is_test is not true
  ) then
    raise exception '中止: この企業に実ユーザーの職歴がある';
  end if;
  if exists (select 1 from public.ow_jobs where company_id = '4fad74d7-8271-4c30-a10c-f70dd4dddc5a') then
    raise exception '中止: この企業に求人がある';
  end if;
  if exists (select 1 from public.ow_company_members where company_id = '4fad74d7-8271-4c30-a10c-f70dd4dddc5a') then
    raise exception '中止: この企業に面談対応者の行がある';
  end if;

  select count(*) into v_picker from public.ow_companies where is_test is not true;
  select count(*) into v_listed from public.ow_companies where listing_status = 'listed' and is_test is not true;
  select count(*) into v_left from public.ow_companies c
    join public.ow_company_creations cr on cr.company_id = c.id
    join public.ow_users u on u.id = cr.created_by_ow_user_id
   where c.is_test is not true and u.is_test = true and c.source in ('biz_self','user');

  raise notice '適用前: ピッカーの母集団 % ／ 掲載中 % ／ 企業側の取り残し %', v_picker, v_listed, v_left;
  if v_picker <> 119 or v_listed <> 22 or v_left <> 1 then
    raise exception '中止: 適用前の数が実測（119 / 22 / 1）と違う。差分を確認すること';
  end if;
end $$;

-- ② 倒す（★id を明示列挙する）
update public.ow_companies set is_test = true
 where id = '4fad74d7-8271-4c30-a10c-f70dd4dddc5a';

-- ③ 事後チェック
do $$
declare
  v_picker int; v_listed int; v_left int;
begin
  select count(*) into v_picker from public.ow_companies where is_test is not true;
  select count(*) into v_listed from public.ow_companies where listing_status = 'listed' and is_test is not true;
  select count(*) into v_left from public.ow_companies c
    join public.ow_company_creations cr on cr.company_id = c.id
    join public.ow_users u on u.id = cr.created_by_ow_user_id
   where c.is_test is not true and u.is_test = true and c.source in ('biz_self','user');

  raise notice '適用後: ピッカーの母集団 % ／ 掲載中 % ／ 企業側の取り残し %', v_picker, v_listed, v_left;
  if v_picker <> 118 or v_listed <> 22 or v_left <> 0 then
    raise exception '中止: 適用後の数が想定（118 / 22 / 0）と違う（実際 % / % / %）', v_picker, v_listed, v_left;
  end if;
  raise notice 'OK: 株式会社IIDA を is_test にした。企業側の取り残し 0件';
end $$;

commit;

-- ── 戻し方 ────────────────────────────────────────────────────────────────
-- update public.ow_companies set is_test = false
--  where id = '4fad74d7-8271-4c30-a10c-f70dd4dddc5a';
