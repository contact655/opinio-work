-- ════════════════════════════════════════════════════════════════════════
-- 転機の3問の置き場所（2026-10-27 / フェーズ1c・柴さんの決定＝案B）
-- ════════════════════════════════════════════════════════════════════════
--
-- 決めたこと（docs/phase1c-proposal-20261027.md）:
--   ・3問は「その会社に入った職歴1件」に付ける（= 同じ会社の職歴のうち、いちばん古い行）
--     Q1 その会社を選んだ決め手（v2 の15個から3つまで・等重み）
--     Q2 移るとき（最初の会社は社会に出るとき）に、いちばん求めていたこと（8択から1つ）
--     Q3 入って1年たったころ、合っていたか（1〜5）＋回答した日。入社から1年たっていない職歴では聞かない
--   ・誰にも読み書きの権限を配らない。読み書きは API（service role）だけ。本人確認は API の requireOwnExperience
--     （v2 の6表・ow_transitions・ow_company_creations と同じ形。RLS 有効・ポリシー0本・GRANT なし）
--
-- ⚠️★anon / authenticated に GRANT しないこと。ポリシーも書かないこと。
--    「本人と集計処理以外は読めない」をこの形で守っている（職歴の表は、ログインしていれば他人の行も読める）。
-- ⚠️ ow_workplace_reviews（入社後レビュー）の表とデータは残す。新しい画面からは書かない。
-- ⚠️ 旧の決め手（ow_experiences.join_reasons）を写す migration は別（supabase/pending/。柴さんの了承後に当てる）。
--
-- データは変えない（表を作るだけ）。
-- 戻し方: drop table public.ow_career_turns;（行が入った後は、先に .dumps/ に控えを取ること）
-- ════════════════════════════════════════════════════════════════════════

begin;

create table public.ow_career_turns (
  experience_id    uuid primary key references public.ow_experiences(id) on delete cascade,
  user_id          uuid not null references public.ow_users(id) on delete cascade,
  -- Q1。⚠️ 選択肢は lib/careerTurns/constants.ts（＝ lib/constants/careerReasons.ts の EXPECTATIONS）と同じ。片方だけ変えないこと
  decisive_reasons text[] check (
    decisive_reasons is null or (
      decisive_reasons <@ array['job_content','customer','position','autonomy','skills','next_career','management',
                                'people','culture','salary','evaluation','work_style','growth','stability','personal']::text[]
      and cardinality(decisive_reasons) between 1 and 3
    )
  ),
  -- Q2。⚠️ 選択肢は lib/careerTurns/constants.ts と同じ
  next_priority    text check (
    next_priority is null or next_priority in
      ('larger_customers','deepen_expertise','wider_scope','salary','flexibility','business_ownership','management','other')
  ),
  -- Q3（1〜5）と、答えた日時。どちらか片方だけは入らない
  fit_after_year   smallint check (fit_after_year is null or fit_after_year between 1 and 5),
  fit_answered_at  timestamptz,
  -- 「この転機は答えない」を選んだ日時。答えると null に戻す
  skipped_at       timestamptz,
  -- 本人が新しい画面で保存した日時。null の行は旧の決め手を写しただけ（答え直しの案内を出す）
  answered_at      timestamptz,
  -- 旧の決め手（join_reasons）から写した日時（写していなければ null）
  copied_from_legacy_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint ow_career_turns_fit_pair check ((fit_after_year is null) = (fit_answered_at is null))
);

create index ow_career_turns_user_id_idx on public.ow_career_turns(user_id);

comment on table public.ow_career_turns is
  '転機の3問（2026-10-27 / フェーズ1c）。その会社に入った職歴1件につき1行。読み書きは API（service role）だけ。anon / authenticated に GRANT しない・ポリシーを書かない。';

alter table public.ow_career_turns enable row level security;
revoke all on table public.ow_career_turns from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_career_turns to service_role;

-- ★適用の中で確かめる（作っただけで終わらせない）
do $$
begin
  if has_table_privilege('anon', 'public.ow_career_turns', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_career_turns', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_career_turns', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_career_turns', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ow_career_turns', 'DELETE') then
    raise exception 'ow_career_turns にクライアントのロールの権限が残っている';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.ow_career_turns'::regclass) <> 0 then
    raise exception 'ow_career_turns にポリシーがある（0本のはず）';
  end if;
  if not has_table_privilege('service_role', 'public.ow_career_turns', 'INSERT') then
    raise exception 'service_role が書けない';
  end if;
end $$;

commit;
