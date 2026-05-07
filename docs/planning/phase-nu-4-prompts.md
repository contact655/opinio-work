# Phase ν-4 Sub-step 投入プロンプト集

各 Sub-step を Claude Code に投げるときのコピペ用テンプレート。
マスタープランは `docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md)` を参照。

---

## 共通ルール(全 Sub-step に適用)

各プロンプトは以下を前提とする:
- マスタープラン(`docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md)`)を参照
- 「作業内容」「完了条件」「制約」に厳密に従う
- 不明点があれば実行前に質問する
- 完了したらサマリー報告(詳細は md ファイルに保存、報告は要点のみ)
- Hisato が「次へ」と明示するまで次の Sub-step に進まない

---

## Sub-step 4A-1: MypageClient.tsx の名前修正

```
Sub-step 4A-1 を開始します。

参照ドキュメント: docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md) の
「Sub-step 4A-1: §4-19 MypageClient.tsx の名前修正」セクション

前提:
- Sub-step 4A-0 完了済み(docs/planning/[phase-nu-4-hardcoded-names.md](http://phase-nu-4-hardcoded-names.md) 参照)
- 修正対象は MypageClient.tsx:303 の「田中翔太」のみ
- line 366 の MOCK_USER.currentRole は TODO コメントのみ追加(実データ化しない)

完了したら以下を報告:
- 修正前後の diff(line 303 と TODO 追加箇所)
- npm run typecheck の結果
- ブラウザでの動作確認結果(ユーザー名表示)
- コミット ID

不明点があれば実行前に質問してください。
```

---

## Sub-step 4A-2: getUser() → getSession() 置換

```
Sub-step 4A-2 を開始します。

参照ドキュメント: docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md) の
「Sub-step 4A-2: §4-20 getUser() → getSession() 置換」セクション

対象は 5 ファイル(B-0 で確定):
1. mypage/applications/page.tsx
2. mypage/company-membership/new/page.tsx
3. mypage/work-history/new/page.tsx
4. auth/page.tsx
5. companies/[id]/page.tsx

置換パターンはマスタープラン参照(変数名 user は維持)。

完了したら以下を報告:
- 各ファイルの diff サマリー(変更行数)
- grep -rn "supabase.auth.getUser" src/app/\(jobseeker\) の結果
- npm run typecheck の結果
- ブラウザ動作確認 5 ページの結果
- コミット ID

不明点があれば実行前に質問してください。
```

---

## Sub-step 4A-3: 応募管理動作確認 + INSERT 検証

```
Sub-step 4A-3 を開始します。

参照ドキュメント: docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md) の
「Sub-step 4A-3: 応募管理動作確認 + INSERT フロー検証」セクション

前提:
- Sub-step 4A-2 完了済み(/mypage/applications の getUser 修正済み)
- 動作確認が中心。バグが見つかった場合は Hisato に報告してから修正方針を決める

確認シナリオ:
1. /mypage/applications で応募一覧が表示されるか(SELECT 側)
2. /jobs/[id]/apply で実際に申込実行 → ow_job_applications に行追加(INSERT 側)
3. 上記の往復が成立するか

応募データが 0 件の場合、テストデータ投入 SQL も含めて実行。

完了したら以下を報告:
- 動作確認の結果(成功/失敗の表)
- バグが見つかった場合は内容と修正方針案(独断修正しない)
- docs/planning/[phase-nu-4-application-verification.md](http://phase-nu-4-application-verification.md) の作成
- コミット ID

不明点があれば実行前に質問してください。
```

---

## Sub-step 4A-4: migration 070

```
Sub-step 4A-4 を開始します。

参照ドキュメント: docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md) の
「Sub-step 4A-4: migration 070(INSERT RLS 修正 + SELECT RLS 緩和)」セクション

重要:
- migration の SQL はマスタープラン記載のものをそのまま使う
- 適用前に Hisato に SQL を見せて最終確認(レビュー後に push)
- ローカル適用 → 動作確認 → リモート適用の順

最初に作業:
1. supabase/migrations/070_phase_nu_4_company_admin_rls.sql を作成
2. 内容を表示して Hisato のレビューを待つ(この時点では push しない)
3. レビュー OK 後にローカル → リモート適用

完了したら以下を報告:
- migration ファイル内容
- ローカル適用結果
- リモート適用結果
- pg_policies の確認結果(新ポリシーが反映されているか)
- 既存対話作成フローの動作確認結果
- コミット ID

不明点があれば実行前に質問してください。
```

