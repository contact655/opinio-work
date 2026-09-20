# 白文字を塗りに載せている箇所 ── 残りを機械的に洗った（2026-09-21）

`docs/todo.md`（2026-09-01 の項）の **「⚠️ ほか未点検の箇所もありうる」** を埋めるための調査。
✅★**2026-09-21 に6件とも直し、塗り用のトークンを2つ立てた**（柴さんの指示）。
下の②が直した本体で、①は**その過程で見つかった数字の誤り**。

```bash
grep -rnE 'background[^;,}]*var\(--(warm|success)\)' src --include='*.tsx' --include='*.ts' --include='*.css'
grep -rnE 'background[^;,}]*(#F59E0B|#059669|#10B981)'  src --include='*.tsx' --include='*.ts' --include='*.css'
```

---

## ★① まず数字の訂正 ── `--success` の白文字は **2.93 ではなく 3.77**

`docs/todo.md` の2つの表（2026-08-31 記録 / 2026-09-01 記録）が
**`--success` #059669 に白文字＝2.93** と書いているが、**実測すると 3.77。**

```
#059669 vs #FFFFFF = 3.77
#F59E0B vs #FFFFFF = 2.15   ← こちらは正しい
```

⚠️ 同じ計算式で、todo.md の他の値（`--warm` 2.15 ／ `--warm-ink` 7.09 ／
`--success-ink` 5.48 ／ `--success` on `--success-soft` 3.58）は**全部一致した**ので、
式ではなく **2.93 という値だけが誤り**。`#10B981`(2.54) でも `--success-soft` 上(3.58) でもなく、
どの組み合わせからも出てこない数字だった。

### ⚠️★この訂正で、直す対象が減る

| | 必要な比 | `--success` 3.77 |
|---|---|---|
| **12〜13px の文字** | 4.5 | ❌ **足りない**（従来どおり失敗） |
| 18.66px 太字 / 24px の文字 | 3.0 | ✅ 通る |
| **アイコン・図形**（WCAG 1.4.11） | 3.0 | ✅ **通る** |

**＝ `--success` の塗りに白いアイコンを置いている箇所は、直す必要がない。**
2.93 のままだと「3.0 に届かない」と読めて、**直す対象に数えてしまう。**

---

## ✅② 白文字が塗りに乗っている ── **6箇所とも直した**

**すべて `color: "#fff"` が明示されていて、文字が乗っている。**

