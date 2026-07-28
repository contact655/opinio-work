-- ⑦ 資本関係・グループ カラム追加
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS capital_type TEXT
    CHECK (
      capital_type IS NULL
      OR capital_type IN (
        'foreign_subsidiary',    -- 外資系日本法人
        'japanese_independent',  -- 日系独立
        'japanese_group',        -- 日系グループ会社
        'other'
      )
    ),
  ADD COLUMN IF NOT EXISTS parent_company_name    TEXT,
  ADD COLUMN IF NOT EXISTS parent_company_country TEXT
    CHECK (
      parent_company_country IS NULL
      OR parent_company_country IN (
        '米国', '日本', 'ドイツ', '英国', 'フランス',
        'カナダ', '韓国', '中国', '台湾', 'オーストラリア',
        'スウェーデン', 'オランダ', 'スイス', 'その他'
      )
    ),
  ADD COLUMN IF NOT EXISTS listed_exchange        TEXT,
  ADD COLUMN IF NOT EXISTS capital_notes          TEXT,
  ADD COLUMN IF NOT EXISTS global_employee_count  TEXT;

-- phase 正規化用 CHECK 制約（NOT VALID = 既存行を検証しない）
-- 対象7社の UPDATE 承認後に VALIDATE CONSTRAINT で有効化する
ALTER TABLE ow_companies
  ADD CONSTRAINT ow_companies_phase_check
    CHECK (
      phase IS NULL
      OR phase IN (
        'seed',
        'series_a',
        'series_b',
        'series_c',
        'series_d',
        'listed',
        'unicorn',
        'non_listed'
      )
    ) NOT VALID;
