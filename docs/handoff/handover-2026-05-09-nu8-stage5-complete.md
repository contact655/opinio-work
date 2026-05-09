# ν-8 段階5 完了報告 — SNS 編集 UI

**完了日**: 2026-05-09  
**担当**: Claude Code  
**テーマ**: ν-8「人のプロフィール充実化」段階5 — SNS 7種固定フィールド編集 UI + 公開ページ表示

---

## §1. 完了コミット一覧

| コミット | hash | 内容 | 当初分割からの変更 |
|---|---|---|---|
| A | (調査のみ、コミットなし) | 事前調査: ow_user_socials スキーマ・social_links JSONB 現状・API ルート有無・/u/[id] SNS 表示有無・アイコン素材確認 | — |
| B | `ab75b14` | `public/icons/sns/` に 7 種 SVG 同梱 + `src/components/SocialIcon.tsx` 新規作成 | 当初計画通り |
| C | `fab33ca` | ProfileEditClient SNS タブ 7種固定フィールド + 700ms デバウンス保存 + プレースホルダー卒業 | 当初計画通り |
| D | `2d9e641` | `/u/[id]` 公開ページ SNS セクション 3種 → 7種拡張 | 当初計画通り |
| D' | `166a6be` | アイコンのみ横並び表示に修正（要望B 準拠）— 動作確認時に発覚 | **追加コミット**（段階4 の Fix B' に相当） |
| E | 本ファイル | 段階5 完了報告 | — |

**合計**: 5コミット（A は調査のみ、D' は修正追加）  
**当初予定**: A〜E の5コミット → **実際**: D' 追加で6コミット（5実装）

---

## §2. 動作確認結果

**テスト URL**: `/u/e826e0bd-f96b-42ec-acda-d8f482e1417d`  
（Account B: s.hisato1020@gmail.com）

### コミット B — SVG・SocialIcon コンポーネント

dogfooding（Account B）で確認済み（2026-05-09）。

| 確認項目 | 結果 |
|---|---|
| `public/icons/sns/` に 7 ファイル配置（twitter/linkedin/github/instagram/facebook/youtube/note） | ✅ |
| note は角丸四角 + "note" テキスト + #41C9B4 のカスタム SVG | ✅ |
| `SocialIcon` コンポーネントが 7 種すべての platform に対応 | ✅ |
| aria-label が表示名（"X", "LinkedIn" 等）で設定 | ✅ |

### コミット C — SNS タブ編集 UI

dogfooding（Account B）で確認済み（2026-05-09）。

| 確認項目 | 結果 |
|---|---|
| `/profile/edit` SNS タブを開く → 7 種フィールドが縦に表示される | ✅ |
| Account B の既存データ（twitter URL / linkedin URL）が初期値として入っている | ✅ |
| URL を入力 → 700ms 後「保存中…」→「自動保存されました」ピル表示 | ✅ |
| リロード後の永続化 | ✅ |
| SaveStatusPill が 3 タブ（基本情報 / スキル / SNS）で独立動作 | ✅ |
| 段階3・段階4 の機能継続動作 | ✅ |

### コミット D / D' — 公開ページ SNS セクション

| 確認項目 | 結果 |
|---|---|
| `/u/[id]` に X・LinkedIn のアイコンが横並び表示（要望B 準拠） | ✅ |
| ラベルテキスト・外部リンクマーク（↗）が表示されない | ✅ |
| ブランドカラー背景（X: 黒、LinkedIn: 青）でアイコンが識別できる | ✅ |
| note（空文字列）は非表示 | ✅ |
| 未認証（シークレットウィンドウ）でも表示 | ✅（RLS select_all=true） |
| アイコンクリックで別タブが開く（target="_blank"） | ✅ |
| ホバーで opacity 0.8 + scale(0.94) のフィードバック | ✅ |

---

## §3. 段階5 で発見した重要情報（マスタープラン v2 反映候補）

