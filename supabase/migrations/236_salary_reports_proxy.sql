-- Migration 236: salary_reports の内訳カラム追加 + 代理投稿サポート
-- Task 4: base/bonus/incentive/stock_options カラム追加
-- Task proxy: user_id を nullable に変更し、代理投稿時は NULL + proxy_note を使う
-- PostgreSQL の UNIQUE インデックスは NULL 同士を不等と扱うため、
-- (NULL, company_id, role_id) の組み合わせは複数行を許容する（代理投稿の重複を防がない）

-- 1. user_id を nullable に変更
ALTER TABLE ow_salary_reports
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. 内訳カラム追加（全てオプション、単位: 万円）
ALTER TABLE ow_salary_reports
  ADD COLUMN IF NOT EXISTS base_salary    INT,  -- 固定給
  ADD COLUMN IF NOT EXISTS bonus_salary   INT,  -- 賞与
  ADD COLUMN IF NOT EXISTS incentive      INT,  -- インセンティブ
  ADD COLUMN IF NOT EXISTS stock_options  INT,  -- 株式報酬（RSU/SO）
  ADD COLUMN IF NOT EXISTS proxy_note     TEXT; -- 代理投稿メモ（本人名・同意確認日等）
