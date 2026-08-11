-- description が空だった公開4社に企業説明を投入する
--
-- ── 対象 ────────────────────────────────────────────────────────────────────
--   09d67e54-0381-45c8-b698-568e1fc47033  株式会社PKSHA Technology
--   81aa95dc-2304-4faa-9c4a-f2f5454e8e11  株式会社SmartHR
--   8b9f84b0-b4be-4191-8322-07c6a2e5e91a  Sansan株式会社
--   fb7397eb-a9c7-4ce3-964a-d7a72159847f  Ubie株式会社
--
-- ── なぜ必要か ──────────────────────────────────────────────────────────────
-- 2026-08-11 に `queries.ts` の about のフォールバックを
-- `description ?? why_join ?? 合成文` から `description ?? null` に変えた。
-- それまでこの4社は migration が書いた勧誘文（why_join）を
-- 「企業について」として表示していたが、企業が言ったことではないため外した。
-- 結果、4社の「企業について」が写真グリッドだけになっていた。
--
-- ── 出典（2026-08-12 作成）──────────────────────────────────────────────────
-- ⚠️ **文章は公開情報から作成したものであり、原文のコピーではない。**
--
--   株式会社PKSHA Technology
--     https://www.pkshatech.com/company/about/
--     会社紹介資料（Speaker Deck）
--
--   株式会社SmartHR
--     https://smarthr.jp/
--     会社紹介資料（Speaker Deck）
--
--   Sansan株式会社
--     https://jp.corp-sansan.com/company/info/
--     IRサイト
--
--   Ubie株式会社
--     会社紹介資料（Speaker Deck）
--     https://ubie.app/
--
-- ⚠️ **`ow_companies` にはまだ出典の列が無い（2026-08-12 時点）。**
--    `source_urls text[]` / `source_verified_at timestamptz` を足すときは、
--    上の対応表（企業 → URL、確認日 2026-08-12）をそのまま移行元として使えるよう
--    この形式を崩さないこと。設計メモは CLAUDE.md「企業データの充填状況」にある。
--
-- ⚠️ 本文中の従業員数などは各社の公表時点（2026年2月〜5月）の値。
--    数字を更新するときは出典を取り直すこと。
--
-- ⚠️ 文言は受領したものをそのまま入れる。要約・加筆・語尾の調整をしない
--    （評価語を混ぜないための型に沿って書かれているため）。

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_exists int;
  v_empty  int;
BEGIN
  SELECT count(*) INTO v_exists FROM ow_companies
   WHERE id IN ('09d67e54-0381-45c8-b698-568e1fc47033',
                '81aa95dc-2304-4faa-9c4a-f2f5454e8e11',
                '8b9f84b0-b4be-4191-8322-07c6a2e5e91a',
                'fb7397eb-a9c7-4ce3-964a-d7a72159847f');
  IF v_exists <> 4 THEN
    RAISE EXCEPTION '対象4社が揃っていない: %', v_exists;
  END IF;

  -- ⚠️ 既に何か書かれている企業を上書きしない
  SELECT count(*) INTO v_empty FROM ow_companies
   WHERE id IN ('09d67e54-0381-45c8-b698-568e1fc47033',
                '81aa95dc-2304-4faa-9c4a-f2f5454e8e11',
                '8b9f84b0-b4be-4191-8322-07c6a2e5e91a',
                'fb7397eb-a9c7-4ce3-964a-d7a72159847f')
     AND (description IS NULL OR btrim(description) = '');
  IF v_empty <> 4 THEN
    RAISE EXCEPTION '対象のうち description が空なのは % 社。空でないものがあるので止める', v_empty;
  END IF;
END $$;

-- ── 本処理 ──────────────────────────────────────────────────────────────────
-- ⚠️ ドル引用符（$desc$）を使う。本文に「」や（）が入るため、
--    シングルクォートのエスケープ漏れを構造的に避ける。

