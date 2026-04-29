-- migration 046: ow_articles full schema + seed (10 articles from mockArticleData.ts)
-- Note: migration 017 had a simplified schema that was never applied to remote DB.
-- This migration creates the full production schema from scratch.

CREATE TABLE IF NOT EXISTS ow_articles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                   TEXT NOT NULL CHECK (type IN ('employee','mentor','ceo','report')),
  slug                   TEXT UNIQUE NOT NULL,
  title                  TEXT NOT NULL,
  subtitle               TEXT,
  eyecatch_gradient      TEXT,
  read_min               INTEGER DEFAULT 5,
  -- Company context (FK optional; text fields carry display data for seed)
  company_id             UUID REFERENCES ow_companies(id) ON DELETE SET NULL,
  company_slug           TEXT,          -- slug used in /companies/[slug] URL
  company_name_text      TEXT,
  company_initial_text   TEXT,
  company_gradient_text  TEXT,
  -- Subject snapshot: single person (employee / mentor / ceo)
  subject_freeze         JSONB,
  -- Subjects snapshot: multiple persons (report type)
  subjects_freeze        JSONB,
  -- Content
  editor_note            TEXT,
  body_blocks            JSONB,          -- string[]
  quote                  TEXT,
  qa_blocks              JSONB,          -- {q: string, a: string[]}[]
  themes_blocks          JSONB,          -- {icon,title,desc}[]  — mentor only
  chapters               JSONB,          -- {num,title,body[],list?[]}[]  — report only
  editor_outro           TEXT,
  -- Related content (slug-based for URL generation)
  related_job_ids        TEXT[]  DEFAULT ARRAY[]::TEXT[],
  related_article_slugs  TEXT[]  DEFAULT ARRAY[]::TEXT[],
  -- Publishing
  is_published           BOOLEAN DEFAULT false,
  published_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ow_articles ENABLE ROW LEVEL SECURITY;

-- Allow all reads (dev: all rows, prod: app-level is_published filter)
CREATE POLICY ow_articles_public_read ON ow_articles
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_ow_articles_slug      ON ow_articles (slug);
CREATE INDEX IF NOT EXISTS idx_ow_articles_type      ON ow_articles (type);
CREATE INDEX IF NOT EXISTS idx_ow_articles_published ON ow_articles (published_at DESC) WHERE is_published = true;

-- ─── Seed data: 10 articles ────────────────────────────────────────────────────

-- 1. mentor: layerx-nakamura-why-mentor
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subject_freeze, editor_note, body_blocks, quote, qa_blocks, themes_blocks, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'mentor',
  'layerx-nakamura-why-mentor',
  'なぜOpinioメンターになったか？「話すことで自分の視点も整理される」',
  'LayerXのPdMとして新機能ローンチを主導しながら、週に数回キャリア相談に応じる中村雪さん。メンター活動を始めた理由と、相談者との対話から得た気づきを聞いた。',
  'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
  7,
  'layerx', 'LayerX', 'L', 'linear-gradient(135deg, #002366 0%, #3B5FD9 100%)',
  '{"initial":"中","gradient":"linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)","name":"中村 雪","role_at_interview":"PdM / LayerX バクラク事業部","current_status":"LayerX PdM（在籍中）","is_mentor":true,"mentor_id":"nakamura-yuki"}',
  'メンターをやっている理由が、実は自分のためでもあるという言葉が印象的だった。相談者の問いに答えながら、自分のキャリア観が鍛えられていくと中村さんは言う。',
  '["メンター活動を始めたきっかけは、偶然だった。LayerXの同僚がOpinioを使って転職相談をしていると聞き、自分も逆の立場で役に立てるかもしれないと思ったのが最初だ。","登録当初は週1件程度の想定だったが、蓋を開けてみると月10件を超えることもある。PdMのキャリアってどう積み上げればいい？SaaSの営業からPdMに転向できる？という問いが多く、自分も同じ悩みを抱えていたことを思い出す。","相談者の質問に答えようとすると、自分の経験を言語化せざるを得ない。それが自分のキャリアを棚卸しする機会になっているという中村さん。メンター活動は与えるだけでなく、得るものも多いと実感している。"]',
  '「話すことで、自分の視点も整理される。メンタリングは一方通行じゃない。」',
  '[{"q":"メンター登録を決意したきっかけを教えてください。","a":["転職活動中に、何度かOB訪問をした経験があります。あの時間が自分のキャリア観を根本から変えてくれた。その体験をOpinioを通じて返せると思ったのが一番の動機です。","あと、PdMという職種はまだロールモデルが少ない。自分が少し先を歩いている人間として、後ろから来る人に道標を示せるなら、それは意義があると思いました。"]},{"q":"どんな相談が多いですか？","a":["一番多いのはPdMになるにはどうしたら良いかという転職相談です。次に多いのが、既にPdMだけど成長が止まった感がある、という悩み。","PdMの仕事がわかる人に話を聞けたという声が多くて、それが一番の励みになっています。"]},{"q":"LayerXのPdMの仕事について、外から見えにくい部分を教えてください。","a":["バクラクは経費精算という、ともすれば地味に見えるドメインをプロダクトで変革しようとしています。ユーザーの業務フローを深く理解して、10秒の操作を3秒にする設計に本気で向き合う仕事です。","地味に見えるから競合が少ない、という逆説もある。ここで本物のPdM力が身につくと実感しています。"]},{"q":"メンタリングで印象に残った相談はありますか？","a":["SaaSベンダーの営業として5年のキャリアを積んだ方が、PdMに転向したい、でも技術がないと相談に来てくれた時のことが忘れられません。","正直に技術は後から学べる、でも顧客の課題を商談で引き出す能力は5年積んだあなたの方がずっと強いと伝えました。その方が半年後にPdMとして転職が決まったと連絡をくれた時は、本当に嬉しかったです。"]},{"q":"これからメンター活動をどう続けていきたいですか？","a":["定量的な目標はあまり考えていません。ただ、相談が来た時に「この人に会えてよかった」と思ってもらえる時間を作ることだけを考えています。","いつか自分がメンタリングで助けた人が、今度は誰かのメンターになる連鎖が生まれたら最高だと思っています。"]}]',
  '[{"icon":"📋","title":"PdMキャリアの作り方","desc":"非エンジニア出身でもPdMになれるか、0→1とグロースどちらが向いているかなど"},{"icon":"🔄","title":"ビジネス職からPdM転向","desc":"営業・CS・マーケからPdMへのキャリアチェンジの現実と準備すべきこと"},{"icon":"🏢","title":"LayerX・SaaS業界の実態","desc":"バクラクの仕事の面白さ、BtoB SaaSのPdMとして成長できる環境"},{"icon":"🎯","title":"転職活動の戦略","desc":"PdMのJD読み方、面接での経験の伝え方、給与交渉のコツ"}]',
  '30分という限られた時間で、相談者の人生の選択肢を一つ広げる仕事。中村さんの言葉には、その仕事への静かな誇りが宿っていた。',
  ARRAY['layerx-pdm-bakuraku','layerx-eng-backend'],
  ARRAY['layerx-suzuki-backend-career','smarthr-hayashi-csm-career','hubspot-product-org-report'],
  true, '2025-11-18T00:00:00Z'
);

