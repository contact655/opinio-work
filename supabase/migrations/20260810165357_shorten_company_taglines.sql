-- 企業カードの tagline を短縮する（2026-08-11）
--
-- 背景:
--   /companies のカードは tagline を1行省略で表示している。実測で
--   1440px 27/76社・768px 56/76社・375px 60/76社が途中で切れており、
--   日本語は述語が後ろに来るため「どうするか」が丸ごと落ちていた
--   （例: Microsoft「…達成できるよ|うにする」）。CSS では直せないため
--   データ側を短くする。
--
-- 対象:
--   35文字以上だった31社のみ。26〜34文字の30社は今回対象外。
--
-- 方針（柴さん判定・2026-08-11）:
--   第一条件は「その一文だけで事業の輪郭が読み取れること」。
--   公式ミッションかどうかは第二条件で、抽象的なもの（「テクノロジーの力で
--   人類の進歩を促進する」等、どの会社にも当てはまる文言）や、出典が
--   PR TIMES 等の二次情報のものは採用しない。
--   結果として31社すべてが「事業内容から作成」になった。
--
-- ⚠️ `mission` と `description` は触らない。
--    現行 tagline は事業説明であってミッションではないため、mission に
--    書き込むと DB 上「その企業のミッションはこれである」と断言することになり
--    事実に反する。また mission に値がある6社は取材で実際に聞けた会社であり、
--    そこに派生テキストを流し込むと取材由来と機械投入の区別がつかなくなる。
--
-- ⚠️ description は今回対象の31社すべてに 107〜151字（中央値129字）入っており、
--    tagline を短くしても事業説明は企業詳細ページに残る。
--
-- ⚠️ 旧値は各 UPDATE の直前にコメントで残してある。復元が必要なときはここから戻す。
--
-- ⚠️ フィードの company_joined 投稿は掲載時の文言で固定されており（部分UNIQUE
--    インデックスで作り直されない）、この UPDATE では変わらない。

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_missing text;
BEGIN
  -- 更新対象31社がすべて存在し、公開中であること
  SELECT string_agg(n, ', ') INTO v_missing
  FROM unnest(ARRAY[
    'ミラクル株式会社',
    'ゲインサイト・ジャパン株式会社',
    'Meta日本法人',
    'ザクトリー株式会社',
    'キリバ株式会社',
    'デル・テクノロジーズ株式会社',
    'コング・ジャパン株式会社',
    'アプティオ株式会社',
    'ノービフォー株式会社',
    'ページャーデューティー株式会社',
    'アンソロピックジャパン合同会社',
    'Notion Labs Japan合同会社',
    'ブレイズ株式会社',
    'クーパ・ソフトウェア株式会社',
    'アカマイ・テクノロジーズ合同会社',
    'ゼットスケーラー株式会社',
    'エラスティック株式会社',
    'ウォークミー株式会社',
    'アップルジャパン合同会社',
    'コンカー株式会社',
    '株式会社日本HP',
    'Twilio Japan合同会社',
    'クラウドフレア・ジャパン株式会社',
    'シスコシステムズ合同会社',
    'コンフルエント合同会社',
    'ウーバー・ジャパン株式会社',
    'マルケト株式会社',
    'レノボ・ジャパン合同会社',
    'アリスタネットワークス合同会社',
    'MongoDB Japan合同会社',
    'パランティア・テクノロジーズ'
  ]) AS n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ow_companies c WHERE c.name = n AND c.is_published = true
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '想定外: 対象企業が見つからないか非公開です: %', v_missing;
  END IF;
END $$;

-- ── 更新 ────────────────────────────────────────────────────────────────────

-- ミラクル株式会社
--   旧(48字): エンタープライズ向けオンラインマーケットプレイスプラットフォームで、新たな収益チャネルを構築する
--   新(21字): 企業のマーケットプレイス開設と拡大を支える
UPDATE public.ow_companies SET tagline = '企業のマーケットプレイス開設と拡大を支える', updated_at = now() WHERE id = '355ce5c6-0412-4512-8864-1d477c97c917';

-- ゲインサイト・ジャパン株式会社
--   旧(47字): Customer Success管理プラットフォームで、顧客の成功と自社の成長を同時に実現する
--   新(24字): カスタマーサクセスの実践を支えるプラットフォーム
UPDATE public.ow_companies SET tagline = 'カスタマーサクセスの実践を支えるプラットフォーム', updated_at = now() WHERE id = '4fecbf31-498c-40b0-a04e-3a6cb978433f';

