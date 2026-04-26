-- 020: Sansan test data for culture card verification
UPDATE ow_companies SET
  side_job_ok = true,
  flex_time = true,
  has_stock_option = false,
  has_incentive = false,
  bonus_times = 2,
  evaluation_cycle = '半期',
  has_book_allowance = true,
  childcare_leave_rate = '70%',
  mid_career_ratio = 60
WHERE name = 'Sansan株式会社';
