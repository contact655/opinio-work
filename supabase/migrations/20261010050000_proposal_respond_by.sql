-- ════════════════════════════════════════════════════════════════════════
-- 提案の締め切り：届いてから30日（2026-10-10 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★respond_by を過ぎて、両方の回答がそろっていない提案は「終了」（見送りと同じ「この提案は終了しました」。
--   どちらが答えなかったかは出さない）。判定は表示するとき（lib/evidence/proposalEnded.ts の
--   isProposalEndedFor）。定期実行では動かさない（状態の列を持たないので、書き換える処理が要らない）。
-- ★今ある提案は「反映した日から30日」。ADD COLUMN の既定値 now() は適用した時点で各行に入るので、
--   作られた日から数えて反映した日にいきなり終了する提案は出ない。新しい行は作られた時点から30日。
-- ⚠️ 2026-10-10 時点で ow_proposals は 0 行。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_proposals
  add column if not exists respond_by timestamptz not null default (now() + interval '30 days');

comment on column public.ow_proposals.respond_by is
  '回答の締め切り（2026-10-10）。届いてから30日。過ぎて両方の回答がそろっていなければ終了（表示時に判定）。既存行は反映した日から30日。';

do $$
declare n int;
begin
  select count(*) into n from public.ow_proposals where respond_by < now() + interval '29 days';
  if n > 0 then raise exception '検算失敗: 締め切りが30日より近い既存の提案がある (%)', n; end if;
  raise notice '検算OK: 既存の提案 % 件に、反映した日から30日の締め切りを入れた', (select count(*) from public.ow_proposals);
end $$;

commit;
