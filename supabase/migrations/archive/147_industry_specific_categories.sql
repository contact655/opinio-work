-- Migration 147: Cloud/SaaS → 企業ごとに正確な業種カテゴリに置き換え
-- "Cloud/SaaS" はプラットフォーム全体のコンセプトと同義で情報ゼロのため廃止

-- ── コラボレーション・生産性 ──────────────────────────────
UPDATE ow_companies SET industry = 'コラボレーション' WHERE name = 'Notion Labs Japan合同会社';
UPDATE ow_companies SET industry = 'コラボレーション' WHERE name = 'Slack Japan株式会社';
UPDATE ow_companies SET industry = 'プロジェクト管理'  WHERE name = 'Asana Japan株式会社';
UPDATE ow_companies SET industry = 'DevTools'          WHERE name = 'アトラシアン株式会社';
UPDATE ow_companies SET industry = 'コンテンツ管理'    WHERE name = 'Box Japan株式会社';
UPDATE ow_companies SET industry = 'ファイル共有'      WHERE name = 'Dropbox Japan株式会社';

-- ── クラウドインフラ・ネットワーク ───────────────────────
UPDATE ow_companies SET industry = 'クラウドインフラ'  WHERE name = 'アマゾン ウェブ サービス ジャパン合同会社';
UPDATE ow_companies SET industry = 'クラウドインフラ'  WHERE name = 'ヴイエムウェア株式会社';
UPDATE ow_companies SET industry = 'ネットワーキング'  WHERE name = 'アリスタネットワークス合同会社';
UPDATE ow_companies SET industry = 'API管理'           WHERE name = 'コング・ジャパン株式会社';
UPDATE ow_companies SET industry = 'データストリーミング' WHERE name = 'コンフルエント合同会社';

-- ── エンタープライズIT ───────────────────────────────────
UPDATE ow_companies SET industry = 'エンタープライズIT' WHERE name = 'SAPジャパン株式会社';
UPDATE ow_companies SET industry = 'エンタープライズIT' WHERE name = '日本IBM株式会社';
UPDATE ow_companies SET industry = 'エンタープライズIT' WHERE name = '日本マイクロソフト株式会社';
UPDATE ow_companies SET industry = 'ワークフロー自動化' WHERE name = 'ServiceNow Japan合同会社';

-- ── データベース・データ基盤 ──────────────────────────────
UPDATE ow_companies SET industry = 'データベース'       WHERE name = 'MongoDB Japan合同会社';
UPDATE ow_companies SET industry = 'データベース・ERP'  WHERE name = '日本オラクル株式会社';

-- ── 財務・経費・調達 ─────────────────────────────────────
UPDATE ow_companies SET industry = '財務・ERP'          WHERE name = 'アプティオ株式会社';
UPDATE ow_companies SET industry = '財務会計'           WHERE name = 'ブラックライン株式会社';
UPDATE ow_companies SET industry = '経費精算'           WHERE name = 'コンカー株式会社';
UPDATE ow_companies SET industry = '調達管理'           WHERE name = 'クーパ・ソフトウェア株式会社';

-- ── マーケティング・クリエイティブ ───────────────────────
UPDATE ow_companies SET industry = 'クリエイティブ'     WHERE name = 'アドビ株式会社';
UPDATE ow_companies SET industry = 'MAツール'           WHERE name = 'マルケト株式会社';

-- ── コミュニケーション・セキュリティ ─────────────────────
UPDATE ow_companies SET industry = 'コミュニケーションAPI' WHERE name = 'Twilio Japan合同会社';
UPDATE ow_companies SET industry = '電子署名'           WHERE name = 'DocuSign Japan株式会社';
UPDATE ow_companies SET industry = 'インシデント管理'   WHERE name = 'ページャーデューティー株式会社';
UPDATE ow_companies SET industry = 'デジタルアダプション' WHERE name = 'ウォークミー株式会社';

-- ── ハードウェア・半導体 ─────────────────────────────────
UPDATE ow_companies SET industry = 'ハードウェア'       WHERE name = 'アップルジャパン合同会社';
UPDATE ow_companies SET industry = 'ハードウェア'       WHERE name = 'デル・テクノロジーズ株式会社';
UPDATE ow_companies SET industry = 'ハードウェア'       WHERE name = 'レノボ・ジャパン合同会社';
UPDATE ow_companies SET industry = 'ハードウェア'       WHERE name = '日本ヒューレット・パッカード合同会社';
UPDATE ow_companies SET industry = 'ハードウェア'       WHERE name = '株式会社日本HP';
UPDATE ow_companies SET industry = '半導体'             WHERE name = 'インテル株式会社';
UPDATE ow_companies SET industry = '半導体'             WHERE name = 'クアルコムジャパン合同会社';

-- ── その他 ───────────────────────────────────────────────
UPDATE ow_companies SET industry = 'SNS / メタバース'  WHERE name = 'Meta日本法人';
UPDATE ow_companies SET industry = 'モビリティ'        WHERE name = 'ウーバー・ジャパン株式会社';
UPDATE ow_companies SET industry = 'エンタープライズIT' WHERE name = 'ミラクル株式会社';