-- Meta日本法人
--   旧(47字): Facebook・Instagram・WhatsAppで世界20億人以上のコミュニティをつなぐ
--   新(30字): Facebook・Instagram・WhatsAppを運営
UPDATE public.ow_companies SET tagline = 'Facebook・Instagram・WhatsAppを運営', updated_at = now() WHERE id = '0ece9af4-96cb-443c-b8a8-0f358c8e3a64';

-- ザクトリー株式会社
--   旧(45字): インテリジェントレベニューマネジメントで、営業インセンティブ・コミッション管理を自動化する
--   新(22字): 営業インセンティブの設計と支払いを自動化する
UPDATE public.ow_companies SET tagline = '営業インセンティブの設計と支払いを自動化する', updated_at = now() WHERE id = '1241f8a5-b645-4aa2-9fa1-bbfc573f1774';

-- キリバ株式会社
--   旧(43字): 財務・流動性マネジメントクラウドで、CFOのデジタルトランスフォーメーションを実現する
--   新(21字): 企業の資金と流動性を可視化し、最適に動かす
UPDATE public.ow_companies SET tagline = '企業の資金と流動性を可視化し、最適に動かす', updated_at = now() WHERE id = 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df';

-- デル・テクノロジーズ株式会社
--   旧(41字): ITインフラ・クラウドソリューションで、デジタルトランスフォーメーションを推進する
--   新(20字): ITインフラとクラウド基盤を企業に届ける
UPDATE public.ow_companies SET tagline = 'ITインフラとクラウド基盤を企業に届ける', updated_at = now() WHERE id = 'f4acddc0-c746-4537-9edf-6f3c1f2c90b3';

-- コング・ジャパン株式会社
--   旧(40字): APIゲートウェイ・サービスメッシュで、APIエコノミーを支えるプラットフォーム
--   新(20字): APIの接続と管理を担う基盤ソフトウェア
UPDATE public.ow_companies SET tagline = 'APIの接続と管理を担う基盤ソフトウェア', updated_at = now() WHERE id = 'e459ac79-5dad-499d-bb65-b758d4281123';

-- アプティオ株式会社
--   旧(40字): TBM（テクノロジービジネスマネジメント）でITコストの透明性と最適化を実現する
--   新(23字): IT投資のコストを可視化し、経営判断につなげる
UPDATE public.ow_companies SET tagline = 'IT投資のコストを可視化し、経営判断につなげる', updated_at = now() WHERE id = '08e4aff6-a12c-4963-ad43-960ac9e39967';

-- ノービフォー株式会社
--   旧(40字): セキュリティ意識向上トレーニングプラットフォームで、人的サイバーリスクを低減する
--   新(21字): 従業員向けの訓練で、フィッシング被害を防ぐ
UPDATE public.ow_companies SET tagline = '従業員向けの訓練で、フィッシング被害を防ぐ', updated_at = now() WHERE id = '99132c64-ff07-4945-aeb6-7e21e6c256c9';

-- ページャーデューティー株式会社
--   旧(40字): インシデント管理とAIOpsプラットフォームで、デジタルオペレーションを変革する
--   新(22字): システム障害の検知から復旧までを一元管理する
UPDATE public.ow_companies SET tagline = 'システム障害の検知から復旧までを一元管理する', updated_at = now() WHERE id = '7baafcb1-d929-46c1-97be-b0fb580b480b';

-- アンソロピックジャパン合同会社
--   旧(39字): AI安全研究と次世代AIアシスタントClaudeで、安全なAIの未来を切り拓く
--   新(25字): 安全性を軸にAIアシスタントClaudeを開発する
UPDATE public.ow_companies SET tagline = '安全性を軸にAIアシスタントClaudeを開発する', updated_at = now() WHERE id = 'f32e6905-f25f-4c01-b64f-c5695fd45a1d';

-- Notion Labs Japan合同会社
--   旧(38字): メモ・ドキュメント・プロジェクト管理を一元化するオールインワンワークスペース
--   新(20字): メモ・文書・タスクを1つの場所にまとめる
UPDATE public.ow_companies SET tagline = 'メモ・文書・タスクを1つの場所にまとめる', updated_at = now() WHERE id = 'bf24736f-fa65-4c5a-9764-98c96ace3b07';

