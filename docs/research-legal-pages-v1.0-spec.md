# Opinio Work 規約v1.0公開 実装仕様書

**作成日**: 2026-05-20
**対象**: Claude Code
**作成**: Opus 4.7 (Hisato 議論ベース)
**ステータス**: 実装待ち

---

## 1. 目的・スコープ

### 目的
弁護士レビュー完了済みの規約3本を、Opinio Work（自社ドメイン）配下に静的ページとして公開する。

### 公開する規約
1. **求職者向け利用規約** v1.0
2. **メンター向け利用規約** v1.0
3. **プライバシーポリシー** v1.0

### スコープ外
- **企業向け利用規約**: ビジネスモデル設計（料金体系）の議論を経てから別日に公開。今日は公開しない。

### 制定日・施行日
- 2026年5月20日（公開と同時に施行）

---

## 2. ルート設計

| ルート | 内容 | ファイル |
|---|---|---|
| `/terms` | 求職者向け利用規約 | `src/app/terms/page.tsx` |
| `/mentor-terms` | メンター向け利用規約 | `src/app/mentor-terms/page.tsx` |
| `/privacy` | プライバシーポリシー | `src/app/privacy/page.tsx` |

**留意**:
- 企業向け規約 `/business-terms` は**今日は実装しない**
- Next.js (App Router) 前提

**確認すべきこと（実装前に）**:
- `ls src/app/` で既存ルート確認（運用ルール#4）
- `terms`, `privacy`, `mentor-terms` の各ルートが既に存在しないこと
- 既に存在する場合は内容を確認し、Hisatoに報告

---

## 3. ファイル配置

```
content/
  legal/
    terms-of-service-jobseeker.md   # 求職者向け規約 v1.0
    terms-of-service-mentor.md      # メンター向け規約 v1.0
    privacy-policy.md               # プライバシーポリシー v1.0
```

**Markdown ファイルとしてリポジトリに含める**。git で改訂履歴を管理する。

**ファイル名は v0.x のサフィックスを付けない**。バージョン管理はファイル冒頭のメタデータと git 履歴で管理。

---

## 4. コンテンツ生成ルール

### 4.1 元ファイル
ローカルにアップロード済み：
- `/mnt/user-data/uploads/terms-of-service-jobseeker-v0_2.md`
- `/mnt/user-data/uploads/terms-of-service-mentor-v0_2.md`
- `/mnt/user-data/uploads/privacy-policy-v0_2.md`

### 4.2 v0.2 → v1.0 変換ルール

各ファイルに対して以下を実施：

#### (1) ヘッダー部分の刷新

**削除**:
```markdown
**版**: 弁護士レビュー前提のたたき台 v0.2
**作成日**: 2026-05-17 (v0.1: 2026-05-16)
**作成**: Claude(株式会社 Opinio 内部利用)
**ステータス**: 弁護士レビュー未実施

---

## 【v0.1からの主な変更点】

[全項目]

---

## 【弁護士レビューに向けた注意書き】

[全項目]

---
```

**残す（変更後）**:
```markdown
# [文書タイトル]

**版**: v1.0
**制定日**: 2026年5月20日
**施行日**: 2026年5月20日
**最終改定日**: 2026年5月20日

---
```

#### (2) 本文内の【弁護士確認事項】を削除

各条項の末尾（または途中）にある「**【弁護士確認事項】** …」と書かれた段落を、**段落単位で削除**する。

該当箇所例：
- 求職者向け規約 第5条第4項末尾
- 求職者向け規約 第8条第3項末尾
- 求職者向け規約 第12条第4項
- 求職者向け規約 第15条第4項
- 求職者向け規約 末尾の「【職業安定法第32条の13に基づく明示事項】」セクション冒頭の【弁護士確認事項】

- メンター向け規約 第3条第3項末尾
- メンター向け規約 第4条第8項
- メンター向け規約 第5条第3項末尾
- メンター向け規約 第6条第4項
- メンター向け規約 第8条第3項末尾
- メンター向け規約 第14条第5項
- メンター向け規約 第19条第4項

- プライバシーポリシー 第5条第3項
- プライバシーポリシー 第7条第4項
- プライバシーポリシー 第8条第4項
- プライバシーポリシー 第12条第3項
- プライバシーポリシー 第13条第3項
- プライバシーポリシー 第14条第3項

**重要**: 各条項の項番（第N項）が連番でなくなる箇所が出る場合は、**項番を再採番**する。

#### (3) 文末の【弁護士レビュー前提の論点リスト】セクションを削除

