# Opinio プロダクト実装仕様書

最終更新：2026年4月23日

## このドキュメントの目的

モック設計フェーズで決定した Opinio プロダクト（求職者側 + 企業側）の全23画面を、実装フェーズに引き継ぐための仕様書。Claude Code がこのドキュメント1つで全体像を把握し、一貫した実装を進められることを目的とする。

---

## 1. プロダクト概要

### サービスコンセプト

**「対話の産業を作る」 / Truth to Careers**

IT/SaaS業界に特化したキャリアプラットフォーム。従来の「スカウト型」「応募型」転職サービスではなく、**対話と情報の非対称性解消**を通じてキャリアを考え続ける人と企業を繋ぐ。

### 2つのプロダクト

| プロダクト | ドメイン | ターゲット |
|---|---|---|
| **Opinio**（求職者側） | opinio.jp | キャリアを考える個人、メンター |
| **Opinio Business**（企業側） | business.opinio.co.jp | 企業の採用担当者 |

### 技術スタック

- **フレームワーク**: Next.js 14 App Router
- **言語**: TypeScript
- **データベース**: Supabase（Postgres）
- **認証**: Supabase Auth
- **デプロイ**: Vercel
- **ローカルパス**: `/Users/hisato/opinio-work/`
- **Supabaseプロジェクト ref**: `xtutnecqeamftygufxco`
- **GitHubアカウント**: `contact655`
- **Vercelチーム**: `opinio1`
- **テーブルプレフィックス**: `ow_`

---

## 2. 核となる設計思想

実装時に迷った場合、以下の思想に立ち返ること。

### 思想1：「キャリアを考え続ける人」（最重要）

**Opinio のユーザー状態に「転職活動中」という概念はない。**

従来の転職サービス：
```
転職活動中 ⇄ 転職活動していない
```

Opinio：
```
常に「キャリアを考え続けている人」
```

**この思想がデータ設計に与える影響：**

- `is_actively_seeking`（転職活動中フラグ）は**不要**
- 企業側から「自社の従業員が求職活動中かどうか」が見える設計にしない
- ユーザーは Opinio に登録した瞬間、「キャリアについて思考する人」として扱う
- Opinio から「マッチする企業」を通知するが、スカウトはしない
- ユーザー本人が能動的にカジュアル面談を申し込む

### 思想2：Users 統合設計

求職者・メンター・企業担当者を**同じ Users テーブル**で管理する。

**理由：**
- 同じ人が多様な役割を持つ（採用担当者が元メンバー、メンターが現役社員、など）
- **採用担当者のキャリアも求職者に見える**（信頼の基盤）
- プロフィール管理が1つで済む
- Opinio の「対等な対話」思想と合致

**実装：**
- Users テーブルで全ユーザーを管理
- `is_mentor` フラグでメンター機能を動的に発動
- 企業担当者の役割は `CompanyAdmins` 中間テーブルで表現

### 思想3：「スカウトしない、採用を」

企業側プロダクトの核となる訴求。

- 企業はスカウトメールを送らない
- 求職者が能動的にカジュアル面談を申し込む
- 企業側には「マッチ候補者の可視化」機能で自社の求人にフィットしそうな人が表示される

### 思想4：運営の丁寧な介在

- メンター登録：Hisato が個別に声がけ（UI上では申請フォームなし）
- メンター相談予約：Opinio 編集部が事前精査
- 求人公開：Opinio 運営が事前審査（2-3営業日）
- 企業記事：Opinio 編集部が直接取材して執筆
- 企業情報：編集なし（企業の自由編集）

### 思想5：モニター期配慮（無料/有料の非表示）

- 現時点では「無料プラン」「有料プラン」のUI表記を**一切出さない**
- データモデル（`plan` カラム等）は残すが、UIからは削除
- 将来プラン機能復活時のために設計は残す
- モニターに「一緒に作っていく」関係性を担保

### 思想6：在籍企業への制約

ユーザーが現在在籍している企業（`Experiences.is_current = true`）には、**カジュアル面談を申し込めない**ようにシステム制約をかける。

