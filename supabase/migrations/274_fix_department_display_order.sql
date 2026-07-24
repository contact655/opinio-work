-- Migration 274: ow_company_departments の display_order を修正
--
-- 問題: applyTemplate の useTransition バッチ遅延により、
--       テンプレート適用時に全レコードが display_order = 0 になっていた。
-- 影響: リロード後に五十音順で表示される（display_order 同値 → name ASC が効く）
--
-- 対象: SaaSテンプレートで作成された部門（display_order = 0 の全件）
-- 修正: テンプレート定義の並び順に合わせて display_order を設定

-- ── ルート部門（SaaS テンプレートの順: 営業0 / CS1 / マーケ2 / プロダクト3 / コーポレート4）
UPDATE ow_company_departments SET display_order = 0 WHERE id = '41c9dd57-81f7-4aa4-a1c9-634b3b8f3f35'; -- 営業
UPDATE ow_company_departments SET display_order = 1 WHERE id = '32143997-dba6-4748-be1f-8ca1d825727b'; -- カスタマーサクセス
UPDATE ow_company_departments SET display_order = 2 WHERE id = 'e03ddc33-d052-4cdb-bd82-d7eb13bc7b1a'; -- マーケティング
UPDATE ow_company_departments SET display_order = 3 WHERE id = 'af827c69-dfb2-42de-bbb0-df5b8e13e87a'; -- プロダクト・開発
UPDATE ow_company_departments SET display_order = 4 WHERE id = '541c465e-f7a7-4e49-879a-287b52b531b1'; -- コーポレート

-- ── 営業の子（インサイドセールス0 / フィールドセールス1 / エンタープライズ2）
UPDATE ow_company_departments SET display_order = 0 WHERE id = '51ad38ef-f422-4937-a3d8-3be296aa74bf'; -- インサイドセールス
UPDATE ow_company_departments SET display_order = 1 WHERE id = '29c5fd36-709c-4dbb-81a9-fbb9c1c04b6d'; -- フィールドセールス
UPDATE ow_company_departments SET display_order = 2 WHERE id = '73c77150-fc15-456d-9342-9afa6e869732'; -- エンタープライズ営業

-- ── CSの子（オンボーディング0 / リニューアル・拡大1）
UPDATE ow_company_departments SET display_order = 0 WHERE id = '87a34398-7e67-44c9-af84-0ab7a6bf7172'; -- オンボーディング
UPDATE ow_company_departments SET display_order = 1 WHERE id = 'c378291e-8538-48a2-b4c9-75d1430af692'; -- リニューアル・拡大

-- ── マーケティングの子（フィールドマーケ0 / プロダクトマーケ1）
UPDATE ow_company_departments SET display_order = 0 WHERE id = 'ad73970b-184d-42c7-bb73-0baa9cc15d6e'; -- フィールドマーケ
UPDATE ow_company_departments SET display_order = 1 WHERE id = '32820d75-5d59-4f8a-afbc-29952958b501'; -- プロダクトマーケ

-- ── プロダクト・開発の子（エンジニアリング0 / プロダクトマネジメント1）
UPDATE ow_company_departments SET display_order = 0 WHERE id = 'f9127b5f-313f-4ac2-813e-8f7ae797c7fd'; -- エンジニアリング
UPDATE ow_company_departments SET display_order = 1 WHERE id = '7fa7d1d9-45c4-44fb-a87d-b4a2d79436b2'; -- プロダクトマネジメント
