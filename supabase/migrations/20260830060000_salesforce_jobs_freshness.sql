-- ═══════════════════════════════════════════════════════════════════════════
-- 公開求人5件を採用ページと突き合わせる（2026-08-30）
--
-- ⚠️ 採番を 20260830030000 → 20260830060000 に直した（2026-08-30）。作成時点では
--    出典の表（20260830040000 / 050000）より前の番号だったため、`db push` が
--    「Found local migration files to be inserted before the last migration」で止まった。
--    **--include-all で順序を崩さず、採番し直した。**

--
-- ── なぜやるか ──────────────────────────────────────────────────────────────
-- 公開求人5件は全部 Salesforce のもので、**2026-06-03 に登録してから87日**
-- 経過していた。`source_url` は5件とも空、`source_verified_at` も空。
-- 求人には鮮度判定の仕組みが無く（`expires_at` は全件 NULL、期限切れ遷移も無効）、
-- **募集が終わっていても自動では落ちない。**
-- Opinio は有料職業紹介事業の許可事業者（13-ユ-316441）で、実在しない求人の掲載は
-- 的確表示義務に関わる。
--
-- ── 突き合わせの方法（2026-08-30 実施）─────────────────────────────────────
-- `https://www.salesforce.com/jp/company/careers/jobs/?country=Japan` の
-- **日本の求人87件を5ページ全部**取得し、5件のタイトルと突き合わせた。
-- 見つからなかったものは、国フィルタを外した**キーワード検索でも**確認している。
--
-- | 当方の求人 | 採用ページ | 判定 |
-- |---|---|---|
-- | Account Executive, MuleSoft（エンタープライズ営業） | **JR325032**「(FY27) MuleSoft, Account Executive (Enterprise Sales)」 | **実在**（Japan - Tokyo / 応募可 / **Posted 02 June 2026**） |
-- | Account Solution Engineer, Tableau | **JR332827**「Account Solution Engineer, Tableau」 | **実在**（Japan - Tokyo / 応募可 / タイトル完全一致） |
-- | Lead Solution Engineer, Tableau | — | **無い** |
-- | Director, Customer Success Management（金融業界） | — | **無い** |
-- | Business Operations - AI Methodology & Enablement | — | **無い** |
--
-- ⚠️ MuleSoft AE の「Posted 02 June 2026」は当方の公開日 2026-06-03 と一致する。
--    **同じ掲載を指していると判断した。**
--
-- ⚠️ 無い3件について、似た名前の求人はある（下記）。**同一とは見なさない。**
--    役割の階層が違うか、対象製品が違うため。
--      Lead Solution Engineer, Tableau
--        → 日本の Tableau 求人は7件あるが Lead SE は無い
--          （Account SE / Technical Architect / CSM / AE×2）。
--          「Lead Solution Engineer - MuleSoft (金融)」は**製品が違う**。
--      Director, Customer Success Management（金融業界）
--        → 「Customer Success Manager, Financial Service」は**Director ではなく Manager**。
--      Business Operations - AI Methodology & Enablement
--        → キーワード検索14件のいずれとも一致しない。
--
-- ── ★status を 'private' にする（'draft' ではない）─────────────────────────
-- CLAUDE.md の定義では
--   `draft`   = 下書き
--   `private` = **一度公開したものを運営が止めた**
-- で、今回はまさに後者。**運営が採用ページと突き合わせて取り下げる**操作にあたる。
--
-- ⚠️ 前例（`20260811155028_unpublish_unsourced_sample_jobs.sql`）は `draft` を使ったが、
--    あちらは**実在を確認できなかったサンプルデータ**で「そもそも公開すべきでなかった」。
--    今回の3件は**実在した可能性が高く、募集が終わった**もの。性質が違うので分ける。
--    `draft` に混ぜると、あの13件と区別がつかなくなる。
--
-- ⚠️ `closed` / `expired` は CHECK に無い（表示側が知らず draft に化けるため）。
--    使わない。
--
-- ── 残る不完全さ ────────────────────────────────────────────────────────────
-- ⚠️ **「無い＝募集終了」と断定はできない。** 採用ページから消えた理由は
--    充足・保留・掲載方法の変更などがありうる。ただし**出典を示せない求人を
--    公開し続けない**という方針（CLAUDE.md「source_url が無い求人を published に
--    戻さない」）に従い、取り下げる。復活は出典が取れた日に行う。
-- ⚠️ 残る2件も**本文・年収・勤務地の中身までは突き合わせていない**。
--    確認したのは「その求人が今も募集されていること」まで。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260830-0228-ow_jobs.sql（スキーマ+データ / 20行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_published int; v_no_source int; v_total int;
BEGIN
  SELECT count(*) INTO v_published FROM public.ow_jobs WHERE status = 'published';
  IF v_published <> 5 THEN
    RAISE EXCEPTION '公開求人が % 件（5 のはず）。前提が違う。中止', v_published;
  END IF;

  -- ★5件とも source_url が空であること（=まだ誰も突き合わせていない）
  SELECT count(*) INTO v_no_source FROM public.ow_jobs
   WHERE status = 'published' AND source_url IS NULL;
  IF v_no_source <> 5 THEN
    RAISE EXCEPTION 'source_url が空の公開求人が % 件（5 のはず）。中止', v_no_source;
  END IF;

  SELECT count(*) INTO v_total FROM public.ow_jobs;
  IF v_total <> 20 THEN RAISE EXCEPTION 'ow_jobs が % 行（20 のはず）。中止', v_total; END IF;

  RAISE NOTICE '適用前: 公開 % 件 / うち出典なし % 件 / 全 % 行', v_published, v_no_source, v_total;
