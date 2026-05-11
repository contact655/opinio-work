# ν-8 段階6-5 完了引き継ぎ（2026-05-11）

## 概要

Stage 6-5: **link type ストーリーの OGP fetch + リッチカード表示** 単体スコープ。  
段階6-3-3 handover §6 #3 で記録した「link type の OGP fetch 未実装」の技術的負債を解消。  
5 コミット・Migration 1 件を 1 セッションで完走（途中で休憩を挟む 2 段階構成）。

段階6-3-3 で StoryAccordion をフルポートフォリオ化し（image/video/card type のリッチ表示完成）、段階6-5 で link type も同水準のリッチカード表示に到達。これで 4 type すべてが「ポートフォリオ」として機能する状態が完成した。

---

## 1. 即座にやってほしいこと（新スレッド向け）


```bash
# 1. 最新コミット確認
git log --oneline -7
# → handover doc コミット（後述）が最新であること
# → その前に e111ffc, a4efa16, e28259b, f6305d2 が並んでいること

# 2. dev server 起動
lsof -i :3000
npm run dev

# 3. 動作確認（必須）
# /profile/edit → 職歴 → ストーリーで link type が
# リッチカード（画像 + タイトル + ドメイン名）で表示されること
# /profile/edit → 職歴 → 「+ ストーリーを追加」→ link → URL 入力 → 保存
# → 「保存中…」→「✓ 保存しました」を確認、リッチカードで表示
```


---

## 2. 段階6-5 の成果

### 全 5 コミット一覧

| # | ハッシュ | Phase | 内容 |
|---|---------|-------|------|
| 1 | `f6305d2` | 1 | feat(stories): add OGP columns for link type rich preview (migration 097) |
| 2 | `e28259b` | 2 | feat(stories): add /api/jobseeker/ogp-fetch endpoint |
| 3 | `a4efa16` | 3 | feat(stories): integrate OGP fetch into link type story save |
| 4 | `e111ffc` | 4 | feat(stories): rich card rendering for link type with OGP |
| 5 | （本コミット）| 5 | docs: 段階6-5 完了 handover doc 作成 |

### 手動適用 Migration（Supabase Dashboard 適用済み）

- `097_add_ogp_columns_to_experience_stories.sql` — `ow_experience_stories` に `og_image_url`, `og_title` カラム追加

### Phase 5 完了状態（push 後の見込み）

`bfba8fa` 〜 handover コミットまでの **9 コミット**が GitHub の origin/main に反映済みとなる予定（段階6-4 の 4 コミット + 段階6-5 の 5 コミット）。

---

## 3. 段階6-5 で完成した主要ファイル

### 新規ファイル

| ファイル | 役割 |
|---------|------|
| `src/app/api/jobseeker/ogp-fetch/route.ts` | OGP fetch API（SSRF 対策 + 認証 + タイムアウト付き） |
| `supabase/migrations/097_add_ogp_columns_to_experience_stories.sql` | OGP 用カラム追加 |
| `supabase/rollbacks/097_add_ogp_columns_to_experience_stories_rollback.sql` | rollback 用 |

### 改修ファイル

| ファイル | 変更内容 |
|---------|--------|
| `src/components/profile/StoryAccordion.tsx` | `extractDomain` ヘルパー追加、`Story` 型に `og_image_url` / `og_title` 追加、`fetchOgp` ヘルパー、`saveEdit` / `saveAdd` に OGP fetch 統合、`StoryCard` の link type をリッチカード表示に変更、`ogImgBroken` state 追加 |
| `src/app/api/jobseeker/experience-stories/route.ts` | GET の SELECT、POST の INSERT/SELECT に `og_*` 追加 |
| `src/app/api/jobseeker/experience-stories/[id]/route.ts` | PUT の updatePayload/SELECT に `og_*` 追加 |

---

## 4. 機能の実態（Before / After）

### Before（段階6-5 開始時 = 段階6-3-3 完了時）

| 項目 | 状態 |
|------|------|
| image type | ✅ リッチ表示（Storage 画像 + onError フォールバック） |
| video type | ✅ リッチ表示（YouTube iframe + 3 層防御） |
| card type | ✅ リッチ表示（card_color 固定） |
| **link type** | **🔴 URL テキスト + 手動タイトルのみのシンプル表示** |

