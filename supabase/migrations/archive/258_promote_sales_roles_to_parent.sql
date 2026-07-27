-- インサイドセールスとフィールドセールスを親カテゴリ（parent_id IS NULL）に昇格
-- これにより /jobs サイドバーに独立したカテゴリとして表示される
UPDATE ow_roles SET parent_id = NULL, display_order = 5  WHERE id = 'd1724303-7ca2-4cbe-a16b-f15d5a2476b8'; -- インサイドセールス
UPDATE ow_roles SET parent_id = NULL, display_order = 6  WHERE id = '133c74c0-e432-4c52-8235-7ad9bc7d96b8'; -- フィールドセールス

-- 「営業」「データ・AI」はコード側（ROLE_NAME_TRACK）で除外済み。
-- display_order を高値にして万が一の表示を防ぐ
UPDATE ow_roles SET display_order = 998 WHERE id = '6938712f-0b29-4682-ac6e-ad112734a3f1'; -- 営業
UPDATE ow_roles SET display_order = 999 WHERE id = '9c7b9128-b2a7-4c40-8a08-5a3bf1ad9c2e'; -- データ・AI
