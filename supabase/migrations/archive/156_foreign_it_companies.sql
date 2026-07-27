-- Migration 156: 外資系IT企業 一括登録（64社）
-- New Relic（既登録）は is_published=true に更新
-- 全社 is_published=true, accepting_casual_meetings=false

-- New Relic: 既登録なので公開のみ更新
UPDATE ow_companies SET is_published = true WHERE name = 'New Relic株式会社';

INSERT INTO ow_companies (
  id, name, name_en, tagline, industry, phase,
  employee_count, location, logo_letter, logo_gradient,
  remote_work_status, accepting_casual_meetings, flex_time, side_job_ok,
  is_published
) VALUES

-- ── メガクラウド ──────────────────────────────────────────────────────────────
(gen_random_uuid(), 'アマゾン ウェブ サービス ジャパン合同会社', 'Amazon Web Services Japan',
 'クラウドで、世界のインフラを動かす', 'Cloud/SaaS', 'listed',
 '約2000名（日本）', '東京都', 'A', 'linear-gradient(135deg, #FF9900 0%, #E8650A 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), '日本マイクロソフト株式会社', 'Microsoft Japan',
 'すべての人と組織が、より多くのことを達成できるようにする', 'Cloud/SaaS', 'listed',
 '約2800名', '東京都', 'M', 'linear-gradient(135deg, #00A4EF 0%, #0078D4 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'グーグル合同会社', 'Google Japan',
 '世界中の情報を整理し、誰もがアクセスできる有益なものにする', 'AI Tech', 'listed',
 '約1500名', '東京都', 'G', 'linear-gradient(135deg, #4285F4 0%, #1565C0 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), '日本オラクル株式会社', 'Oracle Japan',
 'データドリブンなビジネス変革を、クラウドで実現する', 'Cloud/SaaS', 'listed',
 '約1800名', '東京都', 'O', 'linear-gradient(135deg, #F80000 0%, #C00000 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), '日本IBM株式会社', 'IBM Japan',
 'テクノロジーで、ビジネスと社会の変革に貢献する', 'Cloud/SaaS', 'listed',
 '約10000名', '東京都', 'I', 'linear-gradient(135deg, #1F70C1 0%, #054ADA 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'SAPジャパン株式会社', 'SAP Japan',
 'ERPクラウドで、エンタープライズ企業のDXを加速させる', 'Cloud/SaaS', 'listed',
 '約3000名', '東京都', 'S', 'linear-gradient(135deg, #0FAAFF 0%, #0070B9 100%)',
 'hybrid', false, true, false, true),

