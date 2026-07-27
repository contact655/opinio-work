-- Migration 157: 外資系IT企業 情報充実化（description / fit_positives / url / founded_year / avg_salary）

UPDATE ow_companies SET
  description = '世界最大のクラウドプロバイダーAWSの日本法人。EC2・S3・Lambdaをはじめ200以上のサービスを展開し、世界190カ国以上の企業・政府機関を支援。東京リージョンは2011年開設。エンジニアから営業・マーケまで幅広いポジションを展開。',
  fit_positives = '["グローバルキャリア", "高い報酬水準", "クラウド最大手", "エンタープライズ営業"]'::jsonb,
  url = 'https://aws.amazon.com/jp/',
  founded_year = 2006,
  avg_salary = '900万円〜'
WHERE name = 'アマゾン ウェブ サービス ジャパン合同会社';

UPDATE ow_companies SET
  description = 'Windows・Azure・Microsoft 365・Copilotを中核に、企業のDXを支援するグローバルIT企業の日本法人。約2,800名が在籍し、Inclusionとダイバーシティを重視した職場環境で知られる。AI「Copilot」統合を積極推進中。',
  fit_positives = '["グローバルキャリア", "AI最前線", "福利厚生充実", "充実した研修制度"]'::jsonb,
  url = 'https://www.microsoft.com/ja-jp/',
  founded_year = 1978,
  avg_salary = '900万円〜'
WHERE name = '日本マイクロソフト株式会社';

UPDATE ow_companies SET
  description = '検索エンジン・Google Cloud・YouTube・Androidなど世界規模のプロダクトを展開するグローバルテック企業の日本法人。渋谷スクランブルスクエアを拠点に、エンジニアリング・営業・マーケティングのポジションを展開。生成AIへの投資を急加速中。',
  fit_positives = '["GAFA最高峰", "高い報酬水準", "AI最前線", "自由な社風"]'::jsonb,
  url = 'https://about.google/intl/ja_jp/',
  founded_year = 2001,
  avg_salary = '1,200万円〜'
WHERE name = 'グーグル合同会社';

UPDATE ow_companies SET
  description = 'データベース・ERPクラウド・Java開発基盤など、企業の根幹を支えるITインフラを提供するグローバル企業の日本法人。Oracle Databaseは世界シェアNo.1。近年はOCI（Oracle Cloud Infrastructure）へ注力し、大企業のクラウド移行を支援。',
  fit_positives = '["エンタープライズ営業", "安定した基盤", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  url = 'https://www.oracle.com/jp/',
  founded_year = 1985,
  avg_salary = '800万円〜'
WHERE name = '日本オラクル株式会社';

UPDATE ow_companies SET
  description = 'コンサルティング・クラウド・AI（watsonx）・ハイブリッドクラウド基盤を提供するITレガシーの雄。金融・製造・政府機関向け大型プロジェクトに強く、約10,000名が在籍する日本最大規模の外資系IT企業。コンサル色が年々強まっている。',
  fit_positives = '["大企業向け案件", "コンサルキャリア", "AI（watsonx）", "安定した環境"]'::jsonb,
  url = 'https://www.ibm.com/jp-ja',
  founded_year = 1937,
  avg_salary = '700万円〜'
WHERE name = '日本IBM株式会社';

UPDATE ow_companies SET
  description = '世界シェアNo.1のERP「SAP S/4HANA」を中心に、製造・流通・金融など各産業向けクラウドソリューションを展開。日本での大企業DXプロジェクトを多数支援し、コンサルタント・営業・テクノロジスト職で高い需要がある。約3,000名が在籍。',
  fit_positives = '["エンタープライズDX", "グローバル案件", "ERP専門性", "高い報酬水準"]'::jsonb,
  url = 'https://www.sap.com/japan/',
  founded_year = 1992,
  avg_salary = '800万円〜'
WHERE name = 'SAPジャパン株式会社';

UPDATE ow_companies SET
  description = 'ITサービス管理（ITSM）から始まり、HR・カスタマーサービス・セキュリティ業務まで横断するワークフロー自動化プラットフォーム「Now Platform」を提供。フォーチュン500企業の85%以上が導入する急成長SaaS。エンタープライズ営業職の待遇が特に高い。',
  fit_positives = '["急成長SaaS", "エンタープライズ営業", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.servicenow.com/jp/',
  founded_year = 2004,
  avg_salary = '1,000万円〜'
WHERE name = 'ServiceNow Japan合同会社';

UPDATE ow_companies SET
  description = '人事管理（HCM）と財務管理に特化したエンタープライズクラウドSaaS。大企業・グローバル企業の人事・経理システムの基盤として採用されており、Airbnb・Amazon・JP Morganなど世界トップ企業が導入。日本でも大手企業への展開を加速中。',
  fit_positives = '["HR Tech最前線", "エンタープライズ営業", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.workday.com/ja-jp/',
  founded_year = 2005,
  avg_salary = '900万円〜'
