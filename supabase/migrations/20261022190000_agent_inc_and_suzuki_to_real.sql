-- ════════════════════════════════════════════════════════════════════════
-- 株式会社エージェントと鈴木 太郎さんを、検証用から実在に戻す（2026-10-22 / 柴さんの指示・1案）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★きっかけ: 鈴木さん（株式会社エージェントの担当者）から、実在の利用者（大塚悠貴さん）に
--    メッセージを送れなかった。人も会社も is_test だったため（検証用と実在のあいだは送れない）。
--    ★柴さんの確認: d1872303951587@gmail.com は検証用ではない（archive/278 で誤って倒していた）。
--
-- ★前提（この migration の前に済ませる）:
--    node scripts/demo-agent.mjs destroy   … デモのデータ（求人8・声かけ16・紹介10・会話15 ほか）を消し、
--                                           会社のプロフィールをデモ前に戻す。
--    ⚠️ 先に destroy を流すこと。この migration の後では destroy のガード（会社と担当者が is_test）で止まる。
--    ⚠️ 下のガードは、デモのデータが残っていたら中止する。
--
-- 作業前の控え（.dumps/）:
--    20261022-1835-ow_users-ow_companies-ow_company_admins-ow_jobs-ow_company_approaches.sql
--    20261022-1835-ow_proposals-ow_conversations-ow_meetings-ow_notifications-ow_company_posts.sql
--    20261022-1835-ow_company_tools-ow_company_departments-ow_company_job_roles-ow_company_job_role_departments-ow_saved_candidate_searches.sql
--
-- 戻し方:
--    update ow_users     set is_test = true where id = 'a02ee744-728c-4e46-9bea-98d1311e5726';
--    update ow_companies set is_test = true where id = '7a048a8e-2c44-4f09-a727-8d7e6350851c';
--
-- 変わること:
--    ・鈴木さんは実在の利用者として数えられる（職歴・投稿は0件）。/people にログイン中の人から見える
--    ・株式会社エージェントの企業ページが開けるようになる（listing_status='draft' のままなので一覧・sitemap には出ない）
--    ⚠️ hshiba@opinio.co.jp（検証用）は担当者のまま残る。セールスフォースの検証用担当者と同じ形
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  -- デモのデータが残っていないこと（destroy 済みであること）
  if exists (select 1 from ow_jobs where company_id = '7a048a8e-2c44-4f09-a727-8d7e6350851c')
     or exists (select 1 from ow_company_approaches where company_id = '7a048a8e-2c44-4f09-a727-8d7e6350851c')
     or exists (select 1 from ow_proposals where company_id = '7a048a8e-2c44-4f09-a727-8d7e6350851c')
     or exists (select 1 from ow_conversations where company_id = '7a048a8e-2c44-4f09-a727-8d7e6350851c') then
    raise exception '中止: デモのデータが残っている（先に node scripts/demo-agent.mjs destroy を流す）';
  end if;

  update public.ow_users set is_test = false
   where id = 'a02ee744-728c-4e46-9bea-98d1311e5726' and email = 'd1872303951587@gmail.com' and is_test = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '想定外: 鈴木さんの更新が % 行', n; end if;

  update public.ow_companies set is_test = false
   where id = '7a048a8e-2c44-4f09-a727-8d7e6350851c' and name = '株式会社エージェント' and is_test = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '想定外: エージェントの更新が % 行', n; end if;
end $$;

commit;