-- 2. employee: layerx-suzuki-backend-career
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subject_freeze, editor_note, body_blocks, quote, qa_blocks, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'employee',
  'layerx-suzuki-backend-career',
  '「最高の同僚」と働く喜びがある。LayerXバックエンドエンジニアの仕事論',
  '大手SIerからスタートアップへ。鈴木拓海さんがLayerXを選んだ理由と、バクラクのバックエンド開発で日々向き合うプロダクトの複雑さについて聞いた。',
  'linear-gradient(135deg, #002366 0%, #1E40AF 100%)',
  8,
  'layerx', 'LayerX', 'L', 'linear-gradient(135deg, #002366 0%, #3B5FD9 100%)',
  '{"initial":"鈴","gradient":"linear-gradient(135deg, #002366 0%, #002366 100%)","name":"鈴木 拓海","role_at_interview":"バックエンドエンジニア / LayerX バクラク事業部","current_status":"LayerX シニアエンジニア（在籍中）","is_mentor":true,"mentor_id":"suzuki-takumi"}',
  'SIerにいた頃より、はるかに速く成長できていると鈴木さんは言う。その言葉の背景にある、LayerXの開発文化への敬意が全編に滲んでいた。',
  '["SIerで3年間、大手企業の基幹システム構築に携わった鈴木拓海さん。安定したキャリアを歩んでいたはずが、ある日気づいたのは自分のコードがユーザーに届くまでのリードタイムが長すぎるという焦りだった。","転職先を探す中でLayerXに出会った。決め手は採用面接で話した同僚候補のレベルが、明らかに自分より高かったこと。危機感と同時に、ここで働けば加速的に成長できるという確信があった。","入社後の最初の仕事は、バクラクの請求書処理エンジンのリアーキテクチャ。大量の非同期処理と複雑なビジネスロジックを整理する仕事で、SIer時代には経験したことのないスケールと速さで意思決定が求められた。"]',
  '「コードレビューで自分のコードを丁寧に崩してもらった日に、自分は本当に成長した。」',
  '[{"q":"SIerからLayerXへの転職、何が決め手でしたか？","a":["正直に言うと、このままでは自分のエンジニアとしての市場価値が下がっていくという危機感が一番の動機でした。SIerの仕事は悪くなかった。でも、自分で技術選定をする機会がほとんどなかった。","LayerXの採用面接で、技術的な議論をした時にこの人たちと一緒に仕事したいと思いました。面接というより、技術トークでした。そのカルチャーが本物だと確認できたので、オファーをすぐに受けました。"]},{"q":"バクラクのバックエンド開発で特に難しい点は何ですか？","a":["一番難しいのはドメイン知識の深さです。経費精算、請求書処理、法人カード。それぞれに日本の会計基準や税法が絡んでいて、エンジニアも一定の会計知識が必要です。","次に難しいのが、エンタープライズ顧客対応の難易度です。1万人規模の企業が使うシステムで、パフォーマンスの要件が桁違いに厳しい。でもその分、解いた時の達成感も桁違いです。"]},{"q":"GoとKubernetesを採用している技術スタックについて教えてください。","a":["Goを選んでいる理由は、型安全性と並行処理の扱いやすさです。経費精算のように非同期で大量のバッチ処理が走るシステムには、Goの軽量goroutineが適しています。","KubernetesはマイクロサービスのデプロイインフラとしてLayerX全体で使っています。一つのサービスのリリースが他のサービスに影響しない設計が、チームの開発速度を上げる上で重要です。"]},{"q":"チームの雰囲気や働き方について教えてください。","a":["心理的安全性という言葉を使いすぎると陳腐に聞こえますが、ここは本当にそれが高い。こんな初歩的な質問をしたら恥ずかしいという感覚を持ったことがないです。","リモートワーク中心ですが、週一のバーチャルランチや、Slackでのカジュアルな技術議論が活発です。テキストコミュニケーションのクオリティが高い人が多いので、非同期でも密度の濃い仕事ができます。"]},{"q":"これからLayerXでどんなキャリアを歩みたいですか？","a":["短期的にはバクラクのコアエンジンのさらなる拡張に貢献したいです。処理速度の改善と、エンタープライズ顧客が求める柔軟なカスタマイズ性の両立を技術的に解きたい。","中長期的には、エンジニアリングマネージャーになる道も視野に入っています。コードを書くのは大好きですが、若いエンジニアが自分と同じ速さで成長できる環境を作ることにも興味があります。"]}]',
  '最高の同僚と働く喜びという言葉を、鈴木さんは一度も誇張なく使っていた。LayerXの採用哲学が現場にまで根付いている証拠だと感じた。',
  ARRAY['layerx-eng-backend','layerx-pdm-bakuraku'],
  ARRAY['layerx-nakamura-why-mentor','hubspot-product-org-report','freee-platform-infra-report'],
  true, '2025-10-22T00:00:00Z'
);

