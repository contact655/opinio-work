# Opinio — Claude 作業ログ

## プロジェクト概要

IT/SaaS 業界に特化したキャリアプラットフォーム。
**求職者側プロダクト（Phase 2 + Phase 4）が 2026-04-24 に 100% 完成。**

- **リポジトリ**: `/Users/hisato/opinio-work/`
- **ワークツリー**: `/Users/hisato/opinio-work/.claude/worktrees/silly-kowalevski-e4eca2/`
- **プレビューサーバー**: `localhost:3000`（`npm run dev` from worktree）
- **launch.json**: `/Users/hisato/opinio-work/.claude/launch.json`
- **モックHTML + 仕様書**: `/Users/hisato/opinio-mock/`
- **仕様書**: `/Users/hisato/opinio-mock/OPINIO_IMPLEMENTATION_SPEC.md`

> **重要**: dev サーバーは **ワークツリー** から起動している。
> ファイルは必ず worktree パスに書くこと。
> `/Users/hisato/opinio-work/src/...` に書いても反映されない。

---

## 実装済みページ全一覧（2026-04-24 時点）

### Phase 2 — 求職者側 公開ページ（閲覧）

| ページ | パス | ファイル |
|--------|------|---------|
| トップ | `/` | `src/app/page.tsx` |
| 企業一覧 | `/companies` | `src/app/companies/page.tsx` |
| 企業詳細 | `/companies/[id]` | `src/app/companies/[id]/page.tsx` |
| 求人一覧 | `/jobs` | `src/app/jobs/page.tsx` |
| 求人詳細 | `/jobs/[id]` | `src/app/jobs/[id]/page.tsx` |
| メンター一覧 | `/mentors` | `src/app/mentors/page.tsx` |
| 記事一覧 | `/articles` | `src/app/articles/page.tsx` |
| 記事詳細 | `/articles/[slug]` | `src/app/articles/[slug]/page.tsx` |

### Phase 4 — 求職者側 対話アクションページ（2026-04-24 完成）

| ページ | パス | ファイル |
|--------|------|---------|
| プロフィール編集 | `/profile/edit` | `src/app/profile/edit/page.tsx` |
| マイページ | `/mypage` | `src/app/mypage/page.tsx` |
| カジュアル面談申込 | `/companies/[id]/casual-meeting` | `src/app/companies/[id]/casual-meeting/page.tsx` |
| メンター相談予約 | `/mentors/[id]/reserve` | `src/app/mentors/[id]/reserve/page.tsx` |

---

## Phase 4 実装サマリー（2026-04-24）

### 実装規模
| フェーズ | ページ | 行数 |
|---------|--------|------|
| Phase 4a | `/profile/edit` | +11,368行 |
| Phase 4b | `/mypage` | +12,858行 |
| Phase 4c | `/companies/[id]/casual-meeting` | +13,634行 |
| Phase 4d | `/mentors/[id]/reserve` | +14,409行 |
| **今日の合計** | | **+52,269行** |
| **プロジェクト累計** | | **約88,000行超** |

### Phase 4a: `/profile/edit`
- Notion スタイルサイドバー（基本情報 / キャリア / SNS / アカウント設定）
- 自動保存 700ms デバウンス（idle → saving → saved 3状態 UX）
- 会社名3パターン: master（MOCK_COMPANIES から検索）/ 自由入力 / 匿名表示
- 職種マスター: 2階層ドロップダウン（7カテゴリ × サブロール）
- キャリア CRUD: 追加・編集・削除・現職フラグ
- プロフィール完成度プログレスバー（6項目で計算）
- 関連ファイル:
  - `src/app/profile/edit/page.tsx` — メインページ
  - `src/app/profile/edit/CareerModal.tsx` — キャリア追加・編集モーダル
  - `src/app/profile/edit/mockProfileData.ts` — ProfileData 型 + MOCK_PROFILE
  - `src/app/profile/edit/roleData.ts` — 職種マスター（ROLE_CATEGORIES）