```tsx
// 求人詳細ページでの制御例
if (currentUser.experiences.some(exp => 
    exp.company_id === targetCompany.id && exp.is_current)) {
  // カジュアル面談ボタンを非表示 or 「現在の在籍企業です」と表示
}
```

### 思想7：数値データ撤廃

求職者側のUIで、**マッチ度の%表示**や**星評価**などの数値による優劣評価を避ける。

**理由：** キャリアは数値で評価できるものではないという Opinio の世界観。

---

## 3. デザインシステム

### カラーパレット

```css
:root {
  /* 主要カラー */
  --royal: #002366;       /* メインカラー */
  --royal-deep: #001A4D;
  --royal-50: #EFF3FC;
  --royal-100: #DCE5F7;
  --accent: #3B5FD9;      /* アクセント */
  
  /* ステータスカラー */
  --success: #059669;     /* 緑：公開済・完了 */
  --success-soft: #ECFDF5;
  --warm: #F59E0B;        /* 琥珀：警告・下書き */
  --warm-soft: #FEF3C7;
  --purple: #7C3AED;      /* 紫：処理中・審査中 */
  --purple-soft: #F3E8FF;
  --pink: #DB2777;        /* ピンク：ハイライト */
  --pink-soft: #FCE7F3;
  --error: #DC2626;       /* 赤：エラー・差し戻し */
  --error-soft: #FEE2E2;
  
  /* グレースケール */
  --ink: #0F172A;         /* 本文テキスト */
  --ink-soft: #475569;    /* サブテキスト */
  --ink-mute: #94A3B8;    /* ミュート */
  --line: #E2E8F0;        /* ボーダー */
  --line-soft: #F1F5F9;
  --bg: #FFFFFF;
  --bg-tint: #F8FAFC;
}
```

### タイポグラフィ

```css
/* タイトル：セリフ体で格調を出す */
font-family: "Noto Serif JP", serif;

/* 本文：サンセリフ体で可読性を重視 */
font-family: "Noto Sans JP", -apple-system, sans-serif;

/* 数字・英字・ラベル：Inter */
font-family: "Inter", sans-serif;
```

### レイアウトパターン

**求職者側：**
- ヘッダー + メインエリア（1カラム、最大760px）
- セリフ体タイトルで情緒的
- 余白広め

**企業側：**
- サイドバー（240px）+ メインエリア
- 業務ツール的な密度
- Notion風のサブナビ
- 3カラム（カジュアル面談管理）

### フォーマットパターン

- **自動保存パターン**: プロフィール編集のみ（即時反映）
- **下書き + 公開ボタン**: 企業情報編集、求人編集（公開前に確認）
- **ステータスピル**: 色で状態を瞬時に伝達
- **アバター**: グラデーションで自動生成（名前の頭文字）

---

## 4. データモデル

### Supabase テーブル一覧

すべてのテーブルに `ow_` プレフィックスを付与する。

#### Users（全ユーザー統合）

```sql
CREATE TABLE ow_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_color TEXT,
  cover_color TEXT,
  about_me TEXT,
  age_range TEXT, -- '20代前半' / '30代前半' など
  location TEXT,
  social_links JSONB, -- {twitter, linkedin, note, ...}
  
  -- メンターとしての役割（オプション）
  is_mentor BOOLEAN DEFAULT false,
  mentor_registered_at TIMESTAMPTZ,
  mentor_themes TEXT[],
  is_active_mentor BOOLEAN DEFAULT false,
  
  -- プロフィール公開設定
  visibility TEXT DEFAULT 'public', -- 'public' / 'login_only' / 'private'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Companies（企業マスタ）

```sql
CREATE TABLE ow_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  logo_letter TEXT,
  logo_gradient TEXT,
  mission TEXT,
  about_markdown TEXT,
  industry TEXT,
  employee_count TEXT,
  business_stage TEXT,
  website_url TEXT,
  
  -- 詳細情報
  established_at TEXT,
  avg_age TEXT,
  gender_ratio TEXT,
  evaluation_system TEXT,
  benefits TEXT[],
  
  -- 働き方
  headquarters_address TEXT,
  nearest_station TEXT,
  remote_work_status TEXT, -- 'full_remote' / 'hybrid' / 'on_site'
  work_time_system TEXT,
  avg_overtime_hours TEXT,
  paid_leave_rate TEXT,
  workstyle_description TEXT,
  
  -- 公開設定
  is_published BOOLEAN DEFAULT false,
  accepting_casual_meetings BOOLEAN DEFAULT true,
  notification_emails TEXT[],
  
  -- プラン（将来用、UIには表示しない）
  plan TEXT DEFAULT 'free', -- 'free' / 'paid'
  
  -- 下書き
  draft_data JSONB,
  published_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### CompanyAdmins（企業担当者の役割）