-- 3. employee: smarthr-hayashi-csm-career
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subject_freeze, editor_note, body_blocks, quote, qa_blocks, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'employee',
  'smarthr-hayashi-csm-career',
  '「人事の人たちが救われた顔をする」SmartHRカスタマーサクセスが感じるやりがい',
  '法律事務所のパラリーガルからSmartHRのCSMへ。林奈緒美さんが語る、HRテック企業で顧客の人事変革に伴走する仕事の醍醐味。',
  'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
  7,
  'smarthr', 'SmartHR', 'S', 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
  '{"initial":"林","gradient":"linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)","name":"林 奈緒美","role_at_interview":"カスタマーサクセスマネージャー / SmartHR","current_status":"SmartHR CSMリード（在籍中）","is_mentor":true,"mentor_id":"hayashi-naomi"}',
  '顧客の担当者が泣きそうになってお礼を言ってくれたと、林さんはさらりと言った。CSMという仕事の重さが、その一言に凝縮されていた。',
  '["法律事務所で契約書のレビューと法的調査を担当していた林奈緒美さんが、SmartHRのカスタマーサクセスに転職したのは、人の感情に触れる仕事がしたかったからだ。","入社直後に担当したのは、従業員2000人規模の製造業。紙と印鑑で全ての人事手続きをこなしていた会社が、SmartHRを導入した最初の年に残業を月40時間削減できた。人事の方々が本当に救われた顔をした瞬間を今でも覚えていますと林さんは言う。","CSMの仕事は、ソフトウェアの使い方を教えるだけではない。顧客の人事戦略を一緒に描き、SmartHRのデータを使ってどう組織を変えられるかを提案する、コンサルティングに近い役割だ。"]',
  '「人事担当者が『これで楽になります』と言ってくれた瞬間が、この仕事を続ける理由です。」',
  '[{"q":"パラリーガルからCSMという、珍しいキャリアチェンジの経緯を教えてください。","a":["法律事務所の仕事は好きでしたが、自分が作った成果物が誰かの役に立っているという実感が薄かった。契約書のレビューは重要ですが、顧客の顔が見えない仕事でした。","SmartHRを選んだのは、法律と人事が交差する場所だからです。労働法の知識が活かせるし、顧客と長期的な関係を築ける。面接で法律の知識を持つCSMは珍しいし、価値があると言われた時に、これだと思いました。"]},{"q":"CSMとして担当する顧客は、どんな課題を持っていることが多いですか？","a":["一番多いのはExcelと手入力で人事管理をしていて限界が来ているという状況です。特に中堅企業は、DXに投資する予算はあるけれど、何から始めるかわからないケースが多い。","2つ目は、法改正対応の不安です。毎年新しい法律が施行される中、SmartHRがその対応機能を提供できるだけでなく、CSMが法律の意味を説明できることで、顧客の安心感が全然違います。"]},{"q":"成功体験として特に印象に残っているプロジェクトを教えてください。","a":["500名規模の物流会社を担当した時のことが忘れられません。本社・倉庫・ドライバーと3種類の雇用形態が混在していて、SmartHRの設定が複雑でした。","半年かけてフローを整理し、入社手続きにかかる時間を一人当たり3時間から20分に短縮できました。人事担当の方が林さんが来てくれなかったら諦めていたと言ってくれた時、CSMになって良かったと思いました。"]},{"q":"SmartHRの会社としての魅力はどんなところにありますか？","a":["プロダクトのロードマップに現場の声が反映されるスピードが速いことです。顧客からこういう機能が欲しいというフィードバックを上げると、プロダクトチームが真剣に検討してくれる。","あとは、バリューであるRespect Individualが本当に機能していると感じます。育休・産休の取得率が高いし、時短勤務中でも重要な案件を任せてもらえる。"]},{"q":"CSMとして成長するために、特に大切なスキルは何だと思いますか？","a":["顧客の言葉の裏にある感情を読む力だと思っています。ちょっと使いにくいという言葉の裏に、このシステムへの投資は失敗だったのではないかという不安が隠れていることがある。","もう一つは、プロダクトを深く知ること。SmartHRは機能が多い分、顧客の課題に合わせた最適な設定が複雑です。"]}]',
  '人事の人たちの働き方を変えるという仕事の重みを、林さんは軽やかに担っていた。SmartHRのCSMが単なるサポート担当ではない理由が、話を聞いてよくわかった。',
  ARRAY['smarthr-csm','smarthr-eng-fullstack'],
  ARRAY['smarthr-ceo-hr-tech-future','salesforce-murakami-cso-path','layerx-nakamura-why-mentor'],
  true, '2025-09-30T00:00:00Z'
);