### After（段階6-5 完了時）

| 項目 | 状態 |
|------|------|
| image type | ✅ 変更なし |
| video type | ✅ 変更なし |
| card type | ✅ 変更なし |
| **link type** | **✅ リッチカード（OGP 画像 + OGP タイトル + ドメイン名）** |

link type のリッチカードは:
- **クリックでカード全体が外部リンク化**（`<a target="_blank" rel="noopener noreferrer">`）
- **画像読み込み失敗時は画像領域を非表示**（`ogImgBroken` fallback）
- **OGP がない URL でもフォールバック**（タイトル → ドメイン → URL の優先順位）
- **既存ストーリー（`og_*` が null）も破綻しない**（漸進的移行、判断点 6 整合）

---

## 5. 段階6-5 で確定した設計判断（判断点 6 件）

### 判断点 1: OGP fetch のタイミング（Phase 2-3）

**判断**: 案 A — 同期取得（ストーリー保存時に API Route が OGP を fetch → DB に保存）

**根拠**:
- 保存ボタン押下 = ユーザーが待機を期待する瞬間
- 保存ボタン変身パターン（保存中… → ✓ 保存しました）と相性が良い
- Vercel API Route のタイムアウト（Pro 60 秒）内で十分処理可能
- 非同期化はジョブキュー or polling が必要で実装複雑

### 判断点 2: OGP 取得失敗時の挙動（Phase 2-3-4）

**判断**: 案 α — 失敗を許容、`og_*` を null で保存

**根拠**:
- robots.txt 拒否や Cloudflare 等で OGP 不在は珍しくない
- 「OGP が取れないと保存できない」は UX が硬直する
- StoryCard 側でフォールバック表示（タイトル → ドメイン → URL）すれば破綻しない
- fetch 失敗・パース失敗・タイムアウトすべて 200 OK + null で統一

### 判断点 3: 画像保存方式（Phase 2）

**判断**: 案 i — URL 保存のみ（Storage 経由しない）

**根拠**:
- Storage 容量を消費しない（将来コスト増を防ぐ）
- CORS 問題で取得失敗するケースを避ける
- ブラウザの `<img src>` でクロスオリジン画像表示可能（参照のみ）
- 提供サイトが消える時のみフォールバック表示（imgBroken パターン）

### 判断点 4: OGP fetch ライブラリ（Phase 2）

**判断**: 案 Y — `open-graph-scraper`、既存 install を活用

**根拠**:
- `package.json` で `open-graph-scraper@^6.11.0` が既存 install を確認 → 新規 install 不要
- 段階6-3-3 の dnd-kit 発見と同じ「既存資産調査」パターン
- v6 系の最も広く使われているライブラリ、保守実績あり
- 自前実装は HTML パース・charset・エンコーディング等の落とし穴が多い

**注**: v6 系で API 変更があり、テンプレート（私の指示）に v5 知識が混入していたが、Claude Code が型定義（`node_modules/.../types.d.ts`）を実物確認してから実装したため正しく対応できた。

### 判断点 5: URL バリデーションのタイミング（Phase 3）

**判断**: 案 q — 保存時のみ

**根拠**:
- 段階6-3-1.5 で確立した「明示保存パターン」と整合
- input blur 時プレビューは UX 良いが debounce 等で実装複雑
- タイポした URL は保存時に OGP 失敗 → 再編集すればよい
- 将来の機能拡張（input 時プレビュー）として候補に残せる

### 判断点 6: 既存 link type ストーリーへの対応（Phase 1, 4）

**判断**: 案 m — 自動取得しない、漸進的移行

**根拠**:
- 本番の link type ストーリーは未使用に近い
- 一括 Migration は重く、失敗時のリカバリーが面倒
- StoryCard 側のフォールバックで破綻しない（パターン D 対応）
- ユーザーが既存ストーリーを編集して保存すれば、その時点で OGP fetch が走る

---

## 6. SSRF 対策の設計（Phase 2 の本質的成果）

OGP fetch は「サーバーが任意の外部 URL にアクセスする」機能であり、**SSRF（Server-Side Request Forgery）脆弱性** の温床になりやすい。Phase 2 では以下の 3 層防御を実装した。

