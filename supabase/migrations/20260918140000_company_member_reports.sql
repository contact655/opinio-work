-- 「在籍していない人として報告」を受け取る表（2026-09-18 / B7）
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- これまで企業は `/biz/employees` の「非表示」で、自社ページから人を直接消せた
-- （`ow_company_hidden_experiences`）。これは**本人の申告を企業が黙って取り消せる**形で、
-- 「本人の申告です。OPINIO は在籍確認を行っていません」という画面の説明と噛み合わない。
-- → 企業からは**報告**を受け取り、**外すかどうかは運営が判断する**。
--
-- ⚠️★**`ow_company_hidden_experiences` は DROP しない。** 運営が実際に外すときの表として
--    残す（下で企業向けのポリシーだけ落とす）。実データは 2026-09-18 時点で **0行**。
--
-- ── 権限の形は `ow_transitions` と同じ ────────────────────────────────────
--   RLS 有効 ／ ポリシー **0本** ／ anon・authenticated に GRANT **なし**
--   ＝ 読み書きできるのは `service_role`（＝`createAdminClient`）だけ。
-- ⚠️★**「誰にも読ませない」は GRANT で書く。** ポリシーを足すと、
--    GRANT が無いので**死んだポリシー**になり、次に読む人を誤らせる（下の ② がまさにそれ）。

begin;

-- ① 報告テーブル
create table if not exists public.ow_company_member_reports (
  id            uuid primary key default gen_random_uuid(),

  company_id    uuid not null references public.ow_companies(id)   on delete cascade,
  /* ⚠️ 人（user_id）ではなく**経歴（experience_id）**に対して報告する。
        同じ人が同じ会社に複数の在籍期間を持つことがあり（実測: セールスフォースの
        1人が3行）、人単位だと「どの在籍が違うのか」が運営に伝わらない。 */
  experience_id uuid not null references public.ow_experiences(id) on delete cascade,

  /* ★何を報告しているか。⚠️**選択肢が決まっている値なので3層を揃える**
        （UI / API / DB の CHECK）。唯一の出どころは
        [lib/constants/memberReports.ts](../../src/lib/constants/memberReports.ts)。
     ⚠️ 値を足す日は、この CHECK と定数を**同じコミットで**広げること。 */
  reason        text not null check (reason in ('never_employed', 'left')),
  /* 運営が確認するための一言（任意）。「2024年3月に退職」「別会社と混同のようです」など。
     ⚠️ 入力欄と同じコミットで足してある。**片方だけ作らない**
        （「入力させたのに保存しない」「保存するのに入力できない」の両方を避ける）。 */
  note          text,

  /* 報告した企業の担当者。⚠️ `ow_company_hidden_experiences.hidden_by` と同じ形
        （`ow_company_admins.id` を指す。担当者が外れても報告は残す）。 */
  reported_by   uuid references public.ow_company_admins(id) on delete set null,
  reported_at   timestamptz not null default now(),

  /* 運営が対応したら入る。⚠️★**`/admin` の要対応は `resolved_at is null` で数える。** */
  resolved_at   timestamptz,
  /* ⚠️ 運営のユーザー。**`ow_users.id`（auth.uid() ではない）**。
        DB 関数の規約と同じで、空間を名前で示せない列なのでここに書いておく。 */
  resolved_by   uuid references public.ow_users(id) on delete set null,

  /* ⚠️★同じ経歴を二重に報告させない。企業が何度押しても1行のまま
        （アプリ側は 23505 を正常として扱う）。 */
  unique (company_id, experience_id)
);

comment on table public.ow_company_member_reports is
  '企業からの「この人は在籍していない」という報告。運営専用（RLS 有効・ポリシー0本・GRANT なし）。外す操作そのものは ow_company_hidden_experiences。';
comment on column public.ow_company_member_reports.experience_id is
  '報告対象の経歴。人単位ではなく在籍期間単位で受ける。';
comment on column public.ow_company_member_reports.reason is
  'never_employed（在籍したことがない）/ left（退職済み）。許容値は lib/constants/memberReports.ts と同じ集合にすること。';
comment on column public.ow_company_member_reports.note is
  '企業からの補足（任意）。運営が確認するときの手がかり。';
comment on column public.ow_company_member_reports.resolved_at is
  'NULL のあいだ /admin の要対応に出る。';
comment on column public.ow_company_member_reports.resolved_by is
  'ow_users.id（auth.users.id ではない）。';

-- 要対応の一覧は「未対応を古い順」で見るので、その形の索引を1本だけ張る。
-- ⚠️ FK ごとに索引を足さないこと（このDBは既に 411本・インデックスが実データの60%）。
create index if not exists idx_company_member_reports_open
  on public.ow_company_member_reports (reported_at)
  where resolved_at is null;

-- ② RLS は有効にするが、ポリシーは1本も作らない（= 誰にも開かない）
alter table public.ow_company_member_reports enable row level security;

-- ③ 念のため明示的に revoke（既定でも付かないが、意図を残す）
revoke all on public.ow_company_member_reports from anon, authenticated;

-- ④ ★`ow_company_hidden_experiences` を運営専用にする
--    ⚠️ 落とすのは**死んでいるポリシー**。この表は anon にも authenticated にも
--       GRANT が無いので、RLS まで到達せず、このポリシーは一度も評価されていない
--       （実測 2026-09-18: `information_schema.role_table_grants` に行が無い）。
--    ⚠️★**残すと「企業が自分で消せる」と読めてしまう。** B7 で企業側の書き込み経路
--       （POST/DELETE /api/biz/hidden-experiences）を削除するので、意図を DB 側にも合わせる。
drop policy if exists company_admin_manage_own_hidden on public.ow_company_hidden_experiences;

comment on table public.ow_company_hidden_experiences is
  '運営が企業ページから外した経歴。運営専用（企業は ow_company_member_reports で報告するだけ）。';

-- ⑤ 事後チェック
do $$
declare v_pol int; v_grants int; v_hidden_pol int;
begin
  select count(*) into v_pol from pg_policy p join pg_class c on c.oid=p.polrelid
   where c.relname = 'ow_company_member_reports';
  if v_pol <> 0 then
    raise exception '中止: ow_company_member_reports にポリシーが % 本ある（運営専用なので0本が正しい）', v_pol;
  end if;

  select count(*) into v_grants from information_schema.role_table_grants
   where table_schema='public' and table_name='ow_company_member_reports'
     and grantee in ('anon','authenticated');
  if v_grants <> 0 then
    raise exception '中止: anon / authenticated に GRANT が % 件残っている', v_grants;
  end if;

  select count(*) into v_hidden_pol from pg_policy p join pg_class c on c.oid=p.polrelid
   where c.relname = 'ow_company_hidden_experiences' and p.polname = 'company_admin_manage_own_hidden';
  if v_hidden_pol <> 0 then
    raise exception '中止: 企業向けの死んだポリシーが残っている';
  end if;

  if not exists (select 1 from pg_class where relname='ow_company_member_reports' and relrowsecurity) then
    raise exception '中止: RLS が有効になっていない';
  end if;

  -- reason の CHECK が2値で入っていること（3層のうちの DB 層）
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ow_company_member_reports'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%never_employed%'
       and pg_get_constraintdef(oid) like '%left%'
  ) then
    raise exception '中止: reason の CHECK が想定どおりでない';
  end if;

  raise notice 'OK: 運営専用（RLS 有効 / ポリシー0本 / anon・authenticated に GRANT なし）';
end $$;

commit;