-- 4. ceo: smarthr-ceo-hr-tech-future
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subject_freeze, editor_note, body_blocks, quote, qa_blocks, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'ceo',
  'smarthr-ceo-hr-tech-future',
  '「人事データが経営の中枢へ」SmartHR芹澤が語る、HRテックの次のフロンティア',
  'クラウド人事労務から始まり、タレントマネジメント、労務コンプライアンス管理へと拡張を続けるSmartHR。CEOが描く10年後のビジョンと、組織変革の真の意味を聞いた。',
  'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
  10,
  'smarthr', 'SmartHR', 'S', 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
  '{"initial":"芹","gradient":"linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)","name":"芹澤 雅人","role_at_interview":"代表取締役CEO / SmartHR","current_status":"SmartHR CEO（在籍中）","is_mentor":false}',
  '人事データが経営判断の中枢に入る日が来ると芹澤さんは確信を持って言った。その確信の根拠を一つひとつ解きほぐす1時間だった。',
  '["SmartHRが最初に解いた課題は、紙とハンコの人事手続きのデジタル化だった。入社手続きのオンライン完結、年末調整の電子申告。一見地味に見えるこれらの機能が、導入企業の人事部門の工数を劇的に減らした。","しかし、芹澤CEOが今描くビジョンはもっと大きい。手続きの効率化は手段であって目的ではない。本当の目的は、人事データを経営の意思決定に使えるようにすること。従業員のスキルマップ、評価データ、異動履歴。これらをリアルタイムで経営層が把握できれば、人的資本経営が空論ではなくなる。","2024年に施行された人的資本情報の開示義務化は、SmartHRにとって追い風だ。上場企業は従業員の育成・エンゲージメント・多様性に関するデータを投資家に開示しなければならない。SmartHRはその「データの源泉」として機能できる唯一のプラットフォームを目指している。"]',
  '「人事部が経営の中心に来る時代が、もうすぐそこに来ている。」',
  '[{"q":"SmartHRが現在注力している領域を教えてください。","a":["大きく三つあります。一つ目は基盤となる労務管理のさらなる深化。二つ目はタレントマネジメント領域への本格展開。三つ目は人的資本経営を支えるデータ分析機能の強化です。","特に今、力を入れているのはタレントマネジメントです。誰がどんなスキルを持っているか、誰が次のリーダー候補か。これを人の感覚ではなくデータで判断できるようにしたいです。"]},{"q":"競合他社との差別化ポイントはどこにありますか？","a":["データの完全性です。SmartHRは労務管理から始まったので、入社から退職までの全従業員データが一元管理されています。後から人事評価ツールとして入ってきた競合とは、データの深さと信頼性が違う。","もう一つは日本の法規制への対応速度。日本の労働法は毎年改正があります。それに追随するチームを社内に持っていることが、外資系競合にはない強みです。"]},{"q":"エンタープライズ向けの展開で、特に難しい課題は何ですか？","a":["IT部門の壁です。大企業では、業務部門が導入したくても、IT部門がセキュリティ審査と既存システムとのAPI連携を要求してくる。この両方に応える必要があります。","ただ、これは参入障壁でもある。エンタープライズの基幹システムに組み込まれたSaaSは、そう簡単に切り替えられない。一度信頼を得れば、長期的なパートナーシップが生まれます。"]},{"q":"採用について、SmartHRが求める人材像を教えてください。","a":["社会課題として人事を捉えられる人です。SmartHRの仕事は、突き詰めると日本の労働市場を良くすることだと思っています。給与水準の可視化、育休取得の公平化、スキルの流動性向上。これらを本気で信じて取り組める人と働きたい。"]},{"q":"5年後のSmartHRはどんな会社になっていると思いますか？","a":["人事データのインフラになっていると思います。給与計算ソフトがインフラであるように、日本企業の人事データ管理はSmartHRで当たり前になっている世界を目指しています。","そのためには今の3倍以上のプロダクトの厚みが必要です。だからこそ、プロダクトマネージャーとエンジニアの採用に今年は特に力を入れています。"]}]',
  'HRテックは地味な産業ではないと芹澤さんは言った。1億人の働き方のデータを持つプラットフォームが生み出す価値は、まだほとんど掘り起こされていない。',
  ARRAY['smarthr-eng-fullstack','smarthr-csm'],
  ARRAY['smarthr-hayashi-csm-career','layerx-nakamura-why-mentor','hubspot-product-org-report'],
  true, '2025-08-14T00:00:00Z'
);

-- 5. mentor: salesforce-murakami-cso-path
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subject_freeze, editor_note, body_blocks, quote, qa_blocks, themes_blocks, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'mentor',
  'salesforce-murakami-cso-path',
  '「CSからCSOへ」村上真理子が語る、キャリアの頂点を目指す女性に伝えたいこと',
  'SalesforceのCSO（最高セールス責任者）として500人規模の営業組織を率いる村上真理子さん。一般職からの出発、2度の育休、そして役員就任までの軌跡。',
  'linear-gradient(135deg, #DB2777 0%, #F472B6 100%)',
  9,
  'salesforce', 'Salesforce', 'SF', 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
  '{"initial":"村","gradient":"linear-gradient(135deg, #DB2777 0%, #F472B6 100%)","name":"村上 真理子","role_at_interview":"CSO（最高セールス責任者）/ Salesforce Japan","current_status":"Salesforce Japan CSO（在籍中）","is_mentor":true,"mentor_id":"murakami-mariko"}',
  'キャリアに正解はないけど、諦めた時点でゲームオーバーという言葉は、インタビュー中で最も強い言葉だった。村上さんはそれを経験から言っていた。',
  '["Salesforceに新卒で入社した当時、村上真理子さんにはいつかCxOになるという目標は一切なかった。ただ、目の前の顧客の課題を解決することだけを考えていた。","その姿勢が評価を生み、営業チームのリーダーに、そして部門長に、と昇進を重ねた。途中、2度の育休を取得した。育休中も学び続けた。でも、それは義務感ではなく、戻った時に戦えるようにしたかったからと言う。","今、村上さんがOpinioのメンターをしている理由は過去の自分と同じ場所で悩んでいる人たちに、もう少し遠くを見てほしいからだ。"]',
  '「ロールモデルが少ないことは、自分がロールモデルになるチャンスだと思うようにした。」',
  '[{"q":"営業職のキャリアで、CSOになるために最も重要だったスキルは何ですか？","a":["数字への執着と人を見る目の二つです。営業はKPIが明確なので、数字で証明するしかない。でも、組織のトップになるには、どんな人を採用・育成するかという判断がより重要になります。","私が一番時間をかけているのは、営業メンバーの1on1です。月に一度、30分ずつ全部長と話す。その会話から、組織の課題を早期に察知できる。"]},{"q":"2度の育休を経てキャリアを続けた秘訣を教えてください。","a":["Salesforceのカルチャーが良かった、というのは間違いないです。でも、もっと大事なのは自分のキャリアに対して誰よりも本気であるという態度を周囲に見せ続けることだと思っています。","育休から戻ったら、自分が抜けている間に変わったことを全部キャッチアップして、すぐに結果を出す。それを2回やることで、村上は戻ってもパフォーマンスが落ちないという実績を作れた。"]},{"q":"メンターとして相談に来る方に共通する悩みはありますか？","a":["これ以上上に行けるかどうかわからないという天井感を持っている方が多いです。特に、30代半ばで管理職になったけれど、そこから先のイメージが描けない方。","私が必ず聞くのは10年後の自分はどうなっていたいですか？です。案外、この質問に答えられない人が多い。"]},{"q":"女性がリーダーシップを発揮するために、特に意識してきたことは？","a":["女性だからという前置きなしに発言し続けることです。一方で、多様性に敏感であることはマネジメントの武器になります。チームに複数の視点が入ることで、盲点が減る。"]},{"q":"次のキャリアを考えている方へ、一言メッセージをお願いします。","a":["キャリアに正解はないけど、諦めた時点でゲームオーバーです。停滞しているように見える時も、実は準備期間であることが多い。","もし迷っているなら、一度だけ誰かに話してみてください。"]}]',
  '[{"icon":"📈","title":"女性リーダーのキャリア戦略","desc":"育休・産休後のカムバック、男性中心組織での存在感の出し方、CxOへの道"},{"icon":"💼","title":"営業組織のマネジメント","desc":"大規模営業チームの立ち上げ、KPI設計、営業メンバーの育成と評価"},{"icon":"🤝","title":"エンタープライズ営業の極意","desc":"C層への提案、複数ステークホルダーの調整、長期契約の維持・拡大"},{"icon":"🎯","title":"転職・ポジションアップの交渉","desc":"役員ポジションの探し方、オファー交渉、転職時の条件整理"}]',
  'CSOという肩書を持ちながら、村上さんは30分の相談に全力で向き合っていた。その姿勢こそが、キャリアの頂点まで上り詰めた秘訣なのかもしれない。',
  ARRAY['salesforce-ae-enterprise','hubspot-solutions-engineer'],
  ARRAY['smarthr-hayashi-csm-career','ubie-taniguchi-cto-journey','smarthr-ceo-hr-tech-future'],
  true, '2025-07-20T00:00:00Z'
);

