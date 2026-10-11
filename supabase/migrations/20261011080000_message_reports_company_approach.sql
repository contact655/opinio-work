-- ════════════════════════════════════════════════════════════════════════
-- 企業から届いた最初のメッセージも「運営に報告」できるようにする（2026-10-11 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- 「メッセージリクエスト」を「メッセージ」にまとめた（段階2）。求職者が企業からの最初のメッセージを開くと、
-- 個人からのものと同じく「ブロック」「運営に報告」がある。報告の記録は ow_message_reports に入れる。
--
-- ⚠️ 列を足すだけ（追加のみ。既存の行・権限・ポリシーは触らない）。2列とも NULL 可。
--    approach_id          … どの最初のメッセージか（ow_company_approaches.id）
--    reported_company_id  … 報告された企業
-- ⚠️ この表は admin だけが読み書きする（anon / authenticated に GRANT なし・RLS 有効・ポリシー0本）。GRANT は足さない。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_message_reports
  add column if not exists approach_id uuid references public.ow_company_approaches(id) on delete set null,
  add column if not exists reported_company_id uuid references public.ow_companies(id) on delete set null;

comment on column public.ow_message_reports.approach_id is
  '企業から届いた最初のメッセージを報告したとき、その ow_company_approaches.id（2026-10-11）。個人からのものは null。';
comment on column public.ow_message_reports.reported_company_id is
  '企業から届いた最初のメッセージを報告したとき、その企業（2026-10-11）。個人からのものは null。';

do $$
begin
  if has_table_privilege('anon', 'public.ow_message_reports', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_message_reports', 'SELECT') then
    raise exception '想定外: ow_message_reports に anon / authenticated の権限がある（中止）';
  end if;
end $$;

commit;