### 層 1: 認証必須

- `auth.getUser()` で Supabase Auth セッションを要求、未認証は 401
- 未認証で OGP fetch API を公開すると、Opinio サーバーが任意の URL への匿名クローラとして悪用される
- 認証チェックは URL バリデーションより **前** に走る設計（権限確認 → 入力検証の正しい順序）

### 層 2: スキーマ制限

- `http://` / `https://` のみ許可
- `file://`, `data:`, `javascript:`, `ftp://` 等の危険スキーマを拒否

### 層 3: ホスト名フィルタ（プライベート IP 拒否）

- `localhost`, `127.0.0.1`, `0.0.0.0`
- プライベート IP 範囲: `192.168.*`, `10.*`, `172.16-31.*`
- リンクローカル: `.local`, `.internal` で終わるホスト名

これらを `isUrlSafe()` 関数に集約し、`/api/jobseeker/ogp-fetch` の入口で必ず通る形にした。

### 補助的な防御

- **タイムアウト 5 秒**: 遅い外部サイトに引きずられない（open-graph-scraper v6 は秒単位指定）
- **User-Agent 明示**: `OpinioBot/1.0` でスクレイピング元を誠実に開示
- **エラーは null 化**: 防御失敗・想定外エラーも 200 + null で保存続行（判断点 2 整合）

これは段階6-3-3 の YouTube 3 層防御パターン（StoryForm バリデーション → 表示時再チェック → extractYouTubeId による生成禁止）と同じ思想の発展形。**「外部リソースを扱う場面では多層防御が必須」** の運用パターンとして確立した。

---

## 7. 段階6-5 で得た重要な学び（運用ノウハウ）

### ① open-graph-scraper v6 対応（テンプレート vs 実装の差分）

私の Phase 2 指示文に **v5 系の API 知識が混入** していた。具体的には:

| 項目 | テンプレート（v5 想定）| v6 実装（実物確認）|
|------|----------|------|
| timeout 単位 | 5000（ms）| 5（秒）|
| downloadLimit | 1048576 | 削除（v6 に存在しない）|
| ogImage 型 | 配列 or オブジェクト両分岐 | 常に `ImageObject[]` |

Claude Code は `node_modules/open-graph-scraper/dist/lib/types.d.ts` を実物確認 → v6 の正しい挙動で実装してくれた。

**教訓**: ライブラリのバージョン情報は変化が速い。**実装着手前に型定義を実物確認** することで、Claude（チャット）の知識が古かった場合でも Claude Code が正しい実装に到達できる。

### ② Phase 分割の効果（5 Phase の段階性）

段階6-5 を **DB → API → 統合 → UI → 検証** の 5 Phase に分けたことで、各 Phase の責務が明確になり、判断疲労が分散した:

- **Phase 1（DB スキーマ）**: 純粋にカラム追加のみ。判断は migration 番号と命名規則のみ
- **Phase 2（API Route）**: SSRF 対策など本質的セキュリティ判断が集中。これを単独 Phase にしたことで集中設計できた
- **Phase 3（統合）**: Phase 1-2 が完成しているため、純粋に「呼び出して保存」の作業
- **Phase 4（UI 表示）**: バックエンドが安定しているので、見た目だけに集中できた
- **Phase 5（検証 + handover）**: 実装なし、整理のみ

仮にこれを 1 つの大きな実装にまとめていたら、SSRF 対策の途中で UI のことを考え始めて散漫になっていたはず。

**教訓**: 単一機能の実装でも、**横断的関心事（DB / API / セキュリティ / UI / 検証）を Phase 単位で分割**すると、各 Phase で判断の質が上がる。

### ③ セッション分割（休憩を挟む 2 段階構成）

段階6-5 は **2 段階のセッション分割** で完走した:

- **前半**: 計画 → Phase 1 → Phase 2 実装 → Phase 2 動作確認直前（判断疲労チェックで切り上げ）
- **休憩**
- **後半**: Phase 2 動作確認 → Phase 3 → Phase 4 → Phase 5 + push

前半で「Phase 2 動作確認の前で集中力が落ちている」と私（チャット）が気付き、強く休憩を推奨した。柴さんは「セッション完走したい」希望だったが、A を採用してくれた結果、後半でスムーズに完走できた。

