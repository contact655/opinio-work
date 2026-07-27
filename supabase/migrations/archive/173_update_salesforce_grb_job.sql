-- Migration 173: Account Executive, Commercial Sales (GRB) 求人情報更新
-- Source: https://www.openwork.jp/a0910000002WZ8v/recruit?j=bd2a71be989f43f2
--         https://directscout.recruit.co.jp/job_descriptions/10004700

UPDATE ow_jobs SET
  catch_copy = '中堅・大手企業のCEO・役員と向き合い、CRM・AIで経営変革をリードする営業ポジション',

  one_liner = 'Salesforceのコア製品群（CRM・AI・Data Cloud等）を武器に、担当企業のデジタルトランスフォーメーションをエンドツーエンドで支援するAccount Executive。',

  description = '関東・関西を中心とした中堅〜大手企業を担当し、新規顧客への提案に加え、既存顧客に対するアップセル・クロスセルを通じて、アカウント全体の価値最大化を推進するポジションです。

【主な業務内容】
・担当企業のCEO・CFO・CTO等の経営層と向き合い、経営課題を深掘りした上でSalesforceソリューションを提案
・SFA・CRM・Agentic AI・Data Cloud・Marketing Cloud・Tableau等を組み合わせた戦略的ソリューション提案
・インサイドセールス・ソリューションエンジニア・パートナー企業と連携しながら複数ステークホルダーが関与する商談をリード
・新規顧客開拓と既存顧客でのアップセル・クロスセルの両軸で個人売上目標を達成
・商談の戦略設計から契約クローズまでエンドツーエンドで担当

【環境・働き方】
・スーパーフレックス制（コアタイムなし、直行直帰可）
・ハイブリッド勤務（リモート + オフィス）
・年間120日休日（完全週休2日・祝日）
・「働きがいのある企業ランキング2025」第2位',

  requirements = 'IT業界における法人営業経験5年以上（直販経験必須）
個人売上目標を持つ営業経験および高い目標達成意欲
新規顧客への提案経験（新規開拓営業経験）
複数ステークホルダーが関与する商談での合意形成経験',

  preferred_skills = ARRAY[
    'CRM・ERP・BI・SCM等エンタープライズアプリケーションの提案・導入経験',
    '経営者・役員クラスとの折衝・提案経験',
    '無形商材・ソリューション型営業の経験',
    '課題解決型の提案営業スタイルの確立経験',
    '新しいテクノロジーへの積極的な学習意欲'
  ],

  salary_min = 600,
  salary_max = 2500,

  selection_process = '["書類選考", "一次面接", "二次面接・三次面接", "内定"]'::jsonb,

  updated_at = now()

WHERE id = 'cd6d96de-e270-4dd9-9f9a-bc4d5209ab51';
