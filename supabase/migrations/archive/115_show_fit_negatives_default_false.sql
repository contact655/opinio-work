-- Migration 115: Change show_fit_negatives default to false
-- デフォルトを true → false に変更し、既存レコードも全て false にリセット
-- (企業が明示的にオプトインした場合のみ表示)

ALTER TABLE ow_companies
  ALTER COLUMN show_fit_negatives SET DEFAULT false;

UPDATE ow_companies
  SET show_fit_negatives = false
  WHERE show_fit_negatives = true;