```sql
CREATE TABLE ow_company_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  department TEXT,
  role_title TEXT,
  permission TEXT DEFAULT 'member', -- 'admin' / 'member'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);
```

#### CompanyOfficePhotos（オフィス写真）

```sql
CREATE TABLE ow_company_office_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'work' / 'meeting' / 'welfare' / 'event'
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

各カテゴリ最大5枚まで。

#### CompanyPerspectives（Opinio見解、編集部執筆）

```sql
CREATE TABLE ow_company_perspectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  author TEXT, -- Opinio編集部の執筆者
  title TEXT,
  body_markdown TEXT,
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Jobs（求人）

```sql
CREATE TABLE ow_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  
  -- 基本情報
  title TEXT NOT NULL,
  employment_type TEXT, -- 'full_time' / 'contract' / 'part_time' / 'intern' / 'freelance'
  role_category_id UUID REFERENCES ow_roles(id),
  department TEXT,
  
  -- 給与・労働条件
  salary_min INT,
  salary_max INT,
  salary_note TEXT,
  location TEXT,
  remote_work_status TEXT,
  probation_period TEXT,
  
  -- 仕事内容
  description_markdown TEXT,
  message_to_candidates TEXT,
  
  -- 求める人物像
  required_skills TEXT[],
  preferred_skills TEXT[],
  culture_fit TEXT,
  
  -- 選考プロセス
  selection_steps TEXT[],
  selection_duration TEXT,
  start_date_preference TEXT,
  
  -- ステータス
  status TEXT DEFAULT 'draft', -- 'draft' / 'pending_review' / 'published' / 'rejected' / 'private'
  rejection_reason TEXT,
  rejection_date TIMESTAMPTZ,
  rejection_reviewer TEXT,
  
  submitted_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### JobAssignees（求人担当者）

```sql
CREATE TABLE ow_job_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ow_jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);
```

#### Roles（職種マスタ、2階層）

```sql
CREATE TABLE ow_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES ow_roles(id),
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  icon_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**初期データ（7つの大分類）：**
- 営業（フィールドセールス、エンタープライズ営業、インサイドセールス、SDR/BDR）
- PdM / PM（プロダクトマネージャー、プロダクトオーナー、PMM）
- カスタマーサクセス
- エンジニア（バックエンド、フロントエンド、フルスタック、SRE）
- マーケティング
- 経営・CxO（CEO、COO、CPO、CTO、CFO）
- その他（デザイナー、事業開発、HRBP、コーポレート、データサイエンティスト）

マスタ未登録の職種は運営に追加依頼する仕組み。

#### Experiences（職歴）

