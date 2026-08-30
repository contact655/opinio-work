-- ═══════════════════════════════════════════════════════════════════════════
-- ow_companies.benefits を text[] → jsonb にする（2026-08-31）
--
-- ⚠️★**このファイルは `supabase/pending/` に置いてある。まだ適用しないこと。**
--    型を変えるので、**コードのデプロイと同時**でないと
--    「コードは古いのに型が変わっている」状態になる（CLAUDE.md）。
--    当てる日に `supabase/migrations/` へ移す。
--
-- ── なぜ変えるか ────────────────────────────────────────────────────────────
-- 福利厚生の各項目に**詳細**を持たせたい（柴さん・2026-08-31）。
--   例: 「書籍・学習費用補助」→「年間65万円（学習機関の指定あり）」
-- 企業が `/biz/company` で自分で入力する。**詳細は任意。**
--
-- ── なぜ別列にしないか ──────────────────────────────────────────────────────
-- ⚠️ `benefit_details jsonb` を別に足して**名前をキーに紐づける案は採らない。**
--    企業が名前を直した瞬間に詳細が**孤児**になる。
--    CLAUDE.md「列が2組ある」事故（requirements / required_skills ほか）と同じ形。
--
-- ⚠️ `製品名（説明）` のように**1つの文字列へ詰める案も採らない。**
--    `main_products` がその形で、**説明が描画側で捨てられ画面に一度も出ていなかった**
--    （CLAUDE.md / 2026-08-12 の記録）。
--
-- ── 形 ──────────────────────────────────────────────────────────────────────
--   [{"name": "書籍・学習費用補助", "detail": "年間65万円（学習機関の指定あり）"}]
--   ⚠️ `detail` は**任意**。無いときは **キーごと省く**（null を入れない）。
--      「未入力」と「空文字を入れた」を後から区別できるようにするため。
--
-- ── ★当てる日にやること（この順で）─────────────────────────────────────────
--   1. 作業前ダンプ:  ./scripts/dump-tables.sh ow_companies
--   2. このファイルを supabase/migrations/ へ移す
--      ⚠️ `supabase migration list` で**他人の保留分が無いか**必ず確認する
--         （`db push` は保留を全部当てる / CLAUDE.md）
--   3. supabase db push
--   4. **npm run gen:types** を実行して types.ts を作り直す
--   5. ★`src/app/api/biz/company/route.ts` の
--        `bene(d.benefits) as unknown as string[] | null | undefined`
--      から **`as unknown as ...` を外す**（型が jsonb になるので不要になる）
--      ⚠️ 外し忘れると「型が嘘をついている」状態が残る。CLAUDE.md の
--         `employee_count` に `as number` を当てて食い違いを隠していた件と同じ形。
--   6. 実測: 企業詳細・求人詳細で福利厚生が19件そのまま出ること、
--      `/biz/company` で詳細を保存 → 再読込で残ること（0行更新を成功にしない）
--
-- ⚠️ コードは `normalizeBenefits` が**旧形式（text[]）も受ける**ので、
--    2 と 3 の間で画面が壊れることはない。**それでも同時に出すこと**
--    （逆順にすると、詳細を保存できるのに列が text[] のまま、という状態になる）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260831-0207-ow_companies.sql（スキーマ+データ / 89行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
--   戻すなら:
--     alter table public.ow_companies
--       alter column benefits type text[]
--       using (select coalesce(array_agg(e->>'name' order by ord), '{}')
--                from jsonb_array_elements(benefits) with ordinality t(e, ord));
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 適用前の検証 ───────────────────────────────────────────────────────────
DO $$
DECLARE v_type text; v_companies int; v_items int; v_total int;
BEGIN
  SELECT udt_name INTO v_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_companies' AND column_name='benefits';
  IF v_type <> '_text' THEN
    RAISE EXCEPTION 'benefits が text[] ではない（% ）。適用済みか、前提が違う。中止', v_type;
  END IF;

  SELECT count(*) INTO v_companies FROM public.ow_companies
   WHERE benefits IS NOT NULL AND array_length(benefits,1) > 0;
  SELECT coalesce(sum(array_length(benefits,1)),0) INTO v_items FROM public.ow_companies
   WHERE benefits IS NOT NULL;
  SELECT count(*) INTO v_total FROM public.ow_companies;

  /* ⚠️ 実測（2026-08-31）: 2社・19件・全89行。
        ⚠️ **件数が違ったら中止する。** 想定外のデータを黙って変換しない。 */
  IF v_companies <> 2 THEN RAISE EXCEPTION '福利厚生を持つ企業が % 社（2 のはず）。中止', v_companies; END IF;
  IF v_items <> 19 THEN RAISE EXCEPTION '福利厚生の項目が % 件（19 のはず）。中止', v_items; END IF;
  IF v_total <> 89 THEN RAISE EXCEPTION 'ow_companies が % 行（89 のはず）。中止', v_total; END IF;

  RAISE NOTICE '適用前: % 社 / % 件 / 全 % 行', v_companies, v_items, v_total;
