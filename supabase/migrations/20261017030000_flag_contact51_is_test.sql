-- ★検証用アカウント contact+51 の is_test を立てる（2026-10-17）
--
-- 取り残し: contact+51@opinio.co.jp（ow_users.id = e456c329-8342-48b6-9f59-d17fa48232fc、2026-10-15 作成）が
-- is_test = false のまま、実ユーザーとして数えられていた（CLAUDE.md「contact+NN が is_test のまま残らず増える」の5回目）。
--
-- 事前に測ったこと（2026-10-17・読み取りのみ）:
--   職歴 1件（自由入力の会社「株式会社IIDA」・現職。掲載企業ではない）／ 旧形式の理由 1件
--   作成した企業 0 ／ 企業の担当者 0 ／ 投稿 0 ／ フォロー 0 ／ 提案 0 ／ 会話 0 ／ 通知 0 ／ ブックマーク 0 ／ あなたに合う会社の反応 0
--   ⇒ 掲載中の企業ページに出ていない。変わるのは /people の一覧（先頭にいた「鈴木 太一」が消える）と人数の数え方だけ。
--
-- ⚠️ 行は消さない（ow_users を指す FK の多くが CASCADE）。is_test を立てるだけ。
-- ⚠️ email を明示する。パターン（contact+5%）で倒さない。
-- 作業前ダンプ: .dumps/20261017-0309-ow_users.sql
-- 戻し方: update public.ow_users set is_test = false where email = 'contact+51@opinio.co.jp';

do $$
declare
  v_before int;
  v_after int;
  v_hit int;
begin
  select count(*) into v_before from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;

  update public.ow_users
     set is_test = true
   where email = 'contact+51@opinio.co.jp'
     and id = 'e456c329-8342-48b6-9f59-d17fa48232fc'
     and is_test is not true;
  get diagnostics v_hit = row_count;
  if v_hit <> 1 then
    raise exception '想定外: 対象が % 行（1行のはず）', v_hit;
  end if;

  select count(*) into v_after from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  if v_after <> v_before - 1 then
    raise exception '想定外: 実ユーザー % → %（1減るはず）', v_before, v_after;
  end if;

  raise notice '実ユーザー % → %', v_before, v_after;
end $$;
