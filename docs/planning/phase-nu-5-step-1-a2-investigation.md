# Phase ν-5 A-2 調査レポート — 候補者側 UI 系統分断の現状把握

作成日: 2026-05-08  
調査対象: `/mypage` 系と `/biz` 系の UI 分断  
調査ファイル一覧: 下記 §1 参照

---

## 1. 調査ファイル一覧

| ファイル | 系統 | 種別 |
|---------|------|------|
| `src/app/(jobseeker)/layout.tsx` | 候補者共通 | Server Component（ラッパー） |
| `src/app/(jobseeker)/mypage/page.tsx` | 系統 A | Server Component（認証ガード） |
| `src/app/(jobseeker)/mypage/MypageClient.tsx` | 系統 A | Client Component（メイン UI） |
| `src/app/(jobseeker)/mypage/conversations/page.tsx` | 系統 B | Client Component |
| `src/app/(jobseeker)/mypage/conversations/[id]/page.tsx` | 系統 B | Client Component |
| `src/app/(jobseeker)/mypage/applications/page.tsx` | 系統 B | Client Component |
| `src/components/jobseeker/JobseekerHeader.tsx` | 候補者共通 | Client Component |
| `src/components/business/BusinessLayout.tsx` | /biz 系 | Client Component |
| `src/app/biz/conversations/page.tsx` | /biz 系 | Server Component |
| `src/app/biz/conversations/[id]/page.tsx` | /biz 系 | Server Component |

---

## 2. 系統の定義（調査で判明した構造）

### 2-1. 系統 A — `/mypage` ダッシュボード（MypageClient）

```
(jobseeker)/layout.tsx
  └─ JobseekerHeader（fixed top-0, 64px）
  └─ children
       └─ mypage/page.tsx（Server, 認証ガード）
            └─ MypageClient.tsx（Client, "use client"）
                 └─ sticky sidebar（top: 65px、= header 64px + 1px）
                      ← アイコン付き Nav + プロフィールエリア + 6ビュー切替
```

**デザイン**: インラインスタイル（CSS カスタムプロパティ）+ 一部 Tailwind。royal blue 基調。

### 2-2. 系統 B — `/mypage/conversations` + `/mypage/applications`

```
(jobseeker)/layout.tsx
  └─ JobseekerHeader（fixed top-0, 64px）
  └─ children
       └─ conversations/page.tsx（Client, "use client"）
            └─ <main className="min-h-screen bg-background">
                 └─ max-w-6xl mx-auto px-4 py-8 flex gap-6
                      ├─ aside w-[200px]（sticky top-24 = 96px）← ずれている
                      │    └─ SIDEBAR_ITEMS 5件（ハードコード、active は固定値）
                      └─ flex-1 コンテンツエリア
```

**デザイン**: Tailwind CSS クラスのみ（`bg-background`, `rounded-card`, `text-primary`等）。グレー基調。

### 2-3. /biz 系

```
BusinessLayout.tsx（Client, sticky topbar 57px + 240px sidebar）
  ├─ Topbar: Opinio Business ロゴ + CompanySwitcher + User menu（ChevronDown）
  └─ Sidebar: アイコン + ラベル Nav（royal blue active line）
       └─ children（Server Component）
```

**デザイン**: インラインスタイル（CSS カスタムプロパティ）一本化。royal blue 基調。

---

## 3. 系統 A/B/biz 対比表

| 観点 | 系統 A（/mypage ダッシュボード） | 系統 B（/mypage/conversations 等） | /biz 系 |
|------|----------------------------|---------------------------------|--------|
| **ヘッダー** | JobseekerHeader（64px fixed） | 同上 | BusinessLayout topbar（57px sticky） |
| **サイドバー幅** | ~240px（カスタム） | 200px | 240px |
| **サイドバー top 位置** | `top: 65px` | `top-24`（96px）← **ずれ** | `top: 57px` |
| **サイドバーナビ** | アイコン + ラベル + ビュー切替 | テキストのみ 5 項目（一部 `#` プレースホルダー） | アイコン + ラベル（展開あり） |
| **スタイル手法** | インライン + 一部 Tailwind | Tailwind のみ | インラインのみ |
| **カラーパレット** | CSS カスタムプロパティ（`--royal` 等） | Tailwind カスタム（`text-primary`, `bg-primary-light`） | CSS カスタムプロパティ（`--royal` 等） |
| **カードスタイル** | インライン `border-radius: 12`, `var(--line)` | `rounded-card border-card-border`（Tailwind） | インライン `borderRadius: 12`, `var(--line)` |
| **アバター形状** | 円（gradient + イニシャル） | 角丸正方形 `rounded-lg`（ロゴ表示） | 円（gradient + イニシャル） |
| **日時表示** | 相対時刻（N分前）| **絶対日付**（`toLocaleDateString`） | 相対時刻（N分前） |
| **コンポーネント種別** | Client（useCallback + useState） | Client（useCallback + useState） | Server（async/await） |
| **データフェッチ** | mock + Supabase 混在 | Supabase（getSession 経由） | Supabase（getUser、Server） |
| **ログアウト発見性** | 中程度（Header 内 User アイコン） | 同上（同一 JobseekerHeader） | 高（Avatar + ChevronDown A-1 適用済み） |

