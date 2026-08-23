-- 面談対応者の「初回承認」を記録する列を足す（2026-08-23）
--
-- ── なぜ要るか ──────────────────────────────────────────────────────────────
-- `memberState()` は `display_consent && !is_public && created_via='self'` を
-- `pending_company`（本人が申請し、企業の承認待ち）と判定している。
-- ところがこの条件は、**承認したあとで企業が非公開に戻した行にも再び合致する**。
--
--   申請 → 承認（listed）→ 企業が公開トグルを OFF
--     → display_consent=true / is_public=false / created_via='self'
--     → もう一度 pending_company に見える
--
-- そのため以下が起きる（self 行が本番に0件なので、まだ誰にも起きていない）:
--   ・/biz/members  … 承認済みの人が「本人からの申請（未承認）」に出戻る
--   ・/mypage       … 本人に「会社の確認待ち」と申請日が再表示される
--   ・A-3 の通知    … 非公開⇄公開を往復するたび「承認されました」が飛ぶ
--
-- 「一度でも承認したか」は現存する列からは復元できない。
--   `updated_at`  … どの更新でも動くので承認の記録にならない
--   `consent_at`  … 本人が同意した時刻。企業の承認時刻ではない
-- よって列を1つ足す。
--
-- ⚠️ `created_via` を承認時に書き換えて代用しない。出自の記録が消える。

alter table public.ow_company_members
  add column if not exists approved_at timestamptz;

comment on column public.ow_company_members.approved_at is
  '企業（または運営）が初回に承認した時刻。本人の同意時刻は consent_at。'
  '⚠️ 再掲載では更新しない。「一度でも承認されたか」を表す。';

-- ⚠️ バックフィルしない。
--    既存6行は created_via が NULL＝self 経路を通っていないので、承認という
--    イベント自体が無い。created_at で埋めると推測値の投入になる
--    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。

-- ── GRANT: 意図して配らない ────────────────────────────────────────────────
-- ⚠️★このテーブルの SELECT は**列単位**で配っている（20260822090000）。
--    したがって新しい列は「読めない状態で生まれる」。**これは漏れではない。**
--    approved_at を読むのは以下の2画面だけで、どちらも service role
--    （createAdminClient）で引いているため anon / authenticated の権限は要らない:
--      /biz/members  … app/biz/members/page.tsx
--      /mypage       … app/(jobseeker)/mypage/page.tsx
--    ⚠️ 将来ブラウザ側から読む必要が出たら、そのとき
--       `grant select (approved_at) on public.ow_company_members to authenticated;`
--       を**別の migration で明示的に**足すこと。ここで先回りして配らない。

do $$
begin
  if has_column_privilege('authenticated', 'public.ow_company_members', 'approved_at', 'SELECT') then
    raise exception 'approved_at が authenticated に見えている。列単位 GRANT の前提が崩れている';
  end if;
  if has_column_privilege('anon', 'public.ow_company_members', 'approved_at', 'SELECT') then
    raise exception 'approved_at が anon に見えている';
  end if;
end $$;

-- ── RLS: 申請者が自分で approved_at を埋められないようにする ────────────────
-- ⚠️ INSERT の権限は**テーブルレベル**なので、列単位 SELECT を剥がしても
--    申請者は approved_at を指定して INSERT できてしまう。
--    埋めた状態で申請されると、企業が承認したときに「初回承認」の条件
--    （approved_at is null）から外れ、**承認通知が静かに飛ばなくなる**。
--    実害は自分宛の通知の抑止だけだが、条件は1行で塞げる。
--
-- ⚠️ 既存の条件は 20260823040000 のものをそのまま持ち越している。
--    ここで条件を減らしていないことを、下の assert で確かめる。
drop policy if exists member_self_apply on public.ow_company_members;

create policy member_self_apply on public.ow_company_members
  for insert to authenticated
  with check (
    user_id = public.auth_ow_user_id()
    and display_consent = true
    and is_public = false
    and created_via = 'self'
    and approved_at is null
    and exists (
      select 1 from public.ow_experiences e
      where e.user_id = public.auth_ow_user_id()
        and e.company_id = ow_company_members.company_id
        and e.is_current = true
    )
  );

do $$
declare
  expr text;
begin
  select pg_get_expr(polwithcheck, polrelid) into expr
    from pg_policy where polrelid = 'public.ow_company_members'::regclass
     and polname = 'member_self_apply';

  if expr is null then
    raise exception 'member_self_apply が作られていない';
  end if;
  -- 既存条件が1つでも落ちていないこと
  if expr !~ 'display_consent = true' then raise exception 'display_consent の条件が落ちた'; end if;
  if expr !~ 'is_public = false'      then raise exception 'is_public の条件が落ちた'; end if;
  if expr !~ 'created_via'            then raise exception 'created_via の条件が落ちた'; end if;
  if expr !~ 'is_current'             then raise exception '在籍の条件が落ちた'; end if;
  if expr !~ 'approved_at IS NULL'    then raise exception 'approved_at の条件が入っていない'; end if;

  -- ⚠️ PUBLIC に広げていないこと（20260823040000 と同じ確認）
  if exists (
    select 1 from pg_policy
     where polrelid = 'public.ow_company_members'::regclass
       and polname = 'member_self_apply'
       and polroles = '{0}'::oid[]
  ) then
    raise exception 'member_self_apply が PUBLIC に広がっている';
  end if;
end $$;