```sql
CREATE TABLE ow_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE,
  
  -- 会社（3パターン対応）
  company_id UUID REFERENCES ow_companies(id), -- パターン1: マスタ参照
  company_text TEXT, -- パターン2: マスタ未登録の自由入力
  company_anonymized TEXT, -- パターン3: 匿名表示用の名前
  
  -- 職種
  role_category_id UUID REFERENCES ow_roles(id) NOT NULL,
  role_title TEXT, -- 具体的な役職名（任意、自由入力）
  
  -- 期間
  started_at DATE NOT NULL,
  ended_at DATE,
  is_current BOOLEAN DEFAULT false,
  
  description TEXT,
  display_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**重要：** `company_id` / `company_text` / `company_anonymized` のどれか1つだけが入る。

#### Articles（記事）

```sql
CREATE TABLE ow_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'employee' / 'mentor' / 'ceo' / 'report'
  title TEXT NOT NULL,
  subtitle TEXT,
  eyecatch_color TEXT,
  
  company_id UUID REFERENCES ow_companies(id),
  subject_user_id UUID REFERENCES ow_users(id), -- 取材対象
  
  -- 取材時点のスナップショット（取材対象者のその後の変化に影響されない）
  subject_name_text TEXT,
  subject_freeze JSONB, -- {role, company, age_range, ...}
  
  editor_intro TEXT,
  body_markdown TEXT,
  qa_blocks JSONB, -- Q&A形式の場合
  chapters JSONB, -- 取材レポートの場合
  editor_outro TEXT,
  contributors JSONB, -- 取材協力者
  
  status TEXT DEFAULT 'draft', -- 'draft' / 'published'
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### MentorReservation（メンター相談予約）

```sql
CREATE TABLE ow_mentor_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE, -- 相談者
  mentor_user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE,
  
  themes TEXT[], -- 選択された相談テーマ
  current_situation TEXT,
  questions TEXT,
  background TEXT,
  
  preferred_days TEXT[],
  preferred_times TEXT[],
  contact_email TEXT,
  preferred_platform TEXT,
  
  status TEXT DEFAULT 'pending_review',
  -- 'pending_review' / 'approved' / 'rejected' / 'scheduled' / 'completed' / 'cancelled'
  
  editor_note TEXT, -- 編集部の非公開メモ
  mentor_note TEXT, -- メンターの非公開メモ
  scheduled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### CasualMeeting（カジュアル面談申込）

```sql
CREATE TABLE ow_casual_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE, -- 候補者
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  job_id UUID REFERENCES ow_jobs(id), -- 求人発の場合
  
  share_profile BOOLEAN DEFAULT true,
  intent TEXT, -- 'info_gathering' / 'good_opportunity' / 'within_6' / 'within_3'
  interest_reason TEXT,
  questions TEXT,
  contact_email TEXT,
  preferred_format TEXT,
  
  status TEXT DEFAULT 'pending',
  -- 'pending' / 'company_contacted' / 'scheduled' / 'completed' / 'declined'
  
  assignee_user_id UUID REFERENCES ow_users(id), -- 対応者
  company_internal_memo TEXT, -- 社内メモ
  company_read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Bookmark（ブックマーク）

```sql
CREATE TABLE ow_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, -- 'article' / 'company' / 'job' / 'mentor'
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);
```

#### Matches（マッチング、企業側用）

```sql
CREATE TABLE ow_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  job_id UUID REFERENCES ow_jobs(id),
  match_score FLOAT,
  match_reasons TEXT[],
  viewed_by_company BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Activities（アクティビティログ、ダッシュボード用）

```sql
CREATE TABLE ow_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id),
  actor_user_id UUID REFERENCES ow_users(id),
  type TEXT, -- 'approved' / 'new_application' / 'completed' / ...
  description TEXT,
  target_type TEXT,
  target_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS（Row Level Security）ポリシー

Supabase ではすべてのテーブルに RLS を設定する：

- `ow_users`: 公開情報は誰でも読める、編集は本人のみ
- `ow_companies`: 公開情報は誰でも読める、編集は CompanyAdmins のみ
- `ow_company_admins`: 企業担当者のみ参照可
- `ow_jobs`: 公開中求人は誰でも読める、編集は担当企業のみ
- `ow_casual_meetings`: 申込者 + 企業担当者のみ参照可
- `ow_mentor_reservations`: 申込者 + メンター + 運営のみ参照可
- `ow_bookmarks`: 本人のみ参照可

---

## 5. ページ構造（全23ページ）

