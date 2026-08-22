-- 面談対応者に「本人発の申請」を作れるようにする（2026-08-23 / フェーズ2 ステップ1）
--
-- いままで ow_company_members に行を作れるのは**企業の招待だけ**だった。
-- 本人発の入口を開けると、その前提が外れる:
--   `ow_experiences` の在籍は**自己申告**なので、即公開にすると誰でも
--   「セールスフォース在籍」と書いて企業ページに実名・顔写真・/u/ リンクつきで並べられる。
-- → **本人は「申請」までしか作れない。公開は企業側の承認（is_public）を要する。**
--
-- 状態は4つ:
--   行なし                                = 未選択
--   display_consent=true,  is_public=false = **申請中（承認待ち）** ← 今回できるようになる状態
--   display_consent=true,  is_public=true  = 公開中
--   display_consent=false, is_public=false = 企業が招待したが本人未承認（従来からある）
--
-- ⚠️ `display_consent=true / is_public=false` は 2026-08-22 時点で**実データ0件**。
--    「一度も存在したことがない状態」を新しく作る変更なので、表示経路を実測で確認済み:
--    企業ページ・feed 右レール・/people はいずれも**両フラグを要求**しており出ない。
--    PostgREST も RLS `public_members_read`（is_public AND display_consent）で返らない。

-- ── ① created_via ────────────────────────────────────────────────────────────
--
-- 無いと「`invited_at` が NULL なら本人発」という暗黙ルールになる。
-- 実際 `invited_at` は既存6行中4行が NULL（企業側が作った行でも NULL がある）ので、
-- **`invited_at` では判別できない。**
--
-- ⚠️ 既存行は**バックフィルしない**（NULL のまま）。
--    どの経路で作られたかの記録が無いものを、後から推測で埋めない
--    （CLAUDE.md「推測値を投入しない」）。**NULL = 「この列より前に作られた／不明」。**
--    これにより既存6行の挙動は一切変わらない（下の canPost の条件も NULL には当たらない）。
--
-- ⚠️ 語彙は兄弟テーブル `ow_company_admins.created_via`
--    （NULL または 'invite' / 'join_request' / 'admin' / 'migration'）と**形は揃えたが、
--    本人発の値だけ `'self'` にしてある**（あちらは同じ概念を 'join_request' と呼ぶ）。
--    ⚠️ 2表で名前が違うので、片方を見て他方を推測しないこと。

alter table public.ow_company_members
  add column if not exists created_via text;

alter table public.ow_company_members
  drop constraint if exists ow_company_members_created_via_check;

alter table public.ow_company_members
  add constraint ow_company_members_created_via_check
  check (created_via is null or created_via in ('self', 'invite', 'admin', 'migration'));

comment on column public.ow_company_members.created_via is
  'この行がどう作られたか。self=本人がマイページから申請 / invite=企業が招待 / admin=運営 / migration=移行。NULL は列を足す前に作られた行（推測で埋めない）';

-- ⚠️★このテーブルの SELECT は**列単位 GRANT**（2026-08-22 の 20260822090000 で
--    テーブルレベルを落として11列を配り直した）。**足した列は権限が無い状態で生まれる。**
--    書かないと「値はあるが読めない」列になり、select に混ぜたクエリが丸ごと 403 になる。
--
-- ⚠️ anon には配らない。どの経路で登録されたかは閲覧者に関係が無く、
--    表示に使う経路（企業ページ・feed・/people）は service_role で読んでいる。
grant select (created_via) on public.ow_company_members to authenticated;

-- ── ② 本人が「申請」だけを作れる RLS ─────────────────────────────────────────
--
-- 既存の INSERT ポリシーは `company_admin_invite_member`（企業管理者・display_consent=false 縛り）
-- の1本だけで、本人は自分の行を作れなかった。
--
-- ⚠️ INSERT ポリシーは**permissive（OR）**なので、既存ポリシーには触らない。
--    どちらか一方を満たせば通る。
--
-- ⚠️ WITH CHECK で3つとも縛る。1つでも欠けると入口の意味が無くなる:
--    - `user_id = auth_ow_user_id()`   … 他人の行を作れない
--    - `is_public = false`             … ★**本人は公開にできない**（承認を飛ばせない）
--    - `display_consent = true`        … 申請＝本人の同意。CHECK 制約とも整合する
--    - `created_via = 'self'`          … 企業発を騙れない
--    - EXISTS(ow_experiences …)        … ★**在籍を申告している会社にしか出せない**
--
-- ⚠️ EXISTS の中の `ow_experiences` は**実行ユーザーの権限で評価される**
--    （CLAUDE.md「ポリシー式は実行ユーザーの権限で評価される」）。
--    `authenticated` は user_id / company_id / is_current の SELECT を持ち（実測 true）、
--    RLS `ow_experiences_own_manage` で**自分の経歴は読める**ので成立する。
--    ⚠️ 逆に言えば、他人の経歴は読めないので**他人の在籍を根拠にできない**。
--
-- ⚠️ `UNIQUE (company_id, user_id)` があるので、同じ会社に二重申請はできない。

