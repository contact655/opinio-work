-- 046_seed_dummy_company_genres.sql
-- 開発用：全30社にランダムでジャンルタグを付与（1〜3ジャンル）
-- 本番運用では管理画面 or AI推定で正確なタグを付与する
-- 段階：genres-feature Phase A
--
-- 仕様書原案は WHERE name LIKE 'テスト株式会社%' だったが、
-- 実DB は30社すべて is_published=true の本番データのため全社対象に変更

DO $$
DECLARE
  company_rec  record;
  genre_ids    uuid[];
  num_genres   int;
  selected_idx int;
  used_indices int[];
  i            int;
BEGIN
  SELECT array_agg(id ORDER BY display_order) INTO genre_ids FROM ow_genres;

  IF genre_ids IS NULL OR array_length(genre_ids, 1) = 0 THEN
    RAISE NOTICE 'No genres found. Run migration 045 first.';
    RETURN;
  END IF;

  FOR company_rec IN
    SELECT id FROM ow_companies
  LOOP
    num_genres   := 1 + floor(random() * 3)::int;  -- 1〜3ジャンル
    used_indices := ARRAY[]::int[];

    FOR i IN 1..num_genres LOOP
      selected_idx := 1 + floor(random() * array_length(genre_ids, 1))::int;

      IF NOT (selected_idx = ANY(used_indices)) THEN
        used_indices := array_append(used_indices, selected_idx);

        INSERT INTO ow_company_genres (
          company_id, genre_id, is_human_approved, approved_at
        ) VALUES (
          company_rec.id, genre_ids[selected_idx], true, now()
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;