### 求職者側（opinio.jp、17ページ）

モックファイルは `/Users/hisato/opinio-mock/` に配置。

| # | ページ | ルート | モックファイル |
|---|---|---|---|
| 1 | トップ | `/` | `opinio-top-v4.html` |
| 2 | 企業一覧 | `/companies` | `opinio-companies-v4.html` |
| 3 | 企業詳細 | `/companies/[id]` | `opinio-company-detail-v10.html` |
| 4 | 求人一覧 | `/jobs` | `opinio-jobs-v2.html` |
| 5 | 求人詳細 | `/jobs/[id]` | `opinio-job-detail-v3.html` |
| 6 | ユーザープロフィール | `/users/[id]` | `opinio-profile-v4.html` |
| 7 | メンター一覧 | `/mentors` | `opinio-mentors-v3.html` |
| 8 | 記事一覧 | `/articles` | `opinio-articles-v4.html` |
| 9 | 記事詳細（社員） | `/articles/[id]` | `opinio-article-detail-v2.html` |
| 10 | 記事詳細（メンター） | `/articles/[id]` | `opinio-article-detail-mentor.html` |
| 11 | 記事詳細（CEO） | `/articles/[id]` | `opinio-article-detail-ceo.html` |
| 12 | 記事詳細（取材レポート） | `/articles/[id]` | `opinio-article-detail-report.html` |
| 13 | サインアップ/ログイン | `/auth` | `opinio-auth.html` |
| 14 | プロフィール編集 | `/profile/edit` | `opinio-profile-edit-v2.html` |
| 15 | メンター相談予約 | `/mentors/[id]/reserve` | `opinio-mentor-reservation.html` |
| 16 | カジュアル面談申込 | `/companies/[id]/casual-meeting` | `opinio-casual-meeting.html` |
| 17 | マイページ | `/mypage` | `opinio-mypage.html` |

### 企業側（business.opinio.co.jp、6ページ）

| # | ページ | ルート | モックファイル |
|---|---|---|---|
| 18 | 企業サインアップ/ログイン | `/biz/auth` | `opinio-biz-auth-v3.html` |
| 19 | 企業ダッシュボード | `/biz/dashboard` | `opinio-biz-dashboard-v2.html` |
| 20 | カジュアル面談管理 | `/biz/meetings` | `opinio-biz-meetings.html` |
| 21 | 企業情報編集 | `/biz/company` | `opinio-biz-company-edit.html` |
| 22 | 求人一覧 | `/biz/jobs` | `opinio-biz-jobs.html` |
| 23 | 求人編集 | `/biz/jobs/[id]/edit` | `opinio-biz-job-edit.html` |

### ドメイン分離戦略

- `opinio.jp` → 求職者側
- `business.opinio.co.jp` → 企業側
- Next.js の **middleware** でドメインベースのルーティング分岐
- `/biz/*` パスは企業側ドメインでのみアクセス可能

または、Next.js の multi-zone で物理的にプロジェクトを分離する選択肢もある。

---

## 6. 重要機能の実装詳細

### 6.1 認証（Supabase Auth）

**求職者側：**
- Email + Password
- Google OAuth
- サインアップ時は名前・メール・パスワードのみ（最小限）

**企業側：**
- Email + Password のみ
- **企業ドメインメール必須**（gmail等の個人アドレスは不可）
- 既存ユーザー検知機能：メアド入力時に `ow_users` テーブルを検索し、既存なら「権限を追加しますか？」を提示
- サインアップ時に企業情報（企業名・業種・従業員数）+ 担当者情報（氏名・部署・役職）を収集

### 6.2 Users 統合設計の実装

