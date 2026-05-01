# ハードコード色の整理タスク (Phase γ で実施)

## 背景

Phase α Step 3e (2026-05-01) で「CSS 変数と完全一致するハードコード色 (カテゴリ A)」を機械置換済み (81件)。
本タスクは「文脈判断要のハードコード色 (カテゴリ B)」を Phase γ で各画面磨き込み時に対応する。

---

## カテゴリ A 機械置換済み (参考)

| 色値 | CSS 変数 | 置換件数 |
|------|---------|---------|
| `#002366` | `var(--royal)` | 14 |
| `#3B5FD9` | `var(--accent)` | 17 |
| `#7C3AED` | `var(--purple)` | 8 |
| `#DC2626` | `var(--error)` | 5 |
| `#059669` | `var(--success)` | 6 |
| `#0F172A` | `var(--ink)` | 10 |
| `#475569` | `var(--ink-soft)` | 8 |
| `#94A3B8` | `var(--ink-mute)` | 6 |
| `#F1F5F9` | `var(--line-soft)` | 2 |
| `#E2E8F0` | `var(--line)` | 3 |
| `#F8FAFC` | `var(--bg-tint)` | 3 |
| `#ECFDF5` | `var(--success-soft)` | 4 |
| `#FEE2E2` | `var(--error-soft)` | 3 |
| `#DB2777` | `var(--pink)` | 2 |
| `#D97706` | `var(--gold)` | 4 |
| `#FEF3C7` | `var(--warm-soft)` | 5 |
| `#EFF3FC` | `var(--royal-50)` | 3 |
| `#001A4D` | `var(--royal-deep)` | 2 |

**合計: 81 件**

---

## カテゴリ B 一覧 (Phase γ で対応)

### #fff / #ffffff (約450箇所)

最も多いハードコード色。用途は大きく3パターン:

| パターン | 代表例 | 推奨置換先 |
|---------|--------|-----------|
| ボタン白文字 `color: "#fff"` | CTA ボタン文字色 | `"#fff"` のまま可 (styling-conventions.md 例外) |
| カード白背景 `background: "#fff"` | カード・モーダル背景 | `var(--bg-white)` 新設 or そのまま |
| SVG stroke/fill `stroke: "#fff"` | アイコン白 | `"currentColor"` に変更 or そのまま |

**方針**: `"#fff"` は styling-conventions.md で明示的に「許容」とされているため、
積極的な置換は不要。ただしカード背景に限り `var(--bg-white): #fff` トークン新設を検討。

---

### #374151 (14箇所)

Tailwind `gray-700` 相当。テキスト・ラベルに使用。