WHERE name = '株式会社ワークデイ';

UPDATE ow_companies SET
  description = 'Photoshop・Illustrator・Premiere ProなどクリエイティブソフトとAdobe Experience Cloud（デジタルマーケティングプラットフォーム）を展開。SaaS転換後は急成長し、クリエイター向けからエンタープライズDXまで幅広い市場をカバー。',
  fit_positives = '["クリエイティブ産業", "エンタープライズマーケティング", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.adobe.com/jp/',
  founded_year = 1992,
  avg_salary = '800万円〜'
WHERE name = 'アドビ株式会社';

UPDATE ow_companies SET
  description = 'カスタマーサービス・CRM分野に特化したクラウドSaaSの日本法人。チケット管理からAIチャットボット・CRM分析まで一気通貫のカスタマーサポートプラットフォームを提供。世界110,000社以上が導入。2022年にプライベートエクイティに買収後も継続展開中。',
  fit_positives = '["CX（顧客体験）", "SMBから大企業まで", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://www.zendesk.co.jp/',
  founded_year = 2007,
  avg_salary = '700万円〜'
WHERE name = 'Zendesk株式会社';

UPDATE ow_companies SET
  description = 'Jira・Confluence・Trelloなど、開発チームとビジネスチームのコラボレーション・プロジェクト管理ツールを提供するオーストラリア発SaaS。エンジニアリング組織のデファクトスタンダードとして世界300,000社以上が導入。',
  fit_positives = '["DevOps/Agile", "エンジニア向け", "高い自律性", "グローバルキャリア"]'::jsonb,
  url = 'https://www.atlassian.com/ja',
  founded_year = 2002,
  avg_salary = '800万円〜'
WHERE name = 'アトラシアン株式会社';

UPDATE ow_companies SET
  description = 'ビジネスチャット・コラボレーションツール「Slack」の日本法人。2021年にSalesforceに買収後もSlackブランドとして独自展開を継続。「Slack AI」などAI機能の統合を加速し、企業のコミュニケーション基盤として進化中。',
  fit_positives = '["Salesforceグループ", "コミュニケーションSaaS", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  url = 'https://slack.com/intl/ja-jp/',
  founded_year = 2013,
  avg_salary = '800万円〜'
WHERE name = 'Slack Japan株式会社';

UPDATE ow_companies SET
  description = '企業向けコンテンツマネジメントクラウド「Box」の日本法人。契約書・設計書・映像など非構造化データの管理・コラボレーション・セキュリティを統合。医療・金融・製造など規制産業での導入実績が豊富で、世界10万社以上が採用。',
  fit_positives = '["エンタープライズ営業", "コンテンツ管理", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://www.box.com/ja-jp/',
  founded_year = 2012,
  avg_salary = '700万円〜'
WHERE name = 'Box Japan株式会社';

UPDATE ow_companies SET
  description = 'クラウドストレージ・コラボレーションツール「Dropbox」の日本法人。個人ユーザーからチーム・企業向けまでシームレスなファイル共有・同期環境を提供。近年は「Dropbox Sign（旧HelloSign）」などのe-sign機能との統合も強化。',
  fit_positives = '["グローバルキャリア", "SMBからエンタープライズ", "英語活用", "柔軟な働き方"]'::jsonb,
  url = 'https://www.dropbox.com/ja_JP/',
  founded_year = 2010,
  avg_salary = '700万円〜'
WHERE name = 'Dropbox Japan株式会社';

UPDATE ow_companies SET
  description = '電子署名のグローバルリーダー「DocuSign」の日本法人。電子署名から契約管理・CLM（Contract Lifecycle Management）まで幅広い契約DXサービスを提供。世界180カ国100万社以上が利用する業界標準ツール。',
  fit_positives = '["契約DX", "エンタープライズ営業", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  url = 'https://www.docusign.com/ja-jp',
  founded_year = 2019,
  avg_salary = '700万円〜'
WHERE name = 'DocuSign Japan株式会社';

UPDATE ow_companies SET
  description = 'Facebookの共同創業者が設立したワークマネジメントSaaSの日本法人。タスク・プロジェクト・目標管理（OKR）を一元化し、チームのワーク可視化と自動化を実現。フォーチュン100企業の87%が導入する急成長プロダクト。',
  fit_positives = '["ワークマネジメント", "グローバルキャリア", "エンタープライズ営業", "英語活用"]'::jsonb,
  url = 'https://asana.com/ja',
  founded_year = 2008,
  avg_salary = '700万円〜'
WHERE name = 'Asana Japan株式会社';

UPDATE ow_companies SET
  description = 'クラウドアプリケーションのモニタリング・セキュリティ・分析を統合するプラットフォームの日本法人。AWS・Azure・GCPなどマルチクラウド環境の可観測性を一元管理。世界28,000社以上が導入し、年間成長率30%以上を維持するNYSE上場企業。',
  fit_positives = '["クラウドネイティブ", "DevOps/SRE向け", "急成長SaaS", "高い報酬水準"]'::jsonb,
  url = 'https://www.datadoghq.com/ja/',
  founded_year = 2010,
  avg_salary = '900万円〜'
