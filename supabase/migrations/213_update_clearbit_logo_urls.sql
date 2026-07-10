-- Migration 213: Clearbit logo_url を Google Favicon API に更新
-- Clearbit Logo API は廃止済み（全リクエストが 408 を返す）
-- Google Favicon API (https://www.google.com/s2/favicons?domain=...&sz=256) に置き換える

UPDATE ow_companies
SET logo_url = 'https://www.google.com/s2/favicons?domain=' ||
               REPLACE(logo_url, 'https://logo.clearbit.com/', '') ||
               '&sz=256'
WHERE logo_url LIKE 'https://logo.clearbit.com/%';
