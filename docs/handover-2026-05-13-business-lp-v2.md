# Handover: Business LP v2（戦略修正版）

実装日: 2026-05-13  
commit: 194bfa6  
仕様書: docs/spec-2026-05-13-business-lp-v2.md

---

## 1. 変更の目的

v1 LP は「人材紹介事業者」としての訴求が中心だったが、方針修正により以下に変更:

- 「人材紹介」という表現を**完全に廃止**
- 「キャリアコンサルタント国家資格」「ICF 国際コーチング認定」も**全削除**
- 差別化軸を「メンター介在 × IT業界職経ユーザー」に絞る
- ヘッダーを JobseekerHeader（求職者向け）から **BusinessHeader（企業向け専用）** に差し替え

---

## 2. 新規作成ファイル

### `src/components/business/BusinessHeader.tsx`

企業向け LP 専用ヘッダー。JobseekerHeader とは完全に別コンポーネント。

| 要素 | 内容 |
|------|------|
| ロゴ | 「Opinio」+ 「Business」サブバッジ（inline） |
| デスクトップナビ | サービス(`#features`) / 料金(`#pricing`) / 実績(`#results`) / FAQ(`#faq`) |
| 「個人の方へ →」 | `/` へのリンク |
| ログイン | `/biz/auth` |
| 企業を新規登録 | `/biz/companies/add/new/` CTA ボタン |
| モバイル | ハンバーガーメニュー + フルドロワー |
| 認証状態管理 | **なし**（LP ヘッダーのため不要） |

---

## 3. 変更ファイル

### `src/app/business/page.tsx`

#### 3.1 ヘッダー差し替え
```diff
- import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
+ import { BusinessHeader } from "@/components/business/BusinessHeader";

- <JobseekerHeader />
+ <BusinessHeader />
```

#### 3.2 アンカー ID 追加

| セクション | 追加した ID |
|-----------|-------------|
| Section 2（料金比較） | `id="pricing"` |
| Section 4（差別化） | `id="features"` |
| Section 4 内 統計ブロック | `id="results"` |
| Section 7（FAQ） | `id="faq"` |

ヘッダーナビのアンカーリンクが正しく動作するようにするため。

#### 3.3 Section 4 全面書き換え

**v1（削除）:**
- 見出し: 「人材紹介事業の実績」
- 本文: 「Opinio は単なる求人媒体ではありません。キャリアコンサルタント国家資格と ICF 国際コーチング認定を持つ代表自身が...」
- 統計ラベル: 「取引企業」「マッチング実績」「早期離職（創業以来）」

**v2（新設）:**
- 見出し: 「なぜ採用ミスマッチが起きないのか？」
- サブセクション1: 🤝 **メンターが間に立つから** — 応募前メンター面談制度の説明
- サブセクション2: 💼 **IT 業界職経ありユーザーが中心** — 即戦力人材の説明
- 統計ブロック「Opinio が選ばれる理由」:
  - `120社+` → IT/SaaS企業が活用中
  - `200名+` → キャリア意思決定をサポート
  - `99%+`  → 早期離職率を業界平均より大幅に下回る※

#### 3.4 FAQ 修正

**Q3 修正（削除した記述）:**
```diff
- 人材紹介サービスのご利用は任意です。
```

**Q7 新規追加:**
```
Q. メンターとはどんな存在ですか？
A. IT 業界で経験を積んだプロフェッショナルです。候補者の方々は応募前にメンターと面談し、
   キャリアの方向性や企業選びについてアドバイスを受けます。
   これにより「本気度の高い応募」だけが企業に届きます。
```

#### 3.5 metadata description 修正

```diff
- "...人材紹介120社・200名・早期離職ゼロの実績。"
+ "...メンター介在で採用ミスマッチを構造的に防ぐ。"
```

---

## 4. 削除された表現（全件）

| 削除した表現 | 場所 |
|------------|------|
| 「人材紹介事業の実績」 | Section 4 見出し |
| 「Opinio は単なる求人媒体ではありません」 | Section 4 本文 |
| 「キャリアコンサルタント国家資格」 | Section 4 本文 |
| 「ICF 国際コーチング認定」 | Section 4 本文 |
| 「人材紹介サービスのご利用は任意です。」 | FAQ Q3 本文 |
| 「人材紹介120社」 | metadata description |

---

## 5. 完了条件チェック

- [x] BusinessHeader.tsx 新規作成
- [x] /business ページが BusinessHeader を使用
- [x] Section 4 が「なぜミスマッチが起きないのか」に置き換わっている
- [x] 「人材紹介」「キャリアコンサルタント」「ICF」の記述が全て削除
- [x] FAQ に Q7（メンターについて）が追加
- [x] npm run build 通過（✓ Compiled successfully、75 pages）
- [x] git push origin main 実行済み（commit 194bfa6）
- [ ] Vercel ● Ready 確認（push 後 ~2分で完了予定）
- [ ] モバイル / デスクトップ両方で表示確認

---

**作成者**: Claude Code  
**作成日**: 2026-05-13