WHERE name = 'Datadog Japan株式会社';

UPDATE ow_companies SET
  description = 'マルチクラウドに対応したデータクラウドプラットフォームの日本法人。データウェアハウス・データレイク・データシェアリングを統合し、組織を超えたデータ活用を実現。史上最大のソフトウェアIPO（2020年）を実現した急成長SaaS。',
  fit_positives = '["データ活用最前線", "エンタープライズ営業", "急成長SaaS", "高い報酬水準"]'::jsonb,
  url = 'https://www.snowflake.com/ja/',
  founded_year = 2012,
  avg_salary = '900万円〜'
WHERE name = 'Snowflake Japan株式会社';

UPDATE ow_companies SET
  description = 'ドキュメント型NoSQLデータベース「MongoDB」の日本法人。開発者体験に優れたデータプラットフォームとして世界47,000社以上が採用。クラウドサービス「MongoDB Atlas」を軸に急成長中のNASDAQ上場企業。',
  fit_positives = '["デベロッパー向け", "クラウドデータ", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://www.mongodb.com/ja-jp',
  founded_year = 2007,
  avg_salary = '700万円〜'
WHERE name = 'MongoDB Japan合同会社';

UPDATE ow_companies SET
  description = 'Apache Kafkaを生み出したエンジニアが創業したデータストリーミングプラットフォームの日本法人。リアルタイムデータパイプライン・イベント駆動アーキテクチャの基盤として金融・通信・Eコマース業界での採用が急拡大。NASDAQ上場。',
  fit_positives = '["データエンジニアリング", "クラウドネイティブ", "テクニカル営業", "高い報酬水準"]'::jsonb,
  url = 'https://www.confluent.io/ja-jp/',
  founded_year = 2014,
  avg_salary = '800万円〜'
WHERE name = 'コンフルエント合同会社';

UPDATE ow_companies SET
  description = '音声・SMS・メール・WhatsAppなどあらゆる通信チャネルをAPI経由で統合するCPaaS（Communications Platform as a Service）の日本法人。開発者フレンドリーなAPIで世界290,000社以上が利用するNYSE上場企業。',
  fit_positives = '["CPaaS/通信", "デベロッパー向け", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://www.twilio.com/ja/',
  founded_year = 2008,
  avg_salary = '700万円〜'
WHERE name = 'Twilio Japan合同会社';

UPDATE ow_companies SET
  description = 'メモ・ドキュメント・データベース・プロジェクト管理をオールインワンで提供するワークスペースSaaSの日本法人。「Notion AI」を統合し、個人から大企業まで世界3,000万ユーザー以上が利用するユニコーン企業。',
  fit_positives = '["急成長ユニコーン", "プロダクト志向", "グローバルキャリア", "自由な社風"]'::jsonb,
  url = 'https://www.notion.so/ja-jp',
  founded_year = 2013,
  avg_salary = '800万円〜'
WHERE name = 'Notion Labs Japan合同会社';

UPDATE ow_companies SET
  description = 'ゼロトラストセキュリティのグローバルリーダーの日本法人。次世代ファイアウォール・SASE・クラウドセキュリティ（Prisma Cloud）・SOCオートメーション（Cortex）を統合プラットフォームで提供。世界80,000社以上が導入するNASDAQ上場企業。',
  fit_positives = '["サイバーセキュリティ最前線", "エンタープライズ営業", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.paloaltonetworks.jp/',
  founded_year = 2005,
  avg_salary = '1,000万円〜'
WHERE name = 'パロアルトネットワークス株式会社';

UPDATE ow_companies SET
  description = 'AIネイティブのエンドポイント・クラウドセキュリティプラットフォーム「Falcon」を提供する日本法人。世界300TB/日以上の脅威データをAIで分析し、リアルタイムに未知の脅威を阻止。2022年フォーチュン500最速成長企業ランキング1位。',
  fit_positives = '["AIセキュリティ最前線", "急成長SaaS", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.crowdstrike.com/ja-jp/',
  founded_year = 2011,
  avg_salary = '900万円〜'
WHERE name = 'CrowdStrike株式会社';

UPDATE ow_companies SET
  description = 'ゼロトラストネットワークアクセス（ZTNA）のパイオニアの日本法人。従来のVPN・ファイアウォールを置き換えるクラウドネイティブのセキュリティプラットフォームで、世界6,000社以上の大企業が採用するNASDAQ上場企業。',
  fit_positives = '["ゼロトラスト最前線", "エンタープライズ営業", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.zscaler.jp/',
  founded_year = 2007,
  avg_salary = '900万円〜'
WHERE name = 'ゼットスケーラー株式会社';

