-- Migration 259: ow_roles を IT/SaaS・外資・スタートアップ向けに再構成
-- 1) 専門職・その他 カテゴリを削除
-- 2) インサイドセールス/フィールドセールス を 営業 配下に移動
-- 3) 組込・制御 / ゲームエンジニア を削除
-- 4) 親カテゴリの display_order を整理

-- ── 前処理: 削除対象ロールに紐づく experiences の role_category_id を NULL に ──
-- その他（親 + 子を含む全ロール）
UPDATE ow_experiences
SET role_category_id = NULL
WHERE role_category_id IN (
  '2c32c54f-63f2-4672-841e-c838f9a71fac', -- その他（親）
  'ead4c479-c2cd-49e7-8de3-0f9e0be47f9a', -- その他（子）
  'abd1a2c3-9e83-4862-82fb-a04a5e71ee96', -- 研究・開発（メーカー）
  '752767b6-7cfe-4207-93fe-f86de46c2909', -- 生産技術・生産管理
  '7237de42-b17b-4af3-9824-9bbbd4ebc029', -- 品質管理・品質保証
  '96bb6372-cb1d-455a-9ddb-70f9a93ff5e0', -- 設計（機械・電気・半導体）
  'eb07889b-36e7-4644-9db3-ef22956e36e0', -- 施工管理
  '54fb0319-7450-4c88-8a82-ae53ac0f5561', -- 建築・土木設計
  'ed3f754e-d99c-440c-9137-fdefe1de078f', -- 不動産開発・アセットマネジメント
  '3ee9b8b8-0c1a-49dc-8002-0573e4d1dae3', -- 店舗運営・店長
  'a1b1e0fb-f848-4517-b210-a0455cee9d03', -- 物流・倉庫管理
  'f0ebb547-f31c-41f6-aa82-474b2075fd45'  -- 金融専門職
);
-- 専門職（親 + 子）
UPDATE ow_experiences
SET role_category_id = NULL
WHERE role_category_id IN (
  '1a641f61-bd5e-477f-8680-8a09c68711b9', -- 専門職（親）
  'c7de3ae5-f9d2-4e87-b583-e1d203c650b2', -- コンサルタント（戦略）
  '004b1c14-0fda-41fc-b8e7-9afda74c1326', -- コンサルタント（IT・DX）
  '5e0790d1-1180-417e-b8df-fe7a390d7e85', -- コンサルタント（組織・人事）
  'fa041572-5589-41d5-bde7-52d30f1e35b2', -- 公認会計士
  '3c66102f-d26b-46aa-82ff-630976d52864', -- 税理士
  '1d53bb73-93db-4e7b-bf15-c1bd5d52b399', -- 弁護士
  '1520d9ef-0607-4870-89b1-76d3c0b939d6', -- 弁理士
  '3956eaff-b303-46d7-987a-c9a0b9bbbe29', -- 社会保険労務士
  '8de31366-13a6-4779-b642-423b92de5c1e', -- 医師
  '651ff307-6c92-4098-9641-627cf12c2e1b', -- 看護師
  'd7340b81-a4a3-4736-b891-419ee00fd603', -- 薬剤師
  '3616eadf-cab4-4d42-b9c7-03454c3b2853', -- MR・医療営業
  '07c07d22-6cfe-46d1-8028-b8d58e04f942', -- CRA・臨床開発
  '813f7ccc-6f53-4ac2-b464-d7bfe71fe6b1', -- 編集・ライター
  'a2f8ac9f-cfdc-4bee-8ae1-1a7bbcdfa7cb'  -- 講師・トレーナー
);
-- エンジニア配下の削除対象
UPDATE ow_experiences
SET role_category_id = NULL
WHERE role_category_id IN (
  '1ce6719e-793c-465f-b9ac-9af7d6c79232', -- 組込・制御
  '316132cc-65d8-42e3-8738-7dee724f769d'  -- ゲームエンジニア
);

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
