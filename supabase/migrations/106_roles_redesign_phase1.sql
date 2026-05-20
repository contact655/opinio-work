-- =====================================================================
-- Migration 106: ow_roles マスタ再設計 Phase 1
-- 仕様: docs/spec-organization-redesign.md
-- 戦略: 案Y — 全データを「その他」に集約、ow_roles を21項目で再構築
-- =====================================================================
--
-- 前提確認（実施済み）:
--   - ow_experiences.role_category_id: NOT NULL、FK制約なし
--   - ow_company_employee_categories.role_id: NOT NULL、FK制約なし
--   - FK制約がないため、NULL経由なし・削除順序の制約なし
--   - ow_roles 旧: 29行 → 新: 21行
--   - ow_experiences: 224行（全行 → 新「その他」UUID に更新）
--   - ow_company_employee_categories: 180行（全削除→1社1行で再挿入）
--
-- 新マスタ構成:
--   親10個: 経営・CxO / プロダクト / 営業 / エンジニア / デザイナー /
--           マーケティング / カスタマーサクセス / 事業開発 / コーポレート / その他
--   子11個: プロダクトマネージャー / PMM /
--           フィールドセールス / インサイドセールス /
--           バックエンド / フロントエンド / フルスタック / SRE/インフラ /
--           iOS/Android / データサイエンティスト / QA/テストエンジニア
-- =====================================================================

DO $$
DECLARE
  v_sonota_id  uuid;
  v_product_id uuid;
  v_sales_id   uuid;
  v_eng_id     uuid;
BEGIN

  -- ── Step 0: ow_company_employee_categories の company_id を退避 ──────────
  CREATE TEMP TABLE IF NOT EXISTS _phase1_company_ids AS
    SELECT DISTINCT company_id FROM ow_company_employee_categories;

  -- ── Step 1: 参照元テーブルをクリア ────────────────────────────────────────
  -- ow_company_employee_categories: FK制約なし → 全削除して後で再構築
  DELETE FROM ow_company_employee_categories;
  -- ow_experiences.role_category_id は NOT NULL だが FK制約なし
  -- Step 4 で新 UUID に直接 UPDATE するので、ここでは触らない

  -- ── Step 2: 旧 ow_roles を全削除（FK制約なしのため安全） ─────────────────
  DELETE FROM ow_roles;

  -- ── Step 3: 新 ow_roles 21項目 を挿入 ────────────────────────────────────

  -- 親カテゴリ10個（display_order 1〜10）
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('経営・CxO',       NULL, 1);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('プロダクト',       NULL, 2) RETURNING id INTO v_product_id;
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('営業',             NULL, 3) RETURNING id INTO v_sales_id;
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('エンジニア',       NULL, 4) RETURNING id INTO v_eng_id;
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('デザイナー',       NULL, 5);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('マーケティング',   NULL, 6);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('カスタマーサクセス', NULL, 7);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('事業開発',         NULL, 8);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('コーポレート',     NULL, 9);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('その他',           NULL, 10) RETURNING id INTO v_sonota_id;

  -- 子カテゴリ: プロダクト配下（2個）
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('プロダクトマネージャー', v_product_id, 1);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('PMM',                   v_product_id, 2);

  -- 子カテゴリ: 営業配下（2個）
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('フィールドセールス',   v_sales_id, 1);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('インサイドセールス',   v_sales_id, 2);

  -- 子カテゴリ: エンジニア配下（7個）
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('バックエンド',         v_eng_id, 1);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('フロントエンド',       v_eng_id, 2);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('フルスタック',         v_eng_id, 3);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('SRE/インフラ',         v_eng_id, 4);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('iOS/Android',          v_eng_id, 5);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('データサイエンティスト', v_eng_id, 6);
  INSERT INTO ow_roles (name, parent_id, display_order) VALUES ('QA/テストエンジニア',  v_eng_id, 7);

  -- ── Step 4: ow_experiences.role_category_id を全行「その他」に更新 ─────────
  -- （224行・NOT NULL カラム → 直接 v_sonota_id で更新）
  UPDATE ow_experiences SET role_category_id = v_sonota_id;

  -- ── Step 5: ow_company_employee_categories を再構築 ──────────────────────
  -- UNIQUE(company_id, role_id) 制約のため、1社につき「その他」1行だけ挿入
  INSERT INTO ow_company_employee_categories (company_id, role_id, display_order)
  SELECT company_id, v_sonota_id, 0
  FROM _phase1_company_ids;

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  DROP TABLE _phase1_company_ids;

  RAISE NOTICE 'Phase 1 complete: ow_roles=21行, ow_experiences=全行→その他, ow_company_employee_categories=再構築';

END $$;