UPDATE ow_companies SET
  description = 'アイデンティティ・アクセス管理（IAM）のグローバルリーダーの日本法人。シングルサインオン・多要素認証・ライフサイクル管理を統合した「Okta Identity Cloud」は世界18,400社以上が採用。Auth0買収後、開発者向けIAM市場でも圧倒的存在感。',
  fit_positives = '["アイデンティティセキュリティ", "エンタープライズ営業", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.okta.com/jp/',
  founded_year = 2009,
  avg_salary = '900万円〜'
WHERE name = 'オクタ・ジャパン株式会社';

UPDATE ow_companies SET
  description = 'ネットワークセキュリティのグローバルリーダーの日本法人。FortiGateを中核に、ファイアウォール・SD-WAN・EDR・クラウドセキュリティを統合した「Fortinet Security Fabric」を提供。世界74万社以上が導入するNASDAQ上場企業。',
  fit_positives = '["ネットワークセキュリティ", "エンタープライズ営業", "広い顧客基盤", "グローバルキャリア"]'::jsonb,
  url = 'https://www.fortinet.com/jp/',
  founded_year = 2000,
  avg_salary = '800万円〜'
WHERE name = 'フォーティネット株式会社';

UPDATE ow_companies SET
  description = 'ネットワーク機器・セキュリティ・コラボレーション（Webex）・クラウド管理を幅広く提供するIT基盤企業の日本法人。ルーター・スイッチ分野で世界シェアNo.1を維持しつつ、ソフトウェア・サブスクリプションへの移行を推進中。約2,500名が在籍。',
  fit_positives = '["ネットワーク業界の基盤", "安定した環境", "グローバルキャリア", "充実した研修制度"]'::jsonb,
  url = 'https://www.cisco.com/c/ja_jp/',
  founded_year = 1991,
  avg_salary = '800万円〜'
WHERE name = 'シスコシステムズ合同会社';

UPDATE ow_companies SET
  description = '仮想化技術のパイオニアの日本法人。データセンター仮想化からマルチクラウド管理（VMware Cloud）・ネットワーク仮想化（NSX）・エンドユーザーコンピューティング（Workspace ONE）まで幅広く展開。2023年にBroadcomに買収後も事業継続中。',
  fit_positives = '["クラウドインフラ", "エンタープライズ営業", "グローバルキャリア", "充実した研修制度"]'::jsonb,
  url = 'https://www.vmware.com/jp.html',
  founded_year = 1998,
  avg_salary = '800万円〜'
WHERE name = 'ヴイエムウェア株式会社';

UPDATE ow_companies SET
  description = '世界最大のCDN（コンテンツデリバリーネットワーク）運用企業の日本法人。4,200箇所以上のPoP（接続拠点）を持つエッジプラットフォームを活用し、WebパフォーマンスとDDoS・WAFなどのセキュリティサービスを同時提供。インターネットトラフィックの15〜30%を処理。',
  fit_positives = '["エッジコンピューティング", "セキュリティ", "エンタープライズ営業", "グローバルキャリア"]'::jsonb,
  url = 'https://www.akamai.com/ja',
  founded_year = 1998,
  avg_salary = '800万円〜'
WHERE name = 'アカマイ・テクノロジーズ合同会社';

UPDATE ow_companies SET
  description = '世界中のインターネットトラフィックを保護・高速化するグローバルネットワークサービスの日本法人。CDN・DDoS対策・ゼロトラストセキュリティ（SASE）・Workers（エッジコンピューティング）を統合。1日1.3兆件以上のリクエストを処理するNYSE上場企業。',
  fit_positives = '["クラウドセキュリティ最前線", "急成長SaaS", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  url = 'https://www.cloudflare.com/ja-jp/',
  founded_year = 2009,
  avg_salary = '800万円〜'
WHERE name = 'クラウドフレア・ジャパン株式会社';

UPDATE ow_companies SET
  description = 'PC・サーバー・ストレージ・ネットワーク機器から、クラウドソリューションまで幅広く提供するITインフラ企業の日本法人。企業向けにITインフラ全体をワンストップで提供できる強みがあり、大企業・官公庁に強い実績を持つ。',
  fit_positives = '["ITインフラ総合", "エンタープライズ営業", "グローバルキャリア", "安定した環境"]'::jsonb,
  url = 'https://www.dell.com/ja-jp/',
  founded_year = 1992,
  avg_salary = '700万円〜'
WHERE name = 'デル・テクノロジーズ株式会社';

UPDATE ow_companies SET
  description = 'エッジ・コア・クラウドにまたがるハイブリッドITインフラを提供するHPEの日本法人。GreenLake（ITインフラのas-a-service）を軸に、大企業・公共機関向けのITインフラサービスを展開。コンサルティングサービス部門も強化中。',
  fit_positives = '["ITインフラ", "エンタープライズ営業", "グローバルキャリア", "充実した研修制度"]'::jsonb,
  url = 'https://www.hpe.com/jp/ja/',
  founded_year = 2015,
  avg_salary = '700万円〜'
