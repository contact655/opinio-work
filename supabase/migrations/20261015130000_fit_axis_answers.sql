-- ★「相性のものさし」の回答（2026-10-15 / 柴さんの判断）。利用者 × 軸で1行。
--   軸の定義は src/lib/fitAxes/axes.ts（第1版の6軸）。値は 1〜5、NULL は「わからない」。
--
-- ⚠️ 追加のみ（新しい表を1つ作る）。既存の表・列・データは触らない。
-- ⚠️★貼り付けた AI の文章・AI が添えた理由は**持たない**（列を作らない）。保存するのは本人が確認した数字だけ。
--
-- ── 権限 ────────────────────────────────────────────────────────────────────────
--   読み … 本人の行だけ（authenticated に SELECT・RLS で本人に絞る）
--   書き … ★クライアントには配らない。API（service_role）だけが書く（値と軸の key の検証をサーバー1か所で行う）
--   企業 … 読めない（企業の担当者も authenticated だが、RLS が本人の行しか返さない）。admin クライアントで企業向けに読む経路も作らない
--   anon … 何も配らない
--
-- ⚠️ 本番での公開はプライバシーポリシーの改定と同時（axes.ts の FIT_AXES_PUBLIC）。それまでは検証用アカウントだけが書ける。
--
-- 戻し方: drop table public.ow_fit_axis_answers;

create table public.ow_fit_axis_answers (
  user_id       uuid not null references public.ow_users(id) on delete cascade,
  /* ⚠️ CHECK しない。軸を差し替えるたびに migration を要らなくするため。受け付ける key は API が axes.ts で検証する */
  axis_key      text not null,
  /* NULL は「わからない」 */
  value         smallint,
  source        text not null,
  /* 回答した時点の軸の版（axes.ts の FIT_AXES_VERSION） */
  axes_version  integer not null,
  updated_at    timestamptz not null default now(),

  primary key (user_id, axis_key),
  constraint ow_fit_axis_answers_value_check check (value is null or value between 1 and 5),
  /* ⚠️ axes.ts の FIT_AXIS_SOURCES と同じ2つ */
  constraint ow_fit_axis_answers_source_check check (source in ('ai_paste', 'manual')),
  constraint ow_fit_axis_answers_key_length check (char_length(axis_key) between 1 and 40),
  constraint ow_fit_axis_answers_version_positive check (axes_version >= 1)
);

comment on table public.ow_fit_axis_answers is
  '「相性のものさし」の回答（本人が確認した数字だけ。貼り付けた文章は持たない）。⚠ 書くのは API（service_role）だけ。本人は SELECT のみ（RLS）。企業には見せない';
comment on column public.ow_fit_axis_answers.value is '1〜5（1＝axes.ts の left、5＝right）。NULL は「わからない」';

alter table public.ow_fit_axis_answers enable row level security;

create policy ow_fit_axis_answers_own_select on public.ow_fit_axis_answers
  for select to authenticated
  using (user_id = public.auth_ow_user_id());

grant select on public.ow_fit_axis_answers to authenticated;

-- ── 検算 ────────────────────────────────────────────────────────────────────────
do $$
begin
  if has_table_privilege('anon', 'public.ow_fit_axis_answers', 'SELECT') then
    raise exception 'anon が読める。中止';
  end if;
  if has_table_privilege('authenticated', 'public.ow_fit_axis_answers', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_fit_axis_answers', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ow_fit_axis_answers', 'DELETE') then
    raise exception 'authenticated が書ける。中止';
  end if;
end $$;
