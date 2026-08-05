-- ═══════════════════════════════════════════════════════════════════════════
-- ow_company_admins.created_via — 行がどの経路で作られたかを記録する
--
-- ── なぜ要るか（2026-08-05）────────────────────────────────────────────────
-- POST /api/biz/join-request に、誰でも任意の企業の管理者になれる穴があった
-- （埋め込みの曖昧さで「既存adminの一覧」が常に空になり、即時承認が走っていた）。
-- 修正後に「過去に誤承認された行が無いか」を調べたが、10行のうち9行は
--   invited_by_user_id / invitation_token / invited_email / invited_at /
--   accepted_at / joined_at / agreed_* がすべて NULL で、
--   join_request / 管理画面からの直接追加 / migration の3経路が同じ形の行を作るため
-- **データからは区別できなかった**。
-- 今回は ow_user_roles に role='company_admin' の行が0件であることを根拠に
-- 「join-request 経由は0件」と判定できたが、これは副作用に頼った判定で再現性がない。
--
-- ⚠️ 既存10行は NULL のまま。埋めない。経路が判定できないものに
--    もっともらしい値を入れると、後から見たときに根拠のある記録と区別がつかなくなる。
--    （CLAUDE.md「値が無いことを、ある値に置き換えない」）
--
-- ⚠️ NULL は「2026-08-05 より前に作られた行」を意味する。
--    以後に作られる行は必ずいずれかの値を持つ。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_all int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_company_admins' AND column_name='created_via'
  ) THEN
    RAISE EXCEPTION 'created_via が既にある。適用済みの可能性。中止';
  END IF;

  SELECT count(*) INTO v_all FROM public.ow_company_admins;
  RAISE NOTICE '適用前: ow_company_admins % 行（すべて created_via = NULL になる）', v_all;
END $$;

ALTER TABLE public.ow_company_admins
  ADD COLUMN created_via text;

ALTER TABLE public.ow_company_admins
  ADD CONSTRAINT check_created_via
  CHECK (created_via IS NULL OR created_via IN ('invite', 'join_request', 'admin', 'migration'));

COMMENT ON COLUMN public.ow_company_admins.created_via IS
  'この行がどの経路で作られたか。invite=企業側の招待 / join_request=参加リクエストの自動承認'
  ' / admin=管理画面や biz/members からの直接追加 / migration=SQL による投入。'
  ' NULL は 2026-08-05 より前に作られた行で、経路が判定できないもの。'
  ' ⚠️ 承諾（POST /api/biz/members/accept）では書き換えないこと。'
  ' 招待で作られた行は承諾後も invite のままにする（作成経路であって状態ではない）。';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_null int; v_fired boolean := false; v_id uuid;
BEGIN
  SELECT count(*) INTO v_null FROM public.ow_company_admins WHERE created_via IS NULL;

  -- 不正な値が弾かれること（サブトランザクションなので必ず巻き戻る）
  SELECT id INTO v_id FROM public.ow_company_admins LIMIT 1;
  IF v_id IS NOT NULL THEN
    BEGIN
      UPDATE public.ow_company_admins SET created_via = 'bogus' WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN
      v_fired := true;
    END;
    IF NOT v_fired THEN
      RAISE EXCEPTION 'CHECK が効いていない。ロールバック';
    END IF;
  END IF;

  RAISE NOTICE '完了: created_via を追加。既存 % 行は NULL のまま。不正値が弾かれることを確認', v_null;
END $$;

COMMIT;