WHERE name = '日本ヒューレット・パッカード合同会社';

UPDATE ow_companies SET
  description = 'PC・プリンター・周辺機器のグローバルリーダーHPの日本法人。個人・中小企業・大企業向けのPC、業務用プリンター、3Dプリンターなどを展開。「HP Work From Anywhere」ソリューションやサステナビリティ経営でも注目される。',
  fit_positives = '["PCメーカー最大手", "エンタープライズ営業", "グローバルキャリア", "安定した環境"]'::jsonb,
  url = 'https://jp.ext.hp.com/',
  founded_year = 1963,
  avg_salary = '600万円〜'
WHERE name = '株式会社日本HP';

UPDATE ow_companies SET
  description = 'GPUアーキテクチャでAI・生成AI・高性能コンピューティングの基盤を提供するグローバルテック企業の日本法人。データセンター向けH100/B100 GPU・CUDA開発基盤・自動運転用プラットフォームで、AI革命を牽引。時価総額世界トップ3を争うNASDAQ上場企業。',
  fit_positives = '["AI最前線", "時代の最先端", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  url = 'https://www.nvidia.com/ja-jp/',
  founded_year = 1993,
  avg_salary = '1,000万円〜'
WHERE name = 'エヌビディア合同会社';

UPDATE ow_companies SET
  description = 'CPUを中心とした半導体プロセッサのグローバルリーダーの日本法人。Core・Xeonプロセッサのほか、AI向けGaudi・FPGA・ネットワーク半導体まで幅広い製品ラインを持つ。日本ではエンタープライズ企業・PCメーカーへの技術支援・営業活動を担う。',
  fit_positives = '["半導体業界", "テクノロジー深掘り", "グローバルキャリア", "安定した環境"]'::jsonb,
  url = 'https://www.intel.co.jp/content/www/jp/ja/',
  founded_year = 1975,
  avg_salary = '700万円〜'
WHERE name = 'インテル株式会社';

UPDATE ow_companies SET
  description = 'スマートフォン向けSnapdragonプロセッサで世界シェアを誇る半導体設計企業の日本法人。5G基地局向けチップ・IoT・車載（Snapdragon Ride）・PCプラットフォームにも展開するファブレス半導体企業。',
  fit_positives = '["5G/モバイル最前線", "半導体設計", "グローバルキャリア", "テクニカル営業"]'::jsonb,
  url = 'https://www.qualcomm.com/company/locations/japan',
  founded_year = 1998,
  avg_salary = '700万円〜'
WHERE name = 'クアルコムジャパン合同会社';

UPDATE ow_companies SET
  description = '世界PCシェアNo.1（ThinkPad・IdeaPad）を誇る中国発グローバルIT企業の日本法人。PCに加えて、サーバー（ThinkSystem）・ストレージ・スマートデバイスまで幅広い製品ラインを展開。IBMのPC・サーバー部門を買収してグローバル市場を席巻。',
  fit_positives = '["PC業界No.1", "エンタープライズ営業", "グローバルキャリア", "安定した環境"]'::jsonb,
  url = 'https://www.lenovo.com/jp/ja/',
  founded_year = 2005,
  avg_salary = '600万円〜'
WHERE name = 'レノボ・ジャパン合同会社';

UPDATE ow_companies SET
  description = 'クラウドスケールのデータセンター・キャンパスネットワーキングプラットフォームを提供するNYSE上場企業の日本法人。CiscoのエンジニアがスピンオフしたEOSオペレーティングシステムが強み。Microsoft・Meta・Apple等の超大手ハイパースケーラーが主要顧客。',
  fit_positives = '["ネットワーク技術最前線", "高成長企業", "テクニカル営業", "グローバルキャリア"]'::jsonb,
  url = 'https://www.arista.com/ja/',
  founded_year = 2004,
  avg_salary = '900万円〜'
WHERE name = 'アリスタネットワークス合同会社';

UPDATE ow_companies SET
  description = 'Apache SparkとApache Deltaを生み出した研究者チームが創業したデータ・AIプラットフォームの日本法人。データエンジニアリング・機械学習・LLM開発を統合した「Lakehouse」アーキテクチャを提供。評価額430億ドルで世界最高評価ユニコーン企業のひとつ。',
  fit_positives = '["データ/AI最前線", "急成長ユニコーン", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.databricks.com/jp',
  founded_year = 2013,
  avg_salary = '1,000万円〜'
WHERE name = 'Databricks Japan株式会社';

UPDATE ow_companies SET
  description = '大量データの統合・分析に特化したエンタープライズAIプラットフォームを提供する米国企業の日本法人。元々CIA等の情報機関向けに開発し、現在は製造・金融・防衛など幅広い業界に展開。日本では政府・大企業との連携を強化中。',
  fit_positives = '["エンタープライズAI", "データ分析", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  url = 'https://www.palantir.com/',
  founded_year = 2003,
  avg_salary = '900万円〜'