-- ── SaaS / クラウドサービス ───────────────────────────────────────────────────
(gen_random_uuid(), 'ServiceNow Japan合同会社', 'ServiceNow Japan',
 'ワークフロー自動化で、企業全体の仕事の流れを変革する', 'Cloud/SaaS', 'listed',
 '約600名', '東京都', 'S', 'linear-gradient(135deg, #62D84E 0%, #1F8A0E 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), '株式会社ワークデイ', 'Workday Japan',
 '人事・財務クラウドで、企業のスマートワークを実現する', 'HR Tech', 'listed',
 '約400名', '東京都', 'W', 'linear-gradient(135deg, #F4812A 0%, #C95E0A 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'アドビ株式会社', 'Adobe Japan',
 'クリエイティビティとデジタル体験を変革するプラットフォーム', 'Cloud/SaaS', 'listed',
 '約800名', '東京都', 'A', 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Zendesk株式会社', 'Zendesk Japan',
 'カスタマーサービスを、企業の競争優位に変えるCRMプラットフォーム', 'CRM/SaaS', 'listed',
 '約200名', '東京都', 'Z', 'linear-gradient(135deg, #03363D 0%, #0A5C6B 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'アトラシアン株式会社', 'Atlassian Japan',
 'チームの可能性を解き放つ、コラボレーションとDevOpsの基盤', 'Cloud/SaaS', 'listed',
 '約150名', '東京都', 'A', 'linear-gradient(135deg, #0052CC 0%, #0747A6 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Slack Japan株式会社', 'Slack Japan',
 'チームのコミュニケーションを、ビジネスの加速エンジンに変える', 'Cloud/SaaS', 'listed',
 '約200名', '東京都', 'S', 'linear-gradient(135deg, #4A154B 0%, #611F69 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Box Japan株式会社', 'Box Japan',
 '企業のコンテンツ管理とコラボレーションをクラウドで変革する', 'Cloud/SaaS', 'listed',
 '約200名', '東京都', 'B', 'linear-gradient(135deg, #0061D5 0%, #0040A0 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Dropbox Japan株式会社', 'Dropbox Japan',
 'チームの作業効率を高めるスマートワークスペース', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'D', 'linear-gradient(135deg, #0061FF 0%, #0040CC 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'DocuSign Japan株式会社', 'DocuSign Japan',
 '電子署名・契約管理クラウドで、ビジネスプロセスを自動化する', 'Cloud/SaaS', 'listed',
 '約150名', '東京都', 'D', 'linear-gradient(135deg, #FFB71B 0%, #E08C00 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Asana Japan株式会社', 'Asana Japan',
 'チームの仕事を可視化・自動化するワークマネジメントプラットフォーム', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'A', 'linear-gradient(135deg, #F06A6A 0%, #E03E3E 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Datadog Japan株式会社', 'Datadog Japan',
 'クラウドアプリケーションの監視・セキュリティ・分析プラットフォーム', 'AI Tech', 'listed',
 '約300名', '東京都', 'D', 'linear-gradient(135deg, #632CA6 0%, #7C3AED 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Snowflake Japan株式会社', 'Snowflake Japan',
 'データクラウドで、あらゆるデータを価値に変える', 'AI Tech', 'listed',
 '約200名', '東京都', 'S', 'linear-gradient(135deg, #29B5E8 0%, #0E8FC0 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'MongoDB Japan合同会社', 'MongoDB Japan',
 'デベロッパーに選ばれるデータプラットフォームで、アプリ開発を加速させる', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'M', 'linear-gradient(135deg, #4DB33D 0%, #2D8A20 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'コンフルエント合同会社', 'Confluent Japan',
 'データストリーミングプラットフォームで、リアルタイムデータ活用を実現する', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'C', 'linear-gradient(135deg, #CC0000 0%, #990000 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Twilio Japan合同会社', 'Twilio Japan',
 'CPaaSでカスタマーエンゲージメントとコミュニケーション体験を強化する', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'T', 'linear-gradient(135deg, #F22F46 0%, #C4103A 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Notion Labs Japan合同会社', 'Notion Japan',
 'メモ・ドキュメント・プロジェクト管理を一元化するオールインワンワークスペース', 'Cloud/SaaS', 'listed',
 '約50名', '東京都', 'N', 'linear-gradient(135deg, #3A3A3A 0%, #1A1A1A 100%)',
 'hybrid', false, true, false, true),

