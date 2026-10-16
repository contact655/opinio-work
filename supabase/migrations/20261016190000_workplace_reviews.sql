-- ★入社後レビュー（「株式会社◯◯について」）を作り直す（2026-10-16 / 柴さんの指示・フェーズ1）。
--   調査は 2026-10-16 のフェーズ0の報告。旧形式（reason_version 1・2）の表と列は残し、移行しない。
--
-- 決めごと（変えないこと）
--   ・回答は公開しない。企業ページにも出さない。企業側の画面・API からも読めない。
--   ・使い道は3つだけ: 本人への「あなたが合う職場の傾向」／将来の根拠つき提案の材料／将来の企業向け非公開フィードバック
--   ・軸はマスタで持つ（求職者側・企業側にも同じ軸で聞く前提）。回答の表にはラベル文言を持たせない
--   ・回答の単位は「会社」（同じ会社の役割が複数あっても1件）。保存先の職歴の行はアプリが決める
--
-- 表
--   ow_review_axes            軸マスタ（6軸を投入）
--   ow_review_fit_tags        「合う人」タグのマスタ（8つを投入）
--   ow_workplace_reviews      レビュー本体（職歴の行1件につき最大1件）
--   ow_workplace_review_axes  軸の回答（レビュー × 軸）
--   ow_workplace_review_tags  タグの回答（レビュー × タグ）
--
-- 権限
--   ・anon には何も配らない
--   ・回答の3表: authenticated に select / insert / update / delete。RLS は操作ごとに分け、本人の行だけ
--     （⚠️ FOR ALL は使わない）。本人の判定は auth_ow_user_id()
--   ・マスタの2表: authenticated に select だけ（有効なものだけ見える）
--   ⚠️ 企業の担当者も authenticated で来るが、本人の行しか見えないので他人の回答は0件になる
--
-- 戻し方: drop table を子から順に（ow_workplace_review_tags → ow_workplace_review_axes → ow_workplace_reviews
--         → ow_review_fit_tags → ow_review_axes）。旧形式の表には触れていない。

begin;

-- ── マスタ ──────────────────────────────────────────────────────────────────

create table public.ow_review_axes (
  key            text primary key,
  name           text not null,
  left_text      text not null,
  right_text     text not null,
  /* ④の見出しの一文に入れる言い回し。左右それぞれ2つの形で持つ（2026-10-16 / 柴さんの指示）
       ・つなぐ形（_join）… 2つ目の前に置く形。例「やり方を任され」
       ・言い切る形（_end）… 「職場」にそのままかかる形。例「やり方を任される」
       1つなら「言い切る形＋職場で…」、2つなら「つなぐ形、言い切る形＋職場で…」 */
  left_headline_join  text not null,
  left_headline_end   text not null,
  right_headline_join text not null,
  right_headline_end  text not null,
  display_order  smallint not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint ow_review_axes_key_format check (key ~ '^[a-z][a-z0-9_]*$')
);

comment on table public.ow_review_axes is
  '入社後レビュー②の軸マスタ（2026-10-16）。求職者の希望・企業の自己申告でも同じ軸を使う前提。⚠️ 回答の表にラベルを持たせない';

insert into public.ow_review_axes (key, name, left_text, right_text,
  left_headline_join, left_headline_end, right_headline_join, right_headline_end, display_order) values
  ('work_style', '仕事の進め方', '決まったやり方に沿って進める', 'やり方は自分で決める',
     '決まったやり方に沿って進め', '決まったやり方に沿って進める', 'やり方を任され', 'やり方を任される', 1),
  ('onboarding', '立ち上がり',   '自分で調べて覚える',           '研修・先輩が教えてくれる',
     '自分で調べて覚えていき', '自分で調べて覚えていく', '研修や先輩に教わりながら覚えられ', '研修や先輩に教わりながら覚えられる', 2),
  ('evaluation', '評価',         '成果の数字で見られる',         '行動やプロセスも見られる',
     '成果の数字で評価され', '成果の数字で評価される', '行動やプロセスも評価され', '行動やプロセスも評価される', 3),
  ('decision',   '決め方',       '上が決めて降りてくる',         '現場で話し合って決める',
     '上が方針を決め', '上が方針を決める', '現場で話し合って決め', '現場で話し合って決める', 4),
  ('change',     '変化',         '方針や組織はあまり変わらない', '方針や組織がよく変わる',
     '方針や組織が落ち着いていて', '方針や組織が落ち着いている', '方針や組織がよく変わり', '方針や組織がよく変わる', 5),
  ('closeness',  '人との距離感', '仕事上の付き合いが中心',       '仕事以外でも関わる',
     '仕事上の付き合いが中心で', '仕事上の付き合いが中心の', '仕事以外でも関わりがあり', '仕事以外でも関わりがある', 6);