WHERE name = 'パランティア・テクノロジーズ';

UPDATE ow_companies SET
  description = 'オープンソースの全文検索エンジン「Elasticsearch」を中心に、Elastic Stack（ELK）ベースのオブザーバビリティ・セキュリティ・エンタープライズ検索プラットフォームを提供。ログ分析・SIEM・アプリ内検索で世界49,000社以上が利用。NYSE上場。',
  fit_positives = '["オープンソース企業", "データ検索・分析", "エンジニア向け", "グローバルキャリア"]'::jsonb,
  url = 'https://www.elastic.co/jp/',
  founded_year = 2012,
  avg_salary = '800万円〜'
WHERE name = 'エラスティック株式会社';

UPDATE ow_companies SET
  description = 'ChatGPT・GPT-4・DALL-EなどのAIプロダクトを世界に提供するAI研究企業「OpenAI」の日本法人。2024年東京オフィスを開設し、日本語対応の強化と日本の大企業・政府機関へのChatGPT Enterprise展開を推進中。史上最速で1億ユーザーを達成したAI企業。',
  fit_positives = '["AI業界最前線", "歴史的転換期", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  url = 'https://openai.com/ja-JP/',
  founded_year = 2024,
  avg_salary = '1,000万円〜'
WHERE name = 'OpenAI Japan合同会社';

UPDATE ow_companies SET
  description = 'AIの安全性研究に特化した研究企業「Anthropic」の日本法人。AIアシスタント「Claude」を開発・提供し、安全で有益なAIの構築を使命とする。OpenAI出身者が創業したAIセーフティ企業として、AWSとのパートナーシップのもと急成長中。',
  fit_positives = '["AI安全研究最前線", "少数精鋭", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  url = 'https://www.anthropic.com/',
  founded_year = 2024,
  avg_salary = '1,000万円〜'
WHERE name = 'アンソロピックジャパン合同会社';

UPDATE ow_companies SET
  description = 'Facebook・Instagram・WhatsAppを運営し、世界30億人以上が利用するソーシャルメディアプラットフォームの日本法人。日本では広告事業が中心で、大手企業向けのデジタルマーケティングソリューションを提供。AIとメタバース（Quest VR）への投資も積極推進中。',
  fit_positives = '["GAFA最高峰", "高い報酬水準", "デジタルマーケティング最前線", "グローバルキャリア"]'::jsonb,
  url = 'https://www.meta.com/ja-jp/',
  founded_year = 2010,
  avg_salary = '1,000万円〜'
WHERE name = 'Meta日本法人';

UPDATE ow_companies SET
  description = 'iPhone・Mac・iPad・Apple Watchなどのプロダクトと、App Store・Apple Music・iCloudなどのサービスを展開するグローバルテック企業の日本法人。日本は世界第2位の重要市場で、直営Apple Storeとエンタープライズ事業の両方を展開。',
  fit_positives = '["GAFA最高峰", "圧倒的ブランド", "高い報酬水準", "グローバルキャリア"]'::jsonb,
  url = 'https://www.apple.com/jp/',
  founded_year = 1983,
  avg_salary = '1,000万円〜'
WHERE name = 'アップルジャパン合同会社';

UPDATE ow_companies SET
  description = 'ライドシェアリング・フードデリバリー（Uber Eats）・貨物輸送を展開するプラットフォーム企業の日本法人。日本ではUber Taxiとして配車事業、Uber Eatsで飲食デリバリー市場を席巻。日本のモビリティ規制緩和の流れでライドシェア本格展開を推進中。',
  fit_positives = '["プラットフォームビジネス", "デリバリー最大手", "グローバルキャリア", "急成長市場"]'::jsonb,
  url = 'https://www.uber.com/jp/ja/',
  founded_year = 2014,
  avg_salary = '700万円〜'
WHERE name = 'ウーバー・ジャパン株式会社';

UPDATE ow_companies SET
  description = '世界最大の求人検索エンジン「Indeed」の日本法人。月間2億8,000万人以上が利用するグローバルプラットフォームを日本市場向けに展開。パフォーマンス課金モデルで企業の採用コストを抑えた採用支援を実現。リクルートグループ傘下。',
  fit_positives = '["HR Tech最大手", "リクルートグループ", "グローバルキャリア", "安定した環境"]'::jsonb,
  url = 'https://jp.indeed.com/',
  founded_year = 2011,
  avg_salary = '700万円〜'
WHERE name = 'Indeed Japan株式会社';

UPDATE ow_companies SET
  description = '経理・財務部門の業務自動化クラウド「BlackLine」の日本法人。決算・財務クローズ処理の自動化・コントロールで、世界4,400社以上の経理DXを支援。CFO・経理責任者をターゲットとした専門性の高いエンタープライズ営業が中心。NASDAQ上場。',
  fit_positives = '["CFO向けセールス", "経理DX", "エンタープライズ営業", "グローバルキャリア"]'::jsonb,
  url = 'https://www.blackline.com/ja-jp/',
  founded_year = 2020,
  avg_salary = '800万円〜'
