# Opinio モックファイル一式

## このパッケージについて

Opinio プロダクト（求職者側 + 企業側）の全23ページのモックHTMLファイルと、実装仕様書を同梱しています。

## 配置方法

このzipを解凍した内容を、以下の場所に配置してください：

```
/Users/hisato/opinio-mock/
```

ターミナルで実行する場合：

```bash
mkdir -p /Users/hisato/opinio-mock/
cd /Users/hisato/opinio-mock/
unzip ~/Downloads/opinio-mocks.zip
```

## ファイル一覧（全24ファイル）

### 仕様書（1ファイル）
- `OPINIO_IMPLEMENTATION_SPEC.md` — Claude Code に渡す実装仕様書

### 求職者側（17ファイル）

| # | ページ | ファイル | ルート |
|---|---|---|---|
| 1 | トップ | `opinio-top-v4.html` | `/` |
| 2 | 企業一覧 | `opinio-companies-v4.html` | `/companies` |
| 3 | 企業詳細 | `opinio-company-detail-v10.html` | `/companies/[id]` |
| 4 | 求人一覧 | `opinio-jobs-v2.html` | `/jobs` |
| 5 | 求人詳細 | `opinio-job-detail-v3.html` | `/jobs/[id]` |
| 6 | ユーザープロフィール | `opinio-profile-v4.html` | `/users/[id]` |
| 7 | メンター一覧 | `opinio-mentors-v3.html` | `/mentors` |
| 8 | 記事一覧 | `opinio-articles-v4.html` | `/articles` |
| 9 | 記事詳細（社員） | `opinio-article-detail-v2.html` | `/articles/[id]` |
| 10 | 記事詳細（メンター） | `opinio-article-detail-mentor.html` | `/articles/[id]` |
| 11 | 記事詳細（CEO） | `opinio-article-detail-ceo.html` | `/articles/[id]` |
| 12 | 記事詳細（取材レポート） | `opinio-article-detail-report.html` | `/articles/[id]` |
| 13 | サインアップ/ログイン | `opinio-auth.html` | `/auth` |
| 14 | プロフィール編集 | `opinio-profile-edit-v2.html` | `/profile/edit` |
| 15 | メンター相談予約 | `opinio-mentor-reservation.html` | `/mentors/[id]/reserve` |
| 16 | カジュアル面談申込 | `opinio-casual-meeting.html` | `/companies/[id]/casual-meeting` |
| 17 | マイページ | `opinio-mypage.html` | `/mypage` |

### 企業側（6ファイル）

| # | ページ | ファイル | ルート |
|---|---|---|---|
| 18 | 企業サインアップ/ログイン | `opinio-biz-auth-v3.html` | `/biz/auth` |
| 19 | 企業ダッシュボード | `opinio-biz-dashboard-v2.html` | `/biz/dashboard` |
| 20 | カジュアル面談管理 | `opinio-biz-meetings.html` | `/biz/meetings` |
| 21 | 企業情報編集 | `opinio-biz-company-edit.html` | `/biz/company` |
| 22 | 求人一覧 | `opinio-biz-jobs.html` | `/biz/jobs` |
| 23 | 求人編集 | `opinio-biz-job-edit.html` | `/biz/jobs/[id]/edit` |

## Claude Code への指示テンプレート

```
モックファイル一式を /Users/hisato/opinio-mock/ に配置しました。
仕様書は OPINIO_IMPLEMENTATION_SPEC.md を参照してください。

次のタスクをお願いします：
[具体的な指示]

参照モック：/Users/hisato/opinio-mock/opinio-[ファイル名].html
```

## 確認方法

ブラウザで各HTMLファイルをダブルクリックすれば、モックUIが表示されます。

## 備考

- これらは**モックファイル**（見た目の参考用）です
- 実際の実装では、Next.js App Router + Supabase で動的に実装します
- 機能仕様は仕様書（OPINIO_IMPLEMENTATION_SPEC.md）を正とします
- Hisato 設計思想（ユーザー統合、プラン非表示、対話重視など）を最重要視してください
