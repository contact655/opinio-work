# OPINIO Design Audit

> 作成日: 2026-06-05  
> 対象: `/Users/hisato/opinio-work/src/` 全 TSX ファイル + globals.css  
> 手法: grep による機械的抽出 + 静的解析  
> ⚠ このファイルはコード変更なし。指摘のみ。

---

## 1. 余白の値

### セクション間 padding/margin (大) — 上位頻出値

| 値 | 用途例 | CSS変数対応 |
|----|-------|------------|
| 96px | ホームFAQセクション | `--space-24` |
| 80px | ヒーロー・ページ上下 | `--space-32` (128px) → **ミスマッチ** |
| 72px | biz LP セクション | 変数なし ❌ |
| 64px | 認証・not-found | `--space-16` |
| 48px | セクション内上下余白 | `--space-12` |

#### 問題: セクション間隔が混在
biz/page.tsx だけで `72px`・`80px`・`64px` が混用されている。CSS変数 `--space-16: 64px` と `--space-24: 96px` の間に定義がなく、`72px`・`80px` は変数なしで直書き。

---

### カード内 padding (中) — 頻出 TOP15

| 頻度 | 値 |
|------|----|
| 321 | 12px |
| 307 | 10px |
| 301 | 14px |
| 285 | 16px |
| 257 | 8px |
| 241 | 20px |
| 214 | 24px |
| 155 | 28px |
| 115 | 18px |
| 103 | 32px |

#### 問題: 複合 padding 値が 327 種類
`"10px 14px"`, `"12px 14px"`, `"12px 16px"`, `"8px 16px"` など非常に似た値が大量に直書きされている。8px グリッドに収まらない `7px`, `9px`, `11px`, `14px` が頻出。

---

### 要素間 gap (小) — 頻出

| 頻度 | 値 |
|------|----|
| 28 | 1px (border) |
| 24 | 14px |
| 23 | 12px |
| 20 | 16px |
| 16 | 20px |
| 12 | 8px |
| 11 | 24px |

**8px グリッド逸脱値**: `14px` (24件) が多用されている — `--space-3 (12px)` と `--space-4 (16px)` の中間で統一が取れていない。

---

## 2. フォントサイズ・ウェイト

### フォントサイズ — 全頻出値

| 頻度 | px値 | CSS変数 | 用途推定 |
|------|------|---------|---------|
| 731 | 13px | **なし** ❌ | メタ情報・サブラベル (最多) |
| 591 | 12px | `--text-caption` ✅ | キャプション |
| 513 | 11px | **なし** ❌ | 小バッジ・補足テキスト |
| 265 | 14px | `--text-body-sm` ✅ | メタ情報 |
| 230 | 10px | **なし** ❌ | 極小ラベル |
| 147 | 15px | **なし** ❌ | body と body-sm の中間 |
| 100 | 16px | `--text-body` ✅ | 本文 |
| 54 | 20px | **なし** ❌ | 中見出し下 |
| 47 | 22px | `--text-h3` ✅ | サブ見出し |
| 40 | 18px | `--text-body-lg` ✅ | 読み物本文 |
| 32 | 24px | **なし** ❌ | h3.5 扱い |
| 17 | 26px | **なし** ❌ | h2.5 扱い |
| 13 | 28px | `--text-h2` ✅ | セクション中見出し |

#### 問題: CSS変数定義外の頻出サイズが多い
- `13px`: **731回** — 最多使用サイズなのに変数なし
- `11px`: **513回** — 2番目に多いバッジ系サイズなのに変数なし
- `10px`: **230回** — 変数なし
- `15px`: **147回** — 変数なし
- `20px`, `24px`, `26px` も高頻度で変数なし

CSS変数として定義されている 9 段階と、実際に使われている頻出サイズがほぼ一致していない。**システムの定義が実態を反映していない**。

---

### フォントウェイト — 使用頻度

| 頻度 | weight | 用途 |
|------|--------|-----|
| 798 | 700 | 見出し・強調 |
| 658 | 600 | セミボールド |
| 192 | 500 | ミディアム |
| 78 | 800 | 超強調 |
| 27 | 400 | 通常 |
| 3 | 300 | ライト |

weight は概ね 4 〜 5 種類に絞られており比較的統一されている。

---

## 3. 色コード

### CSS変数 (globals.css で定義)