---

## Sub-step 4A-5: テストデータ投入

```
Sub-step 4A-5 を開始します。

参照ドキュメント: docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md) の
「Sub-step 4A-5: テストデータ投入」セクション

目的: ow_conversations が空のため、Sub-step 4A-6 以降の動作確認用にデータ投入。

最初に作業:
1. supabase/seed/phase-nu-4-test-data.sql を作成(投入 SQL + 削除 SQL を併記)
2. 投入想定データの全体像を表示して Hisato のレビューを待つ
3. レビュー OK 後に MCP 経由で投入

投入する想定データ(マスタープラン参照):
- 候補者 1 名、企業 2 社、各社 HR 2 名、対話 2 件、initial participant 4 件

完了したら以下を報告:
- 投入 SQL の内容
- 各テーブルの投入後行数
- 動作確認用ログイン情報(test ユーザーの email + 仮パスワード)
- コミット ID

不明点があれば実行前に質問してください。
```

---

## Sub-step 4A-6: /biz/conversations 一覧ページ

```
Sub-step 4A-6 を開始します。

参照ドキュメント: docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md) の
「Sub-step 4A-6: /biz/conversations 一覧ページ」セクション

前提:
- Sub-step 4A-4(migration 070)適用済み
- Sub-step 4A-5(テストデータ)投入済み
- getTenantContext() 再利用、候補者側 /mypage/conversations の UI を流用

実装方針:
- Server Component
- ORDER BY last_message_at DESC NULLS LAST, created_at DESC
- 自分が participant か / 未参加かのバッジ表示

完了したら以下を報告:
- 新規ファイル一覧と行数
- ブラウザ動作確認(投入した 2 件の対話が表示されるか)
- 他社対話が表示されないことの確認(test ユーザー切り替えで)
- npm run typecheck の結果
- コミット ID

不明点があれば実行前に質問してください。
```

---

## Sub-step 4A-7: /biz/conversations/[id] 詳細 + 参加 + 返信

```
Sub-step 4A-7 を開始します。

参照ドキュメント: docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md) の
「Sub-step 4A-7: /biz/conversations/[id] 詳細 + 返信フォーム + 「参加する」API Route」セクション

このサブステップは 3 つに分割可能:
- 4A-7a: 詳細ページ(participant 分岐 UI 含む)
- 4A-7b: /api/biz/conversations/[id]/join API Route
- 4A-7c: 返信フォーム実装

事前確認すべき不確実性:
- メッセージテーブル名(ow_dialogue_messages か別名か)
- メッセージテーブルの RLS 設計
- ow_conversation_participants.role の命名規則(company_member で良いか)

これらが不明な場合は実装を止めて Hisato に報告してください。

完了したら以下を報告:
- 各サブ a/b/c のコミット ID
- 動作確認シナリオ 2 件の結果(initial HR / 追加 HR)
- 「参加する」ボタンの confirmation dialog 動作
- 候補者側で返信が見えることの確認
- npm run typecheck の結果

不明点があれば実行前に質問してください。
```

---

## Sub-step 4A-8: 引き継ぎ書 v18

```
Sub-step 4A-8 を開始します。

参照ドキュメント: docs/planning/[phase-nu-4-master-plan.md](http://phase-nu-4-master-plan.md) の
「Sub-step 4A-8: 引き継ぎ書 v18 作成 + Phase ν-5 候補スコープの仮置き」セクション

ベース: docs/handoff/[handover-2026-05-06-step-4-complete.md](http://handover-2026-05-06-step-4-complete.md)(v17)

作業:
1. v17 のフォーマットを踏襲して v18 を作成
2. §4-19, §4-20 などの該当項目を「解決済み」に更新
3. Phase ν-5 候補スコープを 4〜5 件挙げる(マスタープラン参照)
4. Hisato への確認質問を 3 件以内にまとめる

完了したら以下を報告:
- v18 のファイルパス(日付込み)
- §4 の解決済み項目リスト
- Phase ν-5 候補スコープの一覧
- Hisato への確認質問
- コミット ID

不明点があれば実行前に質問してください。
```

---

## 全 Sub-step 完了後

Phase ν-4 全体の最終確認:
- 全 Sub-step のコミット履歴を git log で確認
- 引き継ぎ書 v18 の最終レビュー
- Phase ν-5 のキックオフ判断
