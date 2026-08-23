-- 冗長なインデックス18本を落とす（2026-08-23）
--
-- ⚠️ これは performance advisor の `unused_index`（137件）とは**別**。
--    あちらは「使われていない」＝使用統計に基づく判断で、いまは使えない
--    （2026-08-23 06:40 のコンピュート変更で統計がリセットされ、観測窓が1時間44分しかない。
--     411本中スキャンされたのは27本だけ）。
--
--    ここで落とすのは**使用統計に依存せず、構造的に冗長だと証明できるもの**だけ。
--      ① duplicate … 同じ列に UNIQUE 制約のインデックスと普通のインデックスが二重にある
--      ② prefix    … (a) が (a,b) の先頭部分列。btree は先頭列だけの検索にも使える
--
--    どちらも「同じ検索を覆う別のインデックスが必ず存在する」ので、読みは遅くならない。
--    消えるのは**書き込みのたびに余分なインデックスを更新するコスト**だけ。
--    とくに ow_users は auth_id と email に二重に張られており、ログインのたびに効く。
--
-- ⚠️ **制約（PRIMARY KEY / UNIQUE）を支えるインデックスは1本も落としていない。**
--    落とすのはすべて `CREATE INDEX` で作られた素のインデックス。
--
-- ⚠️ データは1行も触らない。テーブルの中身は変わらない。
--
-- ⚠️ 2026-08-23 の障害（Disk IO バジェット枯渇）と同じ方向の対策。
--    ただし本命は残り（統計が1週間たまってからの棚卸し）。
--    **FK にインデックスを足す advisor の指摘（65件）には従わないこと。**
--    このDBはユーザーテーブル10MBに対しインデックスが6MB・411本と既に過剰で、
--    20行のテーブルは Seq Scan のほうが速い（CLAUDE.md 参照）。

-- ── 安全確認: 覆う側のインデックスが実在しない状態では落とさない ──────────────
do $$
declare
  missing text;
begin
  select string_agg(x.covering, ', ')
    into missing
  from (values
    ('ow_articles_slug_key'),
    ('ow_company_domain_verifications_token_key'),
    ('ow_company_members_invite_token_key'),
    ('ow_users_email_key'),
    ('ow_users_auth_id_key'),
    ('ow_agent_jobs_pkey'),
    ('ow_bookmarks_user_id_target_type_target_id_key'),
    ('ow_company_admins_user_id_company_id_key'),
    ('ow_company_employee_categories_company_id_role_id_key'),
    ('ow_company_follows_follower_user_id_company_id_key'),
    ('ow_company_genres_pkey'),
    ('ow_company_hidden_experiences_company_id_experience_id_key'),
    ('ow_company_members_company_id_user_id_key'),
    ('ow_job_assignees_job_id_user_id_key'),
    ('ow_pipeline_stages_order_idx'),
    ('ow_post_likes_post_id_user_id_key'),
    ('ow_profile_desired_roles_user_id_role_id_key'),
    ('ow_scout_blocks_candidate_id_company_id_key')
  ) as x(covering)
  where not exists (
    select 1 from pg_indexes i
    where i.schemaname = 'public' and i.indexname = x.covering
  );

  if missing is not null then
    raise exception '覆う側のインデックスが見つからない: %。冗長ではないので中止する', missing;
  end if;
end $$;

-- ── ① 完全重複（UNIQUE 制約のインデックスと同じ列） ─────────────────────────
drop index if exists public.idx_ow_articles_slug;                 -- ← ow_articles_slug_key (slug) UNIQUE
drop index if exists public.idx_ow_domain_verif_token;             -- ← ow_company_domain_verifications_token_key (token) UNIQUE
drop index if exists public.idx_ow_company_members_invite_token;   -- ← ow_company_members_invite_token_key (invite_token) UNIQUE
drop index if exists public.idx_ow_users_email;                    -- ← ow_users_email_key (email) UNIQUE
drop index if exists public.idx_ow_users_auth_id;                  -- ← ow_users_auth_id_key (auth_id) UNIQUE