```css
/* Brand */
--royal:      #002366    (使用: 738回)
--royal-deep: #001A4D
--royal-50:   #EFF3FC    (使用: 224回)
--royal-100:  #DCE5F7    (使用: 129回)
--accent:     #3B5FD9    (使用: 72回)

/* Text */
--ink:        #0F172A    (使用: 597回)
--ink-soft:   #1E293B    (使用: 538回)
--ink-mute:   #475569    (使用: 772回)

/* Borders */
--line:       #E2E8F0    (使用: 840回)
--line-soft:  #F1F5F9    (使用: 144回)
--bg-tint:    #F8FAFC    (使用: 263回)

/* Status */
--success:    #059669    (使用: 167回)
--success-soft:#ECFDF5
--warm:       #F59E0B    (使用: 61回)
--warm-soft:  #FEF3C7
--purple:     #7C3AED    (使用: 41回)
--purple-soft:#F3E8FF
--error:      #DC2626    (使用: 186回)
--error-soft: #FEE2E2
--pink:       #DB2777    (使用: 2回のみ)
--gold:       #D97706    (使用: 0回)  ← 定義のみ、未使用
--gold-soft:  #FEF3C7    ← warm-soft と同値！重複定義
```

---

### 直書き hex — 実際に使われているもの TOP 30

| 頻度 | hex | 対応CSS変数 | 問題 |
|------|-----|-----------|------|
| 1097 | `#fff` | — | 白は変数化不要 |
| 148 | `#002366` | `--royal` ✅ | 直書きは変数に替えるべき |
| 81 | `#059669` | `--success` ✅ | 同上 |
| 80 | `#0f172a` | `--ink` ✅ | 67回直書き |
| 72 | `#e2e8f0` | `--line` ✅ | 同上 |
| 70 | `#94a3b8` | **なし** ❌ | slate-400 系、変数未定義 |
| 67 | `#7c3aed` | `--purple` ✅ | 直書き多数 |
| 57 | `#d97706` | `--gold` (or `--warm`?) | gold/warm の区別が曖昧 |
| 54 | `#f1f5f9` | `--line-soft` ✅ | 直書き多数 |
| 51 | `#b45309` | **なし** ❌ | amber-700、warm のdark版 |
| 45 | `#475569` | `--ink-mute` ✅ | 37回直書き |
| 40 | `#dc2626` | `--error` ✅ | 直書き多数 |
| 37 | `#64748b` | **なし** ❌ | slate-500 系、変数未定義 |
| 31 | `#6b7280` | **なし** ❌ | gray-500 (Tailwind), 近似 |
| 30 | `#1d9e75` | **なし** ❌ | 旧プライマリ green が残存 |
| 22 | `#001233` | **なし** ❌ | royal より濃い独自ネイビー |
| 9 | `#1d4ed8` | **なし** ❌ | blue-700、accent と競合 |

---

### 問題: 似た色・重複

#### 問題A: グレー系が 5 種類乱立
```
#475569  (--ink-mute: 772回 + 37回直書き)  
#64748b  (slate-500: 81件、変数なし)  
#6b7280  (gray-500: 31件、変数なし)  
#94a3b8  (slate-400: 70件、変数なし)  
#9ca3af  (gray-400: 15件、変数なし)
```
`--ink-mute` の定義は `#475569` だが、実態では `#64748b` と `#94a3b8` も頻繁に直書きされており、3段階のグレーが変数なしで混用されている。

#### 問題B: Green 系が 4 種類乱立
```
#059669  (--success: 167回 + 81回直書き)
#1d9e75  (旧プライマリ: 30件残存)  
#0f6e56  (8件)
#2d7a4f  (10件)  
#34d399  (11件) ← emerald-400、明るい緑
```
旧プライマリグリーン `#1d9e75` が移行後も30件残存。`--success (#059669)` と mix されている。

#### 問題C: gold / warm の定義が重複・混乱
```css
--warm:      #F59E0B  /* amber-400 */
--gold:      #D97706  /* amber-600 */
--gold-soft: #FEF3C7  /* warm-soft と同じ値！ */
```
`--gold` は0回しか使われておらず実質 dead token。`--warm-soft` と `--gold-soft` が同値で定義されている。

#### 問題D: Royal 系の競合
```
#002366  (--royal)
#001233  (22件 — 変数なし、より濃いネイビー)
#1a3569  (11件 — 変数なし、ミドルネイビー)  
#001A4D  (--royal-deep: ほぼ未使用)
```

#### 問題E: 直書き hex と CSS変数の二重管理
- `--ink (#0f172a)`: **67回直書き** vs 変数 597回
- `--royal (#002366)`: **148回直書き** vs 変数 738回
- `--success (#059669)`: **81回直書き** vs 変数 167回

---

## 4. 絵文字使用箇所

