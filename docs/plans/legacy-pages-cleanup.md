# 旧ページ整理タスク (Phase α 完了後に検討)

## 背景

opinio-work が新プロダクトとして稼働開始 (2026 年 5 月)。
過去の Opinio ATS / career-consultation 等のページが `src/app/` 配下に残置されている。
Phase α Step 3a (2026-05-01) で「明らかな死コード」のみ削除し、本タスクは独立化。

---

## 対象ページ一覧

### URL とファイルパス

| URL | ファイルパス |
|-----|------------|
| `/companies/list` | `src/app/companies/list/page.tsx` |
| `/companies/[id]/jobs` | `src/app/companies/[id]/jobs/page.tsx` |
| `/companies/[id]/articles/[articleId]` | `src/app/companies/[id]/articles/[articleId]/page.tsx` |
| `/companies/[id]/members/[memberId]` | `src/app/companies/[id]/members/[memberId]/page.tsx` |
| `/career-consultation` | `src/app/career-consultation/page.tsx` |
| `/career-consultation/[id]` | `src/app/career-consultation/[id]/page.tsx` |
| `/consultation-cases` | `src/app/consultation-cases/page.tsx` |
| `/consultation-request` | `src/app/consultation-request/page.tsx` |
| `/dashboard` | `src/app/dashboard/page.tsx` |
| `/dashboard/profile` | `src/app/dashboard/profile/page.tsx` |
| `/dashboard/job-tracking` | `src/app/dashboard/job-tracking/page.tsx` |
| `/for-companies` | `src/app/for-companies/page.tsx` |
| `/not-job-changing` | `src/app/not-job-changing/page.tsx` |
| `/profile/setup` | `src/app/profile/setup/page.tsx` |
| `/users/[id]` | `src/app/users/[id]/page.tsx` |

### 関連コンポーネントファイル (ページと同時削除が必要)

| ファイル | 役割 |
|---------|------|
| `src/app/companies/CompanyExplorer.tsx` | 旧企業一覧の Client コンポーネント |
| `src/app/companies/CompanySections.tsx` | 旧企業詳細のセクション群 |
| `src/app/companies/CompanyFilterBar.tsx` | 旧企業フィルター |
| `src/app/companies/list/CompanyListClient.tsx` | 旧企業一覧 Client |
| `src/app/consultation-cases/ConsultationCasesClient.tsx` | 旧相談事例 Client |

---

## このタスクで削除候補となるコンポーネント

削除する旧ページからのみ参照されているため、ページ削除後に合わせて削除できる:

- `src/components/Header.tsx` — 旧ページから **17 箇所**参照
- `src/components/Footer.tsx` — 旧ページから **15 箇所**参照
- `src/components/FavoriteButton.tsx` — `CompanyExplorer.tsx` から 1 箇所参照

---

## 検討すべき事項

1. **Google Search Console でインデックス状況確認**
   - 上記 URL が Google にインデックスされているか確認
   - インデックスされている場合はリダイレクト or noindex 対応が必要

2. **Vercel アクセスログでトラフィック確認**
   - 実際にアクセスのあるページかどうかを確認
   - ゼロトラフィックなら単純削除でよい

3. **各旧ページに残しておくべきコンテンツがあるか**
   - `/consultation-cases` — 相談事例コンテンツが残っている可能性
   - `/for-companies` — 採用担当者向けランディングページ (現在も価値あり?)

4. **削除する場合のリダイレクト戦略**
   - `vercel.json` の `redirects` 設定
   - または `next.config.ts` の `redirects()` 関数

---

## 推奨アクション

Phase α 完了後、Phase γ (個別画面磨き込み) の前に判断する。

**最小限の対応**: トラフィックゼロを確認してから単純削除  
**丁寧な対応**: リダイレクト設定 → 削除 → Search Console で削除リクエスト

---

## 関連

- Phase α Step 3a 完了レポート (2026-05-01)
- `docs/styling-conventions.md` — Step 3a で確立したコンポーネント整理方針