-- ── ② 先頭部分列（複合インデックスの先頭列と同じ） ──────────────────────────
drop index if exists public.ow_agent_jobs_agency_id_idx;           -- ← ow_agent_jobs_pkey (agency_id, job_id)
drop index if exists public.idx_ow_bookmarks_user;                 -- ← ow_bookmarks_user_id_target_type_target_id_key (user_id, target_type, target_id)
drop index if exists public.idx_ow_company_admins_user;            -- ← ow_company_admins_user_id_company_id_key (user_id, company_id)
drop index if exists public.idx_ow_company_employee_categories_company_id; -- ← ow_company_employee_categories_company_id_role_id_key (company_id, role_id)
drop index if exists public.ow_company_follows_follower_idx;       -- ← ow_company_follows_follower_user_id_company_id_key (follower_user_id, company_id)
drop index if exists public.idx_ow_company_genres_company;         -- ← ow_company_genres_pkey (company_id, genre_id)
drop index if exists public.idx_company_hidden_exp_company;        -- ← ow_company_hidden_experiences_company_id_experience_id_key (company_id, experience_id)
drop index if exists public.idx_ow_company_members_company;        -- ← ow_company_members_company_id_user_id_key (company_id, user_id)
drop index if exists public.idx_ow_job_assignees_job;              -- ← ow_job_assignees_job_id_user_id_key (job_id, user_id)
drop index if exists public.ow_pipeline_stages_company_id_idx;     -- ← ow_pipeline_stages_order_idx (company_id, order_index)
drop index if exists public.idx_ow_post_likes_post_id;             -- ← ow_post_likes_post_id_user_id_key (post_id, user_id)
drop index if exists public.ow_profile_desired_roles_user_id_idx;  -- ← ow_profile_desired_roles_user_id_role_id_key (user_id, role_id)
drop index if exists public.ow_scout_blocks_candidate_idx;         -- ← ow_scout_blocks_candidate_id_company_id_key (candidate_id, company_id)

-- ═══════════════════════════════════════════════════════════════════════════
-- 元に戻す場合（適用前の定義をそのまま控えてある。これがロールバックの実体）
-- ═══════════════════════════════════════════════════════════════════════════
-- CREATE INDEX idx_company_hidden_exp_company ON public.ow_company_hidden_experiences USING btree (company_id);
-- CREATE INDEX idx_ow_articles_slug ON public.ow_articles USING btree (slug);
-- CREATE INDEX idx_ow_bookmarks_user ON public.ow_bookmarks USING btree (user_id, target_type);
-- CREATE INDEX idx_ow_company_admins_user ON public.ow_company_admins USING btree (user_id);
-- CREATE INDEX idx_ow_company_employee_categories_company_id ON public.ow_company_employee_categories USING btree (company_id);
-- CREATE INDEX idx_ow_company_genres_company ON public.ow_company_genres USING btree (company_id);
-- CREATE INDEX idx_ow_company_members_company ON public.ow_company_members USING btree (company_id);
-- CREATE INDEX idx_ow_company_members_invite_token ON public.ow_company_members USING btree (invite_token);
-- CREATE INDEX idx_ow_domain_verif_token ON public.ow_company_domain_verifications USING btree (token);
-- CREATE INDEX idx_ow_job_assignees_job ON public.ow_job_assignees USING btree (job_id);
-- CREATE INDEX idx_ow_post_likes_post_id ON public.ow_post_likes USING btree (post_id);
-- CREATE INDEX idx_ow_users_auth_id ON public.ow_users USING btree (auth_id);
-- CREATE INDEX idx_ow_users_email ON public.ow_users USING btree (email);
-- CREATE INDEX ow_agent_jobs_agency_id_idx ON public.ow_agent_jobs USING btree (agency_id);
-- CREATE INDEX ow_company_follows_follower_idx ON public.ow_company_follows USING btree (follower_user_id);
-- CREATE INDEX ow_pipeline_stages_company_id_idx ON public.ow_pipeline_stages USING btree (company_id);
-- CREATE INDEX ow_profile_desired_roles_user_id_idx ON public.ow_profile_desired_roles USING btree (user_id);
-- CREATE INDEX ow_scout_blocks_candidate_idx ON public.ow_scout_blocks USING btree (candidate_id);
