-- PKSHA の main_products を現行の製品名に直す
--
-- 20260813071000 で description を「PKSHA ChatAgent」に直したが、main_products が
-- 旧名「PKSHA Chatbot」のまま残っており、**同じページ内で本文と製品カードが
-- 別の名前を出していた**。本文側が正しいので main_products を合わせる。
--
-- 出典: https://aisaas.pkshatech.com/chatbot/
--       公式に「旧 PKSHA Chatbot」と併記されており、リブランドが事実であることを確認済み。
--
-- 旧値: {
--   'PKSHA AI ヘルプデスク（社内問い合わせ対応）',
--   'PKSHA FAQ（FAQシステム）',
--   'PKSHA Chatbot（対話エンジン）',
--   'PKSHA Voicebot（音声対話）',
--   'PKSHA Speech Insight（通話解析）'
-- }
--
-- 変更は2要素だけ。他の3要素（FAQ / Voicebot / Speech Insight）は触らない。
--   ① 'PKSHA Chatbot（対話エンジン）'        → 'PKSHA ChatAgent（AI対話）'
--   ② 'PKSHA AI ヘルプデスク（社内問い合わせ対応）' → 'PKSHA AIヘルプデスク（社内問い合わせ対応）'
--
-- ⚠️ ② はスペースの有無だけの変更。**公式サイト内でも表記が揺れている**
--    （製品サイト = スペースなし / プレスリリース = スペースあり）。
--    description 本文が製品サイト表記なので、そちらに統一する。
--
-- ⚠️ 書式は `製品名（説明）`（全角括弧）を維持する。括弧を外さないこと
--    （CLAUDE.md「main_products の書式」。外すと説明文が製品名として1行に出る）。
UPDATE ow_companies SET main_products = ARRAY[
  'PKSHA AIヘルプデスク（社内問い合わせ対応）',
  'PKSHA FAQ（FAQシステム）',
  'PKSHA ChatAgent（AI対話）',
  'PKSHA Voicebot（音声対話）',
  'PKSHA Speech Insight（通話解析）'
]
WHERE id = '09d67e54-0381-45c8-b698-568e1fc47033';
