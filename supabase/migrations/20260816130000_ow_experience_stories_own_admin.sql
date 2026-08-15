-- ═══════════════════════════════════════════════════════════════════════════
-- ow_experience_stories の SELECT を「本人 + admin」に絞る（3-4）
--
-- ── 直す前（2026-08-16 実測）────────────────────────────────────────────
--   ow_experience_stories_select_all … `FOR SELECT USING (true)` ＋ anon に GRANT
--   行: **0件**
--
-- ── ★このテーブルに user_id は無い ──────────────────────────────────────
--   列: id / experience_id / type / title / description / image_url / video_url /
--       link_url / period_start / period_end / sort_order / created_at /
--       section_id / og_image_url / og_title
--   所有者は **親の職歴（experience_id → ow_experiences.user_id）経由**でしか決まらない。
--   `ow_experience_roles`（3で塞いだ）と同じ形。
--
--   ⚠️ 既存の編集ポリシー（insert / update / delete）が**すでに親経由で書かれている**ので、
--      SELECT もその形に揃える。ここだけ別の書き方にしない。
--
-- ── 読み取り経路（塞いでも壊れないことの確認）──────────────────────────
--   GET /api/jobseeker/experience-stories は `ow_experiences.user_id = 自分` で絞っている。
--   表示は `/profile/edit` の職歴カード内（StoryAccordion）だけで、**`/u/[id]` では使わない**。
--   → 本人しか読んでいないので、own + admin にしても表示は変わらない。
--
-- ── 画像側（Storage）との関係 ────────────────────────────────────────────
--   画像は `{auth.uid()}/experience-stories/{uuid}.{ext}` に置く（`ow_uploads_can_write` の③）。
--   ⚠️ **同じ機能の中で2つの空間が並んでいる。**
--        テーブルの所有者判定 … ow_users.id（親の職歴経由）
--        Storage のパス        … auth.uid()
--      どちらも「本人」を表すが、突き合わせるときは変換が要る。
--      **揃えるならパス側**（`{ow_users.id}/…` にする）だが、既存ファイルの URL が変わるため
--      今回は触らない。⚠️ ストーリー画像の孤児掃除をやるときは、この違いを前提に書くこと
--      （`image_url` のパス先頭は auth.uid であって ow_users.id ではない）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_experience_stories;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_experience_stories が % 件（想定0）。中止', v_rows; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_experience_stories'
                    AND policyname='ow_experience_stories_select_all') THEN
    RAISE EXCEPTION '対象ポリシーが無い。既に適用済み？中止';
  END IF;
  RAISE NOTICE '適用前: ow_experience_stories 0件 / select_all あり';
END $$;

REVOKE SELECT ON public.ow_experience_stories FROM anon;

DROP POLICY "ow_experience_stories_select_all" ON public.ow_experience_stories;

-- ⚠️ 既存の update_own と同じ書き方（親の職歴 → ow_users → auth.uid()）に揃える
CREATE POLICY "ow_experience_stories_select_own" ON public.ow_experience_stories
  FOR SELECT USING (
    experience_id IN (
      SELECT e.id FROM public.ow_experiences e
        JOIN public.ow_users u ON u.id = e.user_id
       WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "ow_experience_stories_select_admin" ON public.ow_experience_stories
  FOR SELECT USING (public.auth_is_admin());

DO $$
BEGIN
  IF has_table_privilege('anon','public.ow_experience_stories','SELECT') THEN
    RAISE EXCEPTION 'anon の SELECT が残っている。ロールバック';
  END IF;
  IF NOT has_table_privilege('authenticated','public.ow_experience_stories','SELECT') THEN
    RAISE EXCEPTION 'authenticated の SELECT まで消えた。ロールバック';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='ow_experience_stories'
                AND cmd='SELECT' AND qual='true') THEN
    RAISE EXCEPTION 'USING(true) が残っている。ロールバック';
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='ow_experience_stories'
         AND cmd IN ('INSERT','UPDATE','DELETE')) <> 3 THEN
    RAISE EXCEPTION '本人の編集ポリシーが欠けている。ロールバック';
  END IF;
  IF (SELECT count(*) FROM public.ow_experience_stories) <> 0 THEN
    RAISE EXCEPTION '件数が変わった。ロールバック';
  END IF;
  RAISE NOTICE '完了: SELECT は own（親の職歴経由）+ admin。anon は剥奪。0件のまま';
END $$;

COMMIT;
