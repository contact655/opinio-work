-- ═══════════════════════════════════════════════════════════════════════════
-- ウェルカムメールの冪等キーを「行の有無」から「送信の事実」に変える（2026-08-20）
--
-- ── なぜ要るか ─────────────────────────────────────────────────────────────
-- **ウェルカムメールは一度も送られていなかった。**
--
--   ① 登録した瞬間、トリガー `on_auth_user_created`（handle_new_ow_user）が
--      `ow_users` の行を **auth_id 付きで** 作る
--   ② 確認リンクを開くと `/auth/confirm` → `resolveOrLinkOwUser` が
--      **auth_id で引いて行を見つける** → `status = 'existing'`
--   ③ `postAuth.ts` は `isNewUser = (status === 'created')` でしか送らない
--   ④ よって `'created'` は事実上発生せず、**送信条件に一度も入らない**
--
-- ⚠️ CLAUDE.md には「ウェルカムメールは ow_users 行の存在が冪等キーになっており
--    2回目は送られない」と書いてあったが、**前提が崩れていた**
--    （トリガーが1回目の時点で行を作るので、1回目から送られない）。
--
-- → 「行があるか」ではなく **「送ったか」** を持つ。
--
-- ── 既存ユーザーへの遡及はしない ───────────────────────────────────────────
-- ⚠️ **NULL のままにすると、既存の36人が次にマジックリンクや Google ログインを
--    通った瞬間に「ようこそ！登録完了しました」を受け取る。** 登録は何ヶ月も前なので、
--    本人にとっては意味不明なメールになる。
--
-- → 移行時点で既に存在する行は `created_at` を入れて**対象外**にする。
-- ⚠️ **入っている値は「実際に送った日時」ではない。** 送っていない。
--    「送信対象として処理済み」という意味で入れている。列コメントにも書く。
--    遡って送る判断をするなら、ここを NULL に戻すのではなく**別の一括送信**として行うこと。
--
-- ── 権限について ───────────────────────────────────────────────────────────
-- ⚠️ `ow_users` の SELECT は **列単位**で配っている（anon 23列 / authenticated 30列）。
--    足した列は **読めない状態で生まれる**。これは意図どおり
--    （読み書きするのは `createAdminClient` だけ）。**GRANT を足さないこと。**
--    適用後に `has_column_privilege` で「配られていないこと」を確かめる。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ow_users' AND column_name='welcome_sent_at'
  ) THEN
    RAISE EXCEPTION '既に welcome_sent_at がある。適用済みか、前提が違う。中止';
  END IF;
  RAISE NOTICE '適用前: ow_users % 行 / welcome_sent_at なし', (SELECT count(*) FROM public.ow_users);
END $$;

ALTER TABLE public.ow_users ADD COLUMN welcome_sent_at timestamptz;

COMMENT ON COLUMN public.ow_users.welcome_sent_at IS
  'ウェルカムメールの送信対象として処理した日時。NULL なら未処理＝次の認証時に送る。'
  ' ⚠️ 2026-08-20 の移行時点で既に存在した行には created_at を入れてあり、'
  ' それらは「実際には送っていないが、遡って送らないと決めた」という意味。';

-- 既存ユーザーを対象外にする（遡って送らない）
UPDATE public.ow_users SET welcome_sent_at = created_at WHERE welcome_sent_at IS NULL;

DO $$
DECLARE v_null int; v_total int; v_anon boolean; v_auth boolean;
BEGIN
  SELECT count(*) FILTER (WHERE welcome_sent_at IS NULL), count(*)
    INTO v_null, v_total FROM public.ow_users;
  IF v_null <> 0 THEN
    RAISE EXCEPTION '既存行に埋め残しがある（% 行）。中止', v_null;
  END IF;

  -- 列単位 GRANT のテーブルなので、新しい列は配られていないはず
  v_anon := has_column_privilege('anon','public.ow_users','welcome_sent_at','SELECT');
  v_auth := has_column_privilege('authenticated','public.ow_users','welcome_sent_at','SELECT');
  IF v_anon OR v_auth THEN
    RAISE EXCEPTION 'welcome_sent_at が anon(%) / authenticated(%) に配られている。中止', v_anon, v_auth;
  END IF;

  RAISE NOTICE '適用後: % 行すべて対象外に設定 / anon・authenticated からは読めない', v_total;
END $$;

COMMIT;
