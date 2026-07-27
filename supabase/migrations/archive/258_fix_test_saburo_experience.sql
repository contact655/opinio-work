-- テスト三郎（contact+08@opinio.co.jp）のオンボーディング企業データを補完
-- バグ修正前に登録したため ow_experiences が空だった
INSERT INTO ow_experiences (user_id, company_id, company_text, is_current, role_title, started_at)
VALUES (
  '3009cf69-9761-46d5-ac79-75e8438c21b2',
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  '株式会社セールスフォース・ジャパン',
  true,
  '',
  null
)
ON CONFLICT DO NOTHING;
