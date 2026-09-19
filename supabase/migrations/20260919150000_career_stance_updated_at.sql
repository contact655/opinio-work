-- ═══════════════════════════════════════════════════════════════════════════
-- ow_profiles.career_stance_updated_at を足す（2026-09-19）
--
-- **「転職意欲（career_stance）を最後に変えた日時」。** 企業側の候補者検索で
-- 「◯日以内に転職意欲を更新した人」で絞るために使う（柴さんの指示）。
--
-- ── ⚠️★なぜ既存の stance_updated_at を使わないのか ─────────────────────────
-- あの列は**転職意欲専用ではない**（2026-09-19 に実測して判明）。打つ経路が2つある:
--   ① PUT /api/jobseeker/career-preferences … career_stance が変わったとき
--   ② lib/profile/stance.ts の touchStanceUpdatedAt
--        … **面談OK の登録・公開切替**（ambassador-self-register / ambassador-visibility）
-- さらにこの値は **/mypage の「転職・面談の状況」カードに
-- 「最終更新 ◯年◯月◯日」として本人に表示されている**（IntentCard）。
--
-- ＝ あのままだと「面談OK を触っただけの人」が「転職意欲を更新した人」として
--    企業の検索に当たる。逆に②を外すと、**本人の画面の「最終更新」の意味が変わる。**
-- → **別の列にする。** 既存列は「カード全体の最終更新」のまま触らない。
--
-- ⚠️★**遡って埋められない列。** 過去にいつ変えたかの記録が無いので、既存の45行は
--    NULL のまま。**推測で埋めないこと。** NULL は「未更新」であって「古い」ではない。
--    ⚠️ 同じ形の transfer_timing_updated_at は 2026-08-07 に入れて **0件のまま**
--       （2026-09-19 実測）。この種の列は入れた日から先しか貯まらない。
--
-- ⚠️ **trigger は作らない。** ow_profiles には trigger が1本も無く、ここで1本目を
--    作ると「この表は trigger が無い」という前提が崩れる（stance_updated_at と同じ判断）。
--    アプリ側で「保存前の値と比べて実際に変わったときだけ」now() を入れる。
--
-- ⚠️ 追加のみ（列の追加）なので先行適用してよい。古いコードはこの列を知らないだけ。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.ow_profiles
  ADD COLUMN IF NOT EXISTS career_stance_updated_at timestamptz;

COMMENT ON COLUMN public.ow_profiles.career_stance_updated_at IS
  '転職意欲（career_stance）を最後に変更した日時。'
  'アプリ側で、値が実際に変わったときだけ now() を入れる（trigger は無い）。'
  '企業側の候補者検索「転職意欲の更新時期」で読む。'
  'NULL は「未更新」。遡って埋められないので推測で埋めないこと。';

-- ⚠️★既存 stance_updated_at の COMMENT を実態に合わせて直す。
--    「scout_enabled を最後に変更した日時」と書かれていたが、**その経路は
--    2026-08-28 に設定ごと削除済み**で、いま打つのは career_stance と面談OK。
COMMENT ON COLUMN public.ow_profiles.stance_updated_at IS
  '「転職・面談の状況」カードを最後に更新した日時（/mypage に「最終更新」として本人へ表示）。'
  '打つのは career_stance の変更と、面談OK の登録・公開切替の2経路。'
  '⚠️ 転職意欲だけの日時が要るときは career_stance_updated_at を見ること（別の列）。'
  '⚠️ 旧COMMENTの「scout_enabled を最後に変更した日時」は誤り。その経路は 2026-08-28 に削除済み。';

DO $$
DECLARE v_ok boolean; v_trg int; v_sel boolean;
BEGIN
  SELECT count(*)=1 INTO v_ok FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles'
     AND column_name='career_stance_updated_at';
  IF NOT v_ok THEN RAISE EXCEPTION '列が足されていない。中止'; END IF;

  -- ⚠️ この表に trigger を増やしていないこと
  SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname='ow_profiles' AND NOT t.tgisinternal;
  IF v_trg <> 0 THEN RAISE EXCEPTION 'ow_profiles に trigger が % 本ある（想定0）。中止', v_trg; END IF;

  -- ⚠️ 列を足したら権限を実測する（CLAUDE.md「測るのは適用後」）。
  --    ow_profiles は列単位 GRANT の表ではないので、足せば読めるはず。
  SELECT has_column_privilege('authenticated','public.ow_profiles','career_stance_updated_at','SELECT')
    INTO v_sel;
  IF NOT v_sel THEN
    RAISE EXCEPTION 'authenticated が新しい列を SELECT できない。列単位 GRANT を疑うこと。中止';
  END IF;

  RAISE NOTICE '適用後: career_stance_updated_at を追加 / trigger は0本 / authenticated SELECT = true';
END $$;

COMMIT;
