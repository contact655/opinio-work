-- is_test を立て忘れていた検証用アカウント1件と、その企業1社を倒す（2026-09-30）
--
-- ── これで5回目 ──────────────────────────────────────────────────────────
-- 2026-09-14（contact+28〜+32）／ 09-17（contact+33・+34）／ 09-28（contact+35〜+39）
-- ／ 09-29（contact+43・+44）に続いて5回目。
-- ⚠️★**取り残しは別々に起きる。** 前回の数字が合わない理由を「直近の取り残しのせい」と
--    決めつけないこと（CLAUDE.md）。
--
-- ⚠️★**検知は効いていた。** `/admin` の要対応タスクと日次 cron
--    （`/api/cron/check-test-leftovers`）が拾う条件にちょうど当たっている。
--    **仕組みではなく、倒す操作がされていなかっただけ。** 検査式を触らないこと。
--
-- ⚠️ 企業側の検査は**作成者が既に `is_test` であること**を条件にしているので、
--    人を倒すまで zap を拾えない ＝ 2段階になる。
--    **同じ migration で両方倒すので、適用後は 0件 に戻る。**
--    ★この2段階を避けるためにメールの綴りを検査式へ持ち込まないこと
--      （実在の利用者を巻き込む。CLAUDE.md「`source` の条件を外すと実在企業を拾う」）。
--
-- ── 倒すもの（★email / id を明示列挙する。まとめて倒さない）───────────────
--   contact+45@opinio.co.jp  3742d051-e7d3-4ec5-875c-93b8ad07c515（2026-09-30 08:42 作成）
--   zap                      2cb20fea-01e9-4647-85c0-a46aa3a4477e（`source='user'` / 09-30 08:43）
--
-- ⚠️★**「zap」は 株式会社ZAP（b9a3b7e2… / 09-19 作成）とは別の行。**
--    あちらは `20260928015000` で既に倒してある。**同じ検証で2社目が作られた形**で、
--    CLAUDE.md「リロードで消える → もう1社作った」（オンボーディング2画面目④）と同種。
--    **id で名指しするので取り違えない。**
--
-- ⚠️★**行を消さない。`is_test` を立てるだけ。** `ow_users` を参照する FK 45列のうち
--    29列が ON DELETE CASCADE（CLAUDE.md）。
--
-- ── 実測（2026-09-30 / 適用前）──────────────────────────────────────────
--   contact+45 にぶら下がるもの: 職歴1 ／ 面談対応者1 ／ 企業の管理者1 ／ 作った企業1。
--   **4件とも相手は zap 1社だけ**で、実在企業のページには一切出ていない。
--   zap にぶら下がる行の持ち主は**全員 contact+45**（実ユーザー0人・求人0件）。
--   ＝ **「1人倒す」＝「1人ぶん画面が変わる」ではない。** 掲載中21社は変わらない。
--
--   ⚠️ 面談対応者の行は `is_public = true` だが、**zap が
--      `listing_status='draft'` かつ `is_published=false`** なので企業ページに出ない。
--      したがって「掲載中の面談対応者 4名」は**前後で変わらない**（下で検算する）。
--      ⚠️ `/admin/ambassador-requests` には引き続き出る（あの画面は `is_test` を隠さず
--         「検証用アカウント」とラベルを付けて区別だけ示す。CLAUDE.md）。
--
-- ── 直近に同じ列を触った migration ──────────────────────────────────────
--   `20260929020000`（contact+43・+44 と 株式会社テスト）／
--   `20260928043000`（株式会社テスト）／ `20260928015000`（検証用が作った企業4社。
--   **株式会社ZAP はここ**）／ `20260928013000`（contact+35〜+39）。
--   **いずれも別の id / email を名指ししており、打ち消していない。**

begin;

-- ① 事前チェック：想定どおりの状態か
do $$
declare
  v_user int; v_company int;
  v_real_users int; v_real_with_exp int; v_listed int; v_picker int; v_amb int;
