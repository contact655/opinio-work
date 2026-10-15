-- ★「あなたに合う順」（/mypage/for-you）での反応の記録（2026-10-15 / 柴さんの指示）。
--   利用者 × 企業で1行。「興味あり」「あとで」「興味なし（理由）」と、押した時点の順位・シグナル。
--
-- ⚠️ 追加のみ（新しい表を1つ作る）。既存の表・列・データは触らない。
--
-- ── なぜ既存の表を使わないか（docs/phase0-for-you-20261015.md §5）─────────────────
--   ow_proposals         … job_id が NOT NULL・evidence が2件以上の CHECK。求人の無い企業を扱えない
--   ow_proposal_declines … proposal_id にぶら下がる
--   ow_bookmarks         … ♡（保存）とは別の操作。混ぜると♡の一覧に勝手に増える
--
-- ── 権限 ────────────────────────────────────────────────────────────────────────
--   読み … 本人の行だけ（authenticated に SELECT・RLS で本人に絞る）。企業からは読めない
--   書き … ★クライアントには配らない。API（service_role）だけが書く。
--          ⚠️ 本人に直接書かせると、①押した時点の順位とシグナル（学習用）を偽れる
--             ②`interested_at` は企業との会話を開く理由になる（lib/conversations/openReason.ts）
--   anon … 何も配らない
--
-- 戻し方: drop table public.ow_for_you_reactions;
--         （⚠️ その前に lib/conversations/openReason.ts の for_you の理由を外すこと。外さないと会話の判定が 42P01 で落ちる）

create table public.ow_for_you_reactions (
  user_id     uuid not null references public.ow_users(id) on delete cascade,
  company_id  uuid not null references public.ow_companies(id) on delete cascade,

  /* いまの反応。押し直しは上書き */
  reaction    text not null,
  /* 「興味なし」の理由。★語彙は lib/constants/declineReasons.ts の CANDIDATE_DECLINE_REASONS（提案の見送り理由と同じ8つ） */
  reason      text,

  /* 押した時点の順位（1始まり）とシグナルのスナップショット。★後で並び順を学習させるため。再計算しない */
  rank_at     integer not null,
  signals     jsonb not null default '[]'::jsonb,

  /* ★最初に「興味あり」を押した日時。**一度入ったら消さない。**
     企業との会話を開く理由（openReason.ts）はこの列を見る。reaction を後で変えても、開いた会話は送れるまま */
  interested_at    timestamptz,
  /* 担当者のいない企業で、運営にメールで知らせた日時（二重に送らない・1日の件数を数える） */
  ops_notified_at  timestamptz,
  /* 「興味あり」で開いた企業との会話 */
  conversation_id  uuid references public.ow_conversations(id) on delete set null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, company_id),

  constraint ow_for_you_reactions_reaction_check
    check (reaction in ('interested', 'later', 'not_interested')),
  /* ⚠️ CANDIDATE_DECLINE_REASONS と同じ8つ。片方だけ足さないこと */
  constraint ow_for_you_reactions_reason_check
    check (reason is null or reason in ('job_content', 'salary', 'work_style', 'location', 'phase', 'known', 'timing', 'other')),
  /* 理由は「興味なし」のときだけ（必須） */
  constraint ow_for_you_reactions_reason_only_when_not_interested
    check ((reaction = 'not_interested') = (reason is not null)),
  constraint ow_for_you_reactions_rank_positive check (rank_at >= 1),
  constraint ow_for_you_reactions_signals_array check (jsonb_typeof(signals) = 'array')
);

comment on table public.ow_for_you_reactions is
  '「あなたに合う順」（/mypage/for-you）での反応。利用者×企業で1行。⚠ 書くのは API（service_role）だけ。本人は SELECT のみ（RLS）。企業からは読めない。⚠ interested_at は企業との会話を開く理由（lib/conversations/openReason.ts）なので消さない';
comment on column public.ow_for_you_reactions.signals is '押した時点のシグナル（lib/forYou/weights.ts の SignalKey と点数）。学習用のスナップショット。再計算しない';
comment on column public.ow_for_you_reactions.interested_at is '最初に「興味あり」を押した日時。一度入ったら消さない（会話を開く理由）';

create index ow_for_you_reactions_company_idx on public.ow_for_you_reactions (company_id);
create index ow_for_you_reactions_ops_notified_idx on public.ow_for_you_reactions (ops_notified_at) where ops_notified_at is not null;

alter table public.ow_for_you_reactions enable row level security;

create policy ow_for_you_reactions_own_select on public.ow_for_you_reactions
  for select to authenticated
  using (user_id = public.auth_ow_user_id());

grant select on public.ow_for_you_reactions to authenticated;

-- ── 検算 ────────────────────────────────────────────────────────────────────────
do $$
begin
  if has_table_privilege('anon', 'public.ow_for_you_reactions', 'SELECT') then
    raise exception 'anon が読める。中止';
  end if;
  if has_table_privilege('authenticated', 'public.ow_for_you_reactions', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_for_you_reactions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ow_for_you_reactions', 'DELETE') then
    raise exception 'authenticated が書ける。中止';
  end if;
  if not has_table_privilege('authenticated', 'public.ow_for_you_reactions', 'SELECT') then
    raise exception 'authenticated が読めない。中止';
  end if;
end $$;
