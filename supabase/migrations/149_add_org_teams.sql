-- Migration 149: 組織体制フィールド追加
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS org_teams JSONB;

COMMENT ON COLUMN ow_companies.org_teams IS '組織体制・チーム情報 [{name, en_name, mission, description, roles[]}]';

-- セールスフォース・ジャパン の組織体制データ
UPDATE ow_companies
SET org_teams = '[
  {
    "name": "エンタープライズ営業",
    "en_name": "Enterprise",
    "mission": "日本の大手企業のDXをCRMで実現する",
    "description": "Fortune 500クラスの大企業・上場企業を対象に、Sales Cloud・Service Cloud・Slack等のマルチクラウド導入を推進。案件規模は数千万〜数億円。長期的なパートナーシップを構築し、顧客の経営課題に深く関与できる。",
    "roles": ["Account Executive", "Solution Engineer", "Customer Success Manager"]
  },
  {
    "name": "コマーシャル営業",
    "en_name": "Commercial (CBU)",
    "mission": "成長する中堅・中小企業のビジネスをスケールさせる",
    "description": "スタートアップから中堅企業（従業員200〜2,000名規模）を対象とした営業チーム。新規開拓のスピードと提案力が求められる。成長市場での案件が多く、ベロシティ（スピード）重視のセールスが特徴。",
    "roles": ["Account Executive", "Inside Sales Representative", "Solution Engineer"]
  },
  {
    "name": "インサイドセールス",
    "en_name": "Inside Sales (ISR/BDR)",
    "mission": "質の高いパイプラインを作り、AEの成功を支える",
    "description": "インバウンドのリード対応（ISR）とアウトバウンドの新規開拓（BDR）の2チームで構成。AEへの商談供給が主ミッション。Salesforce自身のSales Cloudを使ったセールスプロセスを最前線で体験できる。",
    "roles": ["Inside Sales Representative (ISR)", "Business Development Representative (BDR)"]
  },
  {
    "name": "カスタマーサクセス",
    "en_name": "Customer Success",
    "mission": "顧客の投資対効果を最大化し、長期的な成功を届ける",
    "description": "導入済み顧客のオンボーディング・活用促進・更新・拡大を担う。プロジェクト管理からエグゼクティブとの関係構築まで幅広い。「顧客の成功事例を作る」ことがKPIであり、長期的な信頼関係を築ける職種。",
    "roles": ["Customer Success Manager (CSM)", "Renewal Manager", "Technical Architect"]
  },
  {
    "name": "マーケティング",
    "en_name": "Marketing",
    "mission": "Salesforceブランドの認知とデマンドジェネレーションを推進",
    "description": "デジタルマーケティング・イベント・コンテンツ・PR・デマンドジェネレーションの各機能を持つ。Dreamforce（世界最大規模のSaaSカンファレンス）の日本展開も担当。グローバル組織と連携しながら日本市場向けの施策を設計する。",
    "roles": ["Campaign Manager", "Demand Generation", "Event Manager", "Content Marketer"]
  },
  {
    "name": "ソリューションエンジニア",
    "en_name": "Solution Engineering",
    "mission": "技術的な深さで顧客の課題を解決し、受注を支える",
    "description": "セールス側エンジニア（プリセールス）として、製品デモ・PoC・技術提案を担当。顧客の業務プロセスと既存システムを理解した上で、Salesforce製品の最適な活用方法を提案。営業とエンジニアの橋渡し役。",
    "roles": ["Solution Engineer", "Principal Solution Engineer"]
  }
]'::jsonb
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
