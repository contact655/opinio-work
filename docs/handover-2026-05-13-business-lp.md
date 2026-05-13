# Handover: 企業向け LP 実装

実装日: 2026-05-13  
担当: Claude Code（柴ディレクション）  
関連spec: docs/spec-2026-05-13-business-lp.md  
commit: 11d41cc

---

## 1. 実装サマリ

`/for-companies` を仕様書8セクション構成で全面書き換え。  
`npm run build` → `✓ Compiled successfully` 確認済み。

---

## 2. URL 選定

**採用 URL**: `/for-companies`（既存ルート）

既存の `src/app/for-companies/` を発見済みだったため、新規 URL 作成は不要。  
旧ページ（旧 `Header.tsx` + 旧 `Footer.tsx` 使用、260行）を全面書き換えた。

`/business` も候補だったが:
- `/for-companies` はすでに `JobseekerFooter` の「企業の方」欄から `/for-companies` へのリンクが存在していた
- 既存ルートを活用することで外部リンク・ブックマークの互換性を保持

---

## 3. 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app/for-companies/page.tsx` | 260行 → 480行（全面書き換え） |
| `src/components/jobseeker/JobseekerHeader.tsx` | 未ログイン時に「採用担当の方はこちら →」リンク追加 |

**変更なし**:
- `src/components/jobseeker/JobseekerFooter.tsx` — 既存の「企業の方 > 掲載について → /for-companies」リンクが既にあったため変更不要

---

## 4. ページ構成（8セクション）

| # | セクション | 内容 |
|---|-----------|------|
| S1 | Hero | 「採用コスト、ゼロから。」大見出し + 3チェック + CTA |
| S2 | 料金比較表 | 匿名他社 3例との比較（モバイル横スクロール対応） |
| S3 | 3ステップ | 登録→掲載→入社決定時のみ請求 |
| S4 | 実績 | 120社+/200名+/早期離職ゼロ + 品質訴求文 |
| S5 | ターゲット | 適合/不適合の2カラム（正直表現、ミスマッチ防止） |
| S6 | ロゴ | テキスト名のみ（TODO: 許諾確認後に画像化） |
| S7 | FAQ | 6問（常時表示、アコーディオンなし） |
| S8 | 最終CTA | royal 背景 + 白ボタン |

---

## 5. 既存資産の活用

| 資産 | 活用状況 |
|------|---------|
| `JobseekerHeader` | ✅ 直接インポート（jobseeker layout 外のため） |
| `JobseekerFooter` | ✅ 直接インポート |
| CSS custom properties (`--royal`, `--line`, etc.) | ✅ 全セクションで使用 |
| `var(--font-noto-serif)` | ✅ 見出しで使用 |
| `'Inter', sans-serif` | ✅ 数字（実績）で使用 |
| `ui/ConfirmDialog`, `ui/Toast` | 不使用（静的ページのため不要） |

**既存コンポーネントを新規作成しなかった理由**:  
LP は単発ページのため、ファイル内にサブコンポーネント（`CtaButton`, `FaqItem` 等）を定義してローカル化した。  
再利用が必要になった段階で `src/components/` に切り出す設計。

---

## 6. ヘッダー動線

```typescript
// JobseekerHeader.tsx — 未ログイン時のみ表示
<Link href="/for-companies" style={{ fontSize: 12, color: "var(--ink-mute)", ... }}>
  採用担当の方はこちら →
</Link>
```

- 配置: ログイン/無料登録ボタンの左隣
- サイズ: `12px`（ログインボタン `13px` より小さく、控えめ）
- 色: `var(--ink-mute)` — 求職者体験を損なわない最小限の訴求
- ログイン済み時: 非表示（採用担当は `/biz/dashboard` から直接アクセスするため不要）

---

## 7. 表示確認方法

### ローカル確認
```bash
npm run dev
# → http://localhost:3000/for-companies
```

### デスクトップ確認項目
- [ ] Hero: 「採用コスト、ゼロから。」が serif 大見出しで表示
- [ ] 比較表: 5カラムが正常に表示される
- [ ] 実績: ダーク背景に3カラムの数字
- [ ] FAQ: 6問が全て表示
- [ ] 最終 CTA: royal 背景 → 白ボタン「企業を新規登録（無料）」
- [ ] CTA リンク先: `/biz/companies/add/new/` に遷移

### モバイル確認項目
- [ ] 比較表: 横スクロールで全カラムが読める
- [ ] 実績3カラム: `auto-fit minmax(180px, 1fr)` で 1〜3カラムに自動調整
- [ ] 各セクション: `clamp()` でフォントサイズが適切に縮小される
- [ ] ヘッダー動線: 「採用担当の方はこちら →」が表示される（未ログイン時）

---

## 8. 残課題（TODO）

| 項目 | 優先度 | 担当 |
|------|--------|------|
| S6 ロゴ: Sansan, freee, MoneyForward 等の許諾確認後に画像化 | 中 | 柴さん確認後 |
| サービス資料 PDF の作成 → CTA に DL リンク追加 | 低（Phase 3） | 後日 |
| 採用担当向けイベント告知欄 | 低（Phase 3） | 後日 |
| `/about` `/industries` の 404 修正（別件） | 中 | 別タスク |

---

## 9. 仕様書との照合

| 仕様書要件 | 対応状況 |
|-----------|---------|
| 競合の実名なし（§3.2） | ✅「他社例 A/B/C」の匿名表現 |
| 「返金保証」なし | ✅ 未記載 |
| コスト最前面（§1.3） | ✅ Hero が料金訴求、比較表が S2 |
| モバイル対応（§7.3） | ✅ clamp + auto-fit + overflow scroll |
| 北極星整合（§10） | ✅ 掲載無料・成果報酬・セルフサーブ・意思決定インフラ |

---

**フェーズ: Phase 2 企業向け LP 完了**  
作成者: Claude Code + 柴久人  
作成日: 2026-05-13