| # | 場所 | 塗り | 何の文字 | 比 | 誰が見るか |
|---|---|---|---|---|---|
| 1 | [MypageClient.tsx:465](src/app/(jobseeker)/mypage/MypageClient.tsx#L465) | `--success` | 手順番号（12px 800） | **3.77** | **求職者** |
| 2 | [JobPane.tsx:282](src/components/jobs/JobPane.tsx#L282) | `--success` | 選考フローの最終ステップ番号（11px 800） | **3.77** | **求職者** |
| 3 | [ProfileEditModal.tsx:236](src/components/profile/editor/ProfileEditModal.tsx#L236) | `--success` | 保存ボタン（`justSaved` のとき） | **3.77** | **求職者** |
| 4 | [CompanyEditSubNav.tsx:126](src/components/business/CompanyEditSubNav.tsx#L126) | `--success` | 「変更を公開する」（12px 700） | **3.77** | 企業 |
| 5 | [AdminJobsClient.tsx:383](src/app/admin/jobs/AdminJobsClient.tsx#L383) | `--success` | 承認ボタン（12px 600） | **3.77** | 運営 |
| 6 | ★[biz/dashboard/page.tsx:242](src/app/biz/dashboard/page.tsx#L242) | **`#F59E0B` 直書き** | 「ロゴを設定する →」（12px 700） | **2.15** | 企業 |

⚠️★**6 が一番悪い。2.15 は 24px にしても基準（3.0）に届かない。**
todo.md が「色を変えるしかない」と結論した**カジュアル面談CTAと同じ色・同じ比**で、
**そこだけ直して、こちらが残っていた。** しかも `var(--warm)` ではなく**直書き**なので、
変数を辿る grep では見つからない。

⚠️ 1・2 は**番号**なので、読めなくても意味は文脈から取れる（隣にラベルがある）。
   3・4・5・6 は**ボタンの文言そのもの**で、読めないと何のボタンか分からない。

### 直すなら（案。決めていない）

| | |
|---|---|
| 6（2.15） | **塗りを `--warm-ink` #92400E にする。** 白文字で **7.09**。`/biz/members` の「招待中」バッジで既に採った形 |
| 1〜5（3.77） | **塗りを `--success-ink` #047857 にする。** 白文字で **5.48** |

⚠️★**`--success-ink` / `--warm-ink` を塗りに使うのは、todo.md が
   「使い回さないこと」と書いている形。** 名前は文字色を指している。
   **増やすなら塗り用の名前を別に立てる**（例 `--success-fill-strong`）。
   ここで4箇所→10箇所に増えるので、**名前を立てる判断をする分かれ目**だと思う。

⚠️ **`--success` そのものを濃くしないこと。** ドット・枠・アイコンにも使われており、
   色の役割（明るい方＝状態の印）が変わる。

---

## ③ アイコンだけ（文字なし）── **3箇所。訂正の結果、問題なし**

| 場所 | 塗り | 中身 | 比 | |
|---|---|---|---|---|
| [biz/dashboard/page.tsx:316](src/app/biz/dashboard/page.tsx#L316) | `--success` | チェックマーク（`stroke="#fff"`） | 3.77 | ✅ 3.0 を超える |
| [FeedClient.tsx:1984](src/app/(jobseeker)/feed/(list)/FeedClient.tsx#L1984) | `--success` | 鞄アイコン（`stroke="#fff"`） | 3.77 | ✅ |
| [JobEditForm.tsx:1252](src/components/business/JobEditForm.tsx#L1252) | `--success` | 目のアイコン（`currentColor` = #fff） | 3.77 | ✅ |

⚠️ ①の訂正が効くのはここ。**2.93 のままだと3件とも「要修正」に数えていた。**

---

## ④ 文字もアイコンも乗っていない ── **8箇所。対象外**

ドット・パルス・トグルの軌道で、**上に何も載っていない。**

`globals.css:1942`（在籍中パルスドット）／ `MergedTimeline.tsx:1232`（8px ドット）／
`admin/page.tsx:1145`（5px ドット）／ `admin/page.tsx:382`（8px ドット・直書き）／
`AdminCompaniesClient.tsx:411`（10px ドット・直書き）／
`MembersClient.tsx:1760`（28×16 のトグルの軌道）／
`CompanyEditSubNav.tsx:161`（6px ドット）／ `admin/biz-accounts/page.tsx:361`（6px ドット）

⚠️ **ドットは「状態の印」であって情報の担い手ではない**（隣に必ず文字がある）。
   ここを濃くすると**色の役割が変わる**ので、触らない。

---

## ✅⑤ `--warm-ink` を塗りに使っている ── **白文字の3箇所は寄せた。ドット1箇所は残した**

白文字で **7.09** なので読めてはいた。**命名の逸脱**だったので `--warm-strong` に寄せた。
**値が同じなので見た目は変わっていない。**

| | |
|---|---|
| ✅ 寄せた | `MembersClient.tsx:869`（招待中バッジ）／ `CreateCompanyClient.tsx:771`（参加申請）／ `AdminCompaniesClient.tsx:614`（承認する） |
| ⚠️ 残した | **`CompanyEditSubNav.tsx:227`** —— **7px のドットで文字が乗っていない**。`--warm-strong` は「白文字を載せる塗り」なので用途が違う |

⚠️ そのドットは、**同じファイルの161行目のドットが `--warm`（明るい方）**を使っており、
   **同じ画面でドットの色が2種類**ある。意図的かどうかは未確認。**今回は触っていない。**

⚠️ [ProfileEditor.tsx:346](src/components/profile/editor/ProfileEditor.tsx#L346) は逆向き
   —— **`#F59E0B` の塗りに `--warm-ink` の線でアイコン**を描いている（**3.30** ＝ 3.0 を超える）。
   **意図的に濃い線にしてある。** 白い線に「揃える」と 2.15 になるので**戻さないこと。**

---

## ⑥ メール2本の CTA（停止中）

`api/cron/weekly-match/route.ts:235` ／ `api/cron/weekly-jobs/route.ts:220` が
`background:#059669;color:#fff` のボタン（**3.77**）。

⚠️ **どちらも配信は止まっている**（`WEEKLY_EMAIL_ENABLED` 未設定 ＋ `vercel.json` の `crons` が空）。
   再開するときに一緒に直すのが自然で、**いま単独で触る理由は無い。**

---

## ⑦ 別件として見つけたもの（この調査の範囲外）

[AdminCompaniesClient.tsx:9-17](src/app/admin/companies/AdminCompaniesClient.tsx#L9) の
**ロゴ代替のグラデーション8色**は、社名のハッシュで選ばれ**白い頭文字**が乗る。
8色のうち **`#F59E0B→#FBBF24`(2.15) と `#0EA5E9→#38BDF8` と `#DC2626→#F87171`** は
明るい側で基準を割る。**運営画面だけ**で、企業ごとに固定なので「ある社だけ読みにくい」形。

⚠️ ロゴが無い企業は**本番2社**（PKSHA・フライル）なので、実害はその2社が当たるかどうか次第。
   **数えただけ。直していない。**

---

## まとめ

| | 件数 | |
|---|---|---|
| **白文字が読めない** | **6** | ✅ **直した**（3.77→5.48 / 2.15→7.09） |
| 命名の逸脱（読めてはいた） | 4 | ✅ 白文字の3つを寄せた／ドット1つは残す |
| アイコンのみ → ①の訂正で対象外 | 3 | 触っていない |
| ドット・トグル → 対象外 | 8 | 触っていない |
| **停止中のメール** | **2** | ✅ **直した**（下記） |

### ✅ メール2本の CTA も直した（同日）

`api/cron/weekly-match/route.ts:235` ／ `api/cron/weekly-jobs/route.ts:220` の
「詳細を見る →」が `background:#059669;color:#fff` で **3.77** だった（13px には 4.5 が要る）。

→ **[templates.ts](src/lib/notify/templates.ts) の `MAIL_SUCCESS_FILL`（`#047857` / 白で 5.48）** に寄せた。

⚠️★**CSS 変数は効かない**（メールHTML）ので hex の直書きで、**globals.css の
   `--success-strong` と二重管理**になっている。**片方だけ変えないこと。**
   globals.css が挙げている「hex で書いてよい例外」がまさにここ。
⚠️ **色だけを定数にした。** 週次2本は padding と font-weight が違うので、
   既存の `BTN` のように1本の style 文字列に畳むと**見た目が変わる。**
⚠️ 置き場を `templates.ts` にしたのは、**両ルートが既にそこから
   `senderFooterHtml` を import していた**から（新しい依存を作っていない）。

#### メールの他の配色は基準を満たしている（同日に実測）

| | 比 |
|---|---|
| 白 on `#002366`（主ボタン `BTN` ほか3箇所） | **14.66** |
| `#085041` on `#E1F5EE`（weekly-match の理由行） | **8.28** |
| `#92400e` on `#FEF3C7`（運営フォールバックの印） | **6.37** |
| `#111827` on `#f9fafb` | **16.98** |

**直す必要があったのは `#059669` の2箇所だけ。**

#### ⚠️★ここは `tsc` でも lint でも守られない

`style="…"` は**テンプレートリテラルの中の文字列**なので、
**普通の文字列に書き換えてしまうと `${MAIL_SUCCESS_FILL}` がそのままメールに出る。**
`tsc` は通るし、`no-unused-vars` も（Next の既定では）出ない。

→ **確かめ方は、リテラルを実際に評価して `background:#047857` が入るかを見る。**
   2026-09-21 はその方法で2本とも `true` ／ `${` の残り `false` を確認した。

### ✅ 検証（2026-09-21）

| | |
|---|---|
| `npx tsc --noEmit` | **0件** |
| `npx next lint --dir src` | 既存の警告2件のみ（触っていないファイル） |
| 配信CSS | `layout.css` に `--success-strong: #047857` / `--warm-strong: #92400E` が**実際に出ている** |
| 実画面 | `/jobs?selected=…` の JobPane に `var(--success-strong)` が**1件描かれている**（選考フローの最終ステップ） |

⚠️ 残り5件はログインが要るので HTML では確かめていない（同じ形の1行置換）。
