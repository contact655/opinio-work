-- Migration 259: ow_roles を IT/SaaS・外資・スタートアップ向けに再構成
-- 1) 専門職・その他 カテゴリを削除
-- 2) インサイドセールス/フィールドセールス を 営業 配下に移動
-- 3) 組込・制御 / ゲームエンジニア を削除
-- 4) 親カテゴリの display_order を整理

-- ── 前処理: 削除対象ロールに紐づく experiences の role_category_id を NULL に ──
-- その他（子）: ead4c479
UPDATE ow_experiences
SET role_category_id = NULL
WHERE role_category_id = 'ead4c479-c2cd-49e7-8de3-0f9e0be47f9a';

-- ── インサイドセールス / フィールドセールス を 営業 配下に移動 ──
-- 営業 parent id: 6938712f-0b29-4682-ac6e-ad112734a3f1
UPDATE ow_roles
SET parent_id = '6938712f-0b29-4682-ac6e-ad112734a3f1',
    display_order = 1
WHERE id = 'd1724303-7ca2-4cbe-a16b-f15d5a2476b8'; -- インサイドセールス

UPDATE ow_roles
SET parent_id = '6938712f-0b29-4682-ac6e-ad112734a3f1',
    display_order = 2
WHERE id = '133c74c0-e432-4c52-8235-7ad9bc7d96b8'; -- フィールドセールス

-- 既存の営業配下の display_order をずらす
UPDATE ow_roles SET display_order = display_order + 2
WHERE parent_id = '6938712f-0b29-4682-ac6e-ad112734a3f1'
  AND id NOT IN (
    'd1724303-7ca2-4cbe-a16b-f15d5a2476b8',
    '133c74c0-e432-4c52-8235-7ad9bc7d96b8'
  );

-- ── 専門職とその子を全削除 ──
DELETE FROM ow_roles WHERE parent_id = '1a641f61-bd5e-477f-8680-8a09c68711b9';
DELETE FROM ow_roles WHERE id       = '1a641f61-bd5e-477f-8680-8a09c68711b9';

-- ── その他とその子を全削除 ──
DELETE FROM ow_roles WHERE parent_id = '2c32c54f-63f2-4672-841e-c838f9a71fac';
DELETE FROM ow_roles WHERE id       = '2c32c54f-63f2-4672-841e-c838f9a71fac';

-- ── エンジニア配下の非IT/SaaS系ロールを削除 ──
DELETE FROM ow_roles WHERE id IN (
  '1ce6719e-793c-465f-b9ac-9af7d6c79232', -- 組込・制御
  '316132cc-65d8-42e3-8738-7dee724f769d'  -- ゲームエンジニア
);

-- ── 親カテゴリ display_order を IT/SaaS 向け順序に整理 ──
-- エンジニア: 1
UPDATE ow_roles SET display_order = 1  WHERE id = 'c8140123-e29a-43b3-9dbf-1a3d21a68966';
-- データ・AI: 2
UPDATE ow_roles SET display_order = 2  WHERE id = '9c7b9128-b2a7-4c40-8a08-5a3bf1ad9c2e';
-- プロダクト: 3
UPDATE ow_roles SET display_order = 3  WHERE id = '168cd1ab-d096-46cc-ad7e-5baf7f10a0b1';
-- デザイナー: 4
UPDATE ow_roles SET display_order = 4  WHERE id = '9f8deb80-3c93-450b-ad30-dfab90430ea4';
-- 営業: 5
UPDATE ow_roles SET display_order = 5  WHERE id = '6938712f-0b29-4682-ac6e-ad112734a3f1';
-- マーケティング: 6
UPDATE ow_roles SET display_order = 6  WHERE id = '38429140-f784-44c0-8eec-407495044272';
-- カスタマーサクセス: 7
UPDATE ow_roles SET display_order = 7  WHERE id = 'ad47e554-e328-4aec-abd1-dab9953ddf9d';
-- ソリューションエンジニア・プリセールス: 8
UPDATE ow_roles SET display_order = 8  WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';
-- 事業開発: 9
UPDATE ow_roles SET display_order = 9  WHERE id = 'b49b9bc8-488b-47a5-80b0-9eba4869e910';
-- 経営・CxO: 10
UPDATE ow_roles SET display_order = 10 WHERE id = '166bebdf-0c26-40df-9713-5f3b958cc96f';
-- コーポレート: 11
UPDATE ow_roles SET display_order = 11 WHERE id = '23e79605-332b-485d-98c2-d162a491a409';