END $$;

-- ── 型を変える ─────────────────────────────────────────────────────────────
/* ⚠️ 順序を保つ。`with ordinality` を落とすと並び順が変わりうる。
   ⚠️ `detail` は入れない（未入力を表すのはキーの不在）。 */
ALTER TABLE public.ow_companies
  ALTER COLUMN benefits TYPE jsonb
  USING (
    CASE
      WHEN benefits IS NULL THEN NULL
      ELSE (
        SELECT coalesce(jsonb_agg(jsonb_build_object('name', b) ORDER BY ord), '[]'::jsonb)
          FROM unnest(benefits) WITH ORDINALITY AS t(b, ord)
      )
    END
  );

COMMENT ON COLUMN public.ow_companies.benefits IS
  '福利厚生。[{"name": 必須, "detail": 任意}] の配列。detail が無いときはキーごと省く（null を入れない）。2026-08-31 に text[] から移行。';

-- ── ★列単位 GRANT を書き直す ───────────────────────────────────────────────
/* ⚠️★`ow_companies` は **UPDATE がテーブルレベルではなく列単位**（CLAUDE.md）。
      ALTER COLUMN TYPE は既存の列権限を保つが、**保証されているとは限らない**ので
      明示的に付け直す。付いていないと企業側の保存が **403** になる。 */
GRANT UPDATE (benefits) ON public.ow_companies TO authenticated;

-- ── 適用後の検証 ───────────────────────────────────────────────────────────
DO $$
DECLARE v_type text; v_companies int; v_items int; v_total int;
        v_named int; v_has_detail int;
BEGIN
  SELECT udt_name INTO v_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_companies' AND column_name='benefits';
  IF v_type <> 'jsonb' THEN RAISE EXCEPTION '型が jsonb になっていない（%）。中止', v_type; END IF;

  SELECT count(*) INTO v_companies FROM public.ow_companies
   WHERE benefits IS NOT NULL AND jsonb_array_length(benefits) > 0;
  SELECT coalesce(sum(jsonb_array_length(benefits)),0) INTO v_items FROM public.ow_companies
   WHERE benefits IS NOT NULL;
  SELECT count(*) INTO v_total FROM public.ow_companies;

  /* ★1件も欠けていないこと */
  IF v_companies <> 2 THEN RAISE EXCEPTION '変換後の企業が % 社（2 のはず）。中止', v_companies; END IF;
  IF v_items <> 19 THEN RAISE EXCEPTION '変換後の項目が % 件（19 のはず）。中止', v_items; END IF;
  IF v_total <> 89 THEN RAISE EXCEPTION 'ow_companies が % 行（89 のはず）。中止', v_total; END IF;

  /* ★全項目に name があること（空文字も許さない） */
  SELECT count(*) INTO v_named FROM public.ow_companies c, jsonb_array_elements(c.benefits) e
   WHERE c.benefits IS NOT NULL AND coalesce(e->>'name','') <> '';
  IF v_named <> 19 THEN RAISE EXCEPTION 'name を持つ項目が % 件（19 のはず）。中止', v_named; END IF;

  /* ★この時点では detail は1件も無いはず（入力はこれから） */
  SELECT count(*) INTO v_has_detail FROM public.ow_companies c, jsonb_array_elements(c.benefits) e
   WHERE c.benefits IS NOT NULL AND e ? 'detail';
  IF v_has_detail <> 0 THEN RAISE EXCEPTION 'detail を持つ項目が % 件ある（0 のはず）。中止', v_has_detail; END IF;

  /* ★権限。付いていないと企業側の保存が 403 になる */
  IF NOT has_column_privilege('authenticated','public.ow_companies','benefits','UPDATE') THEN
    RAISE EXCEPTION 'authenticated に benefits の UPDATE 権限が無い。中止';
  END IF;
  IF NOT has_column_privilege('authenticated','public.ow_companies','benefits','SELECT') THEN
    RAISE EXCEPTION 'authenticated に benefits の SELECT 権限が無い。中止';
  END IF;

  RAISE NOTICE '完了: jsonb / % 社 / % 件 / name 揃い % / detail % / 全 % 行',
    v_companies, v_items, v_named, v_has_detail, v_total;
END $$;

COMMIT;