drop policy if exists member_self_apply on public.ow_company_members;

create policy member_self_apply on public.ow_company_members
  for insert to authenticated
  with check (
    user_id = public.auth_ow_user_id()
    and display_consent = true
    and is_public = false
    and created_via = 'self'
    and exists (
      select 1
      from public.ow_experiences e
      where e.user_id = public.auth_ow_user_id()
        and e.company_id = ow_company_members.company_id
        and e.is_current = true
    )
  );

-- ── ③ 未承認の本人申請には投稿権限を渡さない ────────────────────────────────
--
-- `posts_insert_own` は「ow_company_members に行があること」だけを見ていた。
-- そのままだと**申請した瞬間に、承認前でフィード投稿権限が付く**。
--
-- ⚠️ 2026-08-05 の判断（「投稿は本人の能動的な行為であって、掲載同意で守る対象ではない」）は
--    **そのまま生きている**。ここで足すのは掲載同意の軸ではなく、
--    **「在籍がまだ企業に確認されていない」という別の軸**。
--    だから `display_consent` ではなく `created_via='self' and not is_public` で切る。
--
-- ⚠️ 既存行は `created_via` が NULL なので**この条件に当たらない**。
--    招待済み・未同意の人（現在1名）は今までどおり投稿できる。挙動は変わらない。
--
-- ⚠️ アプリ側（lib/feed/canPost.ts）と**両方**直すこと。片方だけだと PostgREST 直で抜けられる。

drop policy if exists posts_insert_own on public.ow_posts;

-- ⚠️ 元のポリシーは **to authenticated**（PUBLIC ではない）。作り直すときに
--    `to public` と書くと**権限を広げてしまう**。ロールまで元と同じにすること。
create policy posts_insert_own on public.ow_posts
  for insert to authenticated
  with check (
    user_id = (select ow_users.id from ow_users where ow_users.auth_id = auth.uid())
    and exists (
      select 1
      from ow_company_members m
      where m.user_id = ow_posts.user_id
        -- ★未承認の本人申請は「まだ在籍が確認されていない」ので数えない
        and not (coalesce(m.created_via, '') = 'self' and m.is_public = false)
    )
  );

-- ── アサート ────────────────────────────────────────────────────────────────
-- ⚠️ catalog を見ているだけ。適用後に3者（本人 / 別の一般ユーザー / 企業管理者）で
--    PostgREST を直接叩いて実測すること。
do $$
begin
  if not has_column_privilege('authenticated','public.ow_company_members','created_via','SELECT') then
    raise exception 'authenticated lost SELECT on ow_company_members.created_via';
  end if;
  if has_column_privilege('anon','public.ow_company_members','created_via','SELECT') then
    raise exception 'anon should NOT have SELECT on ow_company_members.created_via';
  end if;
  -- 既存の11列を巻き添えにしていないこと
  if not has_column_privilege('anon','public.ow_company_members','role_title','SELECT') then
    raise exception 'anon lost SELECT on ow_company_members.role_title';
  end if;
  if not exists (select 1 from pg_policy where polrelid='public.ow_company_members'::regclass and polname='member_self_apply') then
    raise exception 'member_self_apply policy missing';
  end if;
  if not exists (select 1 from pg_policy where polrelid='public.ow_posts'::regclass and polname='posts_insert_own') then
    raise exception 'posts_insert_own policy missing';
  end if;
  -- ★ロールを広げていないこと（元は authenticated。PUBLIC にすると anon にも開く）
  if exists (
    select 1 from pg_policy
    where polrelid='public.ow_posts'::regclass and polname='posts_insert_own'
      and polroles = '{0}'::oid[]
  ) then
    raise exception 'posts_insert_own was widened to PUBLIC (must stay authenticated)';
  end if;
  if not exists (
    select 1 from pg_policy p
    where p.polrelid='public.ow_posts'::regclass and p.polname='posts_insert_own'
      and 'authenticated'::regrole = any(p.polroles)
  ) then
    raise exception 'posts_insert_own is not granted to authenticated';
  end if;
  -- 企業招待の INSERT ポリシーを消していないこと
  if not exists (select 1 from pg_policy where polrelid='public.ow_company_members'::regclass and polname='company_admin_invite_member') then
    raise exception 'company_admin_invite_member policy missing';
  end if;
  -- ポリシー式が参照する ow_experiences の列を authenticated が読めること
  if not has_column_privilege('authenticated','public.ow_experiences','company_id','SELECT') then
    raise exception 'authenticated cannot read ow_experiences.company_id (policy would fail)';
  end if;
  if not has_column_privilege('authenticated','public.ow_experiences','is_current','SELECT') then
    raise exception 'authenticated cannot read ow_experiences.is_current (policy would fail)';
  end if;
end $$;