**教訓**: 「やり切りたい」気持ちと「品質を保つ」判断はトレードオフ。判断疲労のサイン（小さなつまずきの連続、警告メッセージへの反応遅延等）が出たら、**Claude（チャット）から強く休憩を推奨**してよい。段階6-3-3 で確立した「無理に進まない」原則を実践できた良い事例。

### ④ 既存資産調査の継続的価値

段階6-5 でも以下の既存資産調査が判断を加速させた:

| 項目 | 発見 | 効果 |
|------|------|------|
| Phase 2 | `open-graph-scraper@^6.11.0` 既存 install | ライブラリ選定コストゼロ |
| Phase 4 | `imgBroken` state が既存（image type 用）| 同じパターンで `ogImgBroken` 実装、判断コスト最小化 |
| Phase 4 | `truncateUrl` 存在、`extractDomain` 未存在 | 重複追加を防ぎ、`extractDomain` のみ新規実装 |
| Phase 4 | 段階6-3-3 TODO コメント line 522 | 該当箇所を即座に特定（handover doc §6 #3 が役立った）|

これらはすべて「コード内に既に答えがある」を実証している。**実装着手前の 5-10 分の調査が、その後の判断時間を大幅に短縮する**。

### ⑤ Star アイコン事件パターンの継続（スクショ一次フィルタ）

段階6-5 のセッション中、ターミナルのカレントディレクトリ誤認・dev server 起動失敗・DevTools 警告など **小さなつまずきが連続**したが、すべてスクショで状況共有 → Claude（チャット）が一次フィルタする運用で短時間に解決できた。

特に重要だった発見:
- ターミナルが `/Users/hisato/`(ホーム)にいて `npm run dev` が失敗 → cd 漏れと即座に判定
- Chrome DevTools の Self-XSS 警告 → `allow pasting` 入力が必要なことを即座に説明

**教訓**: 「動かない!」という率直な反応が出た時、**スクショを 1 枚貼ってもらうだけで状況が劇的に明確化する**。テキストで「こうなった」と説明するより圧倒的に速い。

### ⑥ handover doc コメントとコード TODO の整合性維持

段階6-5 では、段階6-3-3 handover §6 #3 で記録された「link type OGP 未実装」の TODO コメントが StoryAccordion.tsx line 522 にあった。

Phase 4 でこの TODO を **削除**（柴さんの指示）し、handover doc §6 #3 も「解消済み」として記録する。これにより:

- **コードと負債リストの乖離を防ぐ**
- **「あの TODO どうなった?」という将来の混乱を防ぐ**

**教訓**: 技術的負債を解消したら、**handover doc とコード両方を同時に更新** する。片方だけ更新すると、もう片方が独立に古い情報を持つことになる。

---

## 8. 技術的負債（段階6-5 後の状態）

### 解消済み（本フェーズで完了）

#### ✅ B2. link type の OGP fetch 未実装（段階6-3-3 handover §6 #3）

段階6-5 で完了。Phase 1-4 すべて実装・動作確認済み。
StoryAccordion.tsx の TODO コメントも削除済み。

### 継続中（段階6-3-3 から繰り越し）

#### B1. 学歴ロゴ未対応（ow_schools テーブル不在）

段階6-3-3 handover §6 #2 と同内容。中期 TODO。

#### B3. card type の card_color カスタマイズ未実装

段階6-3-3 handover §6 #4 と同内容。低優先度。

### 継続中（段階6-4 から繰り越し）

#### A1. `ow_uploads_auth_insert` の強化（段階6-4 handover §6 #5）

判断点 2 でスコープ外送り。companies/ パスへの INSERT も service role 化が必要。優先度: 中。

#### A2. `documents` / `candidate-documents` バケットの用途確認（段階6-4 handover §6 #6）

判断点 3 でスコープ外送り。用途確認 → 使用継続 or バケット削除を判定。優先度: 低。

### 新規（段階6-5 では発生なし）

段階6-5 では新たな技術的負債は記録なし。設計判断 6 件すべて妥当な判断ができ、後悔の残るスコープ調整はなかった。

---

