-- メール配信設定を DB に持たせる（2026-08-10）
--
-- 背景:
--   `/profile/edit` の「メール通知設定」は **localStorage に保存**していて、
--   cron からは読めなかった。つまり利用者がオフにしても止まらない。
--   これが週次メールを止めている理由②そのもの（CLAUDE.md「週次メールは停止中」）。
--
--   さらに UI の3項目のうち、実在するメールに対応していたのは1つだけだった:
--     「新着企業のお知らせ」… そんなメールは無い（あるのは新着**求人**）
--     「マッチング求人のお知らせ」… weekly-match に対応 ✅
--     「新着記事のお知らせ」… そんなメールは無い
--   逆に weekly-jobs（新着求人）には対応する項目が無かった。
--
-- 何を足すか:
--   実在するメールに1対1で対応する2列だけを足す。
--     email_weekly_enabled … 週次ダイジェスト（weekly-jobs / weekly-match の両方）
--     email_scout_enabled  … スカウトが届いたとき
--
--   ⚠️ 週次2本を1列にまとめたのは、利用者から見ると同じ「週1回のおすすめ」だから。
--      製品が持っていない粒度の設定を出すと、いま直しているズレを作り直すことになる。
--
-- 既定値について:
--   NOT NULL DEFAULT true = 既存39行は「受け取る」になる。
--   登録済みサービスからのダイジェストは opt-out が普通で、
--   **今回その opt-out が実際に効くようになる**ため既定を on にした。
--   ⚠️ 同意を先に取る方針にするなら DEFAULT false に変えること。ここだけで切り替わる。
--
-- ⚠️ `ow_profiles.user_id` は **auth 空間**（CLAUDE.md「user_id は2つの空間がある」）。
--    cron も API もこの空間で引くこと。

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.ow_profiles') IS NULL THEN
    RAISE EXCEPTION '想定外: ow_profiles が存在しない';
  END IF;

  -- 既に同じ意味の列が無いか（名前違いで二重に持たないため）
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_profiles'
       AND column_name IN ('email_weekly_enabled','email_scout_enabled')
  ) THEN
    RAISE EXCEPTION '想定外: 追加しようとした列が既にある';
  END IF;

  -- 比較対象にする既存の兄弟列。これが無いと事後の GRANT 比較ができない
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_profiles' AND column_name='scout_enabled'
  ) THEN
    RAISE EXCEPTION '想定外: 比較対象の scout_enabled が無い';
  END IF;
END $$;

-- ── 変更 ────────────────────────────────────────────────────────────────────

ALTER TABLE public.ow_profiles
  ADD COLUMN email_weekly_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.ow_profiles
  ADD COLUMN email_scout_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ow_profiles.email_weekly_enabled IS
  '週次ダイジェストメール（weekly-jobs / weekly-match）を受け取るか。false で配信停止。';
COMMENT ON COLUMN public.ow_profiles.email_scout_enabled IS
  'スカウト受信時のメール通知を受け取るか。false で配信停止。';

/* ⚠️ 列単位 GRANT が使われているテーブルでは、ADD COLUMN しただけでは
      新しい列に権限が付かない。付いていないと PostgREST は
      **その列を含むクエリを丸ごと 403 にする**（CLAUDE.md「列単位 GRANT」）。
      表単位 GRANT のテーブルなら以下は冗長だが、GRANT は加算なので害はない。 */
GRANT SELECT (email_weekly_enabled, email_scout_enabled) ON public.ow_profiles TO authenticated;
GRANT UPDATE (email_weekly_enabled, email_scout_enabled) ON public.ow_profiles TO authenticated;

-- ── 事後チェック ────────────────────────────────────────────────────────────
-- ⚠️ 「付いていること」ではなく「**既存の兄弟列と同じであること**」を見る。
--    緩すぎ（穴を開けた）も厳しすぎ（403 になる）も、これで両方拾える。
DO $$
DECLARE
  v_role text;
  v_col  text;
  v_priv text;
  v_base boolean;
  v_new  boolean;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_priv IN ARRAY ARRAY['SELECT','UPDATE'] LOOP
      v_base := has_column_privilege(v_role, 'public.ow_profiles', 'scout_enabled', v_priv);
      FOREACH v_col IN ARRAY ARRAY['email_weekly_enabled','email_scout_enabled'] LOOP
        v_new := has_column_privilege(v_role, 'public.ow_profiles', v_col, v_priv);
        IF v_new <> v_base THEN
          RAISE EXCEPTION
            '事後チェック失敗: % の % 権限が scout_enabled と違う（% = % / scout_enabled = %）',
            v_role, v_priv, v_col, v_new, v_base;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 既存行が既定値で埋まったか
  IF EXISTS (SELECT 1 FROM public.ow_profiles
              WHERE email_weekly_enabled IS NULL OR email_scout_enabled IS NULL) THEN
    RAISE EXCEPTION '事後チェック失敗: NULL の行が残っている';
  END IF;
END $$;

COMMIT;
