-- スカウトをアプリ内通知に載せられるようにする（2026-08-10）
--
-- 背景:
--   企業はスカウトを送れるが、求職者がそれを知る手段が1つも無かったため
--   2026-08-09 に送信を停止した（CLAUDE.md「スカウト送信は停止中」）。
--   受信側を作るにあたり、既存の ow_notifications を流用する。
--
-- なぜスキーマ変更が要るか:
--   ow_notifications は「いいね・コメント」専用に作られており、
--     type          CHECK ('like','comment')  … 'scout' が入らない
--     post_id       NOT NULL                  … スカウトには投稿が無い
--     actor_user_id NOT NULL                  … スカウトの主体は企業でユーザーではない
--   の3点がそのままでは通らない。
--
-- ⚠️ メール通知は入れない。ow_profiles / ow_users に配信停止の列が無く、
--    週次メールを止めたのと同じ状態になるため（CLAUDE.md「週次メールは停止中」）。
--    メールを足すのは opt-out 列を作ってから。

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
-- 想定と違う状態なら、何も変更せずロールバックする
DO $$
DECLARE
  v_type_check text;
  v_post_notnull boolean;
  v_actor_notnull boolean;
  v_bad_rows bigint;
BEGIN
  -- 1. 既存の type CHECK が想定どおり ('like','comment') か
  SELECT pg_get_constraintdef(oid) INTO v_type_check
  FROM pg_constraint
  WHERE conrelid = 'public.ow_notifications'::regclass
    AND conname = 'ow_notifications_type_check';

  IF v_type_check IS NULL THEN
    RAISE EXCEPTION '想定外: ow_notifications_type_check が存在しない';
  END IF;
  IF v_type_check NOT LIKE '%like%' OR v_type_check NOT LIKE '%comment%' THEN
    RAISE EXCEPTION '想定外: type CHECK の中身が想定と違う: %', v_type_check;
  END IF;

  -- 2. post_id / actor_user_id が NOT NULL であること（緩める対象）
  SELECT attnotnull INTO v_post_notnull FROM pg_attribute
   WHERE attrelid='public.ow_notifications'::regclass AND attname='post_id';
  SELECT attnotnull INTO v_actor_notnull FROM pg_attribute
   WHERE attrelid='public.ow_notifications'::regclass AND attname='actor_user_id';
  IF NOT v_post_notnull OR NOT v_actor_notnull THEN
    RAISE EXCEPTION '想定外: post_id / actor_user_id が既に NULL 許容になっている';
  END IF;

  -- 3. 既存行が新しい CHECK を全件通ること
  SELECT count(*) INTO v_bad_rows FROM public.ow_notifications
   WHERE type NOT IN ('like','comment','scout');
  IF v_bad_rows > 0 THEN
    RAISE EXCEPTION '想定外: 新しい CHECK を通らない行が % 件ある', v_bad_rows;
  END IF;
END $$;

-- ── 変更 ────────────────────────────────────────────────────────────────────

-- スカウトには投稿が無い
ALTER TABLE public.ow_notifications ALTER COLUMN post_id DROP NOT NULL;

-- スカウトの主体は企業。ユーザーではない
ALTER TABLE public.ow_notifications ALTER COLUMN actor_user_id DROP NOT NULL;

-- どのスカウトの通知か
ALTER TABLE public.ow_notifications
  ADD COLUMN IF NOT EXISTS scout_id uuid REFERENCES public.ow_scouts(id) ON DELETE CASCADE;

-- 企業が主体のときの送り主
ALTER TABLE public.ow_notifications
  ADD COLUMN IF NOT EXISTS actor_company_id uuid REFERENCES public.ow_companies(id) ON DELETE CASCADE;

-- type に 'scout' を許す
ALTER TABLE public.ow_notifications DROP CONSTRAINT ow_notifications_type_check;
ALTER TABLE public.ow_notifications
  ADD CONSTRAINT ow_notifications_type_check
  CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'scout'::text]));

-- ⚠️ 種別ごとに「何がぶら下がっているか」を DB 側でも保証する。
--    アプリ側の実装ミスで post_id も scout_id も無い通知が入ると、
--    受け取った人には「押しても何も起きない通知」として現れる。
ALTER TABLE public.ow_notifications
  ADD CONSTRAINT ow_notifications_target_check CHECK (
    (type IN ('like','comment') AND post_id IS NOT NULL AND actor_user_id IS NOT NULL)
    OR
    (type = 'scout' AND scout_id IS NOT NULL AND actor_company_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_ow_notifications_scout
  ON public.ow_notifications (scout_id) WHERE scout_id IS NOT NULL;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT pg_get_constraintdef(oid) LIKE '%scout%' INTO v_ok
  FROM pg_constraint
  WHERE conrelid='public.ow_notifications'::regclass AND conname='ow_notifications_type_check';
  IF NOT v_ok THEN RAISE EXCEPTION '事後チェック失敗: type CHECK に scout が入っていない'; END IF;

  IF (SELECT attnotnull FROM pg_attribute
       WHERE attrelid='public.ow_notifications'::regclass AND attname='post_id') THEN
    RAISE EXCEPTION '事後チェック失敗: post_id がまだ NOT NULL';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid='public.ow_notifications'::regclass
                    AND attname='scout_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION '事後チェック失敗: scout_id が無い';
  END IF;
END $$;

COMMIT;