-- ブレイズ株式会社
--   旧(38字): 顧客ライフサイクル全体をカバーするカスタマーエンゲージメントプラットフォーム
--   新(25字): アプリやメールで顧客へのメッセージ配信を自動化する
UPDATE public.ow_companies SET tagline = 'アプリやメールで顧客へのメッセージ配信を自動化する', updated_at = now() WHERE id = '478a9ede-ea0f-48c1-859c-d47f84d35b6b';

-- クーパ・ソフトウェア株式会社
--   旧(38字): AIネイティブの支出管理プラットフォームで、ビジネス支出を可視化・最適化する
--   新(15字): 企業の購買と支出を一元管理する
UPDATE public.ow_companies SET tagline = '企業の購買と支出を一元管理する', updated_at = now() WHERE id = '1027a327-18c0-4191-b27b-a28bf5781126';

-- アカマイ・テクノロジーズ合同会社
--   旧(38字): エッジクラウドとセキュリティサービスで、デジタルエクスペリエンスを最適化する
--   新(22字): Webサイトや動画を高速に届け、攻撃から守る
UPDATE public.ow_companies SET tagline = 'Webサイトや動画を高速に届け、攻撃から守る', updated_at = now() WHERE id = '6396920c-70d3-47d2-9f4e-67bc2efe262f';

-- ゼットスケーラー株式会社
--   旧(38字): クラウドネイティブのゼロトラストセキュリティで、安全なデジタル変革を支援する
--   新(23字): 社内システムへの接続を、VPNなしで安全にする
UPDATE public.ow_companies SET tagline = '社内システムへの接続を、VPNなしで安全にする', updated_at = now() WHERE id = 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec';

-- エラスティック株式会社
--   旧(38字): Elasticsearch基盤の検索・可観測性・セキュリティプラットフォーム
--   新(23字): 大量データを高速に検索し、分析できるようにする
UPDATE public.ow_companies SET tagline = '大量データを高速に検索し、分析できるようにする', updated_at = now() WHERE id = '1e541353-c177-40a9-968a-af3af14e1194';

-- ウォークミー株式会社
--   旧(37字): デジタル・アダプション・プラットフォームで、ソフトウェア活用率を最大化する
--   新(21字): 画面上の案内で、社内システムの定着を支える
UPDATE public.ow_companies SET tagline = '画面上の案内で、社内システムの定着を支える', updated_at = now() WHERE id = 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c';

-- アップルジャパン合同会社
--   旧(37字): テクノロジーと人文知の交差点で、人類の可能性を広げるプロダクトを作り続ける
--   新(22字): iPhone・Macと関連サービスを開発する
UPDATE public.ow_companies SET tagline = 'iPhone・Macと関連サービスを開発する', updated_at = now() WHERE id = 'dcd2c652-4335-4031-b4d2-a4f22c98182b';

-- コンカー株式会社
--   旧(36字): 出張・経費管理のクラウドプラットフォームで、バックオフィス業務を変革する
--   新(19字): 出張と経費の精算をクラウドで自動化する
UPDATE public.ow_companies SET tagline = '出張と経費の精算をクラウドで自動化する', updated_at = now() WHERE id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e';

-- 株式会社日本HP
--   旧(36字): PCとプリンティングのグローバルリーダーとして、イノベーションを提供する
--   新(20字): 法人・個人向けにPCとプリンターを届ける
UPDATE public.ow_companies SET tagline = '法人・個人向けにPCとプリンターを届ける', updated_at = now() WHERE id = 'c32027b9-cfbd-4a70-bf4c-464e42790db4';

-- Twilio Japan合同会社
--   旧(36字): CPaaSでカスタマーエンゲージメントとコミュニケーション体験を強化する
--   新(23字): SMSや音声通話をアプリに組み込めるようにする
UPDATE public.ow_companies SET tagline = 'SMSや音声通話をアプリに組み込めるようにする', updated_at = now() WHERE id = '88defb4b-b18c-437b-8b7d-d41a43232af4';

-- クラウドフレア・ジャパン株式会社
--   旧(36字): ゼロトラストとエッジネットワークで、インターネットをより安全・高速にする
--   新(18字): Webサイトを高速化し、攻撃から守る
UPDATE public.ow_companies SET tagline = 'Webサイトを高速化し、攻撃から守る', updated_at = now() WHERE id = '0a216ebb-c1fa-4d19-b066-f45e45c3ba2e';