**新規サインアップフロー（企業側）：**
```typescript
// 1. ユーザー存在チェック
const existingUser = await supabase
  .from('ow_users')
  .select('*')
  .eq('email', email)
  .single();

if (existingUser) {
  // ログインに誘導 + 後で権限追加
  return { action: 'redirect_to_login' };
}

// 2. 新規ユーザー + 企業担当者作成
const { data: user } = await supabase.auth.signUp({ email, password });
await supabase.from('ow_users').insert({ 
  auth_id: user.id, 
  email, 
  name 
});

// 3. 企業を作成 or 参照
let company = await supabase
  .from('ow_companies')
  .select('*')
  .eq('name', companyName)
  .single();

if (!company) {
  company = await supabase.from('ow_companies').insert({
    name: companyName,
    industry,
    employee_count
  }).select().single();
}

// 4. CompanyAdmins 登録
await supabase.from('ow_company_admins').insert({
  user_id: user.id,
  company_id: company.id,
  department,
  role_title,
  permission: 'admin'
});
```

### 6.3 職歴（Experiences）の会社名3パターン

```typescript
// UI で選択
type CompanyInputType = 'master' | 'custom' | 'anonymous';

// パターン1: マスタから選択
{ company_id: 'uuid-of-company', company_text: null, company_anonymized: null }

// パターン2: 未登録企業を自由入力
{ company_id: null, company_text: '株式会社〇〇', company_anonymized: null }

// パターン3: 匿名表示
{ company_id: null, company_text: null, company_anonymized: 'AIスタートアップA社' }
```

表示時のヘルパー関数：
```typescript
function getCompanyDisplay(exp: Experience): { name: string; linkable: boolean; tag?: string } {
  if (exp.company_id && exp.company) {
    return { name: exp.company.name, linkable: true, tag: 'マスタ登録' };
  }
  if (exp.company_text) {
    return { name: exp.company_text, linkable: false, tag: '未登録企業' };
  }
  if (exp.company_anonymized) {
    return { name: exp.company_anonymized, linkable: false, tag: '非公開' };
  }
  return { name: '未設定', linkable: false };
}
```

### 6.4 求人の下書き→公開申請→審査→公開フロー

```typescript
type JobStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'private';

// 下書き保存（自動）
await supabase.from('ow_jobs').update({ 
  ...jobData, 
  status: 'draft' 
});

// 公開申請
await supabase.from('ow_jobs').update({ 
  status: 'pending_review',
  submitted_at: new Date()
});

// 運営が承認（管理画面、未実装）
await supabase.from('ow_jobs').update({ 
  status: 'published',
  published_at: new Date()
});

// 運営が差し戻し（管理画面、未実装）
await supabase.from('ow_jobs').update({ 
  status: 'rejected',
  rejection_reason: 'フィードバック文言',
  rejection_date: new Date(),
  rejection_reviewer: '運営担当者名'
});
```

### 6.5 企業情報の下書き + 公開ボタンフロー

```typescript
// 編集時：draft_data に保存
await supabase.from('ow_companies').update({
  draft_data: {
    mission: newMission,
    about_markdown: newAbout,
    // ...
  }
});

// 公開時：draft_data の内容を本データに反映
const company = await supabase.from('ow_companies').select('*').single();
await supabase.from('ow_companies').update({
  ...company.draft_data,
  draft_data: null,
  published_at: new Date()
});
```

### 6.6 在籍企業制約

カジュアル面談申込ボタンの表示ロジック：

```typescript
function canApplyCasualMeeting(user: User, company: Company): boolean {
  // 現在の在籍企業には申込不可
  const currentExperience = user.experiences.find(
    exp => exp.is_current && exp.company_id === company.id
  );
  return !currentExperience;
}
```

### 6.7 採用担当者のキャリア表示（Opinio独自価値）

求人詳細ページ・企業詳細ページで、採用担当者の職歴を表示：

```tsx
// 求人詳細ページ
{job.assignees.map(assignee => (
  <AssigneeCard key={assignee.user_id}>
    <Avatar user={assignee.user} />
    <Name>{assignee.user.name}</Name>
    <Role>{assignee.department} {assignee.role_title}</Role>
    <CareerSummary>
      元：{assignee.user.experiences
        .filter(e => !e.is_current)
        .slice(0, 2)
        .map(e => getCompanyDisplay(e).name)
        .join(' / ')}
    </CareerSummary>
    <Link href={`/users/${assignee.user.id}`}>
      プロフィールを見る
    </Link>
  </AssigneeCard>
))}
```

