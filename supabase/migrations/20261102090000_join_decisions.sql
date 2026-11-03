-- ════════════════════════════════════════════════════════════════════════
-- 入社の決め手（1問）と、会社ごとの上位3つ（2026-11-02 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- 決めたこと（docs/current-state-20261102.md）:
--   ・「この会社に決めた理由は？（3つまで）」。順位・★なし。任意でスキップ可。選択肢は版を持つ（今回 v1）
--   ・1行 = その会社に入った職歴1件（同じ会社の職歴のうち、いちばん古い行）。転機の3問（ow_career_turns）と同じ単位
--   ・回答日（answered_at）を必ず残す。集計は入社日から3か月以内に答えたものだけ（判定はアプリ側。lib/joinDecision/constants.ts）
--   ・会社ごとの上位3つは毎月1日のバッチで作る（ow_company_reason_rankings）。★人数は保存しない（順位と選択肢だけ）
--   ・誰にも読み書きの権限を配らない。読み書きは API（service role）だけ（ow_career_turns と同じ形）
--
-- ⚠️★anon / authenticated に GRANT しないこと。ポリシーも書かないこと。
-- ⚠️ 追加だけ。既存の表・データ（ow_career_turns の写し19行を含む）は変えない。
--
-- 戻し方: drop table public.ow_company_reason_rankings; drop table public.ow_join_decisions;
--         （行が入った後は、先に ./scripts/dump-tables.sh で控えを取ること）
-- ════════════════════════════════════════════════════════════════════════

begin;

create table public.ow_join_decisions (
  experience_id   uuid primary key references public.ow_experiences(id) on delete cascade,
  user_id         uuid not null references public.ow_users(id) on delete cascade,
  -- ⚠️ 選択肢は lib/joinDecision/constants.ts（v1）と同じ。片方だけ変えないこと
  reasons         text[] check (
    reasons is null or (
      reasons <@ array['position','job_content','prior_experience','skills','autonomy',
                       'people','selection','referral',
                       'growth','mission','stability',
                       'salary','work_style','work_hours']::text[]
      and cardinality(reasons) between 1 and 3
    )
  ),
  -- 選択肢の版。⚠️ 選択肢を変えるときは版を足し、CHECK も版ごとに分ける
  choice_version  smallint not null default 1 check (choice_version in (1)),
  -- 答えた日時。★回答があれば必ず入る
  answered_at     timestamptz,
  -- スキップした日時（答えると null に戻す）
  skipped_at      timestamptz,
  -- スキップから30日後に、もう一度だけ出した日時
  reshown_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ow_join_decisions_answer_pair check ((reasons is null) = (answered_at is null))
);

create index ow_join_decisions_user_id_idx on public.ow_join_decisions(user_id);

comment on table public.ow_join_decisions is
  '入社の決め手（1問・2026-11-02）。その会社に入った職歴1件につき1行。読み書きは API（service role）だけ。anon / authenticated に GRANT しない・ポリシーを書かない。';

create table public.ow_company_reason_rankings (
  company_id      uuid not null references public.ow_companies(id) on delete cascade,
  rank            smallint not null check (rank between 1 and 3),
  reason          text not null,
  choice_version  smallint not null check (choice_version in (1)),
  -- どの月の集計か（毎月1日）
  period          date not null,
  computed_at     timestamptz not null default now(),
  primary key (company_id, rank)
);

comment on table public.ow_company_reason_rankings is
  '会社ごとの入社の決め手の上位3つ（毎月1日のバッチ /api/cron/rebuild-reason-rankings）。★人数は保存しない。回答が10人以上（MIN_REASON_COUNT）の会社だけ。読むのは admin クライアントだけ。';

alter table public.ow_join_decisions enable row level security;
alter table public.ow_company_reason_rankings enable row level security;
revoke all on table public.ow_join_decisions from public, anon, authenticated;
revoke all on table public.ow_company_reason_rankings from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_join_decisions to service_role;
grant select, insert, update, delete on table public.ow_company_reason_rankings to service_role;

-- ★適用の中で確かめる（作っただけで終わらせない）
do $$
declare t text;
begin
  foreach t in array array['public.ow_join_decisions','public.ow_company_reason_rankings'] loop
    if has_table_privilege('anon', t, 'SELECT')
       or has_table_privilege('authenticated', t, 'SELECT')
       or has_table_privilege('authenticated', t, 'INSERT')
       or has_table_privilege('authenticated', t, 'UPDATE')
       or has_table_privilege('authenticated', t, 'DELETE') then
      raise exception '% にクライアントのロールの権限が残っている', t;
    end if;
    if (select count(*) from pg_policy where polrelid = t::regclass) <> 0 then
      raise exception '% にポリシーがある（0本のはず）', t;
    end if;
    if not has_table_privilege('service_role', t, 'INSERT') then
      raise exception '% に service_role が書けない', t;
    end if;
  end loop;
end $$;

commit;
