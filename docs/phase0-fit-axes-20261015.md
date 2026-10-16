# フェーズ0（ステップ0）: 自分のAIで「相性のものさし」を作る（コピー＆ペースト方式）

**実測日: 2026-10-15**（本番 DB・SELECT のみ。コード・migration・データは変更していない）

---

## 1. 既存の入社・退職理由の7軸（全文）

出どころは `src/lib/constants/careerReasons.ts:83-148`。**軸は DB に持たない**（コードの定数だけ）。DB が持つのは選択肢の slug だけ。

### 保存先（テーブル・列）

| 表.列 | 型 | 中身 |
|---|---|---|
| `ow_experiences.join_reasons` | text[]（最大3） | 入社の決め手。下の `JOIN_REASONS` の slug |
| `ow_experiences.join_reason_primary` | text | いちばんの決め手（1つ） |
| `ow_experiences.leave_reasons` | text[]（最大3） | 退職理由。下の `LEAVE_REASONS` の slug |
| `ow_experience_gaps(experience_id, axis, rating)` | text / text | 入社前後のギャップ（別の6軸） |

- 公開範囲: **非公開。本人と集計のみ**。`ow_experiences` の3列は `authenticated` に SELECT が無い（読むには admin クライアント）
- 選べるのは最大3つ（`REASON_MAX = 3`）。順位は取らない

### 軸（`REASON_AXES`）と選択肢

| 軸 | 入社理由（`JOIN_REASONS`） | 退職理由（`LEAVE_REASONS`） |
|---|---|---|
| `work` 仕事の中身 | `job_content` 事業内容・プロダクト／`skills` 身につくスキル | `job_content` 仕事内容が合わなかった／`skills` スキルの伸び代が無かった |
| `role` 裁量・役割 | `autonomy` 裁量の大きさ／`position` ポジション・役割 | `autonomy` 裁量が小さかった／`position` ポジション・役割が変わった |
| `org` 人・組織 | `people` 一緒に働く人／`culture` 組織のカルチャー | `people` 一緒に働く人／`culture` 組織のカルチャー／`management` マネジメント・上司 |
| `pay` 待遇 | `salary` 年収・待遇／`evaluation` 評価・昇進の仕組み | `salary` 年収・待遇／`evaluation` 評価のされ方・昇進 |
| `worklife` 働き方 | `work_style` 働き方（場所・時間） | `work_style` 働き方（場所・時間） |
| `company` 会社の状態 | `growth` 事業の成長性／`stability` 知名度・安定性 | `growth` 事業の先行き／`restructure` 会社都合・組織変更 |
| `personal` 個人の事情 | `personal` タイミング・個人の事情 | `personal` 個人の事情（家庭・健康など） |

### ギャップの6軸（`GAP_AXES`）

`autonomy` 裁量の大きさ／`onboarding` 教育・オンボーディング／`work_hours` 労働時間／`evaluation` 評価の納得感／`decision_speed` 意思決定のスピード／`client_quality` 顧客・案件の質。評価は `better` 想像より良かった／`as_expected` 想像通り／`worse` 想像より厳しかった（未回答は行が無い）。

### 実データ（実在の利用者40人・2026-10-15）

入社理由あり **19 / 51** 件の職歴、ギャップ **107** 件。

---

## 2. 新しい6軸と既存7軸の対応

**性質が違う。** 既存は「**過去の職歴で何を決め手にしたか**（選んだ／選ばない）」、新しい6軸は「**いまどちら寄りか**（1〜5の両極）」。

