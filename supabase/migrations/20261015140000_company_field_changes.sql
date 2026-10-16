-- ★企業情報の項目ごとの更新履歴（2026-10-15 / 柴さんの判断）。運営の「AIで埋める」から反映したものを記録する。
--   最新の出典は既存の ow_company_data_sources（項目×企業で1行）。こちらは**履歴**（旧値・新値・出典・誰が・いつ）。
--
-- ⚠️ 追加のみ（新しい表を1つ作る）。既存の表・列・データは触らない。
-- ⚠️★貼り付けた AI の文章は**持たない**（列を作らない）。持つのは運営が反映した値だけ。
--
-- ── 権限 ────────────────────────────────────────────────────────────────────────
--   運営専用。RLS 有効・ポリシー0本・anon / authenticated に GRANT 無し（ow_transitions・ow_company_data_sources と同じ形）。
--   読み書きは admin クライアント（service_role）だけ。企業の担当者・求職者・未ログインからは読めない。
--
-- 戻し方: drop table public.ow_company_field_changes;

create table public.ow_company_field_changes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.ow_companies(id) on delete cascade,
  /* 項目の key（運営の「AIで埋める」の [key]。src/lib/admin/aiFill/fields.ts） */
  field       text not null,
  /* 配列やマスタ（事業領域は {id, name} の配列）もそのまま入るよう jsonb */
  old_value   jsonb,
  new_value   jsonb,
  source_url  text,
  /* どの経路で反映したか。⚠️ 今は ai_paste だけ。足すときは CHECK と src/lib/admin/aiFill/fields.ts を同時に */
  via         text not null,
  /* 反映した運営（ow_users.id）。退会しても履歴は残す */
  changed_by  uuid references public.ow_users(id) on delete set null,
  changed_at  timestamptz not null default now(),

  constraint ow_company_field_changes_via_check check (via in ('ai_paste')),
  constraint ow_company_field_changes_field_length check (char_length(field) between 1 and 60),
  constraint ow_company_field_changes_url_length check (source_url is null or char_length(source_url) <= 2048)
);

comment on table public.ow_company_field_changes is
  '企業情報の項目ごとの更新履歴（旧値・新値・出典URL・更新者・日時）。⚠ 運営専用（ポリシー0本・GRANT 無し）。貼り付けた文章は持たない';

create index ow_company_field_changes_company_idx on public.ow_company_field_changes (company_id, field, changed_at desc);

alter table public.ow_company_field_changes enable row level security;
revoke all on public.ow_company_field_changes from anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.ow_company_field_changes', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_field_changes', 'SELECT') then
    raise exception 'クライアントから読める。中止';
  end if;
end $$;