-- 6. mentor: ubie-taniguchi-cto-journey
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subject_freeze, editor_note, body_blocks, quote, qa_blocks, themes_blocks, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'mentor',
  'ubie-taniguchi-cto-journey',
  '「医療をアルゴリズムで解く」UbieCTOが語る、エンジニアとして生きる意味',
  '医療AIスタートアップUbieのCTOとして組織を牽引する谷口勇介さん。純粋な技術好きから経営者になるまでの葛藤と、エンジニアが社会変革の主役になれる時代について。',
  'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
  8,
  'ubie', 'Ubie', 'U', 'linear-gradient(135deg, #059669 0%, #34D399 100%)',
  '{"initial":"谷","gradient":"linear-gradient(135deg, #D97706 0%, #F59E0B 100%)","name":"谷口 勇介","role_at_interview":"CTO / Ubie","current_status":"Ubie CTO（在籍中）","is_mentor":true,"mentor_id":"taniguchi-yusuke"}',
  '医療の非効率を直視できなかった。だからエンジニアとして解くことにした。谷口さんの言葉は、技術と使命感が交差するCTOの本質を示していた。',
  '["谷口勇介さんがUbieに入社した時、医療業界のシステムの遅れに驚いた。FAXで診療情報が送られ、紙カルテが倉庫に積まれ、患者が問診票を何度も手書きしている現実。これはソフトウェアエンジニアが解くべき課題だと確信した。","Ubieが開発するAI問診システムは、患者が症状を入力するだけで、医師が必要な情報を事前に把握できる仕組みだ。問診にかかる時間が短縮されるだけでなく、見落としが減り、診療の質が上がる。","CTOになった今、谷口さんが一番考えているのは医療データのセキュリティをどう担保しながら価値を引き出すかという問いだ。"]',
  '「医療というフィールドは、エンジニアにとって未踏の地だ。だからこそ、やりがいがある。」',
  '[{"q":"エンジニアがCTOになる過程で、最も大変だったことは何ですか？","a":["コードを書く時間が減ることへの葛藤です。CTOになると、採用・組織設計・技術戦略のコミュニケーションに時間を取られる。最初は喪失感がありました。","今は、コードを書く代わりに、コードを書く人を増やす仕事をしていると考え方を変えました。"]},{"q":"医療AIという領域で、エンジニアとして特に難しい点は何ですか？","a":["精度と説明可能性のトレードオフです。医療AIは精度が高くても、なぜその判断をしたかを医師に説明できなければ信頼されない。","もう一つは法規制との戦いです。医療機器としての承認を取るプロセスは、通常のソフトウェアリリースとは全く違う。"]},{"q":"スタートアップで技術力を高め続けるための組織設計を教えてください。","a":["技術的負債を返す時間を意図的に確保することです。Ubieでは、スプリントの20%をリファクタリングと技術投資に充てるルールを設けています。","もう一つは技術選定の民主化です。CTOが全部決めるのではなく、現場のエンジニアが提案して議論する文化を作っています。"]},{"q":"メンターとして、どんなエンジニアの相談に来てほしいですか？","a":["技術だけ磨いてきたが、次のキャリアをどう考えればいいかという方に特に来てほしいです。シニアエンジニアからEMになる道、もしくはICとして極めていく道。両方に価値があります。","医療・ヘルスケア分野に興味があるエンジニアも大歓迎です。"]},{"q":"10年後のエンジニアという職業は、どう変わると思いますか？","a":["AIとの協働が当たり前になっていると思います。コーディングの一部はAIが担う。でも、何を作るべきかを決め、ユーザーの感情を理解し、倫理的な判断をするのは人間でなければならない。","エンジニアの価値はコードを書く速さではなく何を解くべきかを判断する力に移行していく。"]}]',
  '[{"icon":"🚀","title":"シニアエンジニア→CTOへの道","desc":"テックリード・EMからCTOになるキャリアパス、必要な思考の変化"},{"icon":"🏥","title":"医療・ヘルスケアエンジニアリング","desc":"医療DXの課題、薬機法、医療AIの設計思想と精度vs説明可能性の問題"},{"icon":"🤖","title":"MLエンジニアのキャリア戦略","desc":"AIエンジニアとしての市場価値の高め方、研究と事業の間のキャリア設計"},{"icon":"🏗️","title":"スタートアップの技術組織設計","desc":"採用・評価・技術選定の民主化、技術的負債のマネジメント"}]',
  '医療を技術で解くという言葉の重みを、谷口さんは一言も大げさに語らなかった。その静けさが、使命感の深さを証明していた。',
  ARRAY['ubie-backend-engineer','pksha-ml-engineer'],
  ARRAY['layerx-suzuki-backend-career','freee-platform-infra-report','pksha-ml-culture-ceo'],
  true, '2025-06-15T00:00:00Z'
);

