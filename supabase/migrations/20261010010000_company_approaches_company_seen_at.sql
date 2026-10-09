-- ════════════════════════════════════════════════════════════════════════
-- 声かけ: 承認されたあと企業が会話を開いた日時（2026-10-10）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★足すだけ（古いコードのままでも壊れない）。
--
-- ★何のための列か
--   /biz サイドバーの「声かけ」に「承認されて、まだ企業が会話を開いていない件数」を出す。
--   accepted_at があり company_seen_at が null のものを数え、企業の担当者の誰かが
--   /biz/conversations/[id]（その声かけで開いた会話）を開いたら立てる。
--   ⚠️ 見送られた声かけには立たない（accepted_at が null なので数えない。企業から見て承認待ちのまま）。
--   ⚠️ 担当者ごとの既読ではなく「企業として開いたか」（誰か1人が開けば消える）。
--      担当者ごとの未読は「メッセージ」のバッジ（ow_conversation_participants.last_read_at）が持つ。
--
-- ⚠️ 表は運営だけが読める形のまま（RLS ポリシー0本・クライアントに GRANT 無し）。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_company_approaches
  add column if not exists company_seen_at timestamptz;

comment on column public.ow_company_approaches.company_seen_at is
  '承認されたあと、企業の担当者が会話を初めて開いた日時（2026-10-10）。/biz サイドバーの「声かけ」の数字は accepted_at があり、これが null のもの。';

do $$
begin
  if has_column_privilege('authenticated', 'public.ow_company_approaches', 'company_seen_at', 'SELECT') then
    raise exception '検算失敗: クライアントから読める';
  end if;
  raise notice '検算OK: company_seen_at を足した';
end $$;

commit;

-- ★戻すとき:
--   alter table public.ow_company_approaches drop column company_seen_at;
