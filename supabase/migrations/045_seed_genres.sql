-- 045_seed_genres.sql
-- ジャンルマスター初期データ（8ジャンル）
-- 段階：genres-feature Phase A

INSERT INTO ow_genres (slug, name, description, display_order) VALUES
  ('foreign-capital',  '外資系',           'グローバル基盤で働く',       1),
  ('horizontal-saas',  'ホリゾンタルSaaS', '業界横断のプロダクト',       2),
  ('vertical-saas',    'バーティカルSaaS', '業界特化のプロダクト',       3),
  ('mega-venture',     'メガベンチャー',   '規模感とスピードの両立',     4),
  ('early-stage',      'シード〜シリーズA','創業期の手触り感',           5),
  ('ai-llm',           'AI・LLM特化',      '最先端領域',                 6),
  ('dx-consulting',    'DX/コンサル',      '大企業変革に関わる',         7),
  ('ipo-ready',        'IPO準備中',        '上場前の成長フェーズ',       8)
ON CONFLICT (slug) DO NOTHING;