1. **JSONB 継続採用 + ow_user_socials 持ち越し**  
   段階5 では `ow_users.social_links` JSONB をデータモデルとして継続使用した（ow_user_socials テーブルは完全に空のまま未使用）。`/api/jobseeker/profile` の `allowed` フィールドに `social_links` が既に含まれていたため、新 API ルートを作らずに実装できた。段階6 で「JSONB 継続 vs ow_user_socials テーブルへの移行（CHECK 制約を 7 種に拡張 + 既存データ移行）」を改めて判断する持ち越し。

2. **キー名 = 内部実装、ラベル = 表示の使い分け**  
   Account B の既存データは `"twitter"` キーで保存されており、/mypage UserProfileCard も `"twitter"` キーを参照している。段階5 では JSONB キー `twitter` を維持し、UI 表示名のみ「X」とする設計を採用した（`SOCIAL_META.twitter.label = "X"`）。`twitter → x` のキー移行はν-9 で別途検討する持ち越し。移行時は /mypage UserProfileCard・/u/[id]・/profile/edit の3箇所と既存データへの migration が必要。

3. **保存経路 4 系統並走（段階6 の主要議題）**  
   - `/mypage` UserProfileCard: Supabase クライアント直接 UPDATE（blur 保存）
   - `/profile/edit` 基本情報タブ: 700ms デバウンス autosave（`patchBasicInfo`）
   - `/profile/edit` スキルタブ: 即時 API（POST/DELETE、楽観更新）
   - **`/profile/edit` SNS タブ: 700ms デバウンス autosave（`patchSocialLinks` 新設）** ← 段階5 で追加  
   `patchSocialLinks` は `patchBasicInfo` と独立したタイマー・SaveStatusPill 状態を持ち、責務が分離されている。一方で UX 上の保存タイミングの不統一（即時 vs デバウンス）は段階6 集約の主要議題となる。

4. **SocialIcon の variant パターン**  
   `variant="icon"`（デフォルト、編集ページ向け）と `variant="display"`（公開ページ向け）を同一コンポーネントで分岐する設計を採用した。`"display"` では note 以外にブランドカラー背景 + `brightness(0) invert(1)` filter で白アイコン化。note は SVG 自体に背景色を持つため例外的に as-is 表示。この variant パターンは今後の「編集 / 表示切り替えコンポーネント」設計の参考になる。

5. **note アイコンの自作対応**  
   note は公式 SVG の配布がないため、角丸四角（`<rect rx="4">`）に "note" テキストを配置し、ブランドカラー `#41C9B4` を使用したカスタム SVG を `public/icons/sns/note.svg` として作成した。今後公式 SVG が配布されない SNS を追加する場合の前例となる。`"display"` variant では SVG 全体を 38×38 で fill することで branded appearance を維持。

6. **当初分割からの変更点 = D' の追加**  
   段階4 の Fix B'（webpack import 修正）と同様に、動作確認後の修正を別コミット D' として追加した。Commit D では縦並びカード形式で実装したが、要望B のスクショに合わせて「アイコンのみ横並び」に修正。Server Component（/u/[id]/page.tsx）では event handler が使えないため、hover 効果は `globals.css` に `.sns-icon-link:hover` クラスとして定義するパターンを確立。

---

## §4. 当初分割からの変更点

**当初計画（指示文 v1 §3）**: A（調査）→ B（SVG + SocialIcon）→ C（編集 UI）→ D（公開ページ）→ E（完了報告）

**実際**: D の後に D'（アイコンのみ横並び修正）を追加。その他は変更なし。

| コミット | 当初計画 | 変更内容 |
|---|---|---|
| A | 調査のみ | 変更なし |
| B | SVG + SocialIcon | 変更なし |
| C | 編集 UI | 変更なし |
| D | 公開ページ拡張 | 変更なし（縦並びカード形式で実装） |
| **D'** | **（予定外）** | **要望B 準拠のアイコン横並びに修正** |
| E | 完了報告 | 変更なし |

