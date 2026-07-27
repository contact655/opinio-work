-- Migration 149: 組織体制フィールド追加
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS org_teams JSONB;

COMMENT ON COLUMN ow_companies.org_teams IS '組織体制・チーム情報 [{name, en_name, division, mission, description, roles[]}]';

-- セールスフォース・ジャパン の組織体制データ（23チーム・8部門）
UPDATE ow_companies
SET org_teams = '[
  {
    "name": "エンタープライズ営業",
    "en_name": "Enterprise",
    "division": "Sales",
    "mission": "日本の大手企業のDXをCRMで実現する",
    "description": "Fortune 500クラスの大企業・上場企業を対象に、マルチクラウド導入を推進。案件規模は数千万〜数億円。CEOレベルとの関係構築が求められる最上位セグメント。",
    "roles": ["Account Executive", "Senior AE"]
  },
  {
    "name": "ECS（子会社・グループ会社担当）",
    "en_name": "Enterprise Corporate Sales",
    "division": "Sales",
    "mission": "エンタープライズ企業のグループ全体にSalesforceを広げる",
    "description": "大手企業の子会社・関連会社・グループ会社を専任で担当するチーム。親会社がEnterprise担当なのに対し、ECSはグループ企業全体へのエクスパンションを担う。複数の子会社を同時に担当するため、効率的なマルチアカウント管理能力が重要。",
    "roles": ["Account Executive (ECS)", "Corporate Account Manager"]
  },
  {
    "name": "Named Account（戦略的大手専任）",
    "en_name": "Named Account",
    "division": "Sales",
    "mission": "最重要顧客との長期的・戦略的パートナーシップを構築する",
    "description": "トヨタ・ソフトバンク・楽天など特定の戦略的アカウントを専任で担当。1社に対して深くコミットし、経営レベルとの関係構築から全グループへの展開まで責任を持つ。業界内での最大の影響力を持つポジションの一つ。",
    "roles": ["Named Account Executive", "Global Account Manager"]
  },
  {
    "name": "コマーシャル営業",
    "en_name": "Commercial (CBU)",
    "division": "Sales",
    "mission": "成長する中堅・中小企業のビジネスをスケールさせる",
    "description": "スタートアップから中堅企業（従業員200〜2,000名規模）を対象とした営業チーム。新規開拓のスピードと提案力が求められる。成長市場での案件が多く、ベロシティ（スピード）重視のセールスが特徴。",
    "roles": ["Account Executive (Commercial)", "Mid-Market AE"]
  },
  {
    "name": "コプライムセールス（製品スペシャリスト）",
    "en_name": "Co-Prime / Overlay Sales",
    "division": "Sales",
    "mission": "特定プロダクトの深い専門性で、AEと協業して受注を支える",
    "description": "Service Cloud・Marketing Cloud・Slack・Data Cloud・Tableauなど特定製品の専門営業チーム。担当AEと「コプライム（共同担当）」として既存商談に参加し、製品固有の価値を訴求。製品知識の深さと顧客の業務課題への洞察が求められる。",
    "roles": ["Product Specialist AE", "Overlay AE", "Cloud AE"]
  },
  {
    "name": "パブリックセクター（官公庁・公共）",
    "en_name": "Public Sector",
    "division": "Sales",
    "mission": "日本の官公庁・自治体・公共機関のDXを推進する",
    "description": "中央省庁・地方自治体・独立行政法人・大学・医療機関などを担当。公共調達プロセスの理解と長期的な関係構築が必要。Government Cloudの活用など、パブリックセクター特有の要件への対応も求められる。",
    "roles": ["Public Sector AE", "Government Account Executive"]
  },
  {
    "name": "アライアンス＆チャネル（パートナー営業）",
    "en_name": "Alliances & Channels",
    "division": "Sales",
    "mission": "SIerやコンサルファームとの協業でエコシステムを拡大する",
    "description": "アクセンチュア・NTTデータ・富士通・IBMなどのパートナー企業と協業し、Salesforce製品の導入案件を共同で創出・推進する。直販と間接販売の両方を統括する戦略的なロール。",
    "roles": ["Alliance Manager", "Partner Account Manager", "Channel Manager"]
  },
  {
    "name": "インサイドセールス（ISR）",
    "en_name": "Inside Sales Representative",
    "division": "Inside Sales",
    "mission": "インバウンドリードを質の高い商談に転換する",
    "description": "マーケティングが獲得したリード（資料請求・デモ申込・イベント参加者等）を対応し、AEへの商談パスを担う。短期間で多くの企業と接点を持てるため、Salesforceのプロダクト知識と幅広い業界理解を素早く習得できる。",
    "roles": ["Inside Sales Representative (ISR)", "Lead Qualification Specialist"]
  },
  {
    "name": "インサイドセールス（BDR）",
    "en_name": "Business Development Representative",
    "division": "Inside Sales",
    "mission": "ターゲット企業を自ら開拓し、新規パイプラインを生み出す",
    "description": "アウトバウンドで新規企業を開拓するチーム。ターゲットリストの作成からコールド接触・ニーズ仮説立案まで主体的に動く。営業力の基礎を鍛える職種として、将来のフィールドAEへのキャリアパスが明確。",
    "roles": ["Business Development Representative (BDR)", "Outbound SDR"]
  },
  {
    "name": "ソリューションエンジニア",
    "en_name": "Solution Engineering",
    "division": "Solution Engineering",
    "mission": "技術的な深さで顧客課題を解決し、受注を支える",
    "description": "セールスと並走するプリセールスエンジニア。製品デモ・PoC・RFP対応・技術提案を担当。顧客の業務プロセスと既存システムを理解した上で最適な設計を提示する。営業とエンジニアの橋渡し役。",
    "roles": ["Solution Engineer", "Senior SE", "Principal SE"]
  },
  {
    "name": "インダストリーSE（業界特化）",
    "en_name": "Industry Solution Engineer",
    "division": "Solution Engineering",
    "mission": "業界固有の業務知識でSalesforceの価値を最大化する",
    "description": "金融・製造・ヘルスケア・小売などの業界に特化したプリセールスチーム。業界の業務プロセス・規制・商習慣を熟知した上で、業界向けクラウド（Financial Services Cloud・Health Cloud等）の活用提案を行う。",
    "roles": ["Industry Solution Engineer", "Financial Services SE", "Healthcare SE"]
  },
  {
    "name": "カスタマーサクセスマネージャー",
    "en_name": "Customer Success",
    "division": "Customer Success",
    "mission": "顧客の投資対効果を最大化し、長期的な成功を届ける",
    "description": "導入済み顧客のオンボーディング・活用促進・更新・拡大を担う。四半期ビジネスレビュー（QBR）でエグゼクティブに価値報告を行い、ネット拡張率（NRR）向上に責任を持つ。",
    "roles": ["Customer Success Manager (CSM)", "Senior CSM", "Strategic CSM"]
  },
  {
    "name": "リニューアルマネージャー",
    "en_name": "Renewal Manager",
    "division": "Customer Success",
    "mission": "契約更新率100%を目指し、顧客の継続利用を確保する",
    "description": "既存顧客の契約更新を専任で担当するチーム。解約リスクの早期検知・対応・アップセルの機会特定まで行う。CSMと密に連携し、更新時期の6〜12ヶ月前から戦略的に動く。",
    "roles": ["Renewal Manager", "Renewal Account Manager"]
  },
  {
    "name": "シグネチャーサクセス（プレミアムサポート）",
    "en_name": "Signature Success",
    "division": "Customer Success",
    "mission": "最重要顧客に専属サポートと先進的な活用支援を提供する",
    "description": "上位プレミアム契約顧客向けの専任サポートチーム。専属のTechnical Account Manager (TAM) がアサインされ、製品ロードマップ情報の提供・パフォーマンス最適化・インシデント対応を行う。",
    "roles": ["Technical Account Manager (TAM)", "Designated Support Engineer"]
  },
  {
    "name": "コンサルティングデリバリー",
    "en_name": "Professional Services - Delivery",
    "division": "Professional Services",
    "mission": "Salesforce導入プロジェクトを成功に導く",
    "description": "Salesforce製品の導入・カスタマイズ・インテグレーションを担当するコンサルタントチーム。プロジェクト管理から要件定義・設定・ユーザートレーニングまで一気通貫で担当。顧客の業務変革を技術で支える。",
    "roles": ["Engagement Manager", "Functional Consultant", "Technical Consultant"]
  },
  {
    "name": "テクニカルアーキテクト",
    "en_name": "Technical Architect",
    "division": "Professional Services",
    "mission": "複雑な大型案件の技術設計に責任を持つ",
    "description": "マルチクラウド・レガシーシステム連携・大規模データ移行など複雑な案件の技術アーキテクチャを設計する。CTAやCCAなどSalesforceの最高位資格保有者が多い。業界最高峰の技術スペシャリストポジション。",
    "roles": ["Technical Architect", "Certified Technical Architect (CTA)"]
  },
  {
    "name": "デマンドジェネレーション",
    "en_name": "Demand Generation",
    "division": "Marketing",
    "mission": "インサイドセールスとAEのパイプラインを最大化する",
    "description": "デジタル広告・SEO/SEM・コンテンツマーケティング・ナーチャリングを組み合わせてMQLを創出するチーム。Salesforceのデータドリブンマーケティングを自社で実践する環境。",
    "roles": ["Demand Generation Manager", "Digital Marketing Specialist", "Marketing Ops"]
  },
  {
    "name": "イベントマーケティング",
    "en_name": "Event Marketing",
    "division": "Marketing",
    "mission": "Salesforce最大のブランド体験「Dreamforce Japan」を届ける",
    "description": "世界最大のSaaSカンファレンス「Dreamforce」の日本版開催や、Salesforce World Tourなどの大型イベントを企画・運営する。セールスフォース・ジャパン内でも特に注目度が高い部門で、数千人規模のイベントを仕切る。",
    "roles": ["Event Manager", "Field Marketing Manager", "Event Coordinator"]
  },
  {
    "name": "プロダクトマーケティング",
    "en_name": "Product Marketing Manager",
    "division": "Marketing",
    "mission": "製品の価値を市場に伝え、競合優位性を確立する",
    "description": "各プロダクト（Sales Cloud・Service Cloud・Data Cloud等）のGo-To-Market戦略を策定するチーム。グローバルのプロダクトチームと連携し日本市場向けのメッセージング・価格戦略・競合対策を担当。",
    "roles": ["Product Marketing Manager (PMM)", "Competitive Intelligence"]
  },
  {
    "name": "レベニューオペレーションズ",
    "en_name": "Revenue Operations",
    "division": "Operations",
    "mission": "営業プロセス・データ・ツールを最適化し、売上成長を加速する",
    "description": "CRM（自社Salesforce）の管理・カスタマイズ・データ品質管理から営業プロセスの設計・改善まで担当。営業チームの「縁の下の力持ち」として、予測精度向上・営業効率化・データ分析を通じてビジネス成長に貢献。",
    "roles": ["Revenue Operations Manager", "Salesforce Admin", "Sales Ops Analyst"]
  },
  {
    "name": "ディールデスク",
    "en_name": "Deal Desk",
    "division": "Operations",
    "mission": "複雑な見積・契約交渉をサポートし、受注スピードを上げる",
    "description": "AEが提案する価格・割引・契約条件の審査・承認・最適化を担うチーム。法務・財務・製品チームと連携し、複雑な大型案件の価格戦略をリードする。営業とオペレーションの橋渡し役。",
    "roles": ["Deal Desk Manager", "Pricing Analyst", "Commercial Operations"]
  },
  {
    "name": "タレントアクイジション（採用）",
    "en_name": "Talent Acquisition",
    "division": "People",
    "mission": "Salesforceの成長を支える優秀な人材を採用する",
    "description": "グローバルNo.1 SaaSの採用チームとして、営業・エンジニア・マーケター等のポジションを担当。Ohana文化を体現した採用体験を設計し、候補者にSalesforceの魅力を伝える役割も担う。",
    "roles": ["Talent Acquisition Partner", "Technical Recruiter", "Campus Recruiter"]
  },
  {
    "name": "エンプロイーサクセス（人事・HRBP）",
    "en_name": "Employee Success",
    "division": "People",
    "mission": "全社員がベストパフォーマンスを発揮できる環境を作る",
    "description": "Salesforceでは「HR」を「Employee Success (ES)」と呼ぶ。各部門に専任のHRビジネスパートナーがアサインされ、組織設計・人材育成・パフォーマンス管理・文化醸成を担う。Ohana文化の守り手としての役割も大きい。",
    "roles": ["HR Business Partner (HRBP)", "People Advisor", "Compensation & Benefits"]
  }
]'::jsonb
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
