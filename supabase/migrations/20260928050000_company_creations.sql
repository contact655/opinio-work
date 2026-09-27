-- ★企業を「誰が作ったか」を記録する（2026-09-28 / 柴さんの指示）
--
-- ── なぜ要るか ──────────────────────────────────────────────────────────────
-- **検証用アカウントが作った企業行を見つける手段が、片方の入口に無かった。**
--
-- | 作られ方 | `ow_companies.source` | 作成者が辿れるか |
-- |---|---|---|
-- | `/biz` から企業が登録（`POST /api/biz/companies`） | `biz_self` | ✅ `ow_company_admins` の行ができる |
-- | **オンボーディングから求職者が登録**（`POST /api/jobseeker/companies`） | **`user`** | ❌ **どこにも記録が無い** |
--
-- ⚠️★**2026-09-28 に実際に取りこぼした。** CLAUDE.md に入れた検査SQLは
--    `ow_company_admins` を join するので、`source='user'` の企業は**構造上ヒットしない。**
--    その日に本番で作られた「株式会社テスト」は 0件 と出たまま残り、
--    柴さんが画面で気づいて初めて倒せた（`20260928043000`）。
--    **「0件だから取り残しが無い」と読める状態**になっていた。
--
-- ── なぜ `ow_companies` に列を足さないか ──────────────────────────────────
-- ⚠️★**`ow_companies` の SELECT は anon にテーブルレベル**（実測 2026-09-28: 153/153列）。
--    列を足すと **`is_published = true` の企業について、作成者の id が
--    PostgREST から誰にでも読める。** 列単位に配り直す手もあるが、
--    153列を配り直す migration は「1列漏らすとクエリが丸ごと 403」になる（CLAUDE.md）。
-- ⚠️★**既存の `ow_companies.user_id` を使わないこと。** あの列には
--    `ow_companies_own_select` / `ow_companies_own_update`（`auth.uid() = user_id`）が
--    掛かっており、**書いた瞬間にその利用者へ企業の閲覧・編集権を渡す。**
--    （2026-08-11 に「83社で0行更新」を起こした列。実測で2社にしか入っていない）
--
-- → **運営専用の別表にする。`ow_transitions` と同じ形**
--   （RLS 有効・ポリシー0本・anon / authenticated に GRANT 無し）。
--
-- ── 何を入れないか ──────────────────────────────────────────────────────────
-- ⚠️ `source` は**持たない。** `ow_companies.source` と二重管理になる。join して読む。
-- ⚠️ メールアドレス・氏名も**持たない。** `ow_users` から引ける。複製すると古くなる。
-- ⚠️★**バックフィルしない。** `source='user'` の既存企業は作成者を辿る手段が無く、
--    `biz_self` を `ow_company_admins` から埋めるのも**推測**になる
--    （管理者は後から足せるので「最初に作った人」とは限らない）。
--    **「記録が無い」という事実を残す**（CLAUDE.md「推測値を投入しない」）。

create table if not exists public.ow_company_creations (
  /* ⚠️ 1社につき1行。企業が消えたら記録も消す（企業なしの記録に意味が無い） */
  company_id uuid primary key references public.ow_companies(id) on delete cascade,
  /* ⚠️★**`ow_users.id` の空間**（`auth.uid()` ではない）。列名とFKの両方で示す。
        ⚠️ `on delete set null`。利用者が消えても「作られた」という事実は残す。 */
  created_by_ow_user_id uuid references public.ow_users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.ow_company_creations is
  '企業を作った利用者の記録（運営専用）。'
  '⚠️ anon / authenticated に GRANT しない（admin クライアントから読む）。'
  '⚠️ ow_companies に列を足さないのは、あの表の SELECT が anon にテーブルレベルのため。';
comment on column public.ow_company_creations.created_by_ow_user_id is
  '⚠️ ow_users.id の空間。auth.uid()（auth.users.id）ではない。';

create index if not exists ow_company_creations_by_user
  on public.ow_company_creations (created_by_ow_user_id);

alter table public.ow_company_creations enable row level security;

-- ⚠️ 明示的に剥がす。既定ACLで付いていないことは確かめるが、意図を残すために書く。
revoke all on public.ow_company_creations from anon, authenticated;

-- ⚠️★ポリシーは1本も書かない。誰にも開いていないので書くべきものが無い
--    （「誰にも読ませない」は GRANT で、「誰に読ませるか」は RLS で書く）。

-- ⚠️ 検算。**「テーブルができた」だけでは足りない。** 閉じていることまで見る。
do $$
declare
  n_pol bigint;
  anon_sel boolean;
  auth_sel boolean;
  rls boolean;
begin
  select count(*) into n_pol from pg_policy where polrelid = 'public.ow_company_creations'::regclass;
  if n_pol <> 0 then
    raise exception 'ポリシーが % 本ある（0本が正しい）', n_pol;
  end if;

  select relrowsecurity into rls from pg_class where oid = 'public.ow_company_creations'::regclass;
  if not rls then
    raise exception 'RLS が有効になっていない';
  end if;

  anon_sel := has_table_privilege('anon', 'public.ow_company_creations', 'SELECT');
  auth_sel := has_table_privilege('authenticated', 'public.ow_company_creations', 'SELECT');
  if anon_sel or auth_sel then
    raise exception 'SELECT が配られている（anon=% / authenticated=%）', anon_sel, auth_sel;
  end if;

  raise notice 'ow_company_creations を作った / ポリシー0本 / RLS 有効 / anon・authenticated に SELECT なし';
end $$;