### Phase 4b: `/mypage`
- 6ビュー切替（ダッシュボード / カジュアル面談 / メンター相談 / ブックマーク / 受けた相談 / スケジュール）
- `isMentor` トグル → サイドバーに「メンター管理」セクションを動的表示
- ステータスピル 6状態: pending(amber) / company_contacted(royal) / scheduled(purple) / completed(gray) / declined(error) / approved(success)
- 承認アクション → バッジカウントリアクティブ更新
- Mock ロール切替バー（通常ユーザー / メンター登録済み）
- 関連ファイル:
  - `src/app/mypage/page.tsx` — メインページ（全ビュー含む）
  - `src/app/mypage/mockMypageData.ts` — 全型定義 + モックデータ

### Phase 4c: `/companies/[id]/casual-meeting`
- **在籍企業制約**（Hisato 思想）: `MOCK_PROFILE.experiences[isCurrent=true]` と企業 ID を照合し、在籍中なら申込不可表示
- 求人 ID 引き継ぎ: `?job_id=xxx` で宛先カードに求人情報表示、`× 紐づけを外す` で解除
- プロフィール共有チェックボックス（デフォルト ON）
- 転職意向4択ラジオ
- テキストエリア2本（きっかけ・質問、ともに必須）
- **warm orange グラデーション** CTA（カジュアル感を色で表現）
- 3ステップ成功モーダル
- エントリーポイント: `/companies/[id]` サイドバー + `/jobs/[id]` サイドバー

### Phase 4d: `/mentors/[id]/reserve`
- `mentor.themes` から相談テーマを動的生成（メンターごとに異なる）
- 5ステップフロー可視化（申請→編集部確認→メンター承認→日程調整→対話）
- テーマ複数選択（`Set<string>`）+ 必須バリデーション
- 相談内容3テキストエリア（状況・質問 必須、背景 任意）
- 希望曜日7択 + 時間帯6択（`Set<string>`、任意）
- **royal グラデーション** CTA（深い対話を色で表現）+ 無料バッジ（MVP期間配慮）
- 5ステップ成功モーダル（編集部精査フロー明示）
- エントリーポイント: `/mentors` 一覧の「話を聞く（30分）」ボタン（既実装済み）

---

## モックデータ — 田中翔太さん（統一ペルソナ）

Phase 4 全体で使用している架空ユーザー。**変更した場合は全ファイルを整合させること。**

```typescript
// src/app/profile/edit/mockProfileData.ts
name: "田中 翔太"
email: "tanaka@example.com"
avatarColor: "linear-gradient(135deg, #002366, #3B5FD9)"

experiences: [
  {
    id: "exp-1",
    companyType: "master",
    companyId: "layerx",          // ← 在籍企業制約のデモキー
    displayCompanyName: "株式会社LayerX",
    roleCategoryId: "product_manager",
    roleTitle: "プロダクトマネージャー（Bakuraku事業）",
    startedAt: "2024-04",
    isCurrent: true,              // ← /companies/layerx/casual-meeting が blocked
  },
  { displayCompanyName: "株式会社タイミー", isCurrent: false },  // 前職
  { displayCompanyName: "株式会社リクルート", isCurrent: false }, // 最初
]
```

```typescript
// src/app/mypage/mockMypageData.ts
MOCK_USER.currentRole = "株式会社LayerX · プロダクトマネージャー（Bakuraku事業）"
```

> **デモポイント**: `/companies/layerx/casual-meeting` → 「現在ご在籍中の企業です」表示
> `/companies/smarthr/casual-meeting` → 通常フォーム

---

## 主要データモデル

### `src/app/companies/mockCompanies.ts`
```typescript
type Company = {
  id: string; name: string; tagline: string; mission: string;
  industry: string; phase: string; employees: string;
  founded: string; hq: string; gradient: string;
  logo_url?: string; website?: string;
  highlights: string[]; tech_stack: string[];
}
```
- 12社収録: layerx / smarthr / hubspot / salesforce / ubie / freee / sansan / moneyforward / datadog / kubell / notion / pksha
- `MOCK_COMPANIES` export

### `src/app/jobs/mockJobData.ts`
- 15求人収録（12社）、`getJobById()`, `filterJobs()`, `getJobsByCompany()` export
- `PositionMember.is_mentor: true` で `/mentors` と紐づく

### `src/app/mentors/mockMentorData.ts`
- 17名収録、`MOCK_MENTORS`, `filterMentors()` export
- `id` は kebab-case（例: `watanabe-miho`, `nakamura-yuki`）→ `/mentors/[id]/reserve` の URL