-- 7. report: hubspot-product-org-report
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subjects_freeze, editor_note, chapters, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'report',
  'hubspot-product-org-report',
  'HubSpotのプロダクト組織はなぜ動きが速いのか？2名のPdMが回す爆速体制を解剖',
  '日本市場向けのプロダクトローカライズを最速で届けるHubSpot Japan。PdMの林誠一郎さんと田村京さんに、2人でどう優先順位をつけ、グローバル本社を動かすかを聞いた。',
  'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
  12,
  'hubspot', 'HubSpot', 'H', 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
  '[{"initial":"林","gradient":"linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)","name":"林 誠一郎","role_at_interview":"シニアPdM / HubSpot Japan","current_status":"HubSpot Japan シニアPdM（在籍中）","is_mentor":true,"mentor_id":"hayashi-seiichiro"},{"initial":"田","gradient":"linear-gradient(135deg, #D97706 0%, #F59E0B 100%)","name":"田村 京","role_at_interview":"PdM / HubSpot Japan → プロダクトロード","current_status":"プロダクトロード PdM（転職済み）","is_mentor":true,"mentor_id":"tamura-kyo"}]',
  '2人の掛け合いが面白い。林さんはグローバルとの交渉に強く、田村さんは日本ユーザーのインサイト発掘が得意。この補完関係が、小さなチームで大きなアウトプットを生んでいた。',
  '[{"num":"01","title":"2名のPdMで日本市場全体を担う、その優先順位のつけ方","body":["HubSpot Japanのプロダクトチームは当時、林さんと田村さんの2名体制だった。グローバルで数百本あるプロダクトのロードマップの中から、日本市場向けに優先すべき機能を選び出し、本社のプロダクトチームを説得する仕事だ。","毎クォーター、日本のユーザーインタビューを50件以上こなしました。CRM初心者が躓くポイントと、上級ユーザーが欲しがる機能は全然違う。その両方を理解した上で、どちらを優先するかの議論を本社としていましたと林さん。"],"list":[{"key":"Weekly","value":"グローバルPdMとのSync（Slack + Zoom）"},{"key":"Monthly","value":"日本ユーザーインタビュー（10〜15件）"},{"key":"Quarterly","value":"Japan Market Review（本社経営陣へのプレゼン）"}]},{"num":"02","title":"グローバル本社を動かす「データと物語」の技術","body":["HubSpotの本社はマサチューセッツ州ケンブリッジ。日本語でロードマップの変更を主張しても伝わらない。データと、そのデータが示すユーザーの感情的なストーリーを英語でプレゼンすることが必須でしたと田村さん。","印象的なエピソードがある。日本のSMB企業がCRMの初期設定で離脱する問題を、60件のインタビューデータと録音を組み合わせたプレゼンで本社に伝えた。3ヶ月後にオンボーディングフローが大幅に改善された。","本社のPdMは日本のユーザーの声を直接聞けない。だから私たちが橋渡しになる。そこに私たちの存在価値があると田村さんは言う。"]},{"num":"03","title":"小さなチームで大きなインパクトを出すための個人の技術","body":["2名体制で日本市場全体を担うためには、圧倒的な個人の生産性が求められる。林さんが実践しているのは非同期ドキュメントの完全化だ。Notionに全ての意思決定と背景を書き、本社のPdMが時差なく判断できる状態を常に保つ。","田村さんはユーザーインサイトの構造化に注力した。顧客インタビューの音声をAI文字起こしツールで処理し、発言を課題タイプ別に分類するデータベースを自作した。"],"list":[{"key":"課題①","value":"時差12時間でのグローバル本社との協調作業"},{"key":"課題②","value":"日本語・英語双方でのドキュメンテーション"},{"key":"課題③","value":"2名で数百万ユーザーのニーズを代弁する責任"}]}]',
  '2人で回せる限界まで自分たちを拡張したという言葉が、このレポートのタイトルの意味を体現していた。グローバルPdMという職種の可能性と難しさを同時に教えてもらった。',
  ARRAY['hubspot-solutions-engineer','layerx-pdm-bakuraku'],
  ARRAY['layerx-nakamura-why-mentor','salesforce-murakami-cso-path','smarthr-ceo-hr-tech-future'],
  true, '2025-11-05T00:00:00Z'
);