-- ── セキュリティ ──────────────────────────────────────────────────────────────
(gen_random_uuid(), 'パロアルトネットワークス株式会社', 'Palo Alto Networks Japan',
 'ゼロトラストとAIでサイバーセキュリティを変革する', 'セキュリティ', 'listed',
 '約500名', '東京都', 'P', 'linear-gradient(135deg, #FA582D 0%, #D43010 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'CrowdStrike株式会社', 'CrowdStrike Japan',
 'AIネイティブのエンドポイントセキュリティで、サイバー脅威を阻止する', 'セキュリティ', 'listed',
 '約200名', '東京都', 'C', 'linear-gradient(135deg, #E1223B 0%, #9B0D21 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ゼットスケーラー株式会社', 'Zscaler Japan',
 'クラウドネイティブのゼロトラストセキュリティで、安全なデジタル変革を支援する', 'セキュリティ', 'listed',
 '約200名', '東京都', 'Z', 'linear-gradient(135deg, #1D5EBB 0%, #003A8C 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'オクタ・ジャパン株式会社', 'Okta Japan',
 'アイデンティティ管理クラウドで、セキュアなアクセスを実現する', 'セキュリティ', 'listed',
 '約200名', '東京都', 'O', 'linear-gradient(135deg, #007DC1 0%, #005A8E 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'フォーティネット株式会社', 'Fortinet Japan',
 'ネットワークセキュリティのリーダーとして、サイバー脅威から企業を守る', 'セキュリティ', 'listed',
 '約400名', '東京都', 'F', 'linear-gradient(135deg, #EE3124 0%, #B71C14 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'シスコシステムズ合同会社', 'Cisco Systems Japan',
 'ネットワーク・セキュリティ・コラボレーションで、デジタルインフラを支える', 'セキュリティ', 'listed',
 '約2500名', '東京都', 'C', 'linear-gradient(135deg, #1BA0D7 0%, #0D6E99 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ヴイエムウェア株式会社', 'VMware Japan',
 'マルチクラウド環境の基盤ソフトウェアで、IT変革を加速させる', 'Cloud/SaaS', 'listed',
 '約600名', '東京都', 'V', 'linear-gradient(135deg, #405C6B 0%, #243545 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'アカマイ・テクノロジーズ合同会社', 'Akamai Japan',
 'エッジクラウドとセキュリティサービスで、デジタルエクスペリエンスを最適化する', 'セキュリティ', 'listed',
 '約300名', '東京都', 'A', 'linear-gradient(135deg, #009BDE 0%, #006B9E 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'クラウドフレア・ジャパン株式会社', 'Cloudflare Japan',
 'ゼロトラストとエッジネットワークで、インターネットをより安全・高速にする', 'セキュリティ', 'listed',
 '約200名', '東京都', 'C', 'linear-gradient(135deg, #F48120 0%, #C45C00 100%)',
 'hybrid', false, true, false, true),

-- ── ハードウェア／インフラ／半導体 ────────────────────────────────────────────
(gen_random_uuid(), 'デル・テクノロジーズ株式会社', 'Dell Technologies Japan',
 'ITインフラ・クラウドソリューションで、デジタルトランスフォーメーションを推進する', 'Cloud/SaaS', 'listed',
 '約2000名', '東京都', 'D', 'linear-gradient(135deg, #007DB8 0%, #005A8A 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), '日本ヒューレット・パッカード合同会社', 'HPE Japan',
 'エッジからクラウドまで、ITインフラのハイブリッドソリューション', 'Cloud/SaaS', 'listed',
 '約1500名', '東京都', 'H', 'linear-gradient(135deg, #0096D6 0%, #006B9E 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), '株式会社日本HP', 'HP Japan',
 'PCとプリンティングのグローバルリーダーとして、イノベーションを提供する', 'Cloud/SaaS', 'listed',
 '約1500名', '東京都', 'H', 'linear-gradient(135deg, #0096D6 0%, #004F80 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'エヌビディア合同会社', 'NVIDIA Japan',
 'AIと高性能コンピューティングの基盤となるGPUプラットフォーム', 'AI Tech', 'listed',
 '約300名', '東京都', 'N', 'linear-gradient(135deg, #76B900 0%, #4E7A00 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'インテル株式会社', 'Intel Japan',
 '半導体・プロセッサ技術でコンピューティングの未来を切り拓く', 'Cloud/SaaS', 'listed',
 '約700名', '東京都', 'I', 'linear-gradient(135deg, #0071C5 0%, #004F8A 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'クアルコムジャパン合同会社', 'Qualcomm Japan',
 'モバイル・IoT・自動車向け半導体で、コネクテッドワールドを実現する', 'Cloud/SaaS', 'listed',
 '約300名', '東京都', 'Q', 'linear-gradient(135deg, #3253DC 0%, #1A35A0 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'レノボ・ジャパン合同会社', 'Lenovo Japan',
 'PCからデータセンターまで、インテリジェントトランスフォーメーションへ', 'Cloud/SaaS', 'listed',
 '約1500名', '東京都', 'L', 'linear-gradient(135deg, #C8102E 0%, #9A0020 100%)',
 'hybrid', false, true, false, true),

-- ── 通信／ネットワーク ────────────────────────────────────────────────────────
(gen_random_uuid(), 'アリスタネットワークス合同会社', 'Arista Networks Japan',
 'クラウド規模のネットワーキングで、データセンターとキャンパスを変革する', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'A', 'linear-gradient(135deg, #DB3552 0%, #A01030 100%)',
 'hybrid', false, true, false, true),