| ファイル | 件数 | 文脈 | 推奨 |
|---------|------|------|------|
| `src/app/(jobseeker)/mypage/company-membership/new/page.tsx` | 9 | `label` の `color` (フォームラベル) | `var(--ink-soft)` (#475569) に寄せる |
| `src/app/admin/mentors/page.tsx` | 2 | テキスト色 | `var(--ink-soft)` |
| `src/app/admin/companies/[id]/page.tsx` | 3 | 動的 color (uploading 状態で変化) | `var(--ink-soft)` |

**推奨**: `var(--ink-soft)` (#475569) へ置換 (`--ink` と `--ink-soft` の中間色として意図的に使われている可能性あり、目視確認を推奨)

---

### #6b7280 (9箇所)

Tailwind `gray-500` 相当。サブテキスト・非活性テキストに使用。

| ファイル | 件数 | 文脈 | 推奨 |
|---------|------|------|------|
| `src/app/(jobseeker)/mypage/company-membership/new/page.tsx` | 4 | サブテキスト・非活性ボタン文字 | `var(--ink-mute)` (#94A3B8) or `var(--ink-soft)` |
| `src/app/admin/mentors/page.tsx` | 3 | テキスト色 | `var(--ink-mute)` |
| `src/components/business/JobPerformanceList.tsx` | 2 | `draft` ステータス色 + 空状態テキスト | `var(--ink-mute)` |

---

### #9ca3af (11箇所)

Tailwind `gray-400` 相当。プレースホルダー・非活性要素に使用。

| ファイル | 件数 | 推奨 |
|---------|------|------|
| 複数ファイル | 11 | `var(--ink-mute)` (#94A3B8) で代替可 (±0.4の差、実質同等) |

---

### #b45309 (24箇所)

Tailwind `amber-700` 相当。`pending` / `warning` 系のテキスト色として使用。

| ファイル | 件数 | 文脈 |
|---------|------|------|
| `src/app/(jobseeker)/articles/[slug]/page.tsx` | 4 | ステータスバッジ |
| `src/components/business/MeetingDetailPanel.tsx` | 3 | meeting ステータス |
| `src/app/(jobseeker)/companies/[id]/page.tsx` | 3 | 警告・注意テキスト |
| `src/components/business/DashboardStatCards.tsx` | 2 | pending ステータス |
| その他 | 12 | 同上 |

**推奨**: `var(--warm)` は `#F59E0B` (amber-400) で色調が異なる。
`#b45309` は `var(--warm)` の暗色版 (hover 時・テキスト用) として使われているため、
`--warm-dark: #B45309` トークンを新設するか、各箇所で文脈確認が必要。

---

### #111827 (6箇所)

Tailwind `gray-900` 相当。見出し・強調テキストに使用。

| ファイル | 件数 | 文脈 | 推奨 |
|---------|------|------|------|
| `src/app/(jobseeker)/mypage/company-membership/new/page.tsx` | 4 | 見出し・本文テキスト | `var(--ink)` (#0F172A) で代替可 |
| `src/app/admin/mentors/page.tsx` | 2 | 見出しテキスト | `var(--ink)` |

---

### #e5e7eb (2箇所)

Tailwind `gray-200` 相当。ボーダー・区切り線に使用。

**推奨**: `var(--line)` (#E2E8F0) で代替可

---

### #f3f4f6 (4箇所)

Tailwind `gray-100` 相当。薄い背景に使用。

**推奨**: `var(--bg-tint)` (#F8FAFC) or `var(--line-soft)` (#F1F5F9) で代替可

---

### #f9fafb (6箇所)

Tailwind `gray-50` 相当。極薄背景に使用。

**推奨**: `var(--bg-tint)` (#F8FAFC) で代替可 (差分 ≤ 0.5%、実質同等)

---

### 短縮形グレー (#aaa, #888, #555) (各1箇所)

| 色値 | 推奨置換先 |
|------|-----------|
| `#aaa` | `var(--ink-mute)` |
| `#888` | `var(--ink-mute)` |
| `#555` | `var(--ink-soft)` |

---

## カテゴリ C (触らない)

以下は意図的なハードコードのため置換対象外:

- グラデーション文字列内の色: `"linear-gradient(135deg, #002366, #3B5FD9)"` 等
  → Avatar.tsx, mockMentorData.ts, mockCompanies.ts のアバター・ブランドカラー配列
- アバター色ローテーション配列 (Avatar.tsx)
- `rgba(0,0,0,0.x)` 形式の半透明 (styling-conventions.md で許容)
- `#1a1a1a` — admin サイドバー背景 (ダークテーマ専用)

---

## 推奨アクション

Phase γ で各画面を磨き込む際に以下の順序で対応:

1. **`#374151` → `var(--ink-soft)`** (9+5件): フォームラベル系、高頻度で影響大
2. **`#111827` → `var(--ink)`** (6件): 見出し系、安全に置換可能
3. **`#9ca3af` → `var(--ink-mute)`** (11件): 非活性テキスト系
4. **`#6b7280` → `var(--ink-mute)`** (9件): サブテキスト系
5. **`#b45309`** (24件): `--warm-dark` トークン新設後に置換
6. **`#fff`** (450件): 基本的にそのまま、カード背景のみ `var(--bg-white)` トークン検討

---

## 関連ドキュメント

- `docs/styling-conventions.md` — デザイントークン定義
- Phase α Step 3e 完了レポート (2026-05-01)
