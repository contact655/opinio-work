-- ═══════════════════════════════════════════════════════════════════════════
-- ow_user_languages.name を落とす（2026-08-28）★2段目・最後
--
-- ① `20260828000000` で nullable にした（緩和。旧コードも新コードも通る状態）
-- ② コード側が `name` を読まず書かなくなった
--    読み手3つ（`u/[id]` / `mypage` / `mypage/details`）は
--    `language:ow_languages(label)` の join に切り替え済み。
--    API は `name` を送らず、一致検証も外した。
-- ③ ← **いまここ。列を落とす**
--
-- ── なぜ落とすのか ──────────────────────────────────────────────────────────
-- `name` は `ow_languages.label` の**複製**で、正は `language_id`。
-- 複製が残っていると、`/search` は `language_id` で引くのに
-- **画面に出る名前だけがズレる**という形の事故が起こりうる。
-- 残していたのは読み手2つが別セッションの作業中で触れなかったためで、
-- **2026-08-27 に両方とも空いた。**
--
-- 実測（2026-08-28）: 本番 **0 行**。移行するデータは無い。
-- 作業前ダンプ: .dumps/20260828-0007-ow_user_languages.sql
--
-- ⚠️ **`name` を復活させないこと。** 複製に戻すと同じ問題に戻る。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int; v_dep text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_user_languages' AND column_name='name') THEN
    RAISE EXCEPTION 'ow_user_languages.name が存在しない。適用済みか、前提が違う。中止';
  END IF;

  -- ★中身が空であること。1行でも入っていたら落とさない
  SELECT count(*) INTO v_rows FROM public.ow_user_languages WHERE name IS NOT NULL;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'name が入っている行が % 件ある。中止', v_rows; END IF;

  -- ⚠️ 関数・ビュー・ポリシーからの参照が無いこと（Postgres は本体を追跡しない）
  SELECT string_agg(proname, ', ') INTO v_dep FROM pg_proc
   WHERE pronamespace='public'::regnamespace
     AND pg_get_functiondef(oid) ~ '\mow_user_languages\M';
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION '関数が参照している: %。中止', v_dep; END IF;

  SELECT string_agg(viewname, ', ') INTO v_dep FROM pg_views
   WHERE schemaname='public' AND definition ~ '\mow_user_languages\M';
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION 'ビューが参照している: %。中止', v_dep; END IF;

  SELECT string_agg(c.relname||'.'||p.polname, ', ') INTO v_dep
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace
     AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '')      ~ '\mname\M'
       OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '\mname\M')
     AND c.relname = 'ow_user_languages';
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION 'RLS ポリシーが参照している: %。中止', v_dep; END IF;
END $$;

-- ⚠️ CASCADE は使わない（依存物を黙って道連れにしない）
ALTER TABLE public.ow_user_languages DROP COLUMN name;

DO $$
DECLARE v_cols int; v_missing text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_user_languages' AND column_name='name') THEN
    RAISE EXCEPTION 'name が残っている。中止';
  END IF;

  -- ★他の列を巻き込んでいないこと（**7列 − 1 = 6列**）
  --   ⚠️ 最初 5 と書いて migration が止まった。`language_id` を足したぶんを
  --      数え忘れていた（2026-08-27 に追加）。**アサートは実測で書くこと。**
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_user_languages';
  IF v_cols <> 6 THEN RAISE EXCEPTION 'ow_user_languages が % 列（6 のはず）。中止', v_cols; END IF;

  -- ★列数だけでは入れ替わりを検出できないので名前で確認する
  SELECT string_agg(c, ', ') INTO v_missing FROM unnest(ARRAY[
    'id','user_id','language_id','proficiency','sort_order','created_at'
  ]) c
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public' AND table_name='ow_user_languages' AND column_name=c);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION '列が消えている: %。中止', v_missing; END IF;

  -- ★正のほう（FK と UNIQUE）が残っていること
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.ow_user_languages'::regclass
                    AND conname='ow_user_languages_user_language_uniq') THEN
    RAISE EXCEPTION 'unique (user_id, language_id) が消えている。中止';
  END IF;

  RAISE NOTICE '完了: name を落とした（ow_user_languages % 列）', v_cols;
END $$;

COMMIT;
