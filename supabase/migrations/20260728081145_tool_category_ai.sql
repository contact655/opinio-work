-- ⑥ ツール・技術スタック カテゴリ追加: ai（AI）（2026-07-28）
--
-- 役割分担:
--   dev … 言語・フレームワーク・インフラ（TypeScript / AWS / GitHub）
--   ai  … AIツール（ChatGPT / Claude / Copilot / Cursor）
--
-- 9区分 → 10区分:
--   追加: 'ai'（カレンダー / メール / 顧客管理 / 営業支援 / マーケティング /
--          コミュニケーション / データ分析 / 開発 / AI / その他）

-- ── Step 1: CHECK 制約を更新 ─────────────────────────────────────────────────

ALTER TABLE ow_tool_masters DROP CONSTRAINT ow_tool_masters_category_check;

ALTER TABLE ow_tool_masters ADD CONSTRAINT ow_tool_masters_category_check
  CHECK (category IN (
    'calendar', 'email', 'crm', 'sales',
    'marketing', 'communication', 'data', 'dev', 'ai', 'other'
  ));

-- ── Step 2: AIツール 6件を INSERT ────────────────────────────────────────────

INSERT INTO ow_tool_masters (name, aliases, category, sort_order) VALUES
('ChatGPT',        ARRAY['OpenAI ChatGPT', 'チャットGPT'],        'ai', 10),
('Claude',         ARRAY['Anthropic Claude', 'クロード'],          'ai', 20),
('Claude Code',    ARRAY['クロードコード'],                         'ai', 30),
('GitHub Copilot', ARRAY['Copilot', 'コパイロット'],               'ai', 40),
('Cursor',         ARRAY['カーソル'],                               'ai', 50),
('Gemini',         ARRAY['Google Gemini', 'ジェミニ'],             'ai', 60);
