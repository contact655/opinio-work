-- ★検証のため、検証用アカウント contact+08（is_test）の公開範囲を一時的に「公開」にする（2026-10-18 / 柴さんの指示）
--
-- 目的: 2026-10-18 の改定（「公開」の人の /u/[id] は未ログインでも開ける）を本番で確かめる。実在の利用者を「公開」にして
--       確かめることはしない（CLAUDE.md「本番の実在データの状態を、検証のために変えない」）。
-- 対象: ow_users.id = 3009cf69-9761-46d5-ac79-75e8438c21b2（contact+08@opinio.co.jp / is_test = true）の1行だけ。
-- 作業前の値（2026-10-18 実測）: visibility = 'login_only' ／ updated_at = 2026-08-19 18:07:46.51+00
-- 戻し方: 20261018030100_contact08_visibility_restore.sql（確かめ終わったら当てる）
-- ⚠️ is_test なので、企業ページの社員の欄・/people・検索エンジン（noindex）には出ない。

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_users
   where id = '3009cf69-9761-46d5-ac79-75e8438c21b2'
     and email = 'contact+08@opinio.co.jp' and is_test = true and visibility = 'login_only';
  if n <> 1 then raise exception '対象が想定と違う（% 行）。中止する', n; end if;
end $$;

update public.ow_users set visibility = 'public'
 where id = '3009cf69-9761-46d5-ac79-75e8438c21b2' and email = 'contact+08@opinio.co.jp' and is_test = true;

do $$
begin
  if (select count(*) from public.ow_users where visibility = 'public') <> 1 then
    raise exception '「公開」の行が1行ではない。ロールバック';
  end if;
end $$;

commit;