---

## §5. 段階6 着手前のチェック項目

段階5 で ν-8 のメイン実装フェーズが完了。段階6 は集約フェーズ。以下を着手前に整理する。

1. **保存経路 4 系統並走の現状確認**  
   blur（/mypage）/ 700ms デバウンス（基本情報・SNS）/ 即時 API（スキル）の 4 系統の現状をコード上で再確認し、統一方針を決定する

2. **ow_user_socials テーブルの最終的な扱い**  
   段階5 では未使用のまま。削除 or 7 種への CHECK 制約拡張 + Account B のデータ移行（migration 作成）のどちらかを判断する

3. **/mypage UserProfileCard の SNS UI を 7 種に揃えるか**  
   現在は twitter/linkedin/note の 3 種のみ対応。7 種に拡張するか、または /profile/edit に編集 UI を集約して /mypage から SNS 編集を廃止するかを決定する

4. **/profile/edit と /mypage UserProfileCard の関係整理**  
   両者が並行する編集 UI を持つ現状を段階6 で整理する。/profile/edit 一本化 or 両者並走継続かを判断

5. **autosave UX 統一の議論**  
   即時 API（スキル）vs 700ms デバウンス（基本情報・SNS）vs blur（/mypage）の 3 方式。フィールド種別ごとの保存方式ルールを段階6 で決定する

6. **`src/app/profile/edit/` 孤立ディレクトリの根本整理**  
   Fix B'（段階3）で暫定回避済みの orphan ディレクトリ問題。段階6 で根本解消する

7. **`/opengraph-image` エラー（既存技術的負債）**  
   段階2 から持ち越し。段階6 or ν-9 での対処を判断する

8. **JSONB キー `twitter → x` 移行の判断**  
   既存データ・/mypage・/u/[id]・/profile/edit の 3 箇所への影響を整理し、ν-9 で移行するか否かを判断する

9. **要望A（Wantedly 並みのプロフィール充実化）の判断**  
   `docs/notes/nu-8-post-stage3-discussion.md` §要望A を参照。ν-8 再スコープ or ν-9 持ち越しかを決定する

10. **要望C（年齢層 → 生年月日自動計算）の判断**  
    `docs/notes/nu-8-post-stage3-discussion.md` §要望C を参照。段階6 着手前に実装方針を決定する

---

## §6. 既知の課題 / 持ち越し

| 課題 | 優先度 | 担当フェーズ | 補足 |
|---|---|---|---|
| `src/app/profile/edit/` 孤立ディレクトリの根本整理 | 中 | 段階6 | Fix B'（段階3）で暫定回避済み |
| /mypage と /profile/edit の編集 UI 重複 | 中 | 段階6 | 2 系統並走は意図的 |
| **保存経路 4 系統並走の統一**（blur / デバウンス×2 / 即時 API） | 中 | 段階6 | 段階5 で 4 系統目（SNS デバウンス）確立 |
| /mypage UserProfileCard へのスキル UI 並行マウント | 低 | 段階6 | 段階4 では非実装（集約方針） |
| /mypage UserProfileCard の SNS UI（3種のまま） | 中 | 段階6 | 7 種対応 or /profile/edit 集約かを判断 |
| sort_order TOCTOU / リインデックス API | 低 | ν-9 | ドラッグ並び替え実装時に必要 |
| ProfileEditClient.tsx のファイル分割 | 低 | 段階6 | 現在 982 行、段階6 追加で 1,000 行超見込み |
| ow_user_socials テーブルの存廃 | 高 | 段階6 | 段階5 では JSONB 継続、テーブルは空のまま |
| JSONB キー `twitter → x` 移行 | 低 | ν-9 | 既存データ・3 箇所への影響あり |
| /opengraph-image エラー（既存技術的負債） | 低 | 段階6 or ν-9 | 段階2 から持ち越し |
| **要望A**: Wantedly 並みのプロフィール充実化 | 要議論 | ν-8 再スコープ or ν-9 | `docs/notes/nu-8-post-stage3-discussion.md` §要望A |
| **要望C**: 年齢層 → 生年月日自動計算 | 要議論 | 段階6 着手前 | `docs/notes/nu-8-post-stage3-discussion.md` §要望C |