各文書の末尾に付いている `## 【弁護士レビュー前提の論点リスト】` 以降のセクション全体を削除する。

#### (4) 空欄の埋め込み

| Placeholder | 確定値 | 該当箇所 |
|---|---|---|
| `[本社所在地]` または `[詳細住所]` | `2-21-4 天翔赤坂ANNEXビル 404-C` | 全文書の事業者表記、明示事項リスト |
| `[代表者名]` または `[代表者を記載]` | `柴 久人` | 全文書 |
| `[氏名・連絡先]`（個人情報保護管理者） | `当社代表取締役` | プライバシーポリシー |
| `[営業日・営業時間]` | `平日10:00〜18:00` | プライバシーポリシー第11条第4項 |
| `[公開日]`（制定日） | `2026年5月20日` | 全文書 |
| `[最終改定日]` | `2026年5月20日` | 全文書 |
| `[X 年間]`（アカウント情報保存期間） | `2年間` | プライバシーポリシー第13条 |
| `[Y 年間]`（対話情報保存期間） | `2年間` | プライバシーポリシー第13条 |
| `[Z 年間]`（利用履歴保存期間） | `2年間` | プライバシーポリシー第13条 |
| `[連絡先を記載]` | `contact@opinio.co.jp` | 求職者向け規約 明示事項リスト |
| `[苦情処理窓口を記載]` | `contact@opinio.co.jp` | 求職者向け規約 明示事項リスト |

#### (5) 文書の品質確認

変換後、以下の文字列が**文書内に残っていないことを確認**：
- `[` で囲まれた未確定プレースホルダ
- `弁護士確認事項`
- `弁護士レビュー`
- `たたき台`
- `v0.1`, `v0.2`（バージョン番号として）

検索コマンド例：
```bash
grep -n '\[.*\]\|弁護士\|たたき台\|v0\.' content/legal/*.md
```

検出された全項目を Hisato に報告し、確認をとった上で対応する。

---

## 5. レンダリングコンポーネント設計

### 5.1 共通レイアウトコンポーネント

`src/components/legal/LegalDocument.tsx` を作成：

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LegalDocumentProps {
  title: string;
  content: string;
}

export function LegalDocument({ title, content }: LegalDocumentProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </article>
    </main>
  );
}
```

**ポイント**:
- Tailwind の `prose` クラスで自動的に見出し・段落・リストがスタイリングされる
- `max-w-3xl` で読みやすい幅に制限
- `remark-gfm` で GFM（テーブル、取り消し線、タスクリスト等）対応

### 5.2 各規約ページの実装

例：`src/app/terms/page.tsx`

```tsx
import fs from 'fs';
import path from 'path';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '利用規約 | Opinio Work',
  description: 'Opinio Work の利用規約（求職者向け）',
};

