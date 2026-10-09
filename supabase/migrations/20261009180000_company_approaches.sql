-- ════════════════════════════════════════════════════════════════════════
-- 企業からの「声かけ」—— 表を作る（2026-10-09 / 声かけ 段2）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★足すだけ（古いコードのままでも壊れない）。
--
-- ★何の表か
--   企業の担当者が、候補者検索で見つけた人に理由を添えて「話を聞いてみたい」と送った記録。
--   求職者が承認したときに初めて企業との会話（ow_conversations kind='company'）を開く。
--   ⚠️★声かけの段階では会話を作らない。企業と求職者の会話は1組につき1本
--      （ow_conversations_unique_per_relation）なので、声かけで作ると後の応募の会話と衝突する。
--
-- ★権限: **運営だけが読める形**（ow_proposals / ow_transitions と同じ）。
--   RLS 有効・ポリシー0本・anon / authenticated に GRANT 無し。
--   読み書きはサーバーの admin クライアントだけ（/api/biz/approaches ほか）。
--   ⚠️★だから「断った」を同じ表の列（declined_at）に置いてよい。企業の担当者は PostgREST から
--      この表を読めないので、断ったことは伝わらない（DM のお願いは送り手が会話の行を読めるため、
--      断った記録を別の表に分けている。事情が違う）。
--   ⚠️★クライアントから読めるようにするときは、declined_at を企業に見せない形を先に決めること。
--
-- ★値の決まり
--   ・reason … 企業がこの人に声をかける理由（30〜200字。下限は API で見る。DB は上限と空でないことだけ）
--   ・body   … 最初の1通の本文（任意・2000字まで）。⚠️ 承認前でも求職者に全文見せる（2026-10-09 / 柴さんの判断）
--   ・accepted_at / declined_at … どちらか一方だけ（両方は立たない）
--   ・conversation_id … 承認して開いた会話。会話を消しても声かけの記録は残す（set null）
--   ・承認待ちの期限（30日）・再送の禁止（180日）・使い回しの禁止（30日）は列を持たず、created_at から数える
-- ════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.ow_company_approaches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  -- ⚠️ ow_users 空間（auth.users ではない）
  candidate_user_id uuid not null references public.ow_users(id) on delete cascade,
  -- 送った担当者（ow_users 空間）。担当者のアカウントが消えても記録は残す
  sender_user_id uuid references public.ow_users(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  body text check (body is null or char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  conversation_id uuid references public.ow_conversations(id) on delete set null,
  constraint ow_company_approaches_single_response check (accepted_at is null or declined_at is null)
);

create index if not exists ow_company_approaches_company_created
  on public.ow_company_approaches (company_id, created_at desc);
create index if not exists ow_company_approaches_candidate_created
  on public.ow_company_approaches (candidate_user_id, created_at desc);

alter table public.ow_company_approaches enable row level security;
revoke all on public.ow_company_approaches from anon, authenticated;
grant all on public.ow_company_approaches to service_role;

comment on table public.ow_company_approaches is
  E'企業からの「声かけ」（2026-10-09）。求職者が承認したときに初めて企業との会話を開く。\nRLS 有効・ポリシー0本・anon/authenticated に GRANT 無し。読み書きは admin クライアントだけ。\n⚠️ declined_at は企業に見せない（企業側は承認されるまで「まだ承認されていません」のまま）。';
comment on column public.ow_company_approaches.declined_at is
  '求職者が見送った日時。⚠️ 企業には伝えない（画面にも API にも出さない）。';

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
begin
  if has_table_privilege('authenticated', 'public.ow_company_approaches', 'SELECT')
     or has_table_privilege('anon', 'public.ow_company_approaches', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_approaches', 'INSERT') then
    raise exception '検算失敗: ow_company_approaches がクライアントから読み書きできる';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.ow_company_approaches'::regclass) then
    raise exception '検算失敗: ポリシーがある（0本のはず）';
  end if;
  raise notice '検算OK: ow_company_approaches を作った（運営だけが読める形）';
end $$;

commit;

-- ★戻すとき:
--   drop table public.ow_company_approaches;