UPDATE ow_companies SET
  description = $desc$自然言語処理・画像認識・機械学習の技術でアルゴリズムを研究開発し、個別のソリューションとAI SaaSの両面で提供する。社内問い合わせ対応の「PKSHA AIヘルプデスク」、FAQシステム「PKSHA FAQ」、対話エンジン「PKSHA Chatbot」などを展開。2012年に東京大学松尾研究室の出身者が設立し、東京証券取引所に上場（証券コード3993）。連結従業員数1,023名・単体382名（2026年2月時点）、グループ会社7社。$desc$,
  updated_at = now()
WHERE id = '09d67e54-0381-45c8-b698-568e1fc47033';  -- 株式会社PKSHA Technology

UPDATE ow_companies SET
  description = $desc$クラウド人事労務ソフト「SmartHR」を開発・提供する。入退社手続きや年末調整といった労務手続きのペーパーレス化から始まり、蓄積した従業員データを活用するタレントマネジメント、勤怠管理・給与計算、従業員ポータルへ領域を広げている。外部サービスと連携するアプリストア「SmartHR Plus」も展開。2013年1月設立、2015年11月にサービスをリリース。未上場。従業員数1,497名（2026年4月末時点、正社員・契約社員・アルバイト等の合計）。$desc$,
  updated_at = now()
WHERE id = '81aa95dc-2304-4faa-9c4a-f2f5454e8e11';  -- 株式会社SmartHR

UPDATE ow_companies SET
  description = $desc$「出会いからイノベーションを生み出す」をミッションに、営業向けのビジネスデータベース「Sansan」、経理領域の「Bill One」、取引管理の「Contract One」、名刺アプリ「Eight」などを開発・提供する。事業はSansan／Bill One事業とEight事業の2区分で、アナログ情報のデータ化技術と研究開発は技術本部が両事業の共通基盤として担う。2007年6月設立、東京証券取引所に上場（証券コード4443）。従業員数は単体2,077名・連結2,336名（2026年5月31日時点）。$desc$,
  updated_at = now()
WHERE id = '8b9f84b0-b4be-4191-8322-07c6a2e5e91a';  -- Sansan株式会社

UPDATE ow_companies SET
  description = $desc$「テクノロジーで人々を適切な医療に案内する」をミッションに掲げるヘルステック企業。生活者向けのAI症状検索エンジン「ユビー」、医療機関向けの問診・業務支援サービス、製薬企業向けの「ユビー for Pharma」を提供する。2017年5月に医師とエンジニアの2名が共同で設立し、両名が代表取締役を務める。2020年にシンガポールへ進出。未上場。従業員数220名（2026年4月時点）。$desc$,
  updated_at = now()
WHERE id = 'fb7397eb-a9c7-4ce3-964a-d7a72159847f';  -- Ubie株式会社

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_filled int;
  v_pub    int;
BEGIN
  SELECT count(*) INTO v_filled FROM ow_companies
   WHERE id IN ('09d67e54-0381-45c8-b698-568e1fc47033',
                '81aa95dc-2304-4faa-9c4a-f2f5454e8e11',
                '8b9f84b0-b4be-4191-8322-07c6a2e5e91a',
                'fb7397eb-a9c7-4ce3-964a-d7a72159847f')
     AND description IS NOT NULL AND btrim(description) <> '';
  IF v_filled <> 4 THEN
    RAISE EXCEPTION '4社ちょうどが更新されていない: %', v_filled;
  END IF;

  -- 公開企業で description が空のものが残っていないこと
  SELECT count(*) INTO v_pub FROM ow_companies
   WHERE is_published AND (description IS NULL OR btrim(description) = '');
  IF v_pub <> 0 THEN
    RAISE EXCEPTION 'description が空の公開企業が % 社残っている', v_pub;
  END IF;

  RAISE NOTICE '4社に description を投入。公開76社すべてが description を持つ状態になった。';
END $$;

COMMIT;
