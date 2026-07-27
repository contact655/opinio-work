-- Migration 195: ダミープロフィール（Migration 188）に salary_man + visibility_salary を追加
-- 全員 2点以上の公開年収ポイントを持つよう設定し、スパークラインを全カードに表示する
-- display_order: 1=現職(最新) / 数が大きいほど古い
-- スパークライン描画方向: 古い(大) → 新しい(小) = 左から右に上昇カーブを表示

DO $$
DECLARE
  u1 uuid := 'c0000001-cafe-babe-dead-000000000001'; -- 田中 美咲（女性 1998年生）リクルート→Sansan→SmartHR
  u2 uuid := 'c0000002-cafe-babe-dead-000000000002'; -- 山田 哲也（男性 1990年生）IBM→アクセンチュア→Salesforce→HubSpot
  u3 uuid := 'c0000003-cafe-babe-dead-000000000003'; -- 鈴木 あかり（女性 1994年生）電通デジタル→HubSpot→Sansan
  u4 uuid := 'c0000004-cafe-babe-dead-000000000004'; -- 佐藤 健太（男性 1996年生）NTTデータ→AWS→Datadog→Ubie
  u5 uuid := 'c0000005-cafe-babe-dead-000000000005'; -- 中村 由美（女性 1987年生）大手製造(masked)→パーソル→SmartHR→freee
  u6 uuid := 'c0000006-cafe-babe-dead-000000000006'; -- 高橋 誠一（男性 1992年生）ServiceNow→Zendesk→Salesforce
  u7 uuid := 'c0000007-cafe-babe-dead-000000000007'; -- 伊藤 さくら（女性 2001年生）製造業(masked)→Timee
  u8 uuid := 'c0000008-cafe-babe-dead-000000000008'; -- 渡辺 正雄（男性 1980年生）三菱UFJ→野村総研→freee→LayerX
BEGIN

  -- ── u1: 田中 美咲（CS系 女性）───────────────────────────────────────
  -- リクルート(display_order=3) → Sansan(2) → SmartHR(1=現職)
  UPDATE ow_experiences SET salary_man = 370, visibility_salary = true
    WHERE user_id = u1 AND display_order = 3; -- リクルート
  UPDATE ow_experiences SET salary_man = 490, visibility_salary = true
    WHERE user_id = u1 AND display_order = 2; -- Sansan
  UPDATE ow_experiences SET salary_man = 620, visibility_salary = true
    WHERE user_id = u1 AND display_order = 1; -- SmartHR（現職）

  -- ── u2: 山田 哲也（外資営業系 男性）────────────────────────────────────
  -- IBM(4) → アクセンチュア(3) → Salesforce(2) → HubSpot(1=現職)
  UPDATE ow_experiences SET salary_man = 410, visibility_salary = true
    WHERE user_id = u2 AND display_order = 4; -- 日本IBM
  UPDATE ow_experiences SET salary_man = 630, visibility_salary = true
    WHERE user_id = u2 AND display_order = 3; -- アクセンチュア
  UPDATE ow_experiences SET salary_man = 920, visibility_salary = true
    WHERE user_id = u2 AND display_order = 2; -- Salesforce
  UPDATE ow_experiences SET salary_man = 1180, visibility_salary = true
    WHERE user_id = u2 AND display_order = 1; -- HubSpot（現職）

  -- ── u3: 鈴木 あかり（マーケ系 女性）───────────────────────────────────
  -- 電通デジタル(3) → HubSpot(2) → Sansan(1=現職)
  UPDATE ow_experiences SET salary_man = 420, visibility_salary = true
    WHERE user_id = u3 AND display_order = 3; -- 電通デジタル
  UPDATE ow_experiences SET salary_man = 670, visibility_salary = true
    WHERE user_id = u3 AND display_order = 2; -- HubSpot
  UPDATE ow_experiences SET salary_man = 780, visibility_salary = true
    WHERE user_id = u3 AND display_order = 1; -- Sansan（現職）

  -- ── u4: 佐藤 健太（エンジニア→PdM 男性）────────────────────────────────
  -- NTTデータ(4) → AWS(3) → Datadog(2) → Ubie(1=現職)
  UPDATE ow_experiences SET salary_man = 380, visibility_salary = true
    WHERE user_id = u4 AND display_order = 4; -- NTTデータ
  UPDATE ow_experiences SET salary_man = 680, visibility_salary = true
    WHERE user_id = u4 AND display_order = 3; -- AWS
  UPDATE ow_experiences SET salary_man = 880, visibility_salary = true
    WHERE user_id = u4 AND display_order = 2; -- Datadog
  UPDATE ow_experiences SET salary_man = 950, visibility_salary = true
    WHERE user_id = u4 AND display_order = 1; -- Ubie（現職）

  -- ── u5: 中村 由美（HR系 女性）──────────────────────────────────────────
  -- 大手製造(masked,4) → パーソル(3) → SmartHR(2) → freee(1=現職)
  -- masked会社でも salary_man/visibility_salary は独立して公開可
  UPDATE ow_experiences SET salary_man = 350, visibility_salary = false
    WHERE user_id = u5 AND display_order = 4; -- 大手製造（非公開、masked会社なので年収も非公開）
  UPDATE ow_experiences SET salary_man = 430, visibility_salary = true
    WHERE user_id = u5 AND display_order = 3; -- パーソル
  UPDATE ow_experiences SET salary_man = 600, visibility_salary = true
    WHERE user_id = u5 AND display_order = 2; -- SmartHR
  UPDATE ow_experiences SET salary_man = 730, visibility_salary = true
    WHERE user_id = u5 AND display_order = 1; -- freee（現職）

  -- ── u6: 高橋 誠一（外資営業 男性）──────────────────────────────────────
  -- ServiceNow(3) → Zendesk(2) → Salesforce(1=現職)
  UPDATE ow_experiences SET salary_man = 550, visibility_salary = true
    WHERE user_id = u6 AND display_order = 3; -- ServiceNow
  UPDATE ow_experiences SET salary_man = 780, visibility_salary = true
    WHERE user_id = u6 AND display_order = 2; -- Zendesk
  UPDATE ow_experiences SET salary_man = 1020, visibility_salary = true
    WHERE user_id = u6 AND display_order = 1; -- Salesforce（現職）

  -- ── u7: 伊藤 さくら（第二新卒 女性）────────────────────────────────────
  -- 製造業(masked,2) → Timee(1=現職)  ← 2社のみ、2点以上を確保
  UPDATE ow_experiences SET salary_man = 270, visibility_salary = true
    WHERE user_id = u7 AND display_order = 2; -- 製造業（masked会社だが年収は公開）
  UPDATE ow_experiences SET salary_man = 400, visibility_salary = true
    WHERE user_id = u7 AND display_order = 1; -- Timee（現職）

  -- ── u8: 渡辺 正雄（金融→フィンテック 男性）──────────────────────────────
  -- 三菱UFJ(4) → 野村総研(3) → freee(2) → LayerX(1=現職)
  UPDATE ow_experiences SET salary_man = 490, visibility_salary = true
    WHERE user_id = u8 AND display_order = 4; -- 三菱UFJ銀行
  UPDATE ow_experiences SET salary_man = 680, visibility_salary = true
    WHERE user_id = u8 AND display_order = 3; -- 野村総合研究所
  UPDATE ow_experiences SET salary_man = 800, visibility_salary = true
    WHERE user_id = u8 AND display_order = 2; -- freee
  UPDATE ow_experiences SET salary_man = 950, visibility_salary = true
    WHERE user_id = u8 AND display_order = 1; -- LayerX（現職）

END $$;
