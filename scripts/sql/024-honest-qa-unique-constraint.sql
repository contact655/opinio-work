-- 024: ow_member_honest_qa に member_id + display_order のユニーク制約を追加
-- （upsert の onConflict で必要）
CREATE UNIQUE INDEX IF NOT EXISTS uq_honest_qa_member_order
  ON ow_member_honest_qa (member_id, display_order);

-- RLSポリシー：ログインユーザーが自分のメンバーのQAを更新・挿入できるようにする
CREATE POLICY "honest_qa_member_write" ON ow_member_honest_qa
  FOR ALL USING (true) WITH CHECK (true);