-- 8. report: freee-platform-infra-report
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subjects_freeze, editor_note, chapters, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'report',
  'freee-platform-infra-report',
  'freeeのプラットフォームエンジニアが語る「会計SaaS基盤を1000万社に届ける」技術とチーム',
  '中小企業向け会計・人事労務SaaSを展開するfreeeのインフラ・プラットフォームチーム。野中浩平さんと小林奈々さんが、スケーラビリティと開発者体験の両立に挑む裏側を語った。',
  'linear-gradient(135deg, #059669 0%, #34D399 100%)',
  11,
  'freee', 'freee', 'F', 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
  '[{"initial":"野","gradient":"linear-gradient(135deg, #002366 0%, #002366 100%)","name":"野中 浩平","role_at_interview":"インフラエンジニア / freee プラットフォームチーム","current_status":"freee インフラエンジニア（在籍中）","is_mentor":true,"mentor_id":"nonaka-kohei"},{"initial":"小","gradient":"linear-gradient(135deg, #0D9488 0%, #2DD4BF 100%)","name":"小林 奈々","role_at_interview":"カスタマーサクセスマネージャー / freee","current_status":"freee CSMリード（在籍中）","is_mentor":true,"mentor_id":"kobayashi-nana"}]',
  'インフラの野中さんとCSの小林さんという組み合わせは、意図的だった。プロダクトの内側と外側から見たfreeeの強みは、互いに補完関係にあった。',
  '[{"num":"01","title":"100万社超の中小企業データを支えるインフラの設計思想","body":["freeeが会計SaaSとして成長してきた裏側には、膨大な取引データと確定申告データを安全・高速に処理するインフラがある。野中さんのチームはKubernetes上で動くマイクロサービスアーキテクチャの運用と改善を担う。","中小企業の会計データは、3月確定申告シーズンにアクセスが集中します。それ以外の時期の10倍以上のトラフィックが来ることがある。その負荷変動に自動でスケールできるシステムを作ることが最初の大仕事でしたと野中さん。"],"list":[{"key":"稼働率","value":"99.99% SLA（会計閑散期・繁忙期問わず）"},{"key":"データ量","value":"累計取引仕訳レコード数 50億件超（2025年時点）"},{"key":"スケール","value":"確定申告シーズンに平常時比10倍のリクエスト処理"}]},{"num":"02","title":"CSがプロダクト改善に「直接接続」する仕組み","body":["freeeのCSチームは、顧客からのフィードバックを単にサポートチケットとして処理するのではなく、プロダクトの改善に直接つなぐ仕組みを持っている。","顧客が消費税の計算が合わないと言ってくる時、実際には仕訳の設定が間違っているケースが8割です。でも残り2割は本当にプロダクトのバグやUXの問題。このトリアージをCSが担うことで、開発チームの無駄な調査工数を減らしていますと小林さん。"]},{"num":"03","title":"freeeで働くことの意味：「中小企業の経営者の時間を取り戻す」","body":["野中さんと小林さんに共通しているのは、freeeは中小企業のインフラだという感覚だ。会計ソフトが落ちれば、確定申告の作業が止まる。その責任感がモチベーションになっている。"],"list":[{"key":"課題意識","value":"中小企業の年間経理コストは平均120万円（人件費換算）"},{"key":"freeeの解","value":"会計・給与・人事をワンプラットフォームで完結させる"},{"key":"達成目標","value":"2030年までにユーザー数1000万社突破"}]}]',
  '技術と顧客の間にある壁を、freeeはCSとエンジニアの協働で溶かしていた。その構造こそが、競合との差別化の源泉なのだと思う。',
  ARRAY['freee-csm','freee-engineer-platform'],
  ARRAY['layerx-suzuki-backend-career','smarthr-hayashi-csm-career','ubie-taniguchi-cto-journey'],
  true, '2025-10-08T00:00:00Z'
);

-- 9. ceo: pksha-ml-culture-ceo
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subject_freeze, editor_note, body_blocks, quote, qa_blocks, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'ceo',
  'pksha-ml-culture-ceo',
  '「AIは道具ではなく、共同作業者だ」PKSHAが目指す人間とAIの新しい協調モデル',
  '自然言語処理・深層学習を軸にエンタープライズAIを提供するPKSHA Technology。共同創業者がAI研究と事業の間で培ってきた哲学と、MLエンジニアに求める思考法を語った。',
  'linear-gradient(135deg, #4338CA 0%, #818CF8 100%)',
  9,
  'pksha', 'PKSHA Technology', 'P', 'linear-gradient(135deg, #E11D48 0%, #F43F5E 100%)',
  '{"initial":"上","gradient":"linear-gradient(135deg, #4338CA 0%, #818CF8 100%)","name":"上野山 勝也","role_at_interview":"代表取締役 / PKSHA Technology","current_status":"PKSHA Technology CEO（在籍中）","is_mentor":false}',
  'AIの倫理を語る前に、AIの仕組みを理解すべきだという言葉に、研究者出身の経営者ならではの鋭さがあった。',
  '["PKSHAが創業した2012年は、深層学習ブームの前夜だった。当時から自然言語処理に注目していた上野山氏にとって、今のAIブームはようやく社会が追いついてきたという感覚だという。","私たちが一番大切にしてきたのは、AIが何を学び、何を判断の根拠にしているかを説明できること。ブラックボックスのAIをエンタープライズ企業に入れることへの抵抗が、創業当初から強くありました。XAIという概念が世に広まる前から、PKSHAはその哲学を持っていた。","今、PKSHAがフォーカスしているのはAIエージェントと呼ばれる領域だ。単一のタスクをこなすAIではなく、複数のAIが協調して複雑な業務プロセスを自律的に処理する。"]',
  '「AIを作る仕事の本質は、人間の知性を敬うことだと思っている。」',
  '[{"q":"PKSHA Technologyのビジネスモデルを教えてください。","a":["大きく二つです。一つは、エンタープライズ向けのAIソフトウェアの提供。自然言語処理を使ったチャットボット、ドキュメント処理の自動化、予測分析などをパッケージとして提供しています。","もう一つは、共同研究・受託開発です。金融機関や製造業の大企業と組んで、業界固有の課題を解くAIを共同で開発します。"]},{"q":"研究者と事業家の二つの側面を持つ経営者として、どうバランスを取っていますか？","a":["正直に言うと、バランスは取れていません。常に事業優先です。でも、研究者としての感覚を完全に捨てることもしていない。新しい技術論文を読むことを、週に必ず時間を確保しています。","研究者の目があると、この技術トレンドが3年後に事業になるという感覚を持ちやすい。ChatGPTの登場も、Transformerが発表された時点でここまで来ると予想していました。"]},{"q":"MLエンジニアとして、PKSHAで活躍できる人の特徴を教えてください。","a":["論文を読んで実装できる人は当然として、その上でなぜこの技術がこのビジネス課題に有効かを説明できる人を求めています。","もう一つ大切にしているのは、不確実性への耐性です。AIプロジェクトは失敗が多い。データが使えない、モデルが期待通りに動かない。こういう状況でも諦めずに仮説を立て直せる人が、PKSHAには向いています。"]},{"q":"日本のAI産業の現状と課題をどう見ていますか？","a":["技術力は世界に遜色ない日本のAI研究者が、日本の産業に活かしきれていないことが最大の課題だと思っています。","PKSHAはその橋渡しを担う会社でありたいと思っています。研究者が事業でチャレンジできる環境、経営者が技術の可能性を深く理解できる機会。この両方を提供することで、日本のAIエコシステムを良くしていきたいです。"]},{"q":"10年後のAIと人間の関係をどう見ていますか？","a":["AIが仕事を奪うという議論には懐疑的です。歴史的に見て、新しい技術は仕事の内容を変えてきましたが、仕事の総量は減っていない。","ただ、AIと協働できるスキルを持つ人と持たない人の格差は、確実に広がります。"]}]',
  'AIが道具から協調者になる日を、上野山氏は焦らず、でも確実に近づけようとしていた。研究と事業の両方を見てきたからこそ持てる、静かな確信があった。',
  ARRAY['pksha-ml-engineer','ubie-backend-engineer'],
  ARRAY['ubie-taniguchi-cto-journey','layerx-suzuki-backend-career','freee-platform-infra-report'],
  true, '2025-05-12T00:00:00Z'
);

