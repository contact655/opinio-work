-- ★ログインしていない人（anon）から、職歴の「業務内容」と「入社理由の自由記述」を読めなくする（2026-10-18 作成）
--
-- ★20261018020000（公開範囲の初期値を「公開」にする）と同じ日（2026-10-18）に当てる。
--
-- なぜ要るか:
--   RLS ow_experiences_public_read は、公開範囲が「公開」の人の職歴を anon に開く。
--   いまは anon に description / join_reason の SELECT が配られているので、画面では未ログインに
--   出していない（業務内容は DescriptionGate、入社理由は描画を止めてある）のに、PostgREST を直に叩けば読める。
--   これまで「公開」の人は0人だったので表に出なかったが、新規登録の初期値を「公開」にした日から起きる。
--   決めたこと（2026-10-18 / 柴さん）: 未ログインに見せるのはプロフィールまで。業務内容・入社理由はログインしてから。
--
-- ⚠️ 確認済み（2026-10-18）: anon 経路（createPublicClient）で ow_experiences の description / join_reason を
--    select しているコードは0件。/u/[id] の職歴は admin クライアントで引いている（UserProfileContent.tsx）。
--    当てる前にもう一度 grep すること（1列でも入ったクエリは丸ごと 401 になり、呼び出し側では「0件」に化ける）。
--
-- 戻し方: grant select (description, join_reason) on public.ow_experiences to anon;

begin;

revoke select (description, join_reason) on public.ow_experiences from anon;

do $$
begin
  if has_column_privilege('anon', 'public.ow_experiences', 'description', 'SELECT')
     or has_column_privilege('anon', 'public.ow_experiences', 'join_reason', 'SELECT') then
    raise exception 'anon からまだ読める。ロールバック';
  end if;
  -- ログインしている人（authenticated）からは引き続き読めること
  if not has_column_privilege('authenticated', 'public.ow_experiences', 'description', 'SELECT') then
    raise exception 'authenticated から description が読めなくなった。ロールバック';
  end if;
end $$;

commit;
