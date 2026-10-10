-- ════════════════════════════════════════════════════════════════════════
-- 社内メモは、担当者が消したらその場で行ごと消す（2026-10-10 / 柴さんの判断）
-- ════════════════════════════════════════════════════════════════════════
--
-- それまでは「消す」で deleted_at を立てるだけ（論理削除）で、行は退会・ブロック・
-- 企業の利用終了から30日後のどれかまで残っていた。画面からは消えるのに中身が残る形で、
-- 開示の請求や「消した」という説明と食い違うため、アプリ側を DELETE に変えた
-- （src/lib/candidateNotes/server.ts の deleteCandidateNote）。
--
-- この migration は使い手がいなくなった deleted_at 列を落とす。
-- ⚠️ 削除を含むので、DELETE に変えたコードのデプロイ後に当てる（古いコードは .is("deleted_at", null) で読む）。
--    本番はフラグ（CANDIDATE_NOTES_ENABLED）でオフなので、いずれにしても API は 404 を返す。
-- ⚠️ 適用前の実測（2026-10-10）: 行 0 ／ deleted_at あり 0。消える中身は無い。
--    ダンプ: .dumps/ の ow_candidate_notes（作業前）
-- ⚠️ 消したことの記録（誰がいつ消したか）は残さない判断（柴さんの任せ → 残さない）。
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_candidate_notes where deleted_at is not null;
  if n > 0 then
    -- 論理削除済みの行は、本来その場で消えているべきだったもの。先に消す
    delete from public.ow_candidate_notes where deleted_at is not null;
    raise notice '論理削除済みの % 行を消した', n;
  end if;
end $$;

alter table public.ow_candidate_notes drop column if exists deleted_at;

comment on table public.ow_candidate_notes is
  '企業の担当者が候補者について書く社内メモ（2026-10-10 / 段5）。その企業の担当者だけが読める。1000字まで。担当者が消すとその場で行ごと消える（記録も残さない）。本人から開示を求められた場合は開示の対象になりうる';

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='ow_candidate_notes' and column_name='deleted_at') then
    raise exception '検算失敗: deleted_at が残っている';
  end if;
  if has_table_privilege('authenticated', 'public.ow_candidate_notes', 'SELECT') or has_table_privilege('anon', 'public.ow_candidate_notes', 'SELECT') then
    raise exception '検算失敗: クライアントのロールから読める';
  end if;
  raise notice '検算OK: deleted_at を落とした';
end $$;

commit;

-- ★戻すとき: alter table public.ow_candidate_notes add column deleted_at timestamptz;