END $$;

/* ── ① 実在を確認できた2件: 出典を記録して公開を維持 ──────────────────────
   ⚠️ 対象は slug で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
   ⚠️ `source_url` には**個別求人のURL**を入れる。検索ページのURLではない
      （archive/152 のコメントは検索ページを指しており、そこが不十分だった）。 */
UPDATE public.ow_jobs
   SET source_url = 'https://www.salesforce.com/jp/company/careers/jobs/JR325032/fy27-mulesoft-account-executive-enterprise-sales/',
       source_verified_at = now(),
       updated_at = now()
 WHERE slug = 'salesforce-ae-mulesoft-ad7ba4' AND status = 'published';

UPDATE public.ow_jobs
   SET source_url = 'https://www.salesforce.com/jp/company/careers/jobs/JR332827/account-solution-engineer-tableau/',
       source_verified_at = now(),
       updated_at = now()
 WHERE slug = 'salesforce-ase-tableau-8e64f7' AND status = 'published';

/* ── ② 採用ページに無い3件: 取り下げる ────────────────────────────────────
   ⚠️ `source_url` は**空のまま残す**。それらしいURLで埋めない
      （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
      「突き合わせたが見つからなかった」ことは `source_verified_at` が示す。 */
UPDATE public.ow_jobs
   SET status = 'private',
       source_verified_at = now(),
       updated_at = now()
 WHERE slug IN ('salesforce-lead-se-tableau-c7e717',
                'salesforce-csm-director-cffdb2',
                'salesforce-biz-ops-ai-351aa1')
   AND status = 'published';

DO $$
DECLARE v_pub int; v_priv int; v_src int; v_total int; v_left int;
BEGIN
  SELECT count(*) INTO v_pub  FROM public.ow_jobs WHERE status = 'published';
  IF v_pub <> 2 THEN RAISE EXCEPTION '公開が % 件（2 のはず）。中止', v_pub; END IF;

  -- ★公開中の2件は両方とも出典を持っていること（=「出典なし（公開中）」タブが0件になる）
  SELECT count(*) INTO v_src FROM public.ow_jobs
   WHERE status = 'published' AND source_url IS NOT NULL AND source_verified_at IS NOT NULL;
  IF v_src <> 2 THEN RAISE EXCEPTION '出典つきの公開求人が % 件（2 のはず）。中止', v_src; END IF;

  SELECT count(*) INTO v_priv FROM public.ow_jobs WHERE status = 'private';
  IF v_priv <> 3 THEN RAISE EXCEPTION 'private が % 件（3 のはず）。中止', v_priv; END IF;

  -- ★取り下げた3件に出典を捏造していないこと
  SELECT count(*) INTO v_left FROM public.ow_jobs
   WHERE status = 'private' AND source_url IS NOT NULL;
  IF v_left <> 0 THEN RAISE EXCEPTION '取り下げた求人に source_url が入っている（% 件）。中止', v_left; END IF;

  SELECT count(*) INTO v_total FROM public.ow_jobs;
  IF v_total <> 20 THEN RAISE EXCEPTION 'ow_jobs が % 行（20 のはず）。中止', v_total; END IF;

  RAISE NOTICE '完了: 公開 %（出典つき %）/ 非公開 % / 全 % 行', v_pub, v_src, v_priv, v_total;
END $$;

COMMIT;
