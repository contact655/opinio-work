-- コンフルエントの tagline を微調整する（2026-08-11）
--
-- 背景:
--   20260810172639 の適用後、375px（カード内寸 309px）で省略が残ったのは4社。
--   うち3社（グーグル / 日本マイクロソフト / OpenAI Japan）は公式ミッションで、
--   かつ**それ単体で事業が読み取れる**ため意図的に残している。
--   残る1社がコンフルエントで、実描画 331.4px（+22.4px ≒ 2文字）だった。
--
-- ⚠️ これは**書き直しではない**。「を基盤に、」は文の骨格ではなく修飾なので、
--    削っても識別子である Kafka は残る。
--    「判定済み文言を触らない」は作り直しによる精度低下を防ぐためのルールで、
--    助詞を削るだけならその懸念は生じない（2026-08-11 判断）。
--
-- 実測: 331.4px → 281.4px（−50px）。目標の 300px 以下に収まる。
--
-- ⚠️ `mission` / `description` / `industry` は触らない。

BEGIN;

-- 事前チェック: 旧値が想定どおりであること（別経路で書き換わっていたら止める）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ow_companies
    WHERE id = '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'
      AND tagline = 'Kafkaを基盤に、システム間のデータをリアルタイムに流す'
  ) THEN
    RAISE EXCEPTION '想定外: コンフルエントの tagline が想定と違う（既に変更済みか、別の値）';
  END IF;
END $$;

-- コンフルエント合同会社
--   旧(29字): Kafkaを基盤に、システム間のデータをリアルタイムに流す   … 331.4px
--   新(26字): Kafkaでシステム間のデータをリアルタイムに流す        … 281.4px
UPDATE public.ow_companies
   SET tagline = 'Kafkaでシステム間のデータをリアルタイムに流す', updated_at = now()
 WHERE id = '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4';

-- 事後チェック
DO $$
DECLARE v_t text;
BEGIN
  SELECT tagline INTO v_t FROM public.ow_companies
   WHERE id = '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4';
  IF v_t <> 'Kafkaでシステム間のデータをリアルタイムに流す' THEN
    RAISE EXCEPTION '事後チェック失敗: 更新されていない（%）', v_t;
  END IF;
  -- ⚠️ 識別子 Kafka が残っていること
  IF position('Kafka' in v_t) = 0 THEN
    RAISE EXCEPTION '事後チェック失敗: 識別子 Kafka が失われた';
  END IF;
END $$;

COMMIT;
