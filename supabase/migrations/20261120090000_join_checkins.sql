-- ════════════════════════════════════════════════════════════════════════
-- 入社後のふり返り（入社3か月・入社1年の時間差レビュー）（2026-11-20 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ✅ 2026-11-20 に柴さんの了承を得て適用した（supabase CLI が無い環境のため、Supabase MCP で
--    このファイルの内容をそのまま実行し、同じトランザクションで schema_migrations に記録した）。
--
-- 決めたこと（2026-11-20 の会話）:
--   ・OPINIO の成長戦略として「転職の結果データ」を持つ。定着は職歴の在籍期間から自動で取り、
--     活躍・合っているかは本人に時間差で聞く（入社3か月・入社1年）
--   ・採用側（Hiring Manager）の評価は使わない（活躍の原因が環境に左右され、特定できないため）
--   ・感想だけでなく「環境の事実」も聞く（立ち上がりの支援・上司の関わり方・業務の進め方・評価・
--     主に向き合う相手・入社前の話との差）。環境と志向の組み合わせで提案できるようにするため
--   ・回答は公開しない。会社にも見せない。本人への「あなたが合う職場の傾向」と、将来の集計にだけ使う
--   ・1行 = その会社に入った職歴1件（同じ会社の職歴のうち、いちばん古い行）× 時点（3m / 1y）。
--     入社の決め手（ow_join_decisions）と同じ単位
--   ・環境の軸は入社後レビューの軸マスタ（ow_review_axes）を使い、「上司の関わり方」を1軸足す
--
-- 表
--   ow_join_checkins       時点ごとの回答（合っているか・入社前の話との差・主に向き合う相手）
--   ow_join_checkin_axes   環境の軸の回答（時点 × 軸）
--   ow_review_axes         ★1行足す（manager_style）
--
-- 権限: 誰にも配らない。読み書きは API（service role）だけ（ow_join_decisions と同じ形）
-- ⚠️★anon / authenticated に GRANT しないこと。ポリシーも書かないこと。
--
-- 既存データへの影響
--   ・既存の表の行は変えない。ow_review_axes に1行足すだけ
--   ・⚠️ ow_review_axes を読む入社後レビュー（ExperienceReasonModal）は /dev/preview からしか開かない。
--     足した軸はそこにも出る（実ユーザーの画面は変わらない）
--
-- 戻し方:
--   drop table public.ow_join_checkin_axes; drop table public.ow_join_checkins;
--   delete from public.ow_review_axes where key = 'manager_style';
--   （⚠️ ow_workplace_review_axes に manager_style の回答が入った後は、先にその行を消す）
--   （行が入った後は、先に ./scripts/dump-tables.sh ow_join_checkins ow_join_checkin_axes で控えを取ること）
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 軸を1つ足す ─────────────────────────────────────────────────────────────
-- ⚠️ display_order は末尾（7）。既存6軸の並びは変えない
insert into public.ow_review_axes (key, name, left_text, right_text,
  left_headline_join, left_headline_end, right_headline_join, right_headline_end, display_order) values
  ('manager_style', '上司の関わり方', '任せて、必要なときに相談する', 'こまめに一緒に進めてくれる',
     '上司に任されて動け', '上司に任されて動ける', '上司が伴走してくれ', '上司が伴走してくれる', 7);

-- ── 回答 ────────────────────────────────────────────────────────────────────

create table public.ow_join_checkins (
  experience_id  uuid not null references public.ow_experiences(id) on delete cascade,
  -- ⚠️ 時点は lib/joinCheckin/constants.ts の JOIN_CHECKPOINTS と同じ。片方だけ変えないこと
  checkpoint     text not null check (checkpoint in ('3m', '1y')),
  user_id        uuid not null references public.ow_users(id) on delete cascade,
  -- 合っているか（0〜10。入社後レビューの fit_score と同じ物差し）
  fit_score      smallint check (fit_score between 0 and 10),
  -- 入社前の話と比べて（0=下回った 1=期待どおり 2=上回った。入社後レビューの gap_* と同じ）
  gap_job        smallint check (gap_job between 0 and 2),
  gap_pay        smallint check (gap_pay between 0 and 2),
  gap_growth     smallint check (gap_growth between 0 and 2),
  gap_culture    smallint check (gap_culture between 0 and 2),
  -- 主に向き合っている相手（任意）。⚠️ 選択肢は constants.ts の CHECKIN_CUSTOMERS と同じ
  customer       text check (customer is null or customer in ('enterprise', 'midmarket', 'smb', 'consumer', 'internal')),
  -- 答えた日時。★回答があれば必ず入る
  answered_at    timestamptz,
  -- 「今回は答えない」を押した日時（その時点はもう聞かない）
  skipped_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (experience_id, checkpoint),
  -- 答えたなら、合っているか・入社前の話との差の5問がそろっている
  constraint ow_join_checkins_answer_check check (
    (answered_at is null and fit_score is null)
    or (answered_at is not null and fit_score is not null and gap_job is not null and gap_pay is not null
        and gap_growth is not null and gap_culture is not null))
);

create index ow_join_checkins_user_id_idx on public.ow_join_checkins(user_id);

comment on table public.ow_join_checkins is
  '入社後のふり返り（入社3か月・1年。2026-11-20）。その会社に入った職歴1件 × 時点で1行。⚠️ 公開しない・会社に見せない。読み書きは API（service role）だけ。anon / authenticated に GRANT しない・ポリシーを書かない。';

create table public.ow_join_checkin_axes (
  experience_id  uuid not null,
  checkpoint     text not null,
  axis_key       text not null references public.ow_review_axes(key),
  -- 0=左にかなり 1=左にやや 2=どちらとも 3=右にやや 4=右にかなり
  value          smallint not null check (value between 0 and 4),
  created_at     timestamptz not null default now(),
  primary key (experience_id, checkpoint, axis_key),
  foreign key (experience_id, checkpoint) references public.ow_join_checkins(experience_id, checkpoint) on delete cascade
);

comment on table public.ow_join_checkin_axes is
  '入社後のふり返りの環境の軸（2026-11-20）。軸は ow_review_axes。読み書きは API（service role）だけ。';

alter table public.ow_join_checkins enable row level security;
alter table public.ow_join_checkin_axes enable row level security;
revoke all on table public.ow_join_checkins from public, anon, authenticated;
revoke all on table public.ow_join_checkin_axes from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_join_checkins to service_role;
grant select, insert, update, delete on table public.ow_join_checkin_axes to service_role;

-- ★適用の中で確かめる（作っただけで終わらせない）
do $$
declare t text;
begin
  foreach t in array array['public.ow_join_checkins','public.ow_join_checkin_axes'] loop
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
  if (select count(*) from public.ow_review_axes where is_active) <> 7 then
    raise exception '有効な軸が7つでない（既存6＋manager_style のはず）';
  end if;
end $$;

commit;
