-- ============================================================================
-- ow_companies の RLS から `status = 'active'` を外す
--   —— is_published を迂回する「第2の公開ゲート」を塞ぐ
--
-- 作業前ダンプ: .dumps/20260905-1437-ow_companies.sql
-- 調査: docs/phase0-company-status-20260905.md
-- ============================================================================
--
-- ── 何が起きていたか ────────────────────────────────────────────────────────
-- `ow_companies` の SELECT ポリシー2本が `status = 'active'` を参照していた。
--
--   ow_companies_public_read     USING (status = 'active')                        -- PUBLIC(anon含む)
--   ow_companies_published_read  USING (is_published = true OR status = 'active')  -- PUBLIC(anon含む)
--
-- `is_published` の COMMENT は「詳細ページが見えるか（404ゲート）」と書いてあるが、
-- **RLS はそれと違うことを言っていた** —— 運営が取り下げるつもりで
-- `is_published = false` にしても、その企業の `status` が `active` なら
-- **anon から PostgREST 経由で読めたまま**になる。
--
-- ⚠️ 画面からは漏れない（求職者側は `filterVisibleCompanies` /
--    `filterListedCompanies` を通す）。危ないのは **PostgREST を直接叩く経路**
--    ——CLAUDE.md「画面は正しく作られていても、PostgREST を直接叩く経路だけが
--    漏れているのが過去に見つかった穴の共通形」。
--
-- ⚠️★**適用前は本当に漏れていた。** 該当行が0件だったので、
--    is_test の検証企業を1社作って実測した（2026-09-05）:
--      status='active' / is_published=false / listing_status='draft'
--      → anon が読める企業が 90 → **91 社**に増え、名指しでも読めた
--    （検証企業は適用後の測定を終えてから削除する）
--
-- ── なぜ status を使わないと決めたか ────────────────────────────────────────
-- 「運営の承認待ち」には **`is_approved` が既にある**（`check_listed_requires_approval`
-- で実際に効いている）。**2つ目の承認軸を作らない。**
-- 掲載の判定は `is_published`（詳細ページ）/ `listing_status`（ディレクトリ）/
-- `is_approved`（運営の確認）の3軸で完結している。
--
-- ⚠️ **CHECK は入れない。** 外したあとこの列は完全に無参照になるので、
--    そのとき決めるのは CHECK ではなく**列の処遇**。
-- ⚠️ **列は DROP しない。** 無参照であることを実測で確かめてから別途判断する。

BEGIN;

-- ── 0. 事前チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_n int;
BEGIN
  -- 想定している2本が実在すること（名前が変わっていたら中止）
  SELECT count(*) INTO v_n FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace AND c.relname='ow_companies'
     AND p.polname IN ('ow_companies_public_read','ow_companies_published_read');
  IF v_n <> 2 THEN
    RAISE EXCEPTION '想定した2本のポリシーが見つからない（% 本）。中止', v_n;
  END IF;

  -- ★anon が読める行数の前提を確かめる。
  --   検証企業（status='active' かつ is_published=false）が1社ある状態で流す。
  SELECT count(*) INTO v_n FROM public.ow_companies
   WHERE status = 'active' AND is_published = false;
  IF v_n <> 1 THEN
    RAISE EXCEPTION
      '「status=active かつ is_published=false」が 1 社でない（% 社）。'
      '検証企業を作ってから流すこと（作らないと塞げたことを示せない）', v_n;
  END IF;
END $$;

-- ── 1. ★先に published_read を狭める ──────────────────────────────────────
--
-- ⚠️★**順序を守ること。①published_read の書き換え → ②public_read の DROP。**
--    逆順にすると、②と①のあいだで anon の読み取りが一瞬でも狭まる
--    （public_read を先に消すと、その瞬間 `status='active'` だけで読めていた行が落ちる）。
--
-- ⚠️★**CASCADE を使わない。** `published_read` は `is_published = true` の節も持っており、
--    **これが anon の唯一の読み取り経路**。列ごと CASCADE で消すと
--    `/companies`・sitemap・LP が全滅する。
--
-- ⚠️★**`listing_status = 'listed'` を足さないこと**（2026-09-05 の判断）。
--    足すと anon が読める範囲が 90社 → 83社に狭まる。**影響が別の話**なので、
--    やるなら独立したタスクにする。**今回は status の節を取り除くだけ。**
DROP POLICY IF EXISTS ow_companies_published_read ON public.ow_companies;
CREATE POLICY ow_companies_published_read
  ON public.ow_companies
  FOR SELECT
  USING (is_published = true);

-- ── 2. あとから public_read を落とす ──────────────────────────────────────
--   ⚠️ このポリシーは元から**完全に冗長**だった（条件が published_read の OR 節に
--      丸ごと含まれていた）。`status` の節を外したいまは、残す理由が無い。
DROP POLICY IF EXISTS ow_companies_public_read ON public.ow_companies;

-- ── 3. 列に「未使用」と書き残す ────────────────────────────────────────────
--   ⚠️ 列は残す。DROP の可否は別途判断する（docs/todo.md）。
COMMENT ON COLUMN public.ow_companies.status IS
  '⚠ 未使用。掲載の判定には使わない（is_published / listing_status / is_approved の3軸で完結）。'
  '2026-09-05 に RLS からも外した（それまでは status=''active'' が is_published を迂回する'
  '第2の公開ゲートになっていた）。実データは pending 91 / draft 5 / active 4 だが、'
  'pending は DB の DEFAULT のまま、active は 2026-05〜06 の遺物で書き込むコードは存在しない。'
  '⚠ 新しく読み書きしないこと。DROP の可否は別途判断（docs/todo.md）。';

-- ── 4. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_sel int; v_status_ref int; v_dep int;
BEGIN
  -- SELECT ポリシーは4本になるはず
  --   own_select / member_select / admin_read / published_read
  SELECT count(*) INTO v_sel FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace AND c.relname='ow_companies'
     AND p.polcmd IN ('r','*');
  IF v_sel <> 4 THEN RAISE EXCEPTION 'SELECT ポリシーが 4 本でない（% 本）', v_sel; END IF;

  -- ★どのポリシーも status を参照していないこと
  SELECT count(*) INTO v_status_ref FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace AND c.relname='ow_companies'
     AND (coalesce(pg_get_expr(p.polqual,p.polrelid),'') ~ '\mstatus\M'
       OR coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ~ '\mstatus\M');
  IF v_status_ref <> 0 THEN
    RAISE EXCEPTION 'まだ % 本のポリシーが status を参照している', v_status_ref;
  END IF;

  -- ★pg_depend 上の依存も0になること（列を落とせる状態か、の確認）
  SELECT count(*) INTO v_dep FROM pg_depend d
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
   WHERE d.refobjid = 'public.ow_companies'::regclass
     AND a.attname = 'status' AND d.deptype = 'n';
  IF v_dep <> 0 THEN RAISE EXCEPTION 'status への依存が % 本残っている', v_dep; END IF;

  -- anon の読み取り経路（is_published = true）が残っていること
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
     WHERE c.relnamespace='public'::regnamespace AND c.relname='ow_companies'
       AND p.polname = 'ow_companies_published_read'
       AND pg_get_expr(p.polqual, p.polrelid) = '(is_published = true)'
  ) THEN
    RAISE EXCEPTION 'published_read が想定どおりの形になっていない';
  END IF;

  RAISE NOTICE '事後チェック OK: SELECT ポリシー % 本 / status を参照するポリシー 0 本 / pg_depend 0 本', v_sel;
END $$;

COMMIT;
