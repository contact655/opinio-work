-- migration 094: ow_story_sections (A-3 サブセクション機能)
--
-- 設計判断:
--   「section_id カラムのみ追加」案より「新テーブル」案を採用。
--   理由: セクション名 / セクション自体の sort_order を独立管理できる。
--         ON DELETE SET NULL で「セクション削除 → stories は未分類へ」を自然に実現できる。
--
-- ON DELETE の 2 種類を意図的に使い分け:
--   ow_story_sections.experience_id → ow_experiences: ON DELETE CASCADE
--     職歴を削除するとそのセクション定義もすべて削除(stories は別の CASCADE で消える)。
--   ow_experience_stories.section_id → ow_story_sections: ON DELETE SET NULL
--     セクションを削除しても stories は消えず、section_id = NULL(未分類)として残る。
--
-- 既存データへの後方互換:
--   section_id はデフォルト NULL。既存 stories はすべて「未分類」として扱われ、
--   表示・編集・削除に影響なし。
--
-- RLS 設計:
--   ow_experience_stories と同じ 2 段階チェックパターンを踏襲
--   (section/story → experience_id → ow_experiences → user_id → ow_users → auth_id)。
--   追加セキュリティ: ow_experience_stories UPDATE ポリシーに WITH CHECK を追加し、
--   section_id に他人のセクション ID を書き込む改ざんを防止する。

-- ─── ow_story_sections テーブル ───────────────────────────────────────────────

CREATE TABLE ow_story_sections (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid        NOT NULL REFERENCES ow_experiences(id) ON DELETE CASCADE,
  name           text        NOT NULL CHECK (char_length(name) <= 50),
  sort_order     integer     NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ow_story_sections_experience_id_idx ON ow_story_sections(experience_id);

ALTER TABLE ow_story_sections ENABLE ROW LEVEL SECURITY;

-- SELECT: 全員読み取り可(ow_experience_stories の SELECT 方針と統一)
CREATE POLICY ow_story_sections_select_all
  ON ow_story_sections FOR SELECT
  USING (true);

-- INSERT: experience_id が認証ユーザー自身の所有か検証(2 段階チェック)
CREATE POLICY ow_story_sections_insert_own
  ON ow_story_sections FOR INSERT
  WITH CHECK (
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- UPDATE: 更新前(USING)・更新後(WITH CHECK)の両方で所有者を検証
--   USING だけでは experience_id を他人のものに書き換える改ざんが可能なため、
--   WITH CHECK で書き込み後の値も同じ条件でチェックする。
CREATE POLICY ow_story_sections_update_own
  ON ow_story_sections FOR UPDATE
  USING (
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- DELETE: section が認証ユーザー自身のものか検証
CREATE POLICY ow_story_sections_delete_own
  ON ow_story_sections FOR DELETE
  USING (
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

COMMENT ON TABLE ow_story_sections IS
  '職歴ストーリーのセクション定義。1 職歴 = 0..N セクション。'
  'section_id=NULL のストーリーは「未分類」エリアに表示される。'
  'セクション削除時は stories の section_id が SET NULL となり未分類へ移動(stories は消えない)。';

-- ─── ow_experience_stories に section_id を追加 ───────────────────────────────

ALTER TABLE ow_experience_stories
  ADD COLUMN section_id uuid REFERENCES ow_story_sections(id) ON DELETE SET NULL;

CREATE INDEX ow_experience_stories_section_id_idx ON ow_experience_stories(section_id);

-- ow_experience_stories UPDATE ポリシーを強化:
--   既存ポリシーは USING のみで WITH CHECK なし。
--   USING のみの場合、PostgreSQL は WITH CHECK を USING と同値とみなすが、
--   それは experience_id の所有者チェックのみであり、section_id の値は制約されない。
--   → 認証ユーザーが自分の story の section_id を他人のセクション ID に書き換える
--     改ざんが可能になる脆弱性がある。
--   本 migration でポリシーを再作成し、WITH CHECK に section_id 所有者検証を追加する。
DROP POLICY ow_experience_stories_update_own ON ow_experience_stories;

CREATE POLICY ow_experience_stories_update_own
  ON ow_experience_stories FOR UPDATE
  USING (
    -- 更新対象の story が自分の experience に属するか
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    -- 書き込み後も experience_id が自分のものであること
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
    -- かつ section_id が NULL(未分類)または自分の experience に属するセクションであること
    AND (
      section_id IS NULL
      OR section_id IN (
        SELECT s.id FROM ow_story_sections s
        JOIN ow_experiences e ON e.id = s.experience_id
        JOIN ow_users u ON u.id = e.user_id
        WHERE u.auth_id = auth.uid()
      )
    )
  );

-- ロールバック手順:
--   DROP POLICY ow_experience_stories_update_own ON ow_experience_stories;
--   CREATE POLICY ow_experience_stories_update_own
--     ON ow_experience_stories FOR UPDATE
--     USING (
--       experience_id IN (
--         SELECT e.id FROM ow_experiences e
--         JOIN ow_users u ON u.id = e.user_id
--         WHERE u.auth_id = auth.uid()
--       )
--     );
--   ALTER TABLE ow_experience_stories DROP COLUMN section_id;
--   DROP TABLE ow_story_sections;
