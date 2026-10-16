-- ★「これ以上の経歴はない」を押した日時（2026-10-16 / 柴さんの判断）
--
-- /mypage の職歴欄に出す促しカード（「{会社名}での異動・昇進を追加」「前職を追加」
-- 「これ以上の経歴はない」）を、本人が「これ以上はない」と答えたら二度と出さないための記録。
--
-- ⚠️ 追加のみ（列を1つ足す）。既存の行は NULL のまま（＝まだ答えていない）。推測で埋めない。
-- ⚠️ 職歴を後から足しても値は消さない（柴さんの指示）。カードは「職歴が現職1件だけ」も条件に
--    しているので、足した時点で自然に出なくなる。
-- ⚠️ ow_profiles の権限はテーブルレベル（authenticated に SELECT / UPDATE。列単位 GRANT は0本。
--    2026-10-16 実測）。RLS は ow_profiles_own_read / ow_profiles_own_update（auth.uid() = user_id）。
--    ⇒ 列を足せば本人がそのまま読み書きできる。GRANT は書かない。
--    ⚠️ ただし書くのは PUT /api/jobseeker/career-history-complete だけ（画面から直接 UPDATE しない）。
--
-- 戻し方:
--   alter table public.ow_profiles drop column if exists career_history_complete_at;

alter table public.ow_profiles
  add column if not exists career_history_complete_at timestamptz;

comment on column public.ow_profiles.career_history_complete_at is
  '本人が /mypage の職歴の促しで「これ以上の経歴はない」を押した日時。NULL＝まだ答えていない。職歴を足しても消さない（2026-10-16）';

-- 検算: 列ができ、本人（authenticated）が読み書きできること
do $$
begin
  if not has_column_privilege('authenticated', 'public.ow_profiles', 'career_history_complete_at', 'SELECT')
     or not has_column_privilege('authenticated', 'public.ow_profiles', 'career_history_complete_at', 'UPDATE') then
    raise exception 'career_history_complete_at: authenticated の SELECT / UPDATE が無い';
  end if;
  if exists (select 1 from public.ow_profiles where career_history_complete_at is not null) then
    raise exception 'career_history_complete_at: 既存行に値が入っている（想定は全件 NULL）';
  end if;
end $$;