| 新しい軸 | 近い既存の選択肢 | 重なり | 初期値に使えるか |
|---|---|---|---|
| `work_style` 自分で考えて動く ⇔ 型や仕組みに沿って動く | `autonomy`（裁量の大きさ）、ギャップ `autonomy` | △ 片側だけ | ✗ 決め手に「裁量」を選んだ人は 1 寄りと言えそうだが、**選ばなかった人を 5 寄りとは言えない**（推測になる） |
| `phase` 整っていない環境 ⇔ 整った環境 | `growth`（事業の成長性）／`stability`（知名度・安定性） | △ 両側に1つずつある | ✗ 過去に選んだ理由で、いまの志向ではない |
| `result` 個人で追う ⇔ チームで追う | なし（`people` は「誰と働くか」で別物） | ✗ | — |
| `decision` スピード ⇔ 合意形成 | ギャップ `decision_speed`（入社後に想像と比べてどうだったか） | △ 別の問い | ✗ |
| `customer` 現場で顧客と ⇔ 戦略・企画の側から | ギャップ `client_quality`（顧客・案件の質）は別物 | ✗ | — |
| `growth` 幅を広げる ⇔ 専門を深める | `skills`（身につくスキル） | ✗ 方向が無い | ✗ |

**見立て: 既存の回答を初期値に入れるのは勧めない。** 推測値の投入になる（CLAUDE.md「推測値を投入しない」）。
画面で「参考：あなたが以前、入社の決め手に挙げたもの」を**横に表示するだけ**なら、本人が判断する材料として使える（値は入れない）。

---

## 3. 保存先

**使える既存テーブルは無い。** 近い名前の `ow_company_culture_tags`（企業側・0行）、`ow_approach_preferences`（連絡の受け方）は用途が違う。

### 新設案

```
ow_fit_axis_answers
  user_id       uuid → ow_users.id（on delete cascade）
  axis_key      text   ★lib/fitAxes/axes.ts の key（DB では CHECK しない＝軸の差し替えに migration を要らなくする）
  value         smallint null  check (value between 1 and 5)   ★null =「わからない」
  source        text   check in ('ai_paste','manual')
  axes_version  integer  ★回答した時点の軸の版（軸を差し替えたあとで古い回答を見分ける）
  updated_at    timestamptz
  primary key (user_id, axis_key)
```

- **貼り付けた AI の文章・AI が添えた理由は持たない**（列を作らない）
- RLS: 本人の行だけ SELECT。**書き込みは API（service_role）だけ**にすることを提案する
  （指示は「本人の行だけ読み書き」だが、値の範囲と軸の key の検証をサーバー1か所で行いたいため。`ow_for_you_reactions` と同じ形）
- 企業（`/biz`）からは読めない。admin クライアントで読む経路も作らない（並び順への反映はポリシー改定後）
- ⚠️ `axis_key` を CHECK しないのは、軸が「仮」で差し替える前提だから。代わりに API が `axes.ts` の key だけ受ける

### ⚠️ プライバシーポリシーとの関係（判断が要る）

- 貼り付けた文章を保存しないので、**OPINIO は AI に何も送らず、委託先も増えない**（2026-09-21 の「会話を保存しない」とも矛盾しない）
- ただし**数字（本人の価値観・志向）は新しい種類の個人データ**。プライバシーポリシーの「取得する情報」には今は無い
  - 「保存と本人への表示」だけでも、取得する情報として書く必要があるかは確認が要る（並び順に使う段階では必須）

---

## 4. 置き場所の案

| 案 | URL | 入口 |
|---|---|---|
| **A（推奨）** | **`/mypage/proposals/axes`**（「あなたに合う会社」の下の階層） | 「あなたに合う会社」の冒頭の1文の下に1枚のカード（未作成なら「自分のAIで、相性のものさしを作る（約3分）」、作成済みなら6軸の要約と「作り直す」） |
| B | `/mypage/fit` | 同上＋ /mypage のカード |

- A の理由: 使う場所（あなたに合う会社）と同じ階層に置くと、戻り先が1つで迷わない。middleware の `/mypage` の認証がそのまま効く
- ページの中は3段: ①質問文とコピー → ②貼り付け → ③スライダーで確認して保存（「AI を使わずに答える」は①を飛ばして③へ）