-- ── データ／分析／AI ─────────────────────────────────────────────────────────
(gen_random_uuid(), 'Databricks Japan株式会社', 'Databricks Japan',
 'データ・AI・ガバナンスを統合したレイクハウスプラットフォーム', 'AI Tech', 'unicorn',
 '約200名', '東京都', 'D', 'linear-gradient(135deg, #FF3621 0%, #CC1A08 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'パランティア・テクノロジーズ', 'Palantir Japan',
 'エンタープライズAIプラットフォームで、データ分析と意思決定を変革する', 'AI Tech', 'listed',
 '約100名', '東京都', 'P', 'linear-gradient(135deg, #1B3A5C 0%, #0A1E35 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'エラスティック株式会社', 'Elastic Japan',
 'Elasticsearch基盤の検索・可観測性・セキュリティプラットフォーム', 'AI Tech', 'listed',
 '約200名', '東京都', 'E', 'linear-gradient(135deg, #F4B400 0%, #C47E00 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'OpenAI Japan合同会社', 'OpenAI Japan',
 'AGI（汎用人工知能）を通じ、全人類に利益をもたらすことを目指す', 'AI Tech', 'unicorn',
 '約50名', '東京都', 'O', 'linear-gradient(135deg, #10A37F 0%, #056B52 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'アンソロピックジャパン合同会社', 'Anthropic Japan',
 'AI安全研究と次世代AIアシスタントClaudeで、安全なAIの未来を切り拓く', 'AI Tech', 'unicorn',
 '約20名', '東京都', 'A', 'linear-gradient(135deg, #CC785C 0%, #A05038 100%)',
 'hybrid', false, true, false, true),

-- ── その他主要どころ ──────────────────────────────────────────────────────────
(gen_random_uuid(), 'Meta日本法人', 'Meta Japan',
 'Facebook・Instagram・WhatsAppで世界20億人以上のコミュニティをつなぐ', 'Cloud/SaaS', 'listed',
 '約500名', '東京都', 'M', 'linear-gradient(135deg, #0082FB 0%, #0050C8 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'アップルジャパン合同会社', 'Apple Japan',
 'テクノロジーと人文知の交差点で、人類の可能性を広げるプロダクトを作り続ける', 'Cloud/SaaS', 'listed',
 '約1000名', '東京都', 'A', 'linear-gradient(135deg, #3D3D3D 0%, #1A1A1A 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ウーバー・ジャパン株式会社', 'Uber Japan',
 'モビリティと配達サービスのプラットフォームで、日常の移動と物流を変革する', 'Cloud/SaaS', 'listed',
 '約300名', '東京都', 'U', 'linear-gradient(135deg, #1C1C1C 0%, #000000 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'Indeed Japan株式会社', 'Indeed Japan',
 '求人情報の集約と求職活動支援で、働くことをもっとシンプルにする', 'HR Tech', 'listed',
 '約1000名', '東京都', 'I', 'linear-gradient(135deg, #003A9B 0%, #001F6B 100%)',
 'hybrid', false, true, false, true),

