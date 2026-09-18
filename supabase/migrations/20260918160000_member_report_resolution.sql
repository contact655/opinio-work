-- 報告に「結果」を持たせる（2026-09-18 / C-9）
--
-- ── いまの形と、足りないもの ──────────────────────────────────────────────
-- `ow_company_member_reports` は `resolved_at` しか持たないので、
-- **「確認して外した」と「確認したが外さなかった（却下）」が区別できない。**
-- 企業側からも、報告済み表示のまま結果が分からない。
--
-- ── 決めたこと ────────────────────────────────────────────────────────────
-- ① 結果は `resolution`（`hidden` / `rejected`）で持つ。
--    ⚠️★**`status` 1列に畳まない。** 「いつ対応したか」は `resolved_at` が既に持っており、
--       1列にすると**運営の対応日時が消える**（面談対応者の `ops_reviewed_at` と同じ形で、
--       あちらも日時を残している）。
--    ⚠️★**`resolved_at` と `resolution` は必ず同時に入る**（下の CHECK で縛る）。
--       片方だけ入ると「対応済みだが結果不明」という読めない行ができる。
--
-- ② 却下の理由は `resolution_note`（任意）。★**企業の画面に出る前提の文面。**
--
-- ③ ★UNIQUE を**部分索引に置き換える**。
--    いまの `UNIQUE (company_id, experience_id)` だと、**却下されたあとに
--    同じ経歴を再報告できない**（状況が変わることがあるので再報告は許したい）。
--    → **未対応のあいだだけ**一意にする。対応済みの行は履歴として積む。
--    ⚠️ アプリ側の 23505 ハンドリング（「もう報告済み」）は**そのまま効く**
--       —— 未対応の行があるときだけ衝突するため。
--    ⚠️★**履歴を消さない。** 「いつ却下して、いつまた報告されたか」は
--       運営が判断するときの材料になる。

begin;

-- ① 事前チェック
do $$
declare v_rows int; v_unique int;
begin
  select count(*) into v_rows from public.ow_company_member_reports;
  /* ⚠️ 0件が正常な状態（2026-09-18 実測）。行があるなら、下の UPDATE で
        既存行に resolution を埋める必要があるので、その場で止めて確認する。 */
  if v_rows <> 0 then
    raise exception '中止: 既存の報告が %件ある。resolution の埋め方を決めてから当てること', v_rows;
  end if;

  select count(*) into v_unique from pg_constraint
   where conrelid = 'public.ow_company_member_reports'::regclass
     and conname = 'ow_company_member_reports_company_id_experience_id_key';
  if v_unique <> 1 then
    raise exception '中止: 想定していた UNIQUE 制約が無い（既に当てた？）';
  end if;
end $$;

-- ② 結果と理由
alter table public.ow_company_member_reports
  add column if not exists resolution      text,
  add column if not exists resolution_note text;

comment on column public.ow_company_member_reports.resolution is
  'hidden（企業ページから外した）/ rejected（確認したが外さなかった）。許容値は lib/constants/memberReports.ts と同じ集合にすること。';
comment on column public.ow_company_member_reports.resolution_note is
  '却下の理由（任意）。★企業の画面に出る。運営メモではない。';

-- ③ 値の集合（3層のうちの DB 層）
alter table public.ow_company_member_reports
  add constraint ow_company_member_reports_resolution_check
  check (resolution is null or resolution in ('hidden', 'rejected'));

-- ④ ★「対応済み」と「結果」は必ず揃う
alter table public.ow_company_member_reports
  add constraint ow_company_member_reports_resolved_pair
  check ((resolved_at is null) = (resolution is null));

-- ⑤ UNIQUE → 未対応だけの部分索引
alter table public.ow_company_member_reports
  drop constraint ow_company_member_reports_company_id_experience_id_key;

create unique index if not exists uq_company_member_reports_open
  on public.ow_company_member_reports (company_id, experience_id)
  where resolved_at is null;

-- ⑥ 事後チェック
do $$
declare v_id uuid; v_co uuid; v_exp uuid;
begin
  if exists (select 1 from pg_constraint
              where conrelid = 'public.ow_company_member_reports'::regclass
                and conname = 'ow_company_member_reports_company_id_experience_id_key') then
    raise exception '中止: 旧 UNIQUE が残っている';
  end if;
  if not exists (select 1 from pg_class where relname = 'uq_company_member_reports_open' and relkind = 'i') then
    raise exception '中止: 部分索引が作られていない';
  end if;
  if not exists (select 1 from pg_constraint
              where conrelid = 'public.ow_company_member_reports'::regclass
                and conname = 'ow_company_member_reports_resolved_pair') then
    raise exception '中止: resolved_at と resolution の対の CHECK が無い';
  end if;
  raise notice 'OK: resolution / resolution_note / 未対応だけの一意制約';
end $$;

commit;
