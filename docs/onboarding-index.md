# オンボーディングの索引（2026-09-11 時点）

**登録の入口（`/onboarding`）の見直しは、ここに挙げた docs で完結している。**
⚠️★**内容をここに書き写さないこと。** 写すと片方だけ古くなる。**リンクだけ置く。**

## いまの形

| | |
|---|---|
| 画面 | **1／3 直近のお勤め先 ／ 2／3 転職について ／ 3／3 あとは任意** |
| 状態の持ち方 | 親の state ＋ **`?step=`**。⚠️ `sessionStorage` は使わない |
| 総数 | **`STEPS.length` から出す。数字を直書きしない** |
| 保存 | **1画面目の「次へ」で職歴を保存**（(c)）。`onboarding_completed` は**いちばん最後** |
| 実体 | [OnboardingClient.tsx](../src/app/onboarding/OnboardingClient.tsx) ／ [page.tsx](../src/app/onboarding/page.tsx) |

## 何をなぜ決めたか

| 何を | どこ |
|---|---|
| 調査（黄色いバナーは不具合ではなかった／完了画面に到達していなかった） | [phase0-onboarding-20260909.md](phase0-onboarding-20260909.md) |
| 完了画面の削除 ／ `?next=` の実装 ／ 公開範囲の一文を戻した裏取り | [phase1-onboarding-20260909.md](phase1-onboarding-20260909.md) |
| **3ステップに分けた理由・保存を (c) にした判断・引き継ぐ制約・残した穴・役職の欄を足さない理由** | [phase0-onboarding-steps-20260911.md](phase0-onboarding-steps-20260911.md) |
| **`/onboarding/stance` の入口が2つある理由**（消さないこと） | [onboarding-stance-two-entries-20260911.md](onboarding-stance-two-entries-20260911.md) |
| 作成時の既定値を型で塞いだ経緯（`visibility_company` を送らない） | [experience-create-defaults-20260911.md](experience-create-defaults-20260911.md) |
| `auth_id IS NULL` の除外（本人が登録していない行を出さない） | [auth-id-null-users-20260910.md](auth-id-null-users-20260910.md) |
| 登録後の進捗表示（%も「あと N 項目」も出さない） | [profile-progress-20260910.md](profile-progress-20260910.md) |

⚠️ 職種を1つに絞った理由と、**関心のある職種（`desired_role_ids`）を別物として
   2画面目に置いた理由**は [phase0-onboarding-steps-20260911.md](phase0-onboarding-steps-20260911.md)。
   前者は「職歴のその行の職種」、後者は「これから何がしたいか」で**列も表も別**
   （`ow_experiences.role_category_id` と `ow_profile_desired_roles`）。**統合しないこと。**

## 未着手のまま残したもの

| | いまの状態 |
|---|---|
| **役職（`rank`）の欄** | オンボーディングには**無い**。職歴エディタには**ある**。足すなら「社内での呼び方」との書き分けを先に決める（理由は steps の docs） |
| **職種の入力方式が2つある** | `RoleSearchSelect`（検索＋2段セレクト）と `TwoStepRolePicker`（大分類→小分類→追加）。オンボーディングは前者だけ、`IntentCard` は両方。**畳んでいない** |
| 勤務地・勤務形態が保存されない条件 | 会社は入れたが職種か入社年月が欠けている場合。いまは「次へ」の警告がカバー。**3画面になったので再確認の対象**（steps の docs） |
| 企業ピッカーの2実装 | 畳んでいない（柴さんの判断） |