create table public.ow_review_fit_tags (
  key           text primary key,
  label         text not null,
  display_order smallint not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint ow_review_fit_tags_key_format check (key ~ '^[a-z][a-z0-9_]*$')
);

comment on table public.ow_review_fit_tags is '入社後レビュー③「どんな人に合う会社か」のタグマスタ（2026-10-16）';

insert into public.ow_review_fit_tags (key, label, display_order) values
  ('self_starter',   '自分で考えて動ける人',   1),
  ('enjoys_change',  '変化を楽しめる人',       2),
  ('numbers_driven', '数字で評価されたい人',   3),
  ('steady_growth',  'じっくり育ちたい人',     4),
  ('team_player',    'チームで動きたい人',     5),
  ('specialist',     '専門性を深めたい人',     6),
  ('generalist',     '幅広く経験したい人',     7),
  ('system_builder', '仕組みを作るのが好きな人', 8);

-- ── 回答 ────────────────────────────────────────────────────────────────────

create table public.ow_workplace_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.ow_users(id) on delete cascade,
  /* 保存先の職歴の行（その会社の行のうち1つ）。⚠️ 行を消すと回答も消える（付け替えない） */
  experience_id uuid not null unique references public.ow_experiences(id) on delete cascade,
  /* 会社。自由入力の会社は null */
  company_id    uuid references public.ow_companies(id) on delete set null,
  /* ① Q1 合っていたか */
  fit_score     smallint check (fit_score between 0 and 10),
  /* ① Q2 入社前の期待と比べて（0=下回った 1=期待どおり 2=上回った） */
  gap_job       smallint check (gap_job between 0 and 2),
  gap_pay       smallint check (gap_pay between 0 and 2),
  gap_growth    smallint check (gap_growth between 0 and 2),
  gap_culture   smallint check (gap_culture between 0 and 2),
  /* ③ 働き方の事実（各4択。0〜3。並びは lib/workplaceReview/constants.ts） */
  overtime      smallint check (overtime between 0 and 3),
  office        smallint check (office between 0 and 3),
  english       smallint check (english between 0 and 3),
  /* ③ 入る前に知りたかったこと。⚠️ 公開しない */
  memo          text check (memo is null or (char_length(btrim(memo)) between 1 and 80)),
  /* required_done = ①まで ／ complete = ③の「保存する」まで */
  status        text not null check (status in ('required_done', 'complete')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  /* ①は必須。行がある＝①の5問がそろっている */
  constraint ow_workplace_reviews_required_check check (
    fit_score is not null and gap_job is not null and gap_pay is not null
    and gap_growth is not null and gap_culture is not null)
);

create index ow_workplace_reviews_user_idx on public.ow_workplace_reviews (user_id);

comment on table public.ow_workplace_reviews is
  '入社後レビュー（2026-10-16）。⚠️ 公開しない。企業側から読ませない。回答の単位は会社（職歴の行は保存先）';

create table public.ow_workplace_review_axes (
  review_id  uuid not null references public.ow_workplace_reviews(id) on delete cascade,
  axis_key   text not null references public.ow_review_axes(key),
  /* 0=左にかなり 1=左にやや 2=どちらとも 3=右にやや 4=右にかなり */
  value      smallint not null check (value between 0 and 4),
  created_at timestamptz not null default now(),
  primary key (review_id, axis_key)
);

create table public.ow_workplace_review_tags (
  review_id  uuid not null references public.ow_workplace_reviews(id) on delete cascade,
  tag_key    text not null references public.ow_review_fit_tags(key),
  created_at timestamptz not null default now(),
  primary key (review_id, tag_key)
);

