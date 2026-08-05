-- ═══════════════════════════════════════════════════════════════════════════
-- 投稿ゲートを「メンバー行の存在」に緩め、柴さんを ow_company_members に追加する
--
-- ── なぜ is_public をやめるか（2026-08-05）─────────────────────────────────
-- 直前の 20260805045237 では条件を is_public = true にしていたが、
-- ow_company_members には CHECK 制約
--   check_public_requires_consent (is_public = false OR display_consent = true)
-- があり、is_public = true は display_consent = true を含意する。
-- そのため is_public でゲートすると「面談の掲載に同意した人だけが発信できる」形になり、
-- 「面談の可否と発信の可否は別」という方針と逆になっていた。
--
-- 投稿は本人の能動的な行為であって、掲載同意で守る対象ではない。
-- 条件はメンバー行の存在だけにする。
--
-- ⚠️ 結果として is_public = false のメンバー（招待済み・未同意。2026-08-05 時点で1名、
--    セールスフォースの「現場担当」）も投稿できるようになる。これは許容する判断。
-- ⚠️ is_test = true の20名はメンバー行が無いので引き続き投稿できない。
-- ⚠️ service_role は RLS を通らないので、システム投稿3経路は影響を受けない。
--
-- ── 柴さんの追加 ────────────────────────────────────────────────────────────
-- ⚠️ is_public = false / display_consent = false で入れる。
--    CHECK 制約を満たし、かつ「面談OKな人」にも出ない。
--    面談に出すかどうかは本人の意思なので、ここで勝手に true にしない
--    （display_consent は guard_member_consent トリガーが本人以外の変更を禁じている）。
--
-- ⚠️ 紐付け先は 株式会社Opinio（cf44d740）。株式会社Third Box（81cae8d8）ではない。
--    Third Box は旧社名で、マスタには両方の行が存在する。中身が入っていて
--    公開されているのは Opinio 側（slug=opinio / url / tagline / 求人2件 / 記事1件）。
--    Third Box 側は ow_company_admins 3行だけのスタブ。
--    重複の整理は別途判断するので、ここでは触らない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_members int; v_shiba uuid; v_opinio uuid; v_eligible int;
BEGIN
  SELECT count(*) INTO v_members FROM public.ow_company_members;
  IF v_members <> 5 THEN
    RAISE EXCEPTION 'ow_company_members が % 行（想定5）。中止', v_members;
  END IF;

  SELECT id INTO v_shiba FROM public.ow_users WHERE email = 's.hisato1020@gmail.com';
  IF v_shiba IS NULL THEN RAISE EXCEPTION '柴さんの ow_users が見つからない。中止'; END IF;
  IF EXISTS (SELECT 1 FROM public.ow_company_members WHERE user_id = v_shiba) THEN
    RAISE EXCEPTION '柴さんは既に ow_company_members にいる。中止';
  END IF;

  -- 紐付け先は「株式会社Opinio」ちょうど1行であること
  SELECT count(*) INTO v_eligible FROM public.ow_companies WHERE name = '株式会社Opinio';
  IF v_eligible <> 1 THEN
    RAISE EXCEPTION '株式会社Opinio が % 行（想定1）。中止', v_eligible;
  END IF;
  SELECT id INTO v_opinio FROM public.ow_companies WHERE name = '株式会社Opinio';
  IF v_opinio <> 'cf44d740-b835-454d-91a3-f1e2eddc7251'::uuid THEN
    RAISE EXCEPTION '株式会社Opinio の id が想定と違う（%）。中止', v_opinio;
  END IF;

  RAISE NOTICE '適用前: ow_company_members % 行', v_members;
END $$;

-- ── ① ゲート条件をメンバー行の存在だけにする ──────────────────────────────
DROP POLICY IF EXISTS posts_insert_own ON public.ow_posts;

CREATE POLICY posts_insert_own ON public.ow_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT ow_users.id FROM public.ow_users WHERE ow_users.auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.ow_company_members m
       WHERE m.user_id = ow_posts.user_id
    )
  );

COMMENT ON POLICY posts_insert_own ON public.ow_posts IS
  '自分の行であること、かつ ow_company_members に行があること。'
  ' is_public / display_consent は条件に含めない。'
  ' CHECK 制約 check_public_requires_consent により is_public は display_consent を含意するため、'
  ' is_public でゲートすると「面談に同意した人だけが発信できる」形になってしまうため。'
  ' service_role は RLS を通らないのでシステム投稿には影響しない。'
  ' アプリ側の同条件は src/lib/feed/canPost.ts にある。';

-- ── ② 柴さんを株式会社Opinio のメンバーに ─────────────────────────────────
--    ⚠️ INSERT のみ。既存行は触らない。
INSERT INTO public.ow_company_members (company_id, user_id, is_public, display_consent, role_title)
SELECT c.id, u.id, false, false, '代表'
  FROM public.ow_companies c, public.ow_users u
 WHERE c.name = '株式会社Opinio' AND u.email = 's.hisato1020@gmail.com';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_members int; v_eligible int; v_src text;
BEGIN
  SELECT count(*) INTO v_members FROM public.ow_company_members;
  IF v_members <> 6 THEN
    RAISE EXCEPTION 'ow_company_members が % 行（想定6）。ロールバック', v_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ow_company_members m
      JOIN public.ow_users u ON u.id = m.user_id
      JOIN public.ow_companies c ON c.id = m.company_id
     WHERE u.email = 's.hisato1020@gmail.com'
       AND c.id = 'cf44d740-b835-454d-91a3-f1e2eddc7251'::uuid
       AND m.is_public = false AND m.display_consent = false
  ) THEN
    RAISE EXCEPTION '柴さんの行が想定どおりでない。ロールバック';
  END IF;

  -- ポリシーから is_public が消えていること
  SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) INTO v_src
    FROM pg_policy pol
   WHERE pol.polname = 'posts_insert_own' AND pol.polrelid = 'public.ow_posts'::regclass;
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'posts_insert_own が無い。ロールバック';
  END IF;
  IF v_src LIKE '%is_public%' THEN
    RAISE EXCEPTION 'ポリシーに is_public が残っている（%）。ロールバック', v_src;
  END IF;

  -- 「面談OKな人」の対象は増えていないこと（柴さんは display_consent = false）
  SELECT count(*) INTO v_eligible
    FROM public.ow_company_members WHERE is_public = true AND display_consent = true;
  IF v_eligible <> 4 THEN
    RAISE EXCEPTION '面談OKな人の対象が % 名（想定4・不変）。ロールバック', v_eligible;
  END IF;

  RAISE NOTICE
    '完了: ow_company_members % 行（投稿できる人 = 全メンバー % 名）。面談OKな人は % 名で不変',
    v_members, v_members, v_eligible;
END $$;

COMMIT;