### 6.8 メンター機能の動的表示

マイページのサイドバー：

```tsx
{currentUser.is_mentor && (
  <SidebarSection label="⭐ メンター管理">
    <SidebarItem href="/mypage/mentor-requests">受けた相談</SidebarItem>
    <SidebarItem href="/mypage/mentor-schedule">スケジュール</SidebarItem>
  </SidebarSection>
)}
```

### 6.9 マッチングアルゴリズム（C-3 似た経歴のメンターレコメンド）

職種マスタの `role_category_id` を活用：

```typescript
// 「営業経験 + PdM経験」を持つメンターを探す
async function findSimilarMentors(userExperiences: Experience[]) {
  const roleCategoryIds = userExperiences.map(e => e.role_category_id);
  
  return await supabase
    .from('ow_users')
    .select('*, experiences:ow_experiences(*)')
    .eq('is_mentor', true)
    .contains('experiences.role_category_id', roleCategoryIds);
}
```

---

## 7. 実装の優先順位

### Phase 1：基盤構築（最優先）

1. **データベーススキーマ**
   - 全テーブルの作成
   - 初期データ投入（Roles マスタ）
   - RLS ポリシー設定

2. **認証システム**
   - Supabase Auth 設定
   - 求職者側サインアップ/ログイン
   - 企業側サインアップ/ログイン（ドメインメール必須、既存ユーザー検知）

3. **共通コンポーネント**
   - ヘッダー、フッター
   - ステータスピル
   - アバター、企業ロゴ
   - マークダウンレンダラー

### Phase 2：求職者側コアページ

4. **公開閲覧ページ**
   - トップページ
   - 企業一覧、企業詳細
   - 求人一覧、求人詳細
   - メンター一覧

5. **ユーザー関連**
   - ユーザープロフィール（閲覧）
   - プロフィール編集（職歴の3パターン、職種マスタ）
   - マイページ

### Phase 3：記事システム

6. **記事機能**
   - 記事一覧（マガジン型横スクロール）
   - 記事詳細（4タイプ対応）
   - 運営側の記事執筆機能（管理画面）

### Phase 4：企業側コアページ

7. **企業側基本機能**
   - 企業ダッシュボード
   - 企業情報編集（自動下書き + 公開）
   - 求人一覧・求人編集（下書き→審査→公開）

### Phase 5：ワークフロー

8. **対話機能**
   - カジュアル面談申込（求職者側）
   - カジュアル面談管理（企業側、3カラムレイアウト）
   - メンター相談予約（求職者側）
   - メンター管理（マイページのメンター専用セクション）

### Phase 6：高度な機能

9. **マッチング・通知**
   - マッチング計算
   - ブックマーク機能
   - 通知機能（メール）

10. **運営者向け管理画面**（モック未作成、後回し）
    - 求人審査
    - 企業マスタ管理
    - 職種マスタ追加依頼の処理
    - 記事執筆
    - メンター登録管理

---

## 8. 重要な留意事項

### セキュリティ

- **RLS を必ず設定する**：認証なしで他人のデータが見えないように
- **企業担当者の権限チェック**：Admin と Member で操作範囲を分ける
- **API Routes の認証**：すべての API で Supabase セッションを検証
- **プロフィール公開設定**：`visibility` カラムで制御

### パフォーマンス

- **画像最適化**：Next.js Image コンポーネントを使用
- **SSR/ISR**：静的ページ（トップ、記事詳細）は ISR
- **キャッシュ**：企業一覧、求人一覧はキャッシュ戦略を検討
- **Supabase クエリ最適化**：N+1問題を避ける、joinを活用

### SEO

- **メタデータ**：Next.js metadata で OGP、Twitter Card
- **構造化データ**：schema.org の Article、JobPosting を記事と求人ページに
- **サイトマップ**：公開中の企業・求人・記事を含める

