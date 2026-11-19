-- ════════════════════════════════════════════════════════════════════════
-- 検証で入った申告の採用中の1行を消す（2026-11-19 / 柴さんの了承）
--   20261119090000 の画面確認で、検証用アカウント contact+43（相澤 太郎・is_test）が
--   株式会社テスト（69c3286a-4425-4cc3-b3f4-ae5866cb74e5・is_test）で採用中にし、
--   担当者 contact+44 が外した。その1行を消して作業前（ow_self_hiring 0行）に戻す。
--
-- 作業前ダンプ: .dumps/20261119-1851-ow_self_hiring.sql（1行）
-- 戻し方: 戻す必要は無い（検証の行）。必要ならダンプから入れ直す。
-- ════════════════════════════════════════════════════════════════════════
begin;

do $$
declare n int;
begin
  -- 想定: 表はこの1行だけ・持ち主は検証用アカウント
  if (select count(*) from public.ow_self_hiring) <> 1 then
    raise exception 'ow_self_hiring が1行でない（想定外）。中止';
  end if;
  delete from public.ow_self_hiring s
   using public.ow_users u
   where u.id = s.user_id
     and u.email = 'contact+43@opinio.co.jp' and u.is_test = true
     and s.company_id = '69c3286a-4425-4cc3-b3f4-ae5866cb74e5';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '消えた行が % 行（1行のはず）。中止', n;
  end if;
  if (select count(*) from public.ow_self_hiring) <> 0 then
    raise exception 'ow_self_hiring が0行に戻っていない。中止';
  end if;
end $$;

commit;
