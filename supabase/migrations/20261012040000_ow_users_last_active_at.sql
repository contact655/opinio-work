-- ow_users.last_active_at を足す（2026-10-12 / 柴さんの指示）
--
-- ★求職者が「最後に利用した日」。候補者を探すの「最近の利用」（3日以内／1週間以内／1か月以内／それ以前）に使う。
--   ⚠️ 企業の画面に出すのは4段階の帯だけ。正確な日時は渡さない（サーバーで帯にする。lib/business/candidates/activity.ts）。
--   ⚠️ 表示・絞り込み・並び替えは CANDIDATE_ACTIVITY_ENABLED のときだけ（本番は無効）。
--
-- 書くのは POST /api/jobseeker/activity だけ（admin クライアント）。**1日1回まで**
--   （「今日の0時（日本時間）より前、または NULL」のときだけ UPDATE する条件付き更新）。
--
-- ⚠️ 既存の行は NULL（推測で埋めない。auth.users.last_sign_in_at からも埋めない ——
--    あれはログインの日時で、ログインしたまま使っている人では古いまま）。
-- ⚠️★anon / authenticated に GRANT しない。ow_users は SELECT・UPDATE とも列単位 GRANT なので、
--    足した列は**読めない・書けない状態で生まれる**。それが意図した状態（他の利用者の利用状況を PostgREST から取らせない）。

ALTER TABLE public.ow_users ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

COMMENT ON COLUMN public.ow_users.last_active_at IS
  '最後に利用した日時（1日1回まで更新。POST /api/jobseeker/activity）。企業には4段階の帯だけを見せる（正確な日時は渡さない）。'
  ' NULL は「記録が無い」（2026-10-12 より前は記録していない）。anon / authenticated には GRANT しない。';

DO $$
BEGIN
  IF has_column_privilege('anon', 'public.ow_users', 'last_active_at', 'SELECT')
     OR has_column_privilege('authenticated', 'public.ow_users', 'last_active_at', 'SELECT')
     OR has_column_privilege('authenticated', 'public.ow_users', 'last_active_at', 'UPDATE') THEN
    RAISE EXCEPTION 'last_active_at が anon / authenticated から読める・書ける状態になっている（想定外）';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ow_users WHERE last_active_at IS NOT NULL) THEN
    RAISE EXCEPTION 'last_active_at に値が入っている（新しい列は NULL で始まるはず）';
  END IF;
  RAISE NOTICE '適用後: last_active_at を追加 / anon・authenticated は SELECT・UPDATE とも false / 全行 NULL';
END $$;
