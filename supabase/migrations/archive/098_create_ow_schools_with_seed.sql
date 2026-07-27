-- ============================================================
-- Migration 098: Create ow_schools master table with seed data
-- ============================================================
-- 段階6-6 Phase 1
--
-- Purpose:
--   学歴ロゴ表示のための学校マスターテーブルを作成。
--   主要 30 校のシードデータを INSERT する。
--
-- Schema:
--   - name (NOT NULL): 学校名(例: "獨協大学")
--   - name_kana: カナ表記(検索用、例: "どっきょうだいがく")
--   - logo_url: 公式ロゴ URL(段階6-6 では null、段階6-7 以降で許諾済み校から埋める)
--   - logo_gradient: グラデ色(段階6-6 で全 30 校に設定)
--   - logo_letter: 1 文字フォールバック(段階6-6 で全 30 校に設定)
--   - country: 国コード(段階6-6 は 'JP' のみ)
--   - type: 'university', 'graduate_school', 'college', 'highschool', 'vocational'
--
-- RLS:
--   - SELECT: 認証ユーザー全員可
--   - INSERT/UPDATE/DELETE: service role のみ(ポリシー作成しない)
--
-- Seed:
--   30 校(獨協大学 + 主要国公私立 29 校)
--   各校に gradient + letter を設定、logo_url は将来用に null のまま
--
-- Rollback: supabase/rollbacks/098_create_ow_schools_with_seed_rollback.sql
-- ============================================================

CREATE TABLE ow_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_kana text,
  logo_url text,
  logo_gradient text,
  logo_letter text,
  country text NOT NULL DEFAULT 'JP',
  type text NOT NULL DEFAULT 'university',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ow_schools_type_check CHECK (
    type IN ('university', 'graduate_school', 'college', 'highschool', 'vocational')
  )
);

CREATE INDEX ow_schools_name_idx ON ow_schools (name);
CREATE INDEX ow_schools_name_kana_idx ON ow_schools (name_kana);

-- RLS 有効化
ALTER TABLE ow_schools ENABLE ROW LEVEL SECURITY;

-- SELECT ポリシー: 認証ユーザー全員可
CREATE POLICY "ow_schools_authenticated_select" ON ow_schools
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE ポリシーは作成しない
-- → 認証ユーザーは変更不可、service role のみ可能

-- カラムコメント
COMMENT ON TABLE ow_schools IS
  'School master table for education timeline logos. Read-only for authenticated users.';
COMMENT ON COLUMN ow_schools.logo_url IS
  'Official school logo URL. NULL in stage 6-6, filled by admin per consent in stage 6-7+.';
COMMENT ON COLUMN ow_schools.logo_gradient IS
  '2-color CSS linear-gradient for letter fallback display.';
COMMENT ON COLUMN ow_schools.logo_letter IS
  'Single character (or short letters like "ICU") for fallback display.';

-- シードデータ: 30 校
INSERT INTO ow_schools (name, name_kana, logo_letter, logo_gradient, type) VALUES
  ('獨協大学', 'どっきょうだいがく', '獨', 'linear-gradient(135deg, #1E3A8A, #312E81)', 'university'),
  ('東京大学', 'とうきょうだいがく', '東', 'linear-gradient(135deg, #B5C5D6, #6B8CAE)', 'university'),
  ('京都大学', 'きょうとだいがく', '京', 'linear-gradient(135deg, #3A4A5C, #1E2A38)', 'university'),
  ('大阪大学', 'おおさかだいがく', '阪', 'linear-gradient(135deg, #1B4A7A, #0F2F5A)', 'university'),
  ('東北大学', 'とうほくだいがく', '北', 'linear-gradient(135deg, #4A1F2B, #2D1018)', 'university'),
  ('名古屋大学', 'なごやだいがく', '名', 'linear-gradient(135deg, #B89968, #7A6240)', 'university'),
  ('九州大学', 'きゅうしゅうだいがく', '九', 'linear-gradient(135deg, #5A1E1E, #3A0F0F)', 'university'),
  ('北海道大学', 'ほっかいどうだいがく', '海', 'linear-gradient(135deg, #2A5A3A, #14361E)', 'university'),
  ('一橋大学', 'ひとつばしだいがく', '一', 'linear-gradient(135deg, #6B7A3A, #3F4A1F)', 'university'),
  ('東京科学大学', 'とうきょうかがくだいがく', '科', 'linear-gradient(135deg, #1B5E20, #0D3811)', 'university'),
  ('早稲田大学', 'わせだだいがく', '早', 'linear-gradient(135deg, #8B1A2B, #5A0F1A)', 'university'),
  ('慶應義塾大学', 'けいおうぎじゅくだいがく', '慶', 'linear-gradient(135deg, #1A2B5A, #0F1A3A)', 'university'),
  ('上智大学', 'じょうちだいがく', '上', 'linear-gradient(135deg, #B91C5C, #7E1241)', 'university'),
  ('東京理科大学', 'とうきょうりかだいがく', '理', 'linear-gradient(135deg, #1E5A8A, #0F3A5A)', 'university'),
  ('国際基督教大学', 'こくさいきりすときょうだいがく', 'ICU', 'linear-gradient(135deg, #2C5F2D, #1A3D1B)', 'university'),
  ('明治大学', 'めいじだいがく', '明', 'linear-gradient(135deg, #5C1F2E, #3A101A)', 'university'),
  ('青山学院大学', 'あおやまがくいんだいがく', '青', 'linear-gradient(135deg, #1B3A5C, #0F2238)', 'university'),
  ('立教大学', 'りっきょうだいがく', '立', 'linear-gradient(135deg, #5A0F2E, #3A0A1F)', 'university'),
  ('中央大学', 'ちゅうおうだいがく', '中', 'linear-gradient(135deg, #8B0000, #5A0000)', 'university'),
  ('法政大学', 'ほうせいだいがく', '法', 'linear-gradient(135deg, #003B6F, #002448)', 'university'),
  ('関西大学', 'かんさいだいがく', '関', 'linear-gradient(135deg, #0F2A5A, #061738)', 'university'),
  ('関西学院大学', 'かんせいがくいんだいがく', '関', 'linear-gradient(135deg, #6B4A8A, #4A2F5C)', 'university'),
  ('同志社大学', 'どうししゃだいがく', '同', 'linear-gradient(135deg, #5A1F2B, #3A101A)', 'university'),
  ('立命館大学', 'りつめいかんだいがく', '立', 'linear-gradient(135deg, #6B0F1A, #4A0810)', 'university'),
  ('学習院大学', 'がくしゅういんだいがく', '学', 'linear-gradient(135deg, #4A2E5A, #2E1A3A)', 'university'),
  ('成蹊大学', 'せいけいだいがく', '成', 'linear-gradient(135deg, #1B5E5A, #0F3A38)', 'university'),
  ('成城大学', 'せいじょうだいがく', '城', 'linear-gradient(135deg, #5A4A2E, #3A2F1A)', 'university'),
  ('武蔵大学', 'むさしだいがく', '武', 'linear-gradient(135deg, #0F4A5A, #082F38)', 'university'),
  ('明治学院大学', 'めいじがくいんだいがく', '院', 'linear-gradient(135deg, #2E5A2E, #1A3A1A)', 'university'),
  ('慶應義塾大学大学院', 'けいおうぎじゅくだいがくだいがくいん', '慶', 'linear-gradient(135deg, #1A2B5A, #0F1A3A)', 'graduate_school');
