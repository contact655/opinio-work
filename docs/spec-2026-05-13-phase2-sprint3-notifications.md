# Phase 2 Sprint 3 仕様書: 通知メール実装

**作成日**: 2026-05-13
**作成者**: Claude（戦略・設計伴走役）
**前提**: `docs/research-2026-05-13-sprint3-pre.md` の調査結果
**位置付け**: Phase 2 の北極星（招待型オンボーディング）を完成させる最後のピース

---

## 1. Sprint 3 の戦略的意義

朝のセッションで確定した北極星：

> Wantedly 型セルフサーブ、運営審査なし、招待型のみ

この北極星を構成する3要素のうち：
- ✅ Sprint 1: API（POST /api/biz/companies など）完成
- ✅ Sprint 2: UI（/biz/companies/add/new/ など）完成
- 🔴 **Sprint 3: 招待メールの実装** ← ここを完成させて初めて「招待型」が動く

**Sprint 3 を完成させなければ、朝の戦略判断は実体化しない。**

---

## 2. 実装スコープ

### 2.1 実装する3つの機能

| # | 機能 | 重要度 | 工数 |
|---|---|---|---|
| 1 | 招待メールテンプレート追加 | 🔴 高 | 小 |
| 2 | /api/biz/members/invite にメール送信処理を追加 | 🔴 高 | 小 |
| 3 | /biz/members UI を /api/biz/members/invite を呼ぶよう修正 | 🔴 高 | 小 |
| 4 | 新規企業作成時の運営通知メール | 中 | 小 |

### 2.2 Sprint 4 以降に回すもの

- 既存の旧パターン（RESEND_fromEmail / onboarding@resend.dev）を lib/notify/ に統一（技術負債解消）
- ow_notifications テーブル + アプリ内通知バッジ
- メール送信のリトライ・キュー機構

---

## 3. 機能1: 招待メールテンプレート

### 3.1 配置先

`src/lib/notify/templates.ts` に新規テンプレート関数を追加。

### 3.2 関数シグネチャ

```typescript
export function companyInviteTemplate(params: {
  recipientEmail: string;
  inviterName: string;        // 招待した人の名前（例: 田中太郎）
  companyName: string;        // 招待先企業名（例: Sansan株式会社）
  companyLogoUrl?: string;    // 任意
  inviteUrl: string;          // 招待リンク（トークン付き）
  roleLabel?: string;         // 任意（例: "採用担当として"）
}): EmailPayload
```

### 3.3 メール件名

```
{companyName} の採用担当として招待されました - Opinio Work
```

例: 「Sansan株式会社 の採用担当として招待されました - Opinio Work」

### 3.4 メール本文（プレーンテキスト）

```
{recipientEmail} 様

{inviterName} さんから、Opinio Work で {companyName} の採用担当として招待されました。

下記リンクから招待を受諾してください。
{inviteUrl}

このリンクは24時間有効です（※有効期限の運用は既存実装に従う）。

Opinio Work について
Opinio Work は、キャリアに関わる組織と人を繋ぐ無料の採用プラットフォームです。

---
このメールに心当たりがない場合は、無視してください。
Opinio Work
https://opinio.jp
```

### 3.5 HTML 版

既存の他テンプレート（templates.ts 内）のスタイルに合わせる。具体的には：
- ロゴ表示（companyLogoUrl があれば）
- ボタン形式の招待受諾リンク
- フッターに opinio.jp へのリンク

実装時は、templates.ts 内の既存テンプレート関数を参考に同じパターンで作成。

---

## 4. 機能2: /api/biz/members/invite にメール送信処理を追加

### 4.1 現状

調査レポートより：
> `/api/biz/members/invite` はトークンを生成して invite_url を返すだけで、メールは一切送信していない。

### 4.2 変更内容

現在のエンドポイント実装に以下を追加：

```typescript
// 既存処理: トークン生成、DB保存、invite_url 生成

// === 追加部分 ===
import { notify } from '@/lib/notify/email';
import { companyInviteTemplate } from '@/lib/notify/templates';

// 招待者の情報を取得
const { data: inviter } = await supabase
  .from('ow_users')
  .select('display_name, email')
  .eq('id', inviterUserId)
  .single();

// 企業情報を取得
const { data: company } = await supabase
  .from('ow_companies')
  .select('name, logo_url')
  .eq('id', companyId)
  .single();

// メール送信
await notify(companyInviteTemplate({
  recipientEmail: invitedEmail,
  inviterName: inviter?.display_name ?? '採用担当者',
  companyName: company?.name ?? '企業',
  companyLogoUrl: company?.logo_url ?? undefined,
  inviteUrl: invite_url,
}));
// === 追加ここまで ===

// 既存のレスポンス処理
return NextResponse.json({ invite_url, ... });
```

