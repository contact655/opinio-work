-- ═══════════════════════════════════════════════════════════════════════════
-- ユーザーフォローの対象を ow_career_profiles → ow_users に張り替える
--
--   ow_career_follows → ow_user_follows       （テーブル名）
--   target_profile_id → target_user_id        （列名 + FK）
--
-- ── なぜ必要か ──────────────────────────────────────────────────────────────
-- ow_career_follows.target_profile_id は ow_career_profiles.id を参照していた。
-- ところが ow_career_profiles は 1行しか無く（実ユーザー5名中1名）、
-- このままでは **5人中1人しかフォローできない**。
--
-- ow_career_profiles は migration 175（キャリア軌跡 Phase 1）で
-- 「/career-trajectories の公開エンベロープ」として作られたもので、
-- 全ユーザーが持つ前提の行ではない。/career-trajectories は現在 404 で、
-- Phase 3（フォロー機能）は着手されないまま土台だけが残っていた。
--
-- フォローしたいのは「その人」であって「公開中のキャリア軌跡」ではないので、
-- ow_users を直接指すのが正しい。
--
-- ── データ ──────────────────────────────────────────────────────────────────
-- ow_career_follows は 0行（2026-08-04 実測）。移し替えるデータは無い。
-- ow_career_profiles 自体は残す（/people の birth_year 取得などで使っている）。
--
-- ⚠️ DROP + CREATE ではなく RENAME にしている。
--    UNIQUE 制約とインデックスを作り直さずに済み、
--    履歴上も「別テーブルが生えた」ではなく「張り替えた」と読めるため。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_rows int;
BEGIN
  -- ── ① 前提の確認 ────────────────────────────────────────────────────────
  IF to_regclass('public.ow_career_follows') IS NULL THEN
    RAISE EXCEPTION 'ow_career_follows が無い。適用済みの可能性。中止';
  END IF;
  IF to_regclass('public.ow_user_follows') IS NOT NULL THEN
    RAISE EXCEPTION 'ow_user_follows が既にある。適用済みの可能性。中止';
  END IF;

  -- ── ② 0行であること ─────────────────────────────────────────────────────
  --    行があるなら target_profile_id → target_user_id の変換が要るので、
  --    黙って壊さず止める。
  SELECT count(*) INTO v_rows FROM ow_career_follows;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION
      'ow_career_follows に % 行ある（想定0行）。ID の意味が変わるため機械的な移行は不可。中止', v_rows;
  END IF;
END $$;

-- ── ③ 張り替え ──────────────────────────────────────────────────────────────
ALTER TABLE public.ow_career_follows RENAME TO ow_user_follows;
ALTER TABLE public.ow_user_follows RENAME COLUMN target_profile_id TO target_user_id;

ALTER TABLE public.ow_user_follows
  DROP CONSTRAINT ow_career_follows_target_profile_id_fkey;

ALTER TABLE public.ow_user_follows
  ADD CONSTRAINT ow_user_follows_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES public.ow_users(id) ON DELETE CASCADE;

-- 自分自身はフォローできない。API 側でも弾くが、DB でも塞いでおく
ALTER TABLE public.ow_user_follows
  ADD CONSTRAINT ow_user_follows_no_self CHECK (follower_user_id <> target_user_id);

COMMENT ON TABLE public.ow_user_follows IS
  'ユーザーのフォロー関係。follower_user_id / target_user_id とも ow_users.id。'
  ' 2026-08-04 に ow_career_follows（対象が ow_career_profiles）から張り替えた。';

-- ── ④ RLS の張り替え ────────────────────────────────────────────────────────
--    旧 career_follows_read_published は「対象のキャリア軌跡が公開中」を条件に
--    していたが、対象が ow_users になったので条件も変える。
--    ⚠️ 読める範囲を「本人のフォロー」に絞る。誰が誰をフォローしているかは
--       他人に見せない（/feed のサイドバーは自分の分しか出さない）。
DROP POLICY IF EXISTS career_follows_read_published ON public.ow_user_follows;
ALTER POLICY career_follows_own_manage ON public.ow_user_follows RENAME TO user_follows_own_manage;

-- ── ⑤ 事後チェック ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.ow_user_follows') IS NULL THEN
    RAISE EXCEPTION 'ow_user_follows が作られていない。ロールバック';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_user_follows' AND column_name='target_user_id'
  ) THEN
    RAISE EXCEPTION 'target_user_id 列が無い。ロールバック';
  END IF;

  -- FK が ow_users を指していること
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ow_user_follows_target_user_id_fkey'
       AND confrelid = 'public.ow_users'::regclass
  ) THEN
    RAISE EXCEPTION 'target_user_id の FK が ow_users を指していない。ロールバック';
  END IF;

  -- ow_career_profiles は消していないこと（/people で使っている）
  IF to_regclass('public.ow_career_profiles') IS NULL THEN
    RAISE EXCEPTION 'ow_career_profiles まで消えている。ロールバック';
  END IF;

  RAISE NOTICE '完了: ow_career_follows → ow_user_follows（対象を ow_users に張り替え）';
END $$;

COMMIT;