---

## 4. 特記事項: 系統 B の送信者識別（A-3 関連）

**`/mypage/conversations/[id]`（系統 B）はすでに送信者名を部分的に表示しています:**

```tsx
// /mypage/conversations/[id]/page.tsx line 303-304
{!isMe && (
  <span className="text-xs text-gray-500 px-1">{senderName}</span>
)}
```

- 他者のメッセージ: 送信者名あり（gray-500 テキスト）
- 自分のメッセージ: 送信者名なし（日時のみ）

**`/biz/conversations/[id]`（biz 系）は送信者名を一切表示していません。**  
→ A-3 は「/biz 側の実装が欠落」が主目的。/mypage 側は部分実装済み。

---

## 5. 統一の難易度評価

| 変更内容 | 難易度 | 理由 |
|---------|--------|------|
| 日時を相対表示に統一（絶対 → 相対） | ✅ 簡単 | `formatRelativeTime` 関数を /biz からコピーするだけ（~10 行） |
| カード hover スタイル統一（`hover:border-primary` → `var(--line)` 強調に） | ✅ 簡単 | className 1 項目変更 |
| サイドバーの `sticky top-24` を `top-20` 等に修正（ずれ解消） | ✅ 簡単 | 数値 1 箇所変更 |
| アバターを角丸正方形 → 円に統一（or 逆） | 🟡 中程度 | JSX 構造変更 + 候補者アバターの gradient 対応が必要 |
| SIDEBAR_ITEMS のプレースホルダー（`#`）をリアルリンクに整理 | 🟡 中程度 | リンク先の存在確認が必要（/onboarding 等） |
| スタイル手法の統一（Tailwind → インライン or 逆） | 🔴 困難 | 全 JSX 書き直し。混在は許容すべき |
| サイドバーを MypageClient 系統 A と揃える（アイコン追加） | 🔴 困難 | 系統 A は 6 ビュー切替という特殊構造で、B に適用しても過剰 |
| Server Component 化（Client → Server に変換） | 🔴 困難 | データフェッチロジック全面見直し。価値に対してコスト大 |

---

## 6. スコープ案 X / Y / Z

### 案 X: 全部統一（高コスト、3〜4 時間）

**スコープ:**
- `/mypage/conversations` と `/mypage/conversations/[id]` を Server Component 化
- スタイルをインライン（CSS カスタムプロパティ）に全面切り替え
- `JobseekerHeader` の User アイコンをイニシャル円 + 名前に改良
- SIDEBAR_ITEMS の整理（dead link 除去）

**メリット:** /biz と /mypage の見た目が一致する。将来の改修で「どちらの系統を見ればいいか」が明確になる。  
**デメリット:** Server Component 化の工数は大きい。/mypage はリアルタイム更新が必要な部分もあり、Client のほうが自然。スタイル手法の全面切り替えはリグレッションリスクが高い。

### 案 Y: 対話画面に絞る（中コスト、1.5〜2 時間）

**スコープ:**
- `/mypage/conversations/page.tsx`: 日時を相対表示に変更、カードデザイン微調整
- `/mypage/conversations/[id]/page.tsx`: メッセージバブルのカラーを royal blue 系に統一、ヘッダー部分を biz 側と近い見た目に
- SIDEBAR_ITEMS の dead link 整理（`#` → 適切な href or 削除）
- `JobseekerHeader` のログアウト発見性改善（ChevronDown 追加 or アイコン → イニシャル円化）