### 4.3 エラーハンドリング

- メール送信失敗時もトークン発行は成功扱い（招待リンクは別途共有可能）
- ログに記録して運営が後追い可能にする
- レスポンスには `email_sent: true/false` フラグを含める

```typescript
let emailSent = false;
try {
  await notify(companyInviteTemplate({...}));
  emailSent = true;
} catch (err) {
  console.error('Failed to send invite email:', err);
  // 招待自体は成立しているので、エラーレスポンスにはしない
}

return NextResponse.json({ invite_url, email_sent: emailSent });
```

---

## 5. 機能3: /biz/members UI の改修

### 5.1 現状（調査レポートより）

> 現在の /biz/members UI は /api/biz/members/invite すら呼んでいない（既存ユーザーのみ追加できる /api/biz/members を使用）。

つまり、UI は「既にOpinioにアカウントある人だけ追加」する設計になっている。

### 5.2 改修方針

**2つの動線を /biz/members で両立させる**：

```
[メンバーを追加] ボタン
  ↓
入力フォーム
  メールアドレスを入力: [           ]
  ↓ システムが自動判定（既存ユーザー検索）
  
  パターンA: アカウント既存
    → 「{name} さんを追加します」
    → 「追加」ボタン押下
    → /api/biz/members を呼ぶ（既存実装）
    → 即座にメンバー追加完了
    
  パターンB: アカウント未登録
    → 「{email} は未登録です。招待メールを送信します」
    → 「招待を送信」ボタン押下
    → /api/biz/members/invite を呼ぶ
    → 招待メール送信、相手がリンククリックで参加
```

### 5.3 UI の判断ポイント

- メールアドレス入力時にデバウンス（500ms程度）で自動検索
- 検索結果に応じて表示メッセージとボタンラベルを動的に変える
- 既存ユーザー検索 API があるか確認（なければ /api/biz/members/invite に統一して常に招待型でも可）

### 5.4 シンプル版（実装軽量化を優先する場合）

複雑な分岐を避けたい場合は、**常に /api/biz/members/invite で統一**してもよい：

- 既存ユーザーでも招待メールが届く → リンクをクリックすると自動でログイン状態を検知 → 即受諾
- 未登録ユーザーは招待メールからアカウント作成 → 受諾

このシンプル版なら UI 変更は最小限。「招待を送信」ボタン1つでよい。

**Claude Code に判断を委ねる**: 既存実装の使い分けを見て、どちらが既存パターンに馴染むかで決める。

---

## 6. 機能4: 新規企業作成時の運営通知メール

### 6.1 トリガー

`POST /api/biz/companies`（Sprint 1 で実装済み）が成功した時。

### 6.2 送信内容

**送信先**: ADMIN_EMAIL 環境変数の値（Hisato のメール）

**件名**:
```
[Opinio Work] 新規企業が登録されました: {companyName}
```

**本文**:
```
新しい企業が Opinio Work に登録されました。

企業名: {companyName}
作成者: {creatorName} ({creatorEmail})
ID: {companyId}
ステータス: draft
作成日時: {createdAt}

管理画面で詳細を確認:
https://opinio.jp/admin/companies/{companyId}

---
これは Opinio Work の自動通知です。
```

### 6.3 テンプレート

`src/lib/notify/templates.ts` に追加：

```typescript
export function newCompanyAdminTemplate(params: {
  companyName: string;
  companyId: string;
  creatorName: string;
  creatorEmail: string;
  createdAt: string;
}): EmailPayload
```

### 6.4 API への組み込み

`src/app/api/biz/companies/route.ts` の POST 処理の最後に追加：

```typescript
// 既存: INSERT 成功後

// 運営通知
try {
  await notify(newCompanyAdminTemplate({
    companyName: company.name,
    companyId: company.id,
    creatorName: creator.display_name ?? '名前未設定',
    creatorEmail: creator.email,
    createdAt: new Date().toISOString(),
  }));
} catch (err) {
  console.error('Failed to send admin notification:', err);
  // 通知失敗は企業作成成功を妨げない
}

return NextResponse.json({ company, redirect_to });
```

### 6.5 force_create 時の扱い

仕様書 §6.1 で定めた `force_create:true`（重複承知で別法人として作成）の場合、件名にフラグを追加：

```
[Opinio Work] [重複承知] 新規企業が登録されました: {companyName}
```

本文にも「同名企業が既に存在する状態で、ユーザーが意図的に別法人として作成しました」と追記。これにより運営が事後巡回で表記ゆれ統合を判断しやすくなる。