### エッジケース

- 企業が退会したときの既存求人・職歴の扱い
- メンターが解除されたときの予約の扱い
- ユーザーがアカウント削除した際の匿名化
- 求人担当者が退社したときの引き継ぎ

### テスト方針

MVP段階では：
- **手動テスト中心**
- 重要な関数（計算ロジック、権限チェック）のみユニットテスト
- E2Eテストは後回し

---

## 9. 未実装で将来対応する機能

これらは現時点では**実装しない**が、データモデルや構造は将来追加できる形にしておく：

1. **有料プラン機能**（データモデルは存在、UI非表示）
2. **マッチングの可視化アルゴリズム**（高度化は後）
3. **通知センター**（現状はメール通知のみ）
4. **メンター登録申請フォーム**（Hisato 個別声がけで運用）
5. **運営者向け管理画面**（手動で Supabase 直接操作）
6. **プレビュー機能**（ボタンだけで中身は後で）
7. **アナリティクス機能**（企業側）
8. **Slack/Discord 連携**（通知拡充）

---

## 10. Claude Code への指示の型

このプロジェクトで Claude Code に依頼する際の推奨パターン：

### 型1：スキーマ作成
```
/Users/hisato/opinio-mock/ のHTMLと、本仕様書のデータモデルを参考に、
Supabase SQL migration を作成してください。
ファイル名: sql/047_opinio_core_tables.sql
```

### 型2：ページ実装
```
モック /Users/hisato/opinio-mock/opinio-top-v4.html を参考に、
Next.js の / ページを実装してください。

要件：
- /Users/hisato/opinio-work/app/page.tsx
- デザインはモックに忠実に（CSS変数、フォント、レイアウト）
- Supabaseからのデータ取得：最新の企業3社、最新の記事4件
- サーバーコンポーネントで実装
```

### 型3：機能実装
```
本仕様書のセクション6.3「職歴の会社名3パターン」を実装してください。

- プロフィール編集ページの職歴追加モーダル
- /Users/hisato/opinio-mock/opinio-profile-edit-v2.html を参考に
- 3パターンの切替UI
- マスタ検索のサジェスト機能
```

---

## 付録：モックで議論した設計判断履歴

### プロフィール編集
- Q1: Notion風サイドバー ✓
- Q2: 自動保存（即時反映）✓
- Q3: 会社名3パターン（マスタ/自由入力/匿名）✓
- Q4: 職種はマスタ化（2階層）✓

### カジュアル面談申込
- Q1: 中程度の情報量
- Q2: プロフィール共有チェックボックス
- Q3: やわらかい言葉遣い（「応募」ではなく「カジュアル面談」）
- Q4: 3営業日以内の返答SLA
- Q5: 求人IDを引き継ぐ統一フォーム

### メンター相談予約
- Q1: メンターに連絡してから調整（プラットフォーム精査あり）
- Q2: ハイブリッド（選択式 + 自由記述）
- Q3: 最初は無料、将来有料化
- Q4: メンター承認型
- Q5: 1ページ完結

### 企業ダッシュボード
- Q1: Notion風サイドバー（求職者マイページと統一）
- Q2: 全セクション表示（情報集約）
- Q3: ~~プラン差分~~ → モニター期は非表示
- Q4: ~~切替モック~~ → 削除
- Q5: ダッシュボードに公開設定概要

### 企業情報編集
- Q1: Notion風サイドバー
- Q2: 自動下書き + 公開ボタン
- Q3: 写真カテゴリあり（+ ガイドラインで乱用抑制）
- Q4: シンプルなマークダウン
- Q5: プレビューは別タブ

### 求人編集
- Q1: 別ページで集中編集
- Q2: 提案通りの項目構成
- Q3: 差し戻しは編集ページ上部 + 一覧バッジ
- Q4: セクション切替（企業情報編集と統一）
- Q5: 自動下書き + 公開申請ボタン

---

以上が、Opinio プロダクトの実装仕様書です。
