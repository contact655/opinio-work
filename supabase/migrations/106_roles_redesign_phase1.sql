-- =====================================================================
-- Migration 106: ow_roles マスタ再設計 Phase 1（案Y改）
-- 仕様: docs/spec-organization-redesign.md
-- 戦略: 案Y改 — 旧→新 UUID マッピング方式（可能な限り保持、不明分のみ「その他」）
-- =====================================================================
--
-- 旧29行 → 新21行 マッピング:
--   経営・CxO / CEO / COO / CPO / CTO / CFO → 経営・CxO
--   PdM / PM / プロダクトオーナー           → プロダクトマネージャー
--   プロダクトマネージャー                  → プロダクトマネージャー（名前維持）
--   PMM                                      → PMM（名前維持）
--   エンタープライズ営業                     → フィールドセールス
--   フィールドセールス                       → フィールドセールス（名前維持）
--   SDR / BDR                                → インサイドセールス
--   インサイドセールス                       → インサイドセールス（名前維持）
--   営業（旧親）                             → その他（ユーザー指定）
--   バックエンド〜データサイエンティスト     → 各対応する新子ロール（名前維持）
--   SRE / インフラ                           → SRE/インフラ（スペース除去）
--   iOS / Android                            → iOS/Android（スペース除去）
--   エンジニア（旧親）                       → その他（ユーザー指定）
--   デザイナー / マーケティング / CS / 事業開発 / コーポレート → 同名新ロール
--   HRBP                                     → その他（廃止）
--   その他                                   → その他（名前維持）
-- =====================================================================

BEGIN;

DO $$
DECLARE
  -- 新ロールの UUID（INSERT 後に取得）
  v_exec_id     uuid;  -- 経営・CxO
  v_product_id  uuid;  -- プロダクト（見出し）
  v_sales_id    uuid;  -- 営業（見出し）
  v_eng_id      uuid;  -- エンジニア（見出し）
  v_designer_id uuid;  -- デザイナー
  v_mktg_id     uuid;  -- マーケティング
  v_cs_id       uuid;  -- カスタマーサクセス
  v_bizdev_id   uuid;  -- 事業開発
  v_corp_id     uuid;  -- コーポレート
  v_sonota_id   uuid;  -- その他
  v_pm_id       uuid;  -- プロダクトマネージャー
  v_pmm_id      uuid;  -- PMM
  v_fs_id       uuid;  -- フィールドセールス
  v_is_id       uuid;  -- インサイドセールス
  v_be_id       uuid;  -- バックエンド
  v_fe_id       uuid;  -- フロントエンド
  v_full_id     uuid;  -- フルスタック
  v_sre_id      uuid;  -- SRE/インフラ
  v_ios_id      uuid;  -- iOS/Android
  v_ds_id       uuid;  -- データサイエンティスト
  v_qa_id       uuid;  -- QA/テストエンジニア

  v_pre_exp_count  int;
  v_pre_cat_count  int;
  v_post_cat_count int;