---

## 7. 実装の順序

### Sub-Sprint 3.1: テンプレート追加
1. `templates.ts` に `companyInviteTemplate` を追加
2. `templates.ts` に `newCompanyAdminTemplate` を追加
3. ローカルで `npm run build` 確認

### Sub-Sprint 3.2: 招待メール送信
4. `/api/biz/members/invite` にメール送信処理を追加
5. ローカルで `npm run build` 確認

### Sub-Sprint 3.3: 運営通知メール
6. `/api/biz/companies` に運営通知処理を追加
7. ローカルで `npm run build` 確認

### Sub-Sprint 3.4: UI 改修
8. `/biz/members` UI を改修（招待動線を組み込む）
9. ローカルで `npm run build` 確認

### Sub-Sprint 3.5: 統合・確認
10. 全体コミット、push
11. Vercel deployments の ● Ready 確認
12. ハンドオフ文書作成: `docs/handover-2026-05-13-phase2-sprint3.md`

---

## 8. テストシナリオ

### シナリオ1: 既存ユーザーの招待
1. 田中さん（Sansan の admin）が /biz/members で鈴木さんのメールアドレスを入力
2. 鈴木さんは既に Opinio アカウント保有
3. 鈴木さんに招待メールが届く
4. 「招待を受諾」ボタンクリック → ログイン状態 → /biz/dashboard に遷移
5. 鈴木さんが Sansan の admin になっている

### シナリオ2: 未登録ユーザーの招待
1. 田中さんが /biz/members で木村さん（未登録）のメールアドレスを入力
2. 招待メールが木村さんに届く
3. 「招待を受諾」ボタンクリック → サインアップ画面
4. アカウント作成 → 自動で Sansan admin として登録

### シナリオ3: 新規企業作成の運営通知
1. 田中さんが /biz/companies/add/new/ で「ABC商事」を新規作成
2. ADMIN_EMAIL（Hisato）に通知メールが届く
3. メール内のリンクから /admin/companies/{id} を開ける
4. 必要なら運営側で確認・kick できる

### シナリオ4: force_create の運営通知
1. 田中さんが「Sansan」と入力 → 既存企業を選ばず「別法人として作成」
2. ADMIN_EMAIL に件名「[重複承知] 新規企業が登録されました: Sansan」のメールが届く
3. 運営が表記ゆれの可能性を確認し、必要なら統合作業を行う

---

## 9. 動作確認方法

### 9.1 ローカル開発時
- RESEND_API_KEY が未設定なので、console.log でメール内容が確認できる
- ターミナルにメール内容（件名・本文・宛先）が出力される

### 9.2 本番デプロイ後
- Vercel の Production 環境に RESEND_API_KEY 設定済み
- 実際にメールが送信される
- Resend のダッシュボード（https://resend.com）で送信履歴を確認可能

### 9.3 確認用テストアカウント
- 招待元: contact+biz002@opinio.co.jp
- 招待先（既存）: contact+biz003@opinio.co.jp 等
- 招待先（新規）: 適当な未登録メールアドレス

---

## 10. 完了条件

- [ ] `npm run build` が通る
- [ ] Vercel deployments の ● Ready 確認
- [ ] Resend ダッシュボードでメール送信ログを確認できる
- [ ] テストシナリオ1〜4 すべてが本番環境で動作
- [ ] ハンドオフ文書（docs/handover-2026-05-13-phase2-sprint3.md）作成

---

## 11. リスクと対策

| リスク | 対策 |
|---|---|
| Resend のレート制限 | 当面はユーザー数が少ないので問題なし。Phase 3 で監視機構検討 |
| 招待メールがスパム判定される | RESEND_FROM_EMAIL に opinio.jp ドメイン使用、SPF/DKIM 確認 |
| 運営通知が大量に届く | 当面は新規企業作成頻度が低いので問題なし。多くなったら日次サマリに切替 |
| 既存ユーザーが招待リンクをクリックしてもログイン誘導されない | 招待受諾エンドポイントの実装を確認、必要なら改修 |

---

## 12. Sprint 3 の戦略的価値

Sprint 3 を完成させると、Opinio Work は以下の状態になる：

- ✅ 朝の北極星「Wantedly 型セルフサーブ、招待型」が**完全に動作**
- ✅ 運営（Hisato）は新規企業作成をメールでリアルタイム監視可能
- ✅ 採用担当者は招待リンクをコピペすることなく、メール送信ボタンで完結
- ✅ 受諾率の向上（コピペでの手動シェアより、メール受信の方が UX 高い）

これにより、Phase 2（オンボーディング）が**真の意味で完成**する。

---

**仕様書ここまで**
