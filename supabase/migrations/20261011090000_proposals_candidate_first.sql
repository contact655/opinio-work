-- ★提案を「求職者が先に答える」形に変える（2026-10-11 / 柴さんの指示）。追加だけの部分。
--
-- 新しい流れ:
--   1. 運営が提案を作る（今のまま）
--   2. 提案は求職者にだけ届く。企業には、求職者が「話を聞いてみたい」と答えるまで何も見えない
--   3. 求職者が答えたら、企業の設定に従う
--        auto   … その場で会話を作る（既定。行が無い企業もこれ）
--        review … 企業の /biz/proposals に「届いた方」として出し、会う／見送るを選んでもらう（14日で終了）
--
-- ⚠️★この migration は「追加だけ」。古いコードはこの列・表・種別を知らないだけで壊れない
--    （CLAUDE.md「追加のみは先行適用してよい」）。job_id の NOT NULL は締める変更なので
--    supabase/pending/ に分けてある。
-- ⚠️ 作業前ダンプ: .dumps/20261011-1432-ow_proposals-ow_proposal_declines.sql（ow_proposals 4行 / declines 1行）

begin;

-- ── ① 企業ごとの設定（行が無ければ auto）─────────────────────────────────────────
--   ⚠️ ow_companies に列を足さない（anon にテーブルレベルの SELECT があり、運用の設定が外から読める）。
--   ⚠️ 権限は ow_proposals と同じ形: RLS 有効・ポリシー0本・クライアントのロールに権限なし。
--      読み書きは所属を確かめたサーバーの処理（admin クライアント）だけ。
create table public.ow_company_proposal_settings (
  company_id  uuid primary key references public.ow_companies(id) on delete cascade,
  mode        text not null check (mode in ('auto', 'review')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.ow_users(id) on delete set null
);
comment on table public.ow_company_proposal_settings is
  '提案で「話を聞いてみたい」と答えた方が届いたときの扱い。auto=すぐにメッセージを始める（行が無い企業もこれ）／review=内容を見てから決める。2026-10-11';
alter table public.ow_company_proposal_settings enable row level security;
revoke all on public.ow_company_proposal_settings from anon, authenticated;
grant all on public.ow_company_proposal_settings to service_role;

-- ── ② ow_proposals に足す列 ────────────────────────────────────────────────────
alter table public.ow_proposals
  add column candidate_note     text,
  add column delivery_mode      text,
  add column company_respond_by timestamptz,
  add column company_seen_at    timestamptz;

comment on column public.ow_proposals.candidate_note is
  '求職者の「会社へのひとこと」（任意・200字まで）。「話を聞いてみたい」と答えたときだけ入る';
comment on column public.ow_proposals.delivery_mode is
  '求職者が答えた時点の企業の設定を写したもの（auto/review）。あとで企業が設定を変えても、届き済みの提案の扱いは変わらない';
comment on column public.ow_proposals.company_respond_by is
  'review のときの企業の返事の締め切り（求職者が答えてから14日）。過ぎたら終了';
comment on column public.ow_proposals.company_seen_at is
  '提案から始まった会話を、企業の参加者が開いた日時（/biz/messages の「新しい」印に使う）';

alter table public.ow_proposals
  add constraint candidate_note_length check (candidate_note is null or char_length(candidate_note) <= 200),
  add constraint candidate_note_needs_interest check (candidate_note is null or candidate_response = 'interested'),
  add constraint delivery_mode_check check (delivery_mode is null or delivery_mode in ('auto', 'review')),
  add constraint delivery_mode_needs_interest check (delivery_mode is null or candidate_response = 'interested'),
  add constraint company_respond_by_needs_review check (company_respond_by is null or delivery_mode = 'review');

-- ── ③ 既存の提案の移し方（4件・すべて検証用。id を明示列挙する）──────────────────
--   contact+04 … 両方答えて会話あり                → auto として記録（表示は「メッセージが始まりました」）
--   contact+11 … 求職者が答えて企業が未回答        → review として企業に出す（14日は今日から）
--   contact+03 … 求職者が見送った                  → 変更なし（企業には出さない）
--   contact+25 … 企業だけ「会いたい」・求職者は未回答 → 変更なし（求職者の回答待ち。答えたらすぐ会話）
do $$
declare n int;
begin
  -- ⚠️ 検証用であることを確かめてから動かす（実在の行が混ざっていたら止める）
  select count(*) into n
    from public.ow_proposals p join public.ow_users u on u.id = p.candidate_user_id
   where p.id in ('5de7ce73-ddab-4b78-a0cd-e7b8c7cea882', 'b9c49705-c7f0-4d45-98d9-633b1cf955b9')
     and u.is_test = true and p.candidate_response = 'interested';
  if n <> 2 then raise exception '想定と違う（対象2件のうち検証用で回答済みのもの: %件）。中止', n; end if;

  update public.ow_proposals set delivery_mode = 'auto'
   where id = '5de7ce73-ddab-4b78-a0cd-e7b8c7cea882' and introduced_at is not null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'contact+04 の更新が % 行。中止', n; end if;

  update public.ow_proposals set delivery_mode = 'review', company_respond_by = now() + interval '14 days'
   where id = 'b9c49705-c7f0-4d45-98d9-633b1cf955b9' and company_response is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'contact+11 の更新が % 行。中止', n; end if;
end $$;

-- ── ④ 会話の「案内の行」（本人の発言ではない行）──────────────────────────────────
--   ⚠️ 本文には「〇〇さんが提案を見て、話を聞いてみたいと答えました。」を入れる（一覧の冒頭1行・未読にも使う）。
--      送った人（sender_participant_id）は入れない。画面は中央の小さな行として描く。
alter table public.ow_conversation_messages drop constraint ow_conversation_messages_kind_check;
alter table public.ow_conversation_messages add constraint ow_conversation_messages_kind_check
  check (kind = any (array['text'::text, 'meeting_slots'::text, 'scheduling_link'::text, 'proposal_intro'::text]));

-- ── 検算 ────────────────────────────────────────────────────────────────────────
do $$
begin
  if has_table_privilege('anon', 'public.ow_company_proposal_settings', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_proposal_settings', 'SELECT') then
    raise exception 'ow_company_proposal_settings がクライアントから読める。中止';
  end if;
  if (select count(*) from public.ow_proposals where delivery_mode is not null) <> 2 then
    raise exception 'delivery_mode が入った行が2件でない。中止';
  end if;
end $$;

commit;