-- シスコシステムズ合同会社
--   旧(36字): ネットワーク・セキュリティ・コラボレーションで、デジタルインフラを支える
--   新(21字): 企業のネットワーク機器と通信基盤を手がける
UPDATE public.ow_companies SET tagline = '企業のネットワーク機器と通信基盤を手がける', updated_at = now() WHERE id = '27988ac1-fd93-445d-a9fd-6dad74c92686';

-- コンフルエント合同会社
--   旧(36字): データストリーミングプラットフォームで、リアルタイムデータ活用を実現する
--   新(29字): Kafkaを基盤に、システム間のデータをリアルタイムに流す
UPDATE public.ow_companies SET tagline = 'Kafkaを基盤に、システム間のデータをリアルタイムに流す', updated_at = now() WHERE id = '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4';

-- ウーバー・ジャパン株式会社
--   旧(36字): モビリティと配達サービスのプラットフォームで、日常の移動と物流を変革する
--   新(16字): 配車と料理配達のアプリを運営する
UPDATE public.ow_companies SET tagline = '配車と料理配達のアプリを運営する', updated_at = now() WHERE id = '943620b5-0fa2-48b4-a072-d47f900ba9f0';

-- マルケト株式会社
--   旧(36字): マーケティングオートメーションで、潜在顧客の獲得から成約までを自動化する
--   新(18字): 見込み客の育成と商談化を自動で進める
UPDATE public.ow_companies SET tagline = '見込み客の育成と商談化を自動で進める', updated_at = now() WHERE id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5';

-- レノボ・ジャパン合同会社
--   旧(35字): PCからデータセンターまで、インテリジェントトランスフォーメーションへ
--   新(21字): PCとサーバーを開発し、企業と個人に届ける
UPDATE public.ow_companies SET tagline = 'PCとサーバーを開発し、企業と個人に届ける', updated_at = now() WHERE id = 'f201ed17-a9e2-4859-85aa-474578b2870d';

-- アリスタネットワークス合同会社
--   旧(35字): クラウド規模のネットワーキングで、データセンターとキャンパスを変革する
--   新(23字): データセンター向けのネットワーク機器を開発する
UPDATE public.ow_companies SET tagline = 'データセンター向けのネットワーク機器を開発する', updated_at = now() WHERE id = '3efd857e-315c-4650-9727-1e5aa1245753';

-- MongoDB Japan合同会社
--   旧(35字): デベロッパーに選ばれるデータプラットフォームで、アプリ開発を加速させる
--   新(22字): アプリ開発者向けのドキュメント型データベース
UPDATE public.ow_companies SET tagline = 'アプリ開発者向けのドキュメント型データベース', updated_at = now() WHERE id = '565b0f13-252d-44d0-8b90-e00acacf4b75';

-- パランティア・テクノロジーズ
--   旧(35字): エンタープライズAIプラットフォームで、データ分析と意思決定を変革する
--   新(25字): 散在するデータを統合し、意思決定に使えるようにする
UPDATE public.ow_companies SET tagline = '散在するデータを統合し、意思決定に使えるようにする', updated_at = now() WHERE id = 'be74d989-db8f-4be1-882c-40cf94e07fe2';


-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_long bigint;
  v_over25 bigint;
BEGIN
  /* 35文字以上の tagline が1件も残っていないこと。
     ⚠️ 35文字以上だったのは今回更新した31社だけなので、
        全公開企業を対象に数えれば取りこぼしを検出できる。 */
  SELECT count(*) INTO v_long
  FROM public.ow_companies
  WHERE is_published = true
    AND char_length(btrim(tagline, '「」')) >= 35;

  IF v_long > 0 THEN
    RAISE EXCEPTION '事後チェック失敗: 35文字以上の tagline が % 件残っている', v_long;
  END IF;

  -- 今回更新した31社のうち25文字を超えるものは Meta(30) とコンフルエント(27) の2件のみ
  SELECT count(*) INTO v_over25
  FROM public.ow_companies
  WHERE is_published = true AND char_length(btrim(tagline, '「」')) > 25;
  RAISE NOTICE '25文字超の公開企業: % 件（26〜34文字の30社が未対応のため残る）', v_over25;
END $$;

COMMIT;
