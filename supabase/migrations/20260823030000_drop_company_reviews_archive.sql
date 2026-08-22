-- ============================================================================
-- 口コミの退避表 ow_company_reviews_archive_20260714 を落とす
--
-- 2026-08-23。届出のための調査で見つかり、同日 20260823020000 で
-- anon から塞いだ表。**出どころの調査が済んだので削除する。**
--
-- ── この表は何だったか ──────────────────────────────────────────────────
-- 口コミ機能は**実在した**。2026-07-14 のコミット 99d6669d
-- 「remove reviews/salary-data features」で削除されるまで、企業ページの
-- `CompanyReviewsSection` が `/api/company-reviews` 経由で
-- `is_approved = true` の口コミを**公開表示していた**。
--
-- 29行の素性（実測）:
--   ・全件が株式会社セールスフォース・ジャパン（実在・公開中の企業）
--   ・`archive/217_insert_salesforce_reviews.sql` が30行を一括投入したもの。
--     **出典コメントが1行も無い。** どこから持ってきたかは特定できなかった
--   ・`created_at` が 2026-07-11 10:59:47.304724+00 で**秒以下まで全件同一**
--   ・`user_id` は全件 NULL（migration が明示的に NULL を入れている）。
--     プラットフォーム上の登録利用者が投稿したものではない
--   ・投入時は全件 is_approved=false。現在21件が true ＝ 後から運営が承認した
--
-- ── ★なぜ未ログインから読めていたか（同じ轍を踏まないために）──────────
-- **この表は migration の外（SQL Editor）で `CREATE TABLE ... AS SELECT`
--   により作られた。** 根拠は2つ。
--   ① どの migration ファイルにも CREATE 文が無く、baseline のダンプに初出
--   ② 主キー・NOT NULL・DEFAULT・CHECK・外部キーが**揃って無い**
--      （CREATE TABLE AS は制約を引き継がない）
--
-- その結果、**Supabase の既定で anon に GRANT ALL が付き**（baseline の ACL に
-- `GRANT ALL ON TABLE ... TO anon` が記録されている）、
-- **RLS を有効にする人がいなかった。**
--
-- ★★ 今後、バックアップ表・退避表を作るときは必ず migration を通すこと。★★
--    migration にすれば GRANT と RLS を書く判断が必ず挟まる。
--    SQL Editor で作った表は「既定で anon に開いた、RLS の無い表」になる。
--
-- ── 本体テーブルについて ────────────────────────────────────────────────
-- `ow_company_reviews`（本体）は `archive/224_drop_review_tables.sql` で
-- DROP 済み。関連の `ow_review_reports` / `ow_review_access` /
-- `ow_salary_reports` も同 migration で落ちている。
-- **この退避表を落とせば、口コミ関連のテーブルは1つも残らない。**
--
-- ── 復元 ────────────────────────────────────────────────────────────────
-- 作業前ダンプ: .dumps/20260822-2347-ow_company_reviews_archive_20260714.sql
--   15,618 バイト / CREATE TABLE 1 / COPY の実データ 29行 / 全21列
--   （.gitignore 済み。**コミットしない**）
--
-- ⚠️ **このダンプには GRANT 文が入っていない**（pg_dump -t の既定）。
--    戻すときは、ダンプを流したうえで
--      GRANT SELECT ON TABLE ... TO authenticated;
--    を自分で足すこと。**足さないと運営でも読めない**
--    （ダンプ自体には ENABLE ROW LEVEL SECURITY と admin 用の
--     SELECT ポリシーが入っているため、GRANT が無いと RLS に到達しない）。
-- ============================================================================

-- ── ① 落とす前の検算：29行でなければ止める ────────────────────────────
-- ⚠️ 行数が違えば、ダンプを取った対象と別物になっている。
DO $$
DECLARE
  v_rows int;
  v_pros int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE coalesce(pros,'') <> '')
    INTO v_rows, v_pros
    FROM public.ow_company_reviews_archive_20260714;

  RAISE NOTICE '削除前: %行（うち本文あり %行）', v_rows, v_pros;

  IF v_rows <> 29 THEN
    RAISE EXCEPTION
      '29行ではない（%行）。ダンプを取った対象と違う。中止して確認すること', v_rows;
  END IF;
  IF v_pros <> 24 THEN
    RAISE EXCEPTION
      '本文ありが24行ではない（%行）。ダンプを取った対象と違う。中止して確認すること', v_pros;
  END IF;
END $$;

-- ── ② DROP ──────────────────────────────────────────────────────────────
-- ⚠️ CASCADE は付けない。この表を参照しているものが**もし在れば**気づきたい。
--    （調査時点では外部キーもポリシーも関数からの参照も0件）
DROP TABLE public.ow_company_reviews_archive_20260714;

-- ── ③ 落ちたことの確認 ──────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
     WHERE relnamespace = 'public'::regnamespace
       AND relname = 'ow_company_reviews_archive_20260714'
  ) THEN
    RAISE EXCEPTION '表がまだ存在する';
  END IF;

  -- 口コミ関連が1つも残っていないこと
  IF EXISTS (
    SELECT 1 FROM pg_class
     WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
       AND (relname LIKE '%company_review%' OR relname LIKE '%review_report%'
            OR relname LIKE '%review_access%')
  ) THEN
    RAISE EXCEPTION '口コミ関連の表がまだ残っている';
  END IF;

  RAISE NOTICE 'DROP 完了。口コミ関連のテーブルは0件';
END $$;