**メリット:** 「対話する場所」の見た目統一が最優先。候補者が「いつも同じ質感で対話できる」体験になる。コストと効果のバランスが最良。  
**デメリット:** `/mypage/applications` や `/mypage` 本体は未対応のまま。完全統一ではない。

### 案 Z: ヘッダー + 対話画面（2 時間程度）

**スコープ（案 Y + ヘッダー改善）:**
- 案 Y の全内容
- + `JobseekerHeader` の User アイコン → イニシャル円 + ▼ chevron に変更（ログアウト発見性向上）

**メリット:** 案 Y に加え、/mypage 側のログアウト発見性問題（v18 §6-3）も同時解消される。一石二鳥。  
**デメリット:** Header.tsx の変更はプラットフォーム全体（/ /companies /jobs 等）に影響する。ログイン済みユーザー全員に影響するため、デグレ確認が必要。

---

## 7. A-3（送信者識別）との同時実装の判断材料

### 同時実装（A-2 + A-3 を一気通貫）のメリット・デメリット

| | メリット | デメリット |
|--|--------|----------|
| `/mypage` 側 | 系統 B の対話 UI を 1 回の改修で完成させられる（手戻りなし） | スコープが広がりすぎて「動作確認 → コミット」のサイクルが長くなる |
| `/biz` 側 | 案 Y/Z 実装後に `/biz/conversations/[id]` も同一セッションで改修できる | `/biz` 側は Server Component なので実装パターンが `/mypage` と異なる（セット実装でも 2 ファイル別々に直す） |

### 別 sub-step に分けるメリット・デメリット

| | メリット | デメリット |
|--|--------|----------|
| | A-2 完了 → 動作確認 → コミットのサイクルを保てる | `/mypage/conversations/[id]` の UI を 2 回触ることになる（A-2 で改修 → A-3 でさらに改修） |
| | 問題が起きたときの原因切り分けが容易 | 対話画面の開発が 2 セッションに分散する |

**Claude Code の見立て（参考）:**  
`/mypage/conversations/[id]` は A-3 の送信者識別が **すでに部分実装済み**（他者のメッセージには sender name あり）。A-2 で `/mypage` 対話画面の UI を改修するついでに、自分のメッセージ側にも名前を出せば A-3-mypage は完結できる（追加工数 10〜15 行程度）。`/biz` 側の A-3 は別途対応が必要なため、A-2 と A-3 を「/mypage 側は同時、/biz 側は別 step」とするハイブリッド案も現実的。

---

## 8. 推奨案（Claude Code の見立て）

**推奨: 案 Z（ヘッダー + 対話画面）+ /mypage 側 A-3 の同時実装**

根拠:
1. **v18 §6-3 の「/mypage ログアウト発見性」を完全解消できる**（A-1 で /biz 側は完了済み）
2. **対話画面（A-2-Y 部分）+ 送信者識別（A-3-mypage 部分）を 1 回の改修で完成**できる（`/mypage/conversations/[id]` は 1 ファイル）
3. **Server Component 化・スタイル手法統一は対象外**（リスクに対してリターンが小さい。Tailwind と CSS カスタムプロパティの混在は許容する）
4. Header.tsx への変更は全ページ影響あるが、**影響箇所はログイン済みユーザーの User アイコン部分のみ**で局所的

**推奨実装順序（A-2-c フェーズ）:**
1. `JobseekerHeader.tsx`: User アイコン → イニシャル円 + ChevronDown
2. `/mypage/conversations/page.tsx`: 日時 → 相対表示、カードデザイン微調整、sidebar top 位置修正
3. `/mypage/conversations/[id]/page.tsx`: メッセージバブル色調整 + 自分のメッセージにも名前表示（A-3-mypage 同時対応）

**対象外（別フェーズ）:**
- `/mypage/applications`: 対話と直接関係ない、今回スコープ外
- `/biz/conversations/[id]`: A-3 の /biz 側実装は別 sub-step で実施

---

## 9. 次のアクション

Hisato さんに確認していただきたい判断:

1. **案 X / Y / Z のどれを選ぶか**
2. **A-3（/mypage 側送信者識別）を A-2 と同時に実装するか否か**
3. `JobseekerHeader` 改修の影響範囲（全ページに当たる）について懸念がなければ、案 Z を確定

確定後、A-2-b スコープ文書を別途作成し実装着手。