| ファイルパス (src/ 以下) | 絵文字 | 用途 |
|------------------------|-------|------|
| `app/(jobseeker)/page.tsx:357` | 🏗️ | 求人なし空状態 |
| `app/(jobseeker)/page.tsx:619` | ✍ | 「取材済み」バッジ |
| `app/(jobseeker)/page.tsx:872` | 🎓 | 「OB・OGの転職経験談」説明 |
| `app/(jobseeker)/jobs/JobsClient.tsx:843,845` | 🏠 🏢 | 勤務形態フィルター選択肢 |
| `app/(jobseeker)/jobs/JobsClient.tsx:1404,1406` | 🏠 🏢 | 同上（2箇所目） |
| `app/(jobseeker)/companies/CompaniesClient.tsx:451` | 🎓 | 「OB・OGの話が聞ける」 |
| `app/(jobseeker)/companies/[id]/page.tsx:394–403,412` | 🏠 🏢 💼 ⚡ ✨ ✓ | 働き方アイコン |
| `app/(jobseeker)/companies/[id]/page.tsx:827,841` | 📊 💬 | フェーズ/メトリクスバッジ |
| `app/(jobseeker)/companies/[id]/CustomerCasesClient.tsx:45` | 🏢 | 顧客事例カンパニー名 |
| `app/(jobseeker)/u/[id]/page.tsx:689–695` | ✍️ 🏢 ⚡ 🎯 📊 📝 | プロフィール完成度チェック項目 |
| `app/(jobseeker)/feed/FeedClient.tsx:944,975,1142` | ❤️ 🤍 💬 📝 | いいね・コメント・空状態 |
| `app/(jobseeker)/profile/edit/ProfileEditClient.tsx:546–547,607` | 🏢 💼 💡 | 通知設定アイコン |
| `app/(jobseeker)/profile/edit/ProfileEditClient.tsx:3954` | ✓ | OGP取得成功表示 |
| `app/biz/posts/PostsClient.tsx:84,86` | 💬 🔗 | 外部リンク種別アイコン |
| `app/biz/posts/PostsClient.tsx:428–432` | ✍️ ✅ 🏢 | 記事作成フロー |
| `app/biz/posts/PostsClient.tsx:509–513` | 🏢 🚀 ✋ 📝 | ストーリーカテゴリアイコン |
| `app/biz/pipeline/PipelineClient.tsx:36,444,737` | ★ | パイプライン星マーク |
| `app/biz/conversations/[id]/page.tsx:283` | ✓ | 参加中表示 |
| `app/biz/organization/CategoriesEditor.tsx:1015` | ✓ | 保存完了表示 |
| `app/biz/candidates/CandidatesClient.tsx:425` | ✓ | プロフィール設定済みバッジ |
| `app/biz/company/CompanyEditClient.tsx:898` | ✓ | 登録ボタンラベル |
| `app/biz/agents/AgentsClient.tsx:414` | ✓ | 招待送信完了 |
| `components/companies/CompanyCardCompact.tsx:208` | ✍ | 「取材済み」バッジ |
| `components/companies/GenreTabs.tsx` | 🏢 🏠 📊 📈 🔗 🏗️ | ジャンルタブアイコン |
| `components/jobseeker/JobseekerHeader.tsx:440–442` | 🏢 💼 📝 | モバイルメニューアイコン |
| `components/jobseeker/PostCard.tsx:22,24` | 💬 🔗 | コンテンツ種別アイコン |
| `components/business/EditorInvitation.tsx:21` | ✍️ | 編集者招待 |
| `components/business/JobEditForm.tsx:684` | 🔒 | 下書き保存オプション |
| `components/business/DashboardStatCards.tsx:156` | ⚠ | 要対応警告 |
| `components/business/JobStatusSummary.tsx:71` | ⚠ | 緊急ステータス |
| `components/business/JobListCard.tsx:387` | ⚠ | 未入力警告 |
| `components/ui/ImageUpload.tsx:71` | ⚠ | アップロードエラー |
| `app/biz/pipeline/PipelineClient.tsx:388` | ⚠ | 警告 |

#### 絵文字に関する問題
- **`✓` と `✍` が Emoji ではなく Unicode 文字として使用** — クロスブラウザで表示が異なる可能性あり
- **同じ用途で `✍` と `✍️` が混在** (`CompanyCardCompact.tsx` vs `PostsClient.tsx`)
- **`⚠` が5箇所で警告表示に使用** — SVGアイコン（Lucide等）に統一すべき
- **`★` が PipelineClient で使用** — Lucide アイコンに置き換え推奨
- 勤務形態フィルターの `🏠 🏢` は JobsClient.tsx で**2箇所に重複定義**されている

---

## 5. Border-radius

### 頻出値一覧

| 頻度 | 値 | CSS変数 | 用途 |
|------|----|---------|----|
| 248 | `1px` | — | ほぼ border-width |
| 244 | `50%` | — | 円形アバター (224件) |
| 128 | `8px` | — | ボタン・入力 (変数は 10px) |
| 108 | `10px` | `--radius-md` ✅ | 標準ボタン・カード |
| 100 | `12px` | — | **変数なし** ❌ |
| 83 | `16px` | `--radius-lg` ✅ | カード標準 |
| 78 | `20px` | — | **変数なし** ❌ |
| 71 | `2px` | — | |
| 70 | `14px` | — | **変数なし** ❌ |
| 62 | `24px` | `--radius-xl` ✅ | 大カード |
| 61 | `7px` | — | **変数なし** ❌ |
| 57 | `100%` | — | ピル形状 (pill) |
| 51 | `28px` | — | **変数なし** ❌ |
| 46 | `3px` | — | |
| 44 | `4px` | — | |
| 38 | `18px` | — | **変数なし** ❌ |
| 32 | `6px` | `--radius-sm (6px)` ✅ | タグ・ピル |
| 32 | `22px` | — | **変数なし** ❌ |