WHERE name = 'ブラックライン株式会社';

UPDATE ow_companies SET
  description = 'リアルタイム顧客エンゲージメントプラットフォーム「Braze」の日本法人。プッシュ通知・メール・SMS・アプリ内メッセージを一元管理し、AIを活用したパーソナライズドマーケティングを実現。Duolingo・HBO・Sonyなどグローバルブランドが採用。NASDAQ上場。',
  fit_positives = '["マーケティングSaaS", "CX最前線", "エンタープライズ営業", "グローバルキャリア"]'::jsonb,
  url = 'https://www.braze.com/ja',
  founded_year = 2021,
  avg_salary = '800万円〜'
WHERE name = 'ブレイズ株式会社';

UPDATE ow_companies SET
  description = 'オープンソース発の超高速OLAP（オンライン分析処理）データベース「ClickHouse」を提供するユニコーン企業の日本法人。1秒間に数十億行を処理できる圧倒的なクエリ速度が強みで、リアルタイム分析が求められる用途に採用が急拡大。評価額20億ドル超。',
  fit_positives = '["データベース最前線", "オープンソース企業", "テクニカル営業", "グローバルキャリア"]'::jsonb,
  url = 'https://clickhouse.com/',
  founded_year = 2021,
  avg_salary = '800万円〜'
WHERE name = 'クリックハウス株式会社';

UPDATE ow_companies SET
  description = 'AI活用の支出管理（Spend Management）プラットフォームを提供するSaaS企業の日本法人。購買・調達・費用精算・契約管理を統合し、企業の「BSM（ビジネス・スペンド・マネジメント）」を実現。フォーチュン500企業の多数が採用する大企業向けソリューション。',
  fit_positives = '["CFO向けセールス", "調達DX", "エンタープライズ営業", "グローバルキャリア"]'::jsonb,
  url = 'https://www.coupa.com/ja',
  founded_year = 2018,
  avg_salary = '800万円〜'
WHERE name = 'クーパ・ソフトウェア株式会社';

UPDATE ow_companies SET
  description = 'カスタマーサクセス管理（CSM）プラットフォームのパイオニア「Gainsight」の日本法人。SaaS企業のチャーン防止・アップセル・ヘルスモニタリングを自動化。「カスタマーサクセス」という概念を業界に広めた企業として知られ、SaaS経営の必需品となっている。',
  fit_positives = '["カスタマーサクセス特化", "SaaS特有ポジション", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://www.gainsight.com/',
  founded_year = 2022,
  avg_salary = '700万円〜'
WHERE name = 'ゲインサイト・ジャパン株式会社';

UPDATE ow_companies SET
  description = 'セキュリティ意識向上トレーニング（SAT）のグローバルリーダー「KnowBe4」の日本法人。フィッシング攻撃シミュレーションと教育コンテンツで、従業員のサイバーセキュリティ意識を向上。世界65,000社以上が導入するNASDAQ上場企業。',
  fit_positives = '["セキュリティ教育", "エンタープライズ営業", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://jp.knowbe4.com/',
  founded_year = 2022,
  avg_salary = '700万円〜'
WHERE name = 'ノービフォー株式会社';

UPDATE ow_companies SET
  description = 'APIゲートウェイ・サービスメッシュのリーディングプラットフォーム「Kong」の日本法人。マイクロサービス間のトラフィック管理・認証・レート制限を行うオープンソース基盤として世界2億回以上ダウンロードされ、マルチクラウド環境での採用が急拡大。',
  fit_positives = '["API/マイクロサービス", "オープンソース企業", "テクニカル営業", "グローバルキャリア"]'::jsonb,
  url = 'https://konghq.com/',
  founded_year = 2017,
  avg_salary = '700万円〜'
WHERE name = 'コング・ジャパン株式会社';

UPDATE ow_companies SET
  description = 'エンタープライズ向けオンラインマーケットプレイスプラットフォーム「Mirakl」の日本法人。企業が自社ECサイトをAmazon・楽天型のマーケットプレイスに変革するためのSaaS基盤を提供。評価額35億ドルのユニコーン企業で、世界400以上のマーケットプレイスを支援。',
  fit_positives = '["Eコマース/マーケットプレイス", "エンタープライズ営業", "グローバルキャリア", "急成長ユニコーン"]'::jsonb,
  url = 'https://www.mirakl.com/',
  founded_year = 2022,
  avg_salary = '800万円〜'
WHERE name = 'ミラクル株式会社';

UPDATE ow_companies SET
  description = 'Salesforceプラットフォーム上に構築した金融機関特化のクラウド型統合銀行業務システム「nCino Bank Operating System」の日本法人。融資審査・管理・コンプライアンス業務を統合し、世界1,900以上の金融機関が導入。NASDAQ上場。',
  fit_positives = '["金融DX特化", "FinTech/Banking", "エンタープライズ営業", "グローバルキャリア"]'::jsonb,
  url = 'https://www.ncino.com/',
  founded_year = 2021,
  avg_salary = '700万円〜'