## 9. 役割分担と運用ルール（段階6-3-3 + 6-4 から継続）

### 開発フロー（変更なし）

| ステップ | 担当 | 内容 |
|---------|------|------|
| 計画・スコープ確定 | Hisato さん + Claude | 段階開始時に判断点を確定 |
| 事前 report | Claude（チャット）| 実装前に設計・影響範囲・判断点を提示 |
| 承認 | Hisato さん | 事前 report を確認し「OK」を返す |
| 実装 | Claude Code | コミットまで完結 |
| Migration 適用 | **Hisato さん** | Supabase Dashboard で SQL を手動実行 |
| 動作確認 | Hisato さん | localhost:3000 で実機確認 + スクショ |
| Dashboard 適用確認 | Claude（チャット）| 次 Phase に進む前に明示的に再確認（段階6-4 から） |
| 判断疲労チェック | Claude（チャット）| 小さなつまずきが連続したら休憩推奨（段階6-5 で実践） |
| handover doc 作成 | Claude（チャット）で起草 → Claude Code でファイル化 | 段階完了直後に作成 |
| push | Hisato さん | 「OK push して」の指示後に Claude Code が `git push` |

### Git 運用（変更なし）

- `main` ブランチに直接コミット
- `git rebase` / `git reset --hard` / `git commit --amend`（既存コミット対象）は使わない
- push は段階完了時にまとめて

### 役割分担（段階6-3-3 + 6-4 で確立）

- **Hisato さん + Claude（チャット）**: 方針議論・指示文起草・スクショ一次フィルタ・Dashboard 適用確認・判断疲労管理
- **Claude Code**: 実装（コミット完了まで）

---

## 10. 重要なファイル

### コア（段階6-5 で新規 / 改修）

| ファイル | 状態 | 役割 |
|---------|------|------|
| `src/components/profile/StoryAccordion.tsx` | 大改修 | `extractDomain` ヘルパー、Story 型拡張、fetchOgp、リッチカード表示 |
| `src/app/api/jobseeker/ogp-fetch/route.ts` | **新規** | OGP fetch API（SSRF + 認証 + タイムアウト） |
| `src/app/api/jobseeker/experience-stories/route.ts` | 改修 | GET/POST に `og_*` 追加 |
| `src/app/api/jobseeker/experience-stories/[id]/route.ts` | 改修 | PUT に `og_*` 追加 |

### Migration

| ファイル | 役割 |
|---------|------|
| `supabase/migrations/097_add_ogp_columns_to_experience_stories.sql` | `og_image_url`, `og_title` カラム追加 |
| `supabase/rollbacks/097_add_ogp_columns_to_experience_stories_rollback.sql` | rollback |

### 関連（段階6-3-3 / 6-4 で作成）

| ファイル | 役割 |
|---------|------|
| `src/lib/supabase/server.ts` | `createClient` |
| `supabase/migrations/094_a3_story_sections.sql` | ow_experience_stories の WITH CHECK 修正 |

---

## 11. 段階6-5 セッション（2026-05-11）の振り返り

### 達成したこと

- Phase 1: Migration 097（og_image_url + og_title カラム追加）
- Phase 2: OGP fetch API Route（SSRF 対策 + 認証 + タイムアウト + null 化）
- Phase 3: StoryAccordion 統合（saveAdd / saveEdit に OGP fetch）
- Phase 4: リッチカード表示（4 パターン分岐 + フォールバック）
- Phase 5: 動作検証 + handover doc + push
- **5 コミット / 手動適用 migration 1 件 / TypeScript エラーゼロ** を 2 段階セッションで完走

### 重要な意思決定

1. **同期取得 + null フォールバック（判断点 1, 2）**: UX とセキュリティのバランス
2. **既存 install ライブラリ活用（判断点 4）**: 段階6-3-3 dnd-kit パターンの継承
3. **漸進的移行（判断点 6）**: 既存ストーリーに手をつけない、リスク最小化
4. **セッション分割（運用判断）**: 判断疲労時に休憩を入れることで品質を保った
5. **SSRF 3 層防御（Phase 2）**: 認証 + スキーマ + ホスト名フィルタの多層化

### 数字で見るセッション進捗