---

## §7. 実装ファイル全一覧

```
新規作成:
  public/icons/sns/twitter.svg       # B: X（黒アイコン）
  public/icons/sns/linkedin.svg      # B: LinkedIn（青アイコン）
  public/icons/sns/github.svg        # B: GitHub（ダークグレーアイコン）
  public/icons/sns/instagram.svg     # B: Instagram（赤系アイコン）
  public/icons/sns/facebook.svg      # B: Facebook（青アイコン）
  public/icons/sns/youtube.svg       # B: YouTube（赤アイコン）
  public/icons/sns/note.svg          # B: note（自作、#41C9B4 背景 + "note" テキスト）
  src/components/SocialIcon.tsx      # B: SocialPlatform 型 / SOCIAL_META / SNS_PLATFORMS /
                                     #    SocialIcon（variant="icon"|"display"）

変更:
  src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx
    # C: SocialLinks 型, socialLinks/socialSaveStatus state,
    #    patchSocialLinks 関数（700ms デバウンス）,
    #    SocialLinksEditor コンポーネント追加,
    #    PlaceholderTabContent label="SNS" を卒業,
    #    ヘッダーに SNS タブ用 SaveStatusPill 追加
  src/app/(jobseeker)/profile/edit/page.tsx
    # C: SELECT に social_links 追加、initialSocialLinks prop 追加
  src/app/(jobseeker)/u/[id]/page.tsx
    # D: SocialLinks 型を 7 種に拡張、inline SocialIcon 削除、
    #    PLATFORM_LABEL 削除、activeSocials フィルタ更新（空文字列除外）
    # D': flexDirection:column → flex横並び、SocialIcon variant="display" に変更
  src/app/globals.css
    # D': .sns-icon-link / .sns-icon-link:hover クラス追加

Supabase migrations:
  なし（social_links JSONB は既存カラム、ow_user_socials は未使用のまま）
```

---

## §8. 段階6 集約への申し送り

段階6 は ν-8「人のプロフィール充実化」の集約フェーズ。段階3〜5 の実装で積み上がった技術的負債・並走状態を整理することが主目的。

| 申し送り事項 | 内容 |
|---|---|
| **保存経路 4 系統の統一方針** | blur（/mypage）/ 700ms デバウンス（基本情報・SNS）/ 即時 API（スキル）の 4 系統が並走。「フィールド種別ごとの保存方式ルール」を段階6 で決定する。全フィールドをデバウンス統一するか、スキルのみ即時 API を維持するかが主な論点 |
| **ow_user_socials テーブルの存廃** | 段階5 で JSONB 継続を採用したが、ow_user_socials テーブルは依然として空のまま残存。削除する場合は DROP TABLE migration のみ。移行する場合は CHECK 制約を 7 種に拡張し、Account B のデータを INSERT する migration が必要 |
| **/mypage UserProfileCard の整合性** | SNS UI が 3 種（twitter/linkedin/note）のまま。7 種に揃えるか、/profile/edit に集約して /mypage から SNS 編集を廃止するかを決定する。スキル UI（/mypage 未実装）も同様の判断が必要 |
| **ProfileEditClient.tsx のファイル分割** | 現在 982 行。段階6 追加後は 1,000 行超が確実。SkillTagsEditor・SocialLinksEditor・TextareaField 等を別ファイルに抽出することを推奨 |
| **orphan ディレクトリの根本整理** | `src/app/profile/edit/`（CareerModal.tsx・mockProfileData.ts・roleData.ts）の孤立状態を段階6 で根本解消する。段階3 Fix B' での import 絶対パス化は暫定対応 |
