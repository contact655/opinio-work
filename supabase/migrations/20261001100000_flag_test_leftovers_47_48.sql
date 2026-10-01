-- 検証用アカウント2件と、そのアカウントが作った企業1社に is_test を立てる（2026-10-01）
--
-- ⚠️★**同じ取り残しの5回目**（2026-09-14 / 09-17 / 09-28 / 09-29 / 本日）。
--    CLAUDE.md「`contact+NN@opinio.co.jp` が `is_test` のまま残らず増える」を読むこと。
--    `/admin` の要対応タスクと日次 cron が既に検知していた。**検査は効いている。**
--    足りないのは「倒す操作」だけなので、**検査式を触らないこと。**
--
-- ⚠️★**行を消さない。`is_test` を立てるだけ**（`ow_users` を指す FK 45列のうち29列が CASCADE）。
-- ⚠️★**email / id を明示列挙する。** `like 'contact+4%'` のようなパターンで倒さない
--    （将来 `contact+4x` が実在の用途で使われたときに巻き込む）。

-- ── ① 人（2件）────────────────────────────────────────────────────────────
do $$
declare
  件数 int;
begin
  select count(*) into 件数 from public.ow_users
   where email in ('contact+47@opinio.co.jp','contact+48@opinio.co.jp')
     and is_test is not true;
  if 件数 <> 2 then
    raise exception '倒す対象の人が 2 件のはずが % 件。中止する', 件数;
  end if;
end $$;

update public.ow_users
   set is_test = true
 where email in ('contact+47@opinio.co.jp','contact+48@opinio.co.jp');

-- ── ② 企業（1社）───────────────────────────────────────────────────────────
-- `zap`（2026-10-01 08:09 作成 / `source='user'` / 作成者 contact+47）。
-- ⚠️★**id で名指しする。**「作成者が is_test の企業をまとめて倒す」形にしない
--    （検証用アカウントが実在の企業を登録した場合に巻き込む。2026-09-28 の前例）。
-- ⚠️ 同名の `zap` / `株式会社ZAP` が**既に2社**あり、どちらも 2026-09-19 / 09-30 に
--    `is_test = true` にしてある。これは**3つ目**で、同じ経緯のもの。
-- ⚠️★この1社だけ `is_published = true`（＝企業ページが生きていた）。
--    倒すまで、そのページに contact+48 が**現役社員として出ていた。**
do $$
declare
  s text; t boolean; pub boolean;
begin
  select source, is_test, is_published into s, t, pub
    from public.ow_companies where id = '1b6b3e1e-5194-4bc2-b420-5047501adabb';
  if s is null then raise exception '対象の企業が見つからない'; end if;
  if s <> 'user' then raise exception 'source が user ではない（%）。中止する', s; end if;
  if t is true then raise exception '既に is_test が立っている。中止する'; end if;
  if pub is not true then raise exception 'is_published が true ではない。別の行を指している可能性'; end if;
end $$;

update public.ow_companies
   set is_test = true
 where id = '1b6b3e1e-5194-4bc2-b420-5047501adabb';

-- ── ③ 検算 ────────────────────────────────────────────────────────────────
-- 事前の実測（2026-10-01）:
--   実ユーザー 28 / 職歴がある実ユーザー 20 / 対象の職歴 1 /
--   面談対応者 0 / 企業管理者 0 / 投稿 0
do $$
declare
  実ユーザー int; 職歴あり int; 残り人 int; 残り社 int;
begin
  select count(*) into 実ユーザー from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  if 実ユーザー <> 26 then
    raise exception '実ユーザーが 26 のはずが %。想定と違うので中止する', 実ユーザー;
  end if;

  select count(distinct e.user_id) into 職歴あり
    from public.ow_experiences e join public.ow_users u on u.id = e.user_id
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  if 職歴あり <> 19 then
    raise exception '職歴がある実ユーザーが 19 のはずが %。中止する', 職歴あり;
  end if;

  -- ★取り残しが0になっていること（CLAUDE.md の検査式と同じもの）
  select count(*) into 残り人 from public.ow_users
   where email like 'contact+%@opinio.co.jp'
     and is_test is not true and is_system is not true and auth_id is not null;
  if 残り人 <> 0 then
    raise exception 'contact+ の取り残しが % 件残っている', 残り人;
  end if;

  select count(*) into 残り社
    from public.ow_companies c
    join public.ow_company_creations cr on cr.company_id = c.id
    join public.ow_users u on u.id = cr.created_by_ow_user_id
   where c.is_test is not true and u.is_test = true
     and c.source in ('biz_self','user');
  if 残り社 <> 0 then
    raise exception '検証用アカウントが作った企業の取り残しが % 社残っている', 残り社;
  end if;
end $$;