#### 問題: radius が 15 種類以上乱立
CSS変数として定義されている 4 段階 (`6px`, `10px`, `16px`, `24px`) だが、実際に頻出するのは `8px`, `12px`, `14px`, `18px`, `20px`, `22px`, `28px` 等と**変数外の値が大多数**。

また、`globals.css` で `.genre-card` に `border-radius: 18px` が定義されているが、これに対応する変数もない。

---

## 6. 統一提案（現状指摘のみ、コード変更なし）

### 🔴 高優先度: 色の混乱

1. **CSS変数と直書き hex の二重管理** — `--royal`, `--success`, `--ink` 等が変数で定義されているにも関わらず、同じ hex が `148回`・`81回`・`67回` 直書きされている。変数化の意味が薄れている。

2. **グレー系が変数なしで 5 種類乱立** — `#64748b` (81件), `#94a3b8` (70件), `#6b7280` (31件) が `--ink-mute` と並列使用されている。中間テキストグレーの基準が存在しない。

3. **旧プライマリ緑 `#1d9e75` が 30 件残存** — royal blue への移行後も旧グリーンが混在。`--success (#059669)` と区別なく使われている。

4. **`--gold` が 0 回しか使われない Dead Token** — `--gold-soft` は `--warm-soft` と**同値**で二重定義されている。どちらかを削除すべき。

5. **`--pink` が 2 件しか使われない準 Dead Token** — ステータスカラーとして定義されているが実質未使用。

---

### 🔴 高優先度: フォントサイズの不統一

6. **最多使用 `13px`(731回) と `11px`(513回) に変数が存在しない** — 設計書では `--text-caption: 12px` が最小だが、実態では 10〜13px のバリエーションが主流になっている。

7. **CSS変数定義と実際の使用頻度が完全に乖離** — 変数に定義されている 9 段階のスケールより、非定義の `13px/11px/10px/15px/20px/24px/26px` の方が圧倒的に多く使われている。

---

### 🟡 中優先度: 余白の断片化

8. **インラインスタイルが 5,639 件 vs className が 1,207 件** — インラインスタイルが約 5 倍多く、padding 値の一元管理が事実上不可能になっている。

9. **padding の組み合わせが 327 通りに達している** — 8px グリッドに乗らない `7px`, `9px`, `11px`, `14px` が高頻度で使われ、視覚的リズムが崩れている。

10. **spacing 変数がほぼ使われていない** — `--space-*` 変数は定義されているが、最も使われる `--space-2` でも 4 件のみ。変数の存在意義が失われている。

---

### 🟡 中優先度: Border-radius の過剰な種類

11. **radius が 15 種類以上** — CSS変数 4 段階 (`6/10/16/24px`) に対して、実際には `8px`, `12px`, `14px`, `18px`, `20px`, `22px`, `28px` 等が直書きされている。`border-radius: 18px` が `.genre-card` に定義されているが変数なし。

---

### 🟢 低優先度: 絵文字の一貫性

12. **`✍` と `✍️` が同じ「取材済み」用途で混在** — `CompanyCardCompact.tsx` は `✍`、`PostsClient.tsx` は `✍️` を使用。

13. **警告アイコン `⚠` が 5 箇所で Unicode 文字として使用** — Lucide の `AlertTriangle` 等の SVG アイコンに統一推奨（スクリーンリーダー対応、スタイル制御が容易）。

14. **ジャンルタブの絵文字がランダム割り当て** — `GenreTabs.tsx` で "data-analytics" と "dx-consulting" に同じ `📊` が使われている（重複）。

---

### 参考: 数値サマリー

| 指標 | 値 |
|------|----|
| ユニーク padding 値組み合わせ | 327 種 |
| CSS変数外の頻出 font-size | 13, 11, 10, 15, 20, 24, 26px |
| 変数で定義済みカラーの直書き件数 | 約 400 件 (主要3色のみ) |
| 変数未定義の高頻度グレー | 3 種 (#64748b, #94a3b8, #6b7280) |
| インライン style vs className の比 | 5,639 : 1,207 |
| border-radius の異なる値 | 15 種以上 |
| 定義済みだが 0〜2件しか使われないCSS変数 | `--gold`, `--pink`, `--royal-deep`, `--space-*` ほぼ全部 |