### `src/app/articles/mockArticleData.ts`
- 10記事収録: employee×2 / mentor×4 / ceo×2 / report×2
- `getArticleBySlug()`, `filterArticles()` export

### `src/app/profile/edit/mockProfileData.ts`
- `ProfileData` 型、`MOCK_PROFILE`, `LOCATIONS`, `AGE_RANGES` export
- **田中翔太さんの現職は LayerX**（`companyType: "master"`, `companyId: "layerx"`）

### `src/app/mypage/mockMypageData.ts`
- `CasualMeeting`, `MentorReservation`, `Bookmark`, `ReceivedRequest` 型
- `PILL_STYLES`, `STATUS_LABEL`, `STATUS_VARIANT` — ステータスピルシステム
- `MOCK_CASUAL_MEETINGS`(4件), `MOCK_MENTOR_RESERVATIONS`(3件)
- `MOCK_BOOKMARKS_ARTICLES`(5), `MOCK_BOOKMARKS_COMPANIES`(4), `MOCK_BOOKMARKS_MENTORS`(3)
- `MOCK_RECEIVED_REQUESTS`(4件: pending×2 + completed×2)

---

## ファイル構造（Phase 4 追加分）

```
src/app/
├── profile/
│   └── edit/
│       ├── page.tsx              # プロフィール編集（"use client"）
│       ├── CareerModal.tsx       # キャリア追加・編集モーダル
│       ├── mockProfileData.ts    # ProfileData 型 + MOCK_PROFILE
│       └── roleData.ts           # 職種マスター（7カテゴリ）
├── mypage/
│   ├── page.tsx                  # マイページ（6ビュー, "use client"）
│   └── mockMypageData.ts         # 全型 + モックデータ
├── companies/
│   └── [id]/
│       └── casual-meeting/
│           └── page.tsx          # カジュアル面談申込（"use client" + Suspense）
└── mentors/
    └── [id]/
        └── reserve/
            └── page.tsx          # メンター相談予約（"use client"）
```

---

## Hisato 思想（実装済み）

1. **キャリアを考え続ける人**: 「転職活動中」フラグなし。情報収集中でも使える
2. **Users 統合設計**: `is_mentor` フラグ1つで求職者↔メンター動的発動（マイページで実証済み）
3. **スカウトしない、採用を**: 企業→求職者へのスカウト機能なし。対話から始まる設計
4. **運営の丁寧な介在**: メンター登録は個別声がけ、相談は編集部が精査してから転送
5. **モニター期配慮**: 料金表示なし、無料バッジ（MVP期間中は無料）のみ
6. **在籍企業制約**: 現在在籍中の企業へのカジュアル面談申込を UI でブロック
7. **数値データ撤廃**: マッチ度%・星評価なし。求職者が自分で判断する
8. **position_members**: 各求人に「この職種を経験した人」を表示。scnashot思想
9. **取材時スナップショット**: 記事の `role_at_interview` + `current_status` で時制を両方表示

---

## 次のセッションで着手すべきタスク

### 🔥 Phase 5: Supabase 接続（次の最優先）

**開始前の確認事項（最初に必ず実行）:**
```bash
# 環境変数確認
cat /Users/hisato/opinio-work/.env.local | grep SUPABASE

# パッケージ確認
cat /Users/hisato/opinio-work/package.json | grep supabase

# クライアント確認
ls /Users/hisato/opinio-work/src/lib/supabase.ts

# 既存テーブル確認（Supabase CLI or ダッシュボード）
# ow_companies, ow_jobs, ow_mentors, ow_articles の投入状況
# auth.users → ow_users 自動作成トリガー
# RLS ポリシー（anon SELECT 許可）
```

**段階的実装ロードマップ:**

| 段階 | 内容 | 認証要否 |
|------|------|---------|
| 段階1 | 読み取り専用ページ（/companies, /jobs, /mentors, /articles） | 不要（anon SELECT） |
| 段階2 | 認証フロー（/auth サインアップ → ow_users 自動作成） | 必要 |
| 段階3 | プロフィール編集（/profile/edit に認証ガード + 自分のデータ読み書き） | 必要 |
| 段階4 | マイページ（/mypage に認証ガード + 関連データ集約） | 必要 |
| 段階5 | アクションページ（カジュアル面談・メンター予約の永続化） | 必要 |

