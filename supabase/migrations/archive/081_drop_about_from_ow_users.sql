-- ν-8 段階2 コミット A2: about カラム DROP（段階1 負債清算）
--
-- 背景:
--   migration 078 で ow_users.about TEXT を追加したが、
--   既存カラム about_me TEXT が正式フィールドであることが判明。
--   コードベース全体（/u/[id]/page.tsx 等）は about_me を参照しており、
--   about カラムは重複・混乱の原因になるため DROP する。
--
-- 方針: about_me に統一（既存コードベース尊重）
-- 参照: docs/handoff/handover-2026-05-09-nu8-stage1-complete.md §4 申し送り

ALTER TABLE ow_users DROP COLUMN IF EXISTS about;
COMMENT ON COLUMN ow_users.about_me IS '自己紹介テキスト。200字推奨。/profile/edit 基本情報タブから編集。';