BEGIN

  -- ══ 事前カウント ════════════════════════════════════════════════════
  SELECT COUNT(*) INTO v_pre_exp_count FROM ow_experiences;
  SELECT COUNT(*) INTO v_pre_cat_count FROM ow_company_employee_categories;
  RAISE NOTICE '【事前】ow_roles=% 行, ow_experiences=% 行, ow_company_employee_categories=% 行',
    (SELECT COUNT(*) FROM ow_roles), v_pre_exp_count, v_pre_cat_count;

  -- ══ Step 0: 旧データを退避 ══════════════════════════════════════════
  -- 旧 ow_roles（name → old_id の逆引き用）
  CREATE TEMP TABLE _old_roles AS
    SELECT id AS old_id, name AS old_name FROM ow_roles;

  -- 旧 ow_company_employee_categories
  CREATE TEMP TABLE _old_cats AS
    SELECT company_id, role_id AS old_role_id, display_order
    FROM ow_company_employee_categories;

  -- ══ Step 1: 参照元テーブルをクリア ═════════════════════════════════
  DELETE FROM ow_company_employee_categories;
  -- ow_experiences は Step 5 で UPDATE するので触らない

  -- ══ Step 2: 旧 ow_roles を全削除 ═══════════════════════════════════
  DELETE FROM ow_roles;

  -- ══ Step 3: 新 ow_roles 21 項目を挿入 ══════════════════════════════
  -- 親 10 個（display_order 1〜10）
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('経営・CxO',         NULL,  1) RETURNING id INTO v_exec_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('プロダクト',         NULL,  2) RETURNING id INTO v_product_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('営業',               NULL,  3) RETURNING id INTO v_sales_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('エンジニア',         NULL,  4) RETURNING id INTO v_eng_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('デザイナー',         NULL,  5) RETURNING id INTO v_designer_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('マーケティング',     NULL,  6) RETURNING id INTO v_mktg_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('カスタマーサクセス', NULL,  7) RETURNING id INTO v_cs_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('事業開発',           NULL,  8) RETURNING id INTO v_bizdev_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('コーポレート',       NULL,  9) RETURNING id INTO v_corp_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('その他',             NULL, 10) RETURNING id INTO v_sonota_id;
  -- 子 11 個
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('プロダクトマネージャー', v_product_id, 1) RETURNING id INTO v_pm_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('PMM',                   v_product_id, 2) RETURNING id INTO v_pmm_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('フィールドセールス',   v_sales_id, 1) RETURNING id INTO v_fs_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('インサイドセールス',   v_sales_id, 2) RETURNING id INTO v_is_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('バックエンド',         v_eng_id, 1) RETURNING id INTO v_be_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('フロントエンド',       v_eng_id, 2) RETURNING id INTO v_fe_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('フルスタック',         v_eng_id, 3) RETURNING id INTO v_full_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('SRE/インフラ',         v_eng_id, 4) RETURNING id INTO v_sre_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('iOS/Android',          v_eng_id, 5) RETURNING id INTO v_ios_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('データサイエンティスト', v_eng_id, 6) RETURNING id INTO v_ds_id;
  INSERT INTO ow_roles (name, parent_id, display_order)
    VALUES ('QA/テストエンジニア',  v_eng_id, 7) RETURNING id INTO v_qa_id;

  -- ══ Step 4: 旧→新 UUID マッピングテーブルを構築 ════════════════════
  CREATE TEMP TABLE _role_map (old_id uuid, new_id uuid);

  INSERT INTO _role_map (old_id, new_id)
  -- 経営・CxO 系（旧 CEO/COO/CPO/CTO/CFO → 新 経営・CxO）
  SELECT old_id, v_exec_id     FROM _old_roles WHERE old_name = '経営・CxO'             UNION ALL
  SELECT old_id, v_exec_id     FROM _old_roles WHERE old_name = 'CEO'                    UNION ALL
  SELECT old_id, v_exec_id     FROM _old_roles WHERE old_name = 'COO'                    UNION ALL
  SELECT old_id, v_exec_id     FROM _old_roles WHERE old_name = 'CPO'                    UNION ALL
  SELECT old_id, v_exec_id     FROM _old_roles WHERE old_name = 'CTO'                    UNION ALL
  SELECT old_id, v_exec_id     FROM _old_roles WHERE old_name = 'CFO'                    UNION ALL
  -- プロダクト系（旧 PdM/PM・プロダクトオーナー → プロダクトマネージャー）
  SELECT old_id, v_pm_id       FROM _old_roles WHERE old_name = 'PdM / PM'               UNION ALL
  SELECT old_id, v_pm_id       FROM _old_roles WHERE old_name = 'プロダクトマネージャー' UNION ALL
  SELECT old_id, v_pm_id       FROM _old_roles WHERE old_name = 'プロダクトオーナー'     UNION ALL
  SELECT old_id, v_pmm_id      FROM _old_roles WHERE old_name = 'PMM'                    UNION ALL
  -- 営業系（旧 エンタープライズ営業 → フィールドセールス、SDR/BDR → インサイドセールス）
  SELECT old_id, v_fs_id       FROM _old_roles WHERE old_name = 'フィールドセールス'     UNION ALL
  SELECT old_id, v_fs_id       FROM _old_roles WHERE old_name = 'エンタープライズ営業'   UNION ALL
  SELECT old_id, v_is_id       FROM _old_roles WHERE old_name = 'インサイドセールス'     UNION ALL
  SELECT old_id, v_is_id       FROM _old_roles WHERE old_name = 'SDR / BDR'              UNION ALL
  SELECT old_id, v_sonota_id   FROM _old_roles WHERE old_name = '営業'                   UNION ALL  -- 旧親 → その他
  -- エンジニア系（SRE・iOS はスペース除去で名前変更）
  SELECT old_id, v_be_id       FROM _old_roles WHERE old_name = 'バックエンド'           UNION ALL
  SELECT old_id, v_fe_id       FROM _old_roles WHERE old_name = 'フロントエンド'         UNION ALL
  SELECT old_id, v_full_id     FROM _old_roles WHERE old_name = 'フルスタック'           UNION ALL
  SELECT old_id, v_sre_id      FROM _old_roles WHERE old_name = 'SRE / インフラ'         UNION ALL  -- スペースあり→なし
  SELECT old_id, v_ios_id      FROM _old_roles WHERE old_name = 'iOS / Android'          UNION ALL  -- スペースあり→なし
  SELECT old_id, v_ds_id       FROM _old_roles WHERE old_name = 'データサイエンティスト' UNION ALL
  SELECT old_id, v_sonota_id   FROM _old_roles WHERE old_name = 'エンジニア'             UNION ALL  -- 旧親 → その他
  -- その他の親カテゴリ（名前維持・UUID は新規）
  SELECT old_id, v_designer_id FROM _old_roles WHERE old_name = 'デザイナー'             UNION ALL
  SELECT old_id, v_mktg_id     FROM _old_roles WHERE old_name = 'マーケティング'         UNION ALL
  SELECT old_id, v_cs_id       FROM _old_roles WHERE old_name = 'カスタマーサクセス'     UNION ALL
  SELECT old_id, v_bizdev_id   FROM _old_roles WHERE old_name = '事業開発'               UNION ALL
  SELECT old_id, v_corp_id     FROM _old_roles WHERE old_name = 'コーポレート'           UNION ALL
  SELECT old_id, v_sonota_id   FROM _old_roles WHERE old_name = 'HRBP'                   UNION ALL  -- 廃止 → その他
  SELECT old_id, v_sonota_id   FROM _old_roles WHERE old_name = 'その他';

  -- ══ Step 5: ow_experiences を旧→新 UUID で更新 ═════════════════════
  -- マッピング一致分を新 UUID に変換
  UPDATE ow_experiences e
  SET role_category_id = m.new_id
  FROM _role_map m
  WHERE e.role_category_id = m.old_id;

  -- fallback: マッピング未解決（ow_roles に存在しない UUID が残っている場合）→ その他
  UPDATE ow_experiences
  SET role_category_id = v_sonota_id
  WHERE role_category_id NOT IN (SELECT id FROM ow_roles);

  -- ══ Step 6: ow_company_employee_categories を再構築 ════════════════
  -- 旧 role_id を新 role_id にマッピングし、DISTINCT ON で重複を排除して挿入
  -- （例: 旧「営業（親）」と「フィールドセールス」が同社に両方あった場合 → 1行に集約）
  INSERT INTO ow_company_employee_categories (company_id, role_id, display_order)
  SELECT DISTINCT ON (company_id, new_role_id)
    company_id,
    new_role_id,
    display_order
  FROM (
    SELECT
      c.company_id,
      COALESCE(m.new_id, v_sonota_id) AS new_role_id,
      c.display_order
    FROM _old_cats c
    LEFT JOIN _role_map m ON c.old_role_id = m.old_id
  ) sub
  ORDER BY company_id, new_role_id, display_order;

  -- ══ Cleanup ═════════════════════════════════════════════════════════
  DROP TABLE _old_roles;
  DROP TABLE _old_cats;
  DROP TABLE _role_map;

  -- ══ 事後カウント ════════════════════════════════════════════════════
  SELECT COUNT(*) INTO v_post_cat_count FROM ow_company_employee_categories;
  RAISE NOTICE '【事後】ow_roles=% 行（期待21）, ow_experiences=% 行（変化なし・期待%）, ow_company_employee_categories=% 行（旧%→新%）',
    (SELECT COUNT(*) FROM ow_roles),
    (SELECT COUNT(*) FROM ow_experiences), v_pre_exp_count,
    v_post_cat_count, v_pre_cat_count, v_post_cat_count;

END $$;

COMMIT;