WHERE name = 'エヌシーノ合同会社';

UPDATE ow_companies SET
  description = 'インシデント管理・AIOpsプラットフォームのリーダー「PagerDuty」の日本法人。DevOps・SRE組織のオンコール管理・アラート集約・インシデント対応を自動化。世界26,000社以上が導入し、Datadog・Splunk・ServiceNowとも連携するNYSE上場企業。',
  fit_positives = '["DevOps/SRE向け", "エンタープライズ営業", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://www.pagerduty.co.jp/',
  founded_year = 2019,
  avg_salary = '700万円〜'
WHERE name = 'ページャーデューティー株式会社';

UPDATE ow_companies SET
  description = '営業インセンティブ・コミッション管理（ICM）のパイオニア「Xactly」の日本法人。営業報酬設計・支払い管理・パフォーマンス分析をクラウドで一元管理し、営業組織の生産性向上を実現。世界1,600社以上の企業が活用するSales Performance Management（SPM）リーダー。',
  fit_positives = '["Salesインセンティブ特化", "エンタープライズ営業", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://www.xactlycorp.com/',
  founded_year = 2022,
  avg_salary = '700万円〜'
WHERE name = 'ザクトリー株式会社';

UPDATE ow_companies SET
  description = 'ITコスト管理・IT財務管理（ITFM）のリーダー「Apptio」（現IBMグループ）の日本法人。TBM（Technology Business Management）フレームワークに基づき、IT予算の可視化・最適化を実現。CIO・CFO向けのFinOps・クラウドコスト管理ソリューションとして注目。',
  fit_positives = '["IT財務管理特化", "CIO向けセールス", "グローバルキャリア", "英語活用"]'::jsonb,
  url = 'https://www.apptio.com/ja/',
  founded_year = 2020,
  avg_salary = '800万円〜'
WHERE name = 'アプティオ株式会社';

UPDATE ow_companies SET
  description = '出張管理・経費精算クラウドのグローバルリーダー「SAP Concur」の日本法人。従業員の出張申請から経費精算・精算書承認までをシームレスに自動化。日本では大手企業・グローバル企業を中心に幅広く導入されており、SAPとのシナジーを活かした展開を推進中。',
  fit_positives = '["経費精算DX", "エンタープライズ営業", "SAPグループ", "グローバルキャリア"]'::jsonb,
  url = 'https://www.concur.co.jp/',
  founded_year = 2007,
  avg_salary = '700万円〜'
WHERE name = 'コンカー株式会社';

UPDATE ow_companies SET
  description = 'CFO・財務部門向けの財務・流動性管理（TMS）クラウドプラットフォームのグローバルリーダー「Kyriba」の日本法人。キャッシュマネジメント・リスク管理・支払い管理・FX自動化を統合。世界2,500社以上のグローバル企業が採用する評価額11億ドルのユニコーン企業。',
  fit_positives = '["CFO向けFinTech", "財務DX", "エンタープライズ営業", "グローバルキャリア"]'::jsonb,
  url = 'https://www.kyriba.com/',
  founded_year = 2021,
  avg_salary = '800万円〜'
WHERE name = 'キリバ株式会社';

UPDATE ow_companies SET
  description = 'マーケティングオートメーション（MA）のパイオニア「Adobe Marketo Engage」（旧Marketo）の日本法人。リードナーチャリング・スコアリング・メールマーケティング・ABMを統合。2018年にAdobeが買収後も独自ブランドで展開を継続中。',
  fit_positives = '["MAツール最大手", "エンタープライズマーケティング", "アドビグループ", "グローバルキャリア"]'::jsonb,
  url = 'https://jp.marketo.com/',
  founded_year = 2013,
  avg_salary = '700万円〜'
WHERE name = 'マルケト株式会社';

UPDATE ow_companies SET
  description = 'DAP（デジタル・アダプション・プラットフォーム）のパイオニア「WalkMe」（現SAPグループ）の日本法人。ソフトウェア操作ガイド・アナリティクスをシステム上にオーバーレイ表示し、従業員のITツール活用率を最大化。Salesforce・SAP・Workday等の導入支援で世界2,000社以上が採用。',
  fit_positives = '["DAP/IT活用支援", "エンタープライズ営業", "SAPグループ", "グローバルキャリア"]'::jsonb,
  url = 'https://www.walkme.com/ja/',
  founded_year = 2019,
  avg_salary = '700万円〜'
WHERE name = 'ウォークミー株式会社';

UPDATE ow_companies SET
  fit_positives = '["オブザーバビリティ最前線", "エンジニアリング重視", "グローバルキャリア", "高い報酬水準"]'::jsonb,
  avg_salary = '800万円〜',
  url = 'https://newrelic.com/jp'
WHERE name = 'New Relic株式会社';