export default function TermsPage() {
  const filePath = path.join(process.cwd(), 'content/legal/terms-of-service-jobseeker.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return <LegalDocument title="利用規約" content={content} />;
}
```

**ポイント**:
- ファイル読み込みはサーバーサイドで完結（SSG）
- 各規約ごとに同じパターンで作成

### 5.3 既存UIコンポーネント確認

実装前に確認：
```bash
ls src/components/ui/
```

`prose` 系のスタイルや legal ページ用の既存コンポーネントがないか確認。

---

## 6. 依存パッケージ追加

```bash
npm install react-markdown remark-gfm
npm install -D @tailwindcss/typography  # prose クラスを使うため（未導入の場合）
```

`tailwind.config.ts` （または `.js`）に追加：

```typescript
plugins: [
  require('@tailwindcss/typography'),
  // ... existing plugins
],
```

**確認**: 既に `@tailwindcss/typography` が導入されているか確認してから追加する。

---

## 7. フッターリンク更新

`src/components/Footer.tsx` （または該当ファイル）に以下のリンクを追加：

```tsx
<div>
  <h3>法的情報</h3>
  <ul>
    <li><Link href="/terms">利用規約</Link></li>
    <li><Link href="/mentor-terms">メンター向け利用規約</Link></li>
    <li><Link href="/privacy">プライバシーポリシー</Link></li>
  </ul>
</div>
```

**重要**:
- **企業向け規約のリンクは追加しない**（未公開のため）
- 既存のフッター構造を確認し、適切なセクションに統合
- 既に「利用規約」「プライバシーポリシー」のリンクがプレースホルダで存在する場合は、それらの href を更新する

---

## 8. その他参照箇所の更新

以下の動線も確認・更新：

### サインアップフロー（求職者）
- 求職者登録時の「利用規約に同意する」チェックボックスのリンク先
- 「プライバシーポリシーに同意する」のリンク先

### サインアップフロー（メンター・将来）
- メンター登録ページが存在する場合、「メンター向け利用規約に同意する」のリンク先

### 企業登録フロー
- **今日の時点では更新しない**（企業向け規約が未公開のため）
- 既存フローに「企業向け規約に同意する」が存在する場合、リンクをコメントアウト or プレースホルダ化

### `/career-consultation` 関連
- 5/19の引き継ぎ書で発見されたメイン導線ページ
- メンター相談申込フローに「メンター向け利用規約への同意」が必要か検討
- **今日は触らない**（別議論で判断）

**確認方法**:
```bash
grep -rn "利用規約\|プライバシーポリシー\|terms\|privacy" src/app src/components --include="*.tsx" --include="*.ts"
```

---

## 9. SEO 設定

各ページの metadata に以下を設定済み：
- `title`
- `description`

追加で検討：
- `robots: { index: true, follow: true }`（規約は検索エンジンにインデックスされて問題ない）

---

## 10. 検証チェックリスト

### ローカルでの確認
- [ ] `npm run build` がエラーなく完走する（運用ルール#1）
- [ ] `/terms`, `/mentor-terms`, `/privacy` の3ページが正しくレンダリングされる
- [ ] 見出し・リスト・テーブル・段落のスタイルが prose で正しく適用されている
- [ ] モバイル表示で読みやすい
- [ ] フッターのリンクから各規約ページに遷移できる
- [ ] 各規約ページ内に「[ ]」「弁護士確認事項」「弁護士レビュー」「たたき台」「v0.x」が残っていない

### Hisatoによる目視確認
- [ ] 求職者向け規約 v1.0 の全文を読み、違和感がないこと
- [ ] メンター向け規約 v1.0 の全文を読み、違和感がないこと
- [ ] プライバシーポリシー v1.0 の全文を読み、違和感がないこと
- [ ] 事業者情報（所在地・代表者名等）が正しいこと
- [ ] 制定日・施行日が「2026年5月20日」になっていること

### 本番デプロイ
- [ ] `git push origin main` 実行（運用ルール#2、5/13に7コミット未push事故あり）
- [ ] Vercel deployments で新しいデプロイを commit hash で目視確認（運用ルール#3）
- [ ] 本番URLで3ページが200レスポンスを返すこと
- [ ] 本番のフッターから各規約に遷移できること

---

## 11. コミット粒度の推奨

```
1. content: 規約v1.0の3本のMarkdownファイルを追加
2. feat: react-markdown 依存追加 + tailwind typography 設定
3. feat: LegalDocument 共通レンダリングコンポーネント追加
4. feat(routes): /terms, /mentor-terms, /privacy ページ追加
5. feat(footer): 規約ページへのフッターリンク追加
6. chore: サインアップフロー等の規約参照リンクを更新
```

各コミットで `npm run build` を実行することを推奨。

---

## 12. このタスク完了後の更新

- [ ] handover-2026-05-20.md に「規約v1.0公開（3本）」を記録
- [ ] CLAUDE.md（プロジェクトルート）に規約ページのルートを記録
- [ ] 次回引き継ぎ書（5/21）に「企業向け規約は料金体系議論後に別日公開」を明記

---

## 13. 関連情報

### 事業者情報
- 法人名: 株式会社Opinio
- 本社所在地: 東京都港区赤坂2-21-4 天翔赤坂ANNEXビル 404-C
- 代表者: 代表取締役CEO 柴 久人
- 有料職業紹介事業許可番号: 13-ユ-316441
- 連絡窓口メールアドレス: contact@opinio.co.jp（一般・苦情）
- プライバシー窓口: privacy@opinio.co.jp
- メンター窓口: mentor@opinio.co.jp

### 関連ドキュメント
- `/mnt/user-data/uploads/CHANGELOG-v0_1-to-v0_2.md`: v0.2 への変更履歴（参考）
- `/mnt/user-data/uploads/handover-2026-05-20.md`: 5/20 の引き継ぎ書

### 残課題（企業向け規約関連）
- 企業向け規約 v1.0 公開は別日
- 料金体系（成果報酬モデル）の戦略議論を経てから
- 料金体系の選択肢: (A) 業界標準 30〜35% / (B) 一律固定額 / (C) ハイブリッド
- メモリの北極星「年収30〜35%」と一律固定額モデルの整合性を要議論

---

**End of SPEC**