-- 10. mentor: sansan-kato-pdm-career
INSERT INTO ow_articles (
  type, slug, title, subtitle, eyecatch_gradient, read_min,
  company_slug, company_name_text, company_initial_text, company_gradient_text,
  subject_freeze, editor_note, body_blocks, quote, qa_blocks, themes_blocks, editor_outro,
  related_job_ids, related_article_slugs, is_published, published_at
) VALUES (
  'mentor',
  'sansan-kato-pdm-career',
  '「名刺から経営インフラへ」SansanのPdMが語る、B2B SaaSの進化と自分の成長',
  '名刺管理SaaSから法人向けインボイス管理・契約管理へと拡張するSansan。加藤俊さんがプロダクトマネージャーとして向き合う、仕事の仕組みを変えることの難しさと面白さ。',
  'linear-gradient(135deg, #D97706 0%, #FBBF24 100%)',
  8,
  'sansan', 'Sansan', 'S', 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
  '{"initial":"加","gradient":"linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)","name":"加藤 俊","role_at_interview":"プロダクトマネージャー / Sansan","current_status":"Sansan PdM（在籍中）","is_mentor":true,"mentor_id":"kato-shun"}',
  '名刺管理は入り口に過ぎないという言葉から、加藤さんのプロダクト哲学が滲み出ていた。Sansanが次に解こうとしている課題の大きさに、改めて驚かされた。',
  '["Sansanの代表プロダクトは、名刺管理という地味なカテゴリで始まった。しかし今、加藤俊さんが取り組んでいるのは、インボイス処理の自動化と契約書の一元管理という、より広いビジネスの基盤の領域だ。","名刺は人と人のつながりを記録するもの。インボイスは企業と企業のつながりを記録するもの。契約書はその関係の約束を記録するもの。これら全部を繋げることで、企業の全ての関係性を一つのプラットフォームで管理できると加藤さんは言う。","その哲学が、プロダクトの設計に滲んでいる。単なるデータ入力ツールではなく、誰が、どの取引先と、どんな関係にあるかを可視化するインテリジェンスツールとして進化しようとしている。"]',
  '「名刺スキャンという単純な行為が、企業の関係性データベースになる瞬間を見た時、このプロダクトの可能性を確信しました。」',
  '[{"q":"Sansanのプロダクトマネージャーの仕事で、特に独自性のある部分を教えてください。","a":["OCRの精度改善とUXの両立です。名刺の情報を正確に読み取るためのMLモデルの改善と、入力ミスを手軽に修正できるUIの設計、この両方をPdMが橋渡しする仕事は、名刺管理SaaSならではです。","もう一つはB2Bで企業内の複数ロールに使われるプロダクトの設計です。営業担当者、営業マネージャー、経営企画の三者全員が使うシステムで、三者の要求が必ずしも一致しない。そのトレードオフの意思決定が面白いです。"]},{"q":"Bill One（インボイス管理プロダクト）の開発で、特に難しかった点は？","a":["会計担当者と経営者で課題認識が180度違うことへの対応です。会計担当者は処理速度と正確性を求め、経営者はコストの可視化と承認フローの効率化を求める。","最終的に会計担当者が使いやすいシステムが、経営者の見たい数字を自動で生成するという設計に落ち着きました。"]},{"q":"PdMとしてのキャリアをSansanでどう積んできましたか？","a":["最初の2年間はUserテスト専任でした。週に5件以上のユーザーインタビューをこなしながら、ユーザーが言葉にしない不満を読む力を鍛えました。","3年目からBill Oneのプロダクト開発チームに移り、機能の企画から開発・リリース・検証までの全サイクルを担当するようになりました。"]},{"q":"メンターとして、どんな相談者に来てほしいですか？","a":["B2B SaaSのプロダクト開発に興味がある方なら誰でも歓迎します。特にSaaSのPdMになりたいが、エンタープライズとSMBどちらが自分に向いているかわからないという方に、自分の経験を話せると思います。","あとはPdMのポートフォリオをどう作るかという悩みを持つ方。コードを書くエンジニアと違い、PdMは成果物が見えにくい。だからこそ、どんな意思決定をしてどんな結果を出したかをストーリーとして語る力が必要で、そのコーチングが得意です。"]},{"q":"Sansanで次の3年間でやりたいことを教えてください。","a":["契約管理プロダクトContract Oneの0→1フェーズを完走したいです。法務・購買・財務が同じプラットフォームで契約情報を共有できるプロダクトは、日本にまだほとんどない。","そして、プロダクトラインを束ねるグループプロダクトマネージャーに成長したいです。"]}]',
  '[{"icon":"📋","title":"B2B SaaS PdMのキャリア設計","desc":"エンタープライズ vs SMB、0→1 vs グロース、どのフェーズがキャリアに合うか"},{"icon":"🧾","title":"インボイス・契約管理DXの実態","desc":"Bill One・Contract Oneの設計思想、会計担当者と経営者のニーズ調整"},{"icon":"📊","title":"PdMのポートフォリオ作り方","desc":"意思決定のストーリー化、面接での経験の伝え方、PdMとして評価される実績の作り方"},{"icon":"🔗","title":"Sansan・SaaS業界への転職","desc":"Sansanの選考プロセス、PdM面接の準備、B2B SaaS各社の文化比較"}]',
  '名刺から始まった会社が、企業の全関係性インフラになろうとしている。その大きな転換期に、プロダクトを作る仕事の醍醐味を加藤さんは全身で体験していた。',
  ARRAY['sansan-pdm','layerx-pdm-bakuraku'],
  ARRAY['layerx-nakamura-why-mentor','hubspot-product-org-report','smarthr-ceo-hr-tech-future'],
  true, '2025-04-25T00:00:00Z'
);