begin
  select count(*) into v_user from public.ow_users
   where email = 'contact+45@opinio.co.jp'
     and id = '3742d051-e7d3-4ec5-875c-93b8ad07c515'
     and is_test is not true;
  if v_user <> 1 then
    raise exception '中止: 倒す対象の利用者が想定（1件）と違う（実際 %件）', v_user;
  end if;

  select count(*) into v_company from public.ow_companies
   where id = '2cb20fea-01e9-4647-85c0-a46aa3a4477e' and is_test is not true and source = 'user';
  if v_company <> 1 then
    raise exception '中止: 倒す対象の企業が想定（1件）と違う（実際 %件）', v_company;
  end if;

  -- ★この企業に contact+45 以外の実ユーザーの職歴がぶら下がっていたら中止
  if exists (
    select 1 from public.ow_experiences e join public.ow_users u on u.id = e.user_id
     where e.company_id = '2cb20fea-01e9-4647-85c0-a46aa3a4477e'
       and u.is_test is not true and u.is_system is not true
       and u.email <> 'contact+45@opinio.co.jp'
  ) then
    raise exception '中止: この企業に、倒す1人以外の実ユーザーの職歴がある';
  end if;

  -- ★contact+45 以外の面談対応者が居たら中止
  --   ⚠️ 09-29 の前例は「面談対応者が1人でも居たら中止」だったが、ここは
  --      **本人の行が1件ある**ので持ち主で見る。企業が掲載中でないことは下で確かめる。
  if exists (
    select 1 from public.ow_company_members m join public.ow_users u on u.id = m.user_id
     where m.company_id = '2cb20fea-01e9-4647-85c0-a46aa3a4477e'
       and u.email <> 'contact+45@opinio.co.jp'
  ) then
    raise exception '中止: この企業に、倒す1人以外の面談対応者がいる';
  end if;

  -- ★この企業が掲載中なら中止（求職者に見えている企業を黙って消さない）
  if exists (
    select 1 from public.ow_companies
     where id = '2cb20fea-01e9-4647-85c0-a46aa3a4477e'
       and (listing_status = 'listed' or is_published = true)
  ) then
    raise exception '中止: この企業は掲載中またはページ公開中。倒す前に判断が要る';
  end if;

  select count(*) into v_real_users from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  select count(*) into v_real_with_exp from public.ow_users u
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null
     and exists (select 1 from public.ow_experiences e where e.user_id = u.id);
  select count(*) into v_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  select count(*) into v_picker from public.ow_companies where is_test is not true;
  select count(*) into v_amb from public.ow_company_members m
    join public.ow_companies c on c.id = m.company_id
   where m.is_public and m.display_consent and c.listing_status = 'listed' and c.is_published;

  raise notice '適用前: 実ユーザー % ／ 職歴がある実ユーザー % ／ 掲載中 % ／ ピッカーの母集団 % ／ 掲載中の面談対応者 %',
    v_real_users, v_real_with_exp, v_listed, v_picker, v_amb;

  if v_real_users <> 13 or v_real_with_exp <> 9 or v_listed <> 21 or v_picker <> 100 or v_amb <> 4 then
    raise exception '中止: 適用前の数が実測（13 / 9 / 21 / 100 / 4）と違う。差分を確認すること';
  end if;
end $$;

-- ② 倒す（★email / id を明示列挙する）
update public.ow_users set is_test = true
 where id = '3742d051-e7d3-4ec5-875c-93b8ad07c515';

update public.ow_companies set is_test = true
 where id = '2cb20fea-01e9-4647-85c0-a46aa3a4477e';

-- ③ 事後チェック：想定どおりに動いたか
do $$
declare
  v_real_users int; v_real_with_exp int; v_listed int; v_picker int; v_amb int;
  v_left_users int; v_left_companies int;
begin
  select count(*) into v_real_users from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  select count(*) into v_real_with_exp from public.ow_users u
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null
     and exists (select 1 from public.ow_experiences e where e.user_id = u.id);
  select count(*) into v_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  select count(*) into v_picker from public.ow_companies where is_test is not true;
  select count(*) into v_amb from public.ow_company_members m
    join public.ow_companies c on c.id = m.company_id
   where m.is_public and m.display_consent and c.listing_status = 'listed' and c.is_published;

  raise notice '適用後: 実ユーザー % ／ 職歴がある実ユーザー % ／ 掲載中 % ／ ピッカーの母集団 % ／ 掲載中の面談対応者 %',
    v_real_users, v_real_with_exp, v_listed, v_picker, v_amb;

  if v_real_users <> 12 or v_real_with_exp <> 8 or v_listed <> 21 or v_picker <> 99 or v_amb <> 4 then
    raise exception '中止: 適用後の数が想定（12 / 8 / 21 / 99 / 4）と違う（実際 % / % / % / % / %）',
      v_real_users, v_real_with_exp, v_listed, v_picker, v_amb;
  end if;

  -- ★取り残しが 0 になっていること（`lib/admin/testLeftovers.ts` と同じ条件）
  select count(*) into v_left_users from public.ow_users
   where email like 'contact+%@opinio.co.jp'
     and is_test is not true and is_system is not true and auth_id is not null;
  if v_left_users <> 0 then
    raise exception '中止: contact+ の取り残しが %件 残っている', v_left_users;
  end if;

  select count(*) into v_left_companies from public.ow_companies c
    join public.ow_company_creations cr on cr.company_id = c.id
    join public.ow_users u on u.id = cr.created_by_ow_user_id
   where c.is_test is not true and u.is_test = true and c.source in ('biz_self','user');
  if v_left_companies <> 0 then
    raise exception '中止: 検証用アカウントが作った企業の取り残しが %件 残っている', v_left_companies;
  end if;

  raise notice 'OK: 検証用1名と企業1社を is_test にした。取り残し0件';
end $$;

commit;

-- ── 戻し方 ────────────────────────────────────────────────────────────────
-- update public.ow_users set is_test = false
--  where id = '3742d051-e7d3-4ec5-875c-93b8ad07c515';
-- update public.ow_companies set is_test = false
--  where id = '2cb20fea-01e9-4647-85c0-a46aa3a4477e';
