-- 面談可を本人が切り替えられるようにする（2026-08-24）
--
-- ★方針変更（柴さんの判断）。**会社の事前承認をやめ、LinkedIn と同じ「自己申告で即掲載・
--   会社は後から外せる」に変える。**
--
-- ── なぜ変えたか（実測 2026-08-24 / 本番）──────────────────────────────────
--   `ow_company_members` は6行。**`approved_at` が入っている行は0件**。
--   掲載中4件のうち3件は**管理者が0人の会社**の行で、企業が承認した実績は一度も無い。
--   そもそも有効な管理者がいる企業は **79社中7社**。
--   残り72社では承認できる人が存在せず、本人が申請しても永久に「確認待ち」になる。
--
--   加えて `/people` の注記は既に「**OPINIO は在籍確認を行っていません**」と書いており、
--   「会社が在籍を確認してから掲載されます」という説明と食い違っていた。
--
-- ⚠️ **なりすましの受け止め方が変わる。** 事前に止めるのではなく、
--    ①在籍として申告している会社にしか出せない（下の EXISTS）
--    ②企業はいつでも非掲載にできる（`/biz/members` の公開トグル・実装済み）
--    ③画面に「本人の申告です。OPINIO は在籍確認をしていません」と明記する
--    の3つで受ける。**①を外さないこと。** 外すと任意の会社に出せるようになる。

-- ── ① guard_member_consent の ID 空間を直す ────────────────────────────────
-- ⚠️ `ow_company_members.user_id` は **ow_users.id**、`auth.uid()` は **auth.users.id**。
--    比較しても決して一致しないため、「本人のみが変更できる」はずの分岐が
--    **本人を弾き、運営だけを通していた**（CLAUDE.md「DB 関数の書き方」の実例）。
--    本人がトグルを押す経路を作る以上、ここを直さないと必ず踏む。
create or replace function public.guard_member_consent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- 同意状態が変更されようとしている
  if new.display_consent is distinct from old.display_consent then
    -- 本人以外は変更できない
    -- ⚠️ `auth.uid()`（auth 空間）ではなく `auth_ow_user_id()`（ow_users 空間）と比べる。
    if new.user_id is distinct from public.auth_ow_user_id() then
      -- ただし OPINIO の admin は例外（サポート対応のため）
      -- ⚠️ こちらは `ow_user_roles.user_id` が auth 空間なので `auth.uid()` のままが正しい。
      if not exists (
        select 1 from ow_user_roles
        where ow_user_roles.user_id = auth.uid()
          and ow_user_roles.role = 'admin'
      ) then
        raise exception '面談対応者の公開同意は、本人のみが変更できます'
          using errcode = 'P0003';
      end if;
    end if;

    -- 同意した場合は日時を記録する
    -- ⚠️ **取り下げても消さない**（2026-08-24 に変更）。`consent_at` を null に戻すと
    --    「招待されて未応答」と「一度ONにして自分でOFF」が区別できなくなり、
    --    自分でOFFにした人の画面に「会社から依頼が届いています」が出てしまう。
    --    意味は「**最後に同意した日時**」。
    if new.display_consent = true then
      new.consent_at := now();
    end if;
  end if;

  return new;
end;
$function$;

-- ── ② member_self_apply: 本人が公開状態で作れるようにする ────────────────────
-- ⚠️ 変更点は `is_public = false` の縛りを外したことと、`approved_at is null` を
--    要求しなくなったことの2つだけ。**在籍している会社であることの EXISTS は維持する。**
drop policy if exists member_self_apply on public.ow_company_members;

create policy member_self_apply on public.ow_company_members
  for insert to authenticated
  with check (
    user_id = auth_ow_user_id()
    and display_consent = true
    and created_via = 'self'
    -- ★在籍として申告している会社にしか作れない。**この条件が唯一の入口の絞り。**
    and exists (
      select 1 from ow_experiences e
      where e.user_id = auth_ow_user_id()
        and e.company_id = ow_company_members.company_id
        and e.is_current = true
    )
  );

-- ── ③ own_member_consent（UPDATE）に在籍チェックを足す ──────────────────────
-- ⚠️ **既存の穴を塞ぐ。** このポリシーは列も条件も絞っておらず、`authenticated` は
--    テーブルレベルの UPDATE を持つ（実測: `has_table_privilege` = true / 列単位 0件）。
--    そのため本人は PostgREST を直に叩けば
--      ・`is_public` を true にして承認を飛ばす
--      ・`company_id` を書き換えて**在籍していない会社**に出す
--    のどちらもできた。①②で公開を本人に開く以上、後者は必ず塞ぐ。
--
-- ⚠️ **在籍チェックは「公開する側」にだけ掛ける。** 退職して `is_current` が
--    false になった人が**自分で掲載を止められなくなる**ため、
--    `is_public = false` にする更新は無条件で通す。
drop policy if exists own_member_consent on public.ow_company_members;

create policy own_member_consent on public.ow_company_members
  for update to authenticated
  using (user_id = auth_ow_user_id())
  with check (
    user_id = auth_ow_user_id()
    and (
      is_public = false
      or exists (
        select 1 from ow_experiences e
        where e.user_id = auth_ow_user_id()
          and e.company_id = ow_company_members.company_id
          and e.is_current = true
      )
    )
  );

-- ── 適用後の実測（catalog を見るだけでは足りないので、後で PostgREST も叩く）──
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.guard_member_consent'::regproc) into v_def;
  if v_def ~ 'new\.user_id\s*<>\s*auth\.uid\(\)' then
    raise exception 'guard_member_consent がまだ auth.uid() と比較している';
  end if;
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.ow_company_members'::regclass and polname = 'member_self_apply'
       and pg_get_expr(polwithcheck, polrelid) ~ 'is_current'
  ) then
    raise exception 'member_self_apply から在籍チェックが消えている';
  end if;
  if exists (
    select 1 from pg_policy
     where polrelid = 'public.ow_company_members'::regclass and polname = 'member_self_apply'
       and pg_get_expr(polwithcheck, polrelid) ~ 'is_public = false'
  ) then
    raise exception 'member_self_apply がまだ is_public=false を強制している';
  end if;
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.ow_company_members'::regclass and polname = 'own_member_consent'
       and pg_get_expr(polwithcheck, polrelid) ~ 'is_current'
  ) then
    raise exception 'own_member_consent に在籍チェックが入っていない';
  end if;
end $$;
