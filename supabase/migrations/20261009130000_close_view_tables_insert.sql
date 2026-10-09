-- ════════════════════════════════════════════════════════════════════════
-- 閲覧の表（ow_page_views / ow_job_views）にクライアントから行を足せないようにする（2026-10-09）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★何が起きていたか
--   どちらの表も INSERT のポリシーが WITH CHECK (true) で、ログインしていれば誰でも任意の行を
--   足せた（ow_page_views は authenticated と anon、ow_job_views は全ロール。anon は GRANT を
--   2026-08-12 に外してあったので実際に書けたのは authenticated）。
--   記録する経路は 2026-07-13〜07-30 に消えており、いま書いている所は1つも無い。
--   ⚠️ 閲覧数を分析に使い始めた瞬間に、水増しできる形だった。
--
-- ★やること
--   ・両表の INSERT のポリシーを落とす
--   ・anon / authenticated から INSERT の権限を外す
--   ⚠️ 読み取り（admin can read page views）は触らない。
--   ⚠️ 記録はサーバー（service_role）からだけ行う（段階 D で作り直す）。
--
-- ⚠️ 作業前ダンプ: .dumps/20261009-1638-ow_page_views-ow_job_views.sql（ポリシー3本・67行を含む）
-- ════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "anyone can insert page views" on public.ow_page_views;
drop policy if exists "anyone can log views" on public.ow_job_views;

revoke insert on public.ow_page_views from anon, authenticated;
revoke insert on public.ow_job_views from anon, authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.ow_page_views', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_job_views', 'INSERT')
     or has_table_privilege('anon', 'public.ow_page_views', 'INSERT')
     or has_table_privilege('anon', 'public.ow_job_views', 'INSERT') then
    raise exception '検算失敗: クライアントのロールに INSERT が残っている';
  end if;
  if exists (select 1 from pg_policy where polrelid in ('public.ow_page_views'::regclass, 'public.ow_job_views'::regclass) and polcmd = 'a') then
    raise exception '検算失敗: INSERT のポリシーが残っている';
  end if;
  if not has_table_privilege('service_role', 'public.ow_page_views', 'INSERT') then
    raise exception '検算失敗（陽性対照）: service_role が書けない';
  end if;
  raise notice '検算OK: 閲覧の表はクライアントから書けない';
end $$;

commit;

-- ★戻すとき（適用前の定義そのまま）:
--   grant insert on public.ow_page_views to authenticated;
--   grant insert on public.ow_job_views to authenticated;
--   create policy "anyone can insert page views" on public.ow_page_views for insert to authenticated, anon with check (true);
--   create policy "anyone can log views" on public.ow_job_views for insert with check (true);
--   ⚠️ anon の INSERT は 2026-08-12（20260812053708）に外してあったので戻さない。
