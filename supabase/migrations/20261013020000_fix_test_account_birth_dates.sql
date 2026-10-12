-- ════════════════════════════════════════════════════════════════════════
-- 検証用アカウント3件の生年月日を、15〜100歳の範囲に直す（2026-10-13 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
-- 2026-10-13 に生年月日を 15〜100歳に限った（lib/age.ts）。それより前に入った検証用の3件が
-- 2017〜2018年生まれ（8〜9歳）のままで、Third Box（検証用の会社）の候補者一覧に「8歳」と出ていた。
-- 月日はそのままにして、年だけを社会人年数と矛盾しない値にする（推測値の投入ではなく、検証用データの修正）。
--
--   contact+33 テスト 太郎   2017-07-11 → 1999-07-11（社会人5年）
--   contact+34 問 合せ対応   2018-04-04 → 1998-04-04（社会人4年）
--   contact+35 五十嵐 健二   2018-10-10 → 1992-10-10（社会人9年）
--
-- ⚠️ email を明示列挙し、is_test = true の行だけを書き換える（実在の利用者は1件も触らない）。
-- ⚠️ 範囲外の生年月日は 2026-10-13 時点でこの3件だけ（実在の利用者は0件）。適用前に SQL で確認済み。
-- 作業前のダンプ: .dumps/20261013-0143-ow_users.sql
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$ declare n int; begin
  select count(*) into n from public.ow_users
   where is_test = true and (
     (email = 'contact+33@opinio.co.jp' and birth_date = '2017-07-11') or
     (email = 'contact+34@opinio.co.jp' and birth_date = '2018-04-04') or
     (email = 'contact+35@opinio.co.jp' and birth_date = '2018-10-10'));
  if n <> 3 then raise exception '中止: 対象が想定（3件）と違う: % 件', n; end if;
end $$;

update public.ow_users set birth_date = '1999-07-11' where email = 'contact+33@opinio.co.jp' and is_test = true and birth_date = '2017-07-11';
update public.ow_users set birth_date = '1998-04-04' where email = 'contact+34@opinio.co.jp' and is_test = true and birth_date = '2018-04-04';
update public.ow_users set birth_date = '1992-10-10' where email = 'contact+35@opinio.co.jp' and is_test = true and birth_date = '2018-10-10';

do $$ begin
  if exists (select 1 from public.ow_users where birth_date is not null
              and (age(birth_date) < interval '15 years' or age(birth_date) > interval '100 years')) then
    raise exception '検算失敗: 15〜100歳の範囲外の生年月日が残っている';
  end if;
end $$;

commit;