**マスタデータ移行:**
```
mockCompanies.ts   → ow_companies テーブル
mockJobData.ts     → ow_jobs テーブル（現在未作成の可能性）
mockMentorData.ts  → ow_mentors テーブル（現在未作成の可能性）
mockArticleData.ts → ow_articles テーブル（一部既存）
mockProfileData.ts → ow_users + ow_experiences テーブル
```

### Phase 3: 企業側プロダクト（Phase 5 の後）
- `/biz/auth` — 企業側ログイン
- `/biz/dashboard` — ダッシュボード（面談申込件数、求人一覧）
- `/biz/meetings` — カジュアル面談管理（pending → company_contacted → scheduled）
- `/biz/jobs` — 求人管理（CRUD）
- `/biz/company` — 企業情報編集
- `/biz/analytics` — 分析

---

## 技術的注意事項

### ワークツリー使用
- Claude は必ず **ワークツリー** のパスにファイルを書く:
  `/Users/hisato/opinio-work/.claude/worktrees/silly-kowalevski-e4eca2/src/...`
- dev サーバーもワークツリーから起動している（launch.json の `npm run dev`）

### "use client" + Suspense パターン
- `useSearchParams()` を使う場合は Suspense でラップ必須（Next.js 14 要件）
- `useParams()` のみなら Suspense 不要
- Phase 4c（casual-meeting）は Suspense あり、Phase 4d（reserve）は Suspense なし

### nativeInputValueSetter パターン（React state 更新）
- preview_fill や DOM 直接書き換えでは React state が更新されない
- eval で `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set` を使い、`new Event('input', { bubbles: true })` で発火

### 既知の TypeScript エラー（既存・非クリティカル）
```
src/app/companies/mockCompanies.ts(219,31): error TS2802
  Type 'Set<string>' can only be iterated through when using '--downlevelIteration'
```
- ビルド・動作には影響しない
- 直すなら `Array.from(new Set(...))` に置き換え

### CSS カスタムプロパティ（globals.css）
```css
--royal: #002366; --royal-50: #EFF3FC; --royal-100: #DCE5F7;
--accent: #3B5FD9; --success: #059669; --success-soft: #ECFDF5;
--warm: #F59E0B; --warm-soft: #FEF3C7;
--purple: #7C3AED; --purple-soft: #F3E8FF;
--error: #DC2626; --error-soft: #FEE2E2;
--ink: #0F172A; --ink-soft: #475569; --ink-mute: #94A3B8;
--line: #E2E8F0; --line-soft: #F1F5F9; --bg-tint: #F8FAFC;
```

### デザインシステム
- フォント: `"Noto Serif JP"` 見出し / `"Noto Sans JP"` 本文 / `Inter` 数字・ラベル
- ステータスピル: pending(amber) / royal(pending_review) / purple(scheduled) / gray(completed) / error(declined) / success(approved)
- CTAグラデーション色の使い分け:
  - warm orange: カジュアル面談（軽い接触）
  - royal blue: メンター予約（深い対話）
  - royal blue: 企業詳細 CTA（標準）

---

## コミット履歴（直近）

```
feat: Phase 4 complete - user-side product 100% done
  - Phase 4a: /profile/edit (+11,368行)
  - Phase 4b: /mypage (+12,858行)
  - Phase 4c: /companies/[id]/casual-meeting (+13,634行)
  - Phase 4d: /mentors/[id]/reserve (+14,409行)
  Total: +52,269行 / プロジェクト累計: 約88,000行超

feat: Phase 4b mypage — 6-view dashboard, is_mentor toggle, status pills
feat: Phase 4a profile/edit — auto-save, career CRUD, company 3-pattern
feat: Phase 2g articles (mock data, list, detail, cross-links)
feat: Phase 2f mentors (mock data, list, filter)
feat: Phase 2d/2e jobs (mock data, list, detail, position_members)
feat: Phase 2b/2c companies (mock data, list, detail)
```

---

## 明日の再開クイックガイド

```
1. このファイル（CLAUDE.md）を読む ← 今ここ
2. dev サーバーが起動しているか確認: localhost:3000
3. Phase 5 開始前確認:
   cat /Users/hisato/opinio-work/.env.local
   cat /Users/hisato/opinio-work/package.json | grep supabase
4. 段階1から: /companies, /jobs, /mentors, /articles を
   mockXxx.ts → Supabase の anon SELECT に切り替え
```