-- ── 追加リクエスト ────────────────────────────────────────────────────────────
(gen_random_uuid(), 'ブラックライン株式会社', 'BlackLine Japan',
 '経理業務の自動化・変革クラウドで、財務チームの生産性を最大化する', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'B', 'linear-gradient(135deg, #1B3A6B 0%, #0A1E40 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ブレイズ株式会社', 'Braze Japan',
 '顧客ライフサイクル全体をカバーするカスタマーエンゲージメントプラットフォーム', 'CRM/SaaS', 'listed',
 '約200名', '東京都', 'B', 'linear-gradient(135deg, #F26B21 0%, #C04800 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'クリックハウス株式会社', 'ClickHouse Japan',
 '超高速リアルタイム分析に特化したOLAPデータベースプラットフォーム', 'AI Tech', 'unicorn',
 '約30名', '東京都', 'C', 'linear-gradient(135deg, #F5B500 0%, #C07800 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'クーパ・ソフトウェア株式会社', 'Coupa Japan',
 'AIネイティブの支出管理プラットフォームで、ビジネス支出を可視化・最適化する', 'Cloud/SaaS', 'listed',
 '約200名', '東京都', 'C', 'linear-gradient(135deg, #F87C1F 0%, #C05000 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ゲインサイト・ジャパン株式会社', 'Gainsight Japan',
 'Customer Success管理プラットフォームで、顧客の成功と自社の成長を同時に実現する', 'CRM/SaaS', 'unicorn',
 '約100名', '東京都', 'G', 'linear-gradient(135deg, #0CA6A6 0%, #076B6B 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ノービフォー株式会社', 'KnowBe4 Japan',
 'セキュリティ意識向上トレーニングプラットフォームで、人的サイバーリスクを低減する', 'セキュリティ', 'listed',
 '約100名', '東京都', 'K', 'linear-gradient(135deg, #DA1F26 0%, #A00010 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'コング・ジャパン株式会社', 'Kong Japan',
 'APIゲートウェイ・サービスメッシュで、APIエコノミーを支えるプラットフォーム', 'Cloud/SaaS', 'series_d',
 '約50名', '東京都', 'K', 'linear-gradient(135deg, #003459 0%, #001830 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ミラクル株式会社', 'Mirakl Japan',
 'エンタープライズ向けオンラインマーケットプレイスプラットフォームで、新たな収益チャネルを構築する', 'Cloud/SaaS', 'unicorn',
 '約50名', '東京都', 'M', 'linear-gradient(135deg, #FF3C00 0%, #CC1800 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'エヌシーノ合同会社', 'nCino Japan',
 'クラウド型統合銀行業務プラットフォームで、金融機関のDXを加速する', 'FinTech/SaaS', 'listed',
 '約50名', '東京都', 'N', 'linear-gradient(135deg, #00A3E0 0%, #006FA0 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ページャーデューティー株式会社', 'PagerDuty Japan',
 'インシデント管理とAIOpsプラットフォームで、デジタルオペレーションを変革する', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'P', 'linear-gradient(135deg, #06AC38 0%, #047025 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ザクトリー株式会社', 'Xactly Japan',
 'インテリジェントレベニューマネジメントで、営業インセンティブ・コミッション管理を自動化する', 'Sales Tech', 'unicorn',
 '約50名', '東京都', 'X', 'linear-gradient(135deg, #00B5E2 0%, #007AA0 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'アプティオ株式会社', 'Apptio Japan',
 'TBM（テクノロジービジネスマネジメント）でITコストの透明性と最適化を実現する', 'Cloud/SaaS', 'listed',
 '約50名', '東京都', 'A', 'linear-gradient(135deg, #1F4E79 0%, #0A2848 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'コンカー株式会社', 'Concur Japan',
 '出張・経費管理のクラウドプラットフォームで、バックオフィス業務を変革する', 'Cloud/SaaS', 'listed',
 '約300名', '東京都', 'C', 'linear-gradient(135deg, #E37222 0%, #A84E00 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'キリバ株式会社', 'Kyriba Japan',
 '財務・流動性マネジメントクラウドで、CFOのデジタルトランスフォーメーションを実現する', 'FinTech/SaaS', 'unicorn',
 '約50名', '東京都', 'K', 'linear-gradient(135deg, #003087 0%, #001550 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'マルケト株式会社', 'Marketo Japan',
 'マーケティングオートメーションで、潜在顧客の獲得から成約までを自動化する', 'Cloud/SaaS', 'listed',
 '約300名', '東京都', 'M', 'linear-gradient(135deg, #5C4084 0%, #3A2060 100%)',
 'hybrid', false, true, false, true),

(gen_random_uuid(), 'ウォークミー株式会社', 'WalkMe Japan',
 'デジタル・アダプション・プラットフォームで、ソフトウェア活用率を最大化する', 'Cloud/SaaS', 'listed',
 '約100名', '東京都', 'W', 'linear-gradient(135deg, #00B0F5 0%, #0078C0 100%)',
 'hybrid', false, true, false, true);