-- ── 権限 ────────────────────────────────────────────────────────────────────

alter table public.ow_review_axes            enable row level security;
alter table public.ow_review_fit_tags        enable row level security;
alter table public.ow_workplace_reviews      enable row level security;
alter table public.ow_workplace_review_axes  enable row level security;
alter table public.ow_workplace_review_tags  enable row level security;

revoke all on public.ow_review_axes, public.ow_review_fit_tags, public.ow_workplace_reviews,
  public.ow_workplace_review_axes, public.ow_workplace_review_tags from anon, authenticated;

grant select on public.ow_review_axes, public.ow_review_fit_tags to authenticated;
grant select, insert, update, delete on public.ow_workplace_reviews, public.ow_workplace_review_axes,
  public.ow_workplace_review_tags to authenticated;
grant all on public.ow_review_axes, public.ow_review_fit_tags, public.ow_workplace_reviews,
  public.ow_workplace_review_axes, public.ow_workplace_review_tags to service_role;

-- マスタ: 有効なものだけ読める
create policy ow_review_axes_select on public.ow_review_axes
  for select to authenticated using (is_active);
create policy ow_review_fit_tags_select on public.ow_review_fit_tags
  for select to authenticated using (is_active);

-- 本体: 本人の行だけ。⚠️ 書くときは職歴の行も本人のものであることを要求する
create policy ow_workplace_reviews_select on public.ow_workplace_reviews
  for select to authenticated using (user_id = public.auth_ow_user_id());
create policy ow_workplace_reviews_insert on public.ow_workplace_reviews
  for insert to authenticated with check (
    user_id = public.auth_ow_user_id()
    and exists (select 1 from public.ow_experiences e where e.id = experience_id and e.user_id = public.auth_ow_user_id()));
create policy ow_workplace_reviews_update on public.ow_workplace_reviews
  for update to authenticated using (user_id = public.auth_ow_user_id())
  with check (
    user_id = public.auth_ow_user_id()
    and exists (select 1 from public.ow_experiences e where e.id = experience_id and e.user_id = public.auth_ow_user_id()));
create policy ow_workplace_reviews_delete on public.ow_workplace_reviews
  for delete to authenticated using (user_id = public.auth_ow_user_id());

-- 子の2表: 親のレビューが本人のものなら
create policy ow_workplace_review_axes_select on public.ow_workplace_review_axes
  for select to authenticated using (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()));
create policy ow_workplace_review_axes_insert on public.ow_workplace_review_axes
  for insert to authenticated with check (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()));
create policy ow_workplace_review_axes_update on public.ow_workplace_review_axes
  for update to authenticated using (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()))
  with check (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()));
create policy ow_workplace_review_axes_delete on public.ow_workplace_review_axes
  for delete to authenticated using (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()));

create policy ow_workplace_review_tags_select on public.ow_workplace_review_tags
  for select to authenticated using (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()));
create policy ow_workplace_review_tags_insert on public.ow_workplace_review_tags
  for insert to authenticated with check (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()));
create policy ow_workplace_review_tags_update on public.ow_workplace_review_tags
  for update to authenticated using (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()))
  with check (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()));
create policy ow_workplace_review_tags_delete on public.ow_workplace_review_tags
  for delete to authenticated using (exists (select 1 from public.ow_workplace_reviews r where r.id = review_id and r.user_id = public.auth_ow_user_id()));

-- ── 検算 ────────────────────────────────────────────────────────────────────
do $$
begin
  if (select count(*) from public.ow_review_axes where is_active) <> 6 then raise exception '軸が6つでない'; end if;
  if (select count(*) from public.ow_review_fit_tags where is_active) <> 8 then raise exception 'タグが8つでない'; end if;
  if has_table_privilege('anon', 'public.ow_workplace_reviews', 'SELECT') then raise exception 'anon に SELECT がある'; end if;
  if (select count(*) from pg_policy where polrelid = 'public.ow_workplace_reviews'::regclass and polcmd = '*') > 0 then
    raise exception 'FOR ALL のポリシーがある';
  end if;
end $$;

commit;