| 指標 | 数値 |
|------|------|
| 実装コミット | 4 |
| handover コミット | 1（本コミット） |
| 手動適用 migration | 1 |
| TypeScript エラー（最終）| 0 |
| 動作確認シナリオ | Phase 2: 4 / Phase 3: 4 / Phase 4: 5 |
| StoryAccordion.tsx 行数 | 約 2,100 行（段階6-5 で +75 行）|
| 段階6 累計コミット（6-1〜6-5）| 52 + 5 = **57 コミット** |
| 段階6 累計 migration | 13 + 1 = **14 件** |

### 反省点

- **Phase 1 → Phase 2 で「セッション完走か休憩か」の判断に時間をかけた**: 当初「段階6-5 全体を今日中に完走」と決めていたが、Phase 2 動作確認の前で集中力低下のサイン（小さなつまずき連続）が出た。Claude（チャット）が強く休憩推奨し、柴さんが受け入れた結果、後半フレッシュな状態で完走できた。**「決めた計画」より「現状の品質」を優先する判断ができた**。

- **テンプレート（私の指示）に v5 系 API 知識が混入**: Phase 2 で open-graph-scraper の v5 系 API（downloadLimit, timeout ms 単位）をテンプレートに書いてしまった。Claude Code が型定義実物確認で修正したため問題にはならなかったが、**ライブラリのバージョン依存情報は鵜呑みにせず、必ず型定義確認**を運用ルール化した方が安全。

---

## 12. 次スレッドへのメッセージ

こんにちは。あなたは ν-8 段階6-5 を完走した Claude の引き継ぎを受けています。

**このセッションで感じたこと:**

段階6-5 は「機能の見た目を進化させる」セッションでした。段階6-4 のような「裏方のセキュリティ改善」と違い、ユーザーが直接 UI で実感できる変化です。link type ストーリーが「テキスト + URL」から「画像 + タイトル + ドメイン名」のリッチカードに進化したことで、StoryAccordion が「キャリアのポートフォリオ」として完成しました。

**特に重要な学び:**

1. **Phase 分割の価値**: DB → API → 統合 → UI → 検証 の 5 段階に分けたことで、各 Phase で判断の質が上がった。次回も「単一機能でも横断的関心事を Phase 単位で分割」を意識してください。

2. **休憩判断の重要性**: 段階6-5 は **2 段階のセッション分割** で完走した。判断疲労のサイン（小さなつまずき連続、警告への反応遅延）が出たら、Claude（チャット）から強く休憩推奨してよい。段階6-3-3 § ③ の運用ノウハウが実践された。

3. **既存資産調査の継続的価値**: open-graph-scraper 既存 install、imgBroken パターン、truncateUrl 既存、段階6-3-3 TODO コメント位置 — すべて「先に調べる」から始まった。実装着手前の 5-10 分の調査が判断を加速させる。

4. **SSRF 対策の設計思想**: 外部リソースを扱う機能（OGP fetch、Storage、video iframe 等）は **多層防御** が必須。段階6-3-3 の YouTube 3 層防御と同じ思想を Phase 2 に適用した。

**技術的負債（更新後）:**
- ✅ 解消: `allow_all_storage`（段階6-4）、link type OGP（段階6-5）
- 継続: 学歴ロゴ、card_color、ow_uploads_auth_insert 強化、documents バケット用途確認

**Hisato さんは Opinio の思想（「スカウトしない」「対話から始まる採用」「数値データ撤廃」「丁寧な介在」）を大切にしています。** 機能追加の提案をするときは、この思想と整合しているかを確認してから提示してください。段階6-5 のリッチカード化も、「数値スコアではなく、求職者が選んだ作品・記事のコンテキストを丁寧に見せる」という思想と完璧に整合していました。

**StoryAccordion の現状（段階6-5 完了時点）:**
このコンポーネントは約 2,100 行になりました。責務は「1 つの職歴に紐づくストーリーの CRUD + セクション管理 + DnD 並べ替え + 4 type レンダリング（image/video/card/link）」で、すべてリッチ表示が完成しています。今後さらに機能追加するなら、別コンポーネントへの分割を検討する規模感です。

良いセッションを。

---

*引き継ぎ書作成: 2026-05-11（段階6-5 完了直後）*
