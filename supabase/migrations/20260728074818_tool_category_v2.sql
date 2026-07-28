-- ⑥ ツール・技術スタック カテゴリ再編（2026-07-28）
--
-- 旧8区分 → 新9区分:
--   crm        → crm（顧客管理）/ sales（営業支援）に分割
--   marketing  → marketing（変更なし）
--   cloud_infra→ dev（開発）に統合
--   dev        → dev（変更なし）
--   data       → data（変更なし）
--   communication → communication（変更なし）
--   productivity → other（その他）に統合
--   security   → other（その他）に統合
--   新規: calendar（カレンダー）/ email（メール）
--
-- 統合スイートの扱いルール:
--   カレンダー・メール・ドキュメント等を兼ねる製品（Google Workspace, Microsoft 365, Garoon 等）
--   は「other」に置く。単体ツールを各カテゴリに配置する原則。

-- ── Step 1: CHECK 制約を削除 ─────────────────────────────────────────────────

ALTER TABLE ow_tool_masters DROP CONSTRAINT ow_tool_masters_category_check;

-- ── Step 2: 既存67件の category を振り替え ──────────────────────────────────

-- crm(8) → sales(3) / crm(5)
UPDATE ow_tool_masters
  SET category = 'sales'
  WHERE name IN ('Outreach', 'SalesLoft', 'Gong');

-- cloud_infra(9) → dev
UPDATE ow_tool_masters
  SET category = 'dev'
  WHERE category = 'cloud_infra';

-- security(6) → other（sort_order を +100 してproductivity と衝突しないよう退避）
UPDATE ow_tool_masters
  SET sort_order = sort_order + 100
  WHERE name IN ('CrowdStrike', 'Palo Alto Networks', 'Okta', 'Zscaler', 'Splunk', 'KnowBe4');
UPDATE ow_tool_masters
  SET category = 'other'
  WHERE category = 'security';

-- productivity(8) → other
UPDATE ow_tool_masters
  SET category = 'other'
  WHERE category = 'productivity';

-- marketing / data / communication / crm(残5) / dev(残14) は変更なし
-- Google Analytics は marketing のまま（日常的に触るのはマーケ担当）

-- ── Step 3: 新 CHECK 制約を追加 ─────────────────────────────────────────────

ALTER TABLE ow_tool_masters ADD CONSTRAINT ow_tool_masters_category_check
  CHECK (category IN (
    'calendar', 'email', 'crm', 'sales',
    'marketing', 'communication', 'data', 'dev', 'other'
  ));

-- ── Step 4: 新規5件を INSERT ─────────────────────────────────────────────────

INSERT INTO ow_tool_masters (name, aliases, category, sort_order) VALUES
('Google カレンダー',  ARRAY['Google Calendar', 'Googleカレンダー'],               'calendar', 10),
('Outlook カレンダー', ARRAY['Outlook Calendar', 'Microsoft Outlook Calendar'],     'calendar', 20),
('Gmail',              ARRAY['Google Gmail', 'Gメール'],                            'email',    10),
('Outlook',            ARRAY['Microsoft Outlook', 'Outlookメール'],                 'email',    20),
('Garoon',             ARRAY['サイボウズ Garoon', 'ガルーン'],                      'other',    200);
