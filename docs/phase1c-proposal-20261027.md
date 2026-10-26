# フェーズ1c 提案：転機の3問の置き場所と、Q1 の対応表（2026-10-27）

前提: 指示書「フェーズ1（安全面の修正 → 在籍期間のバグ → 転機の3問）」の 1c。
**まだ何も実装していない。DB も変えていない。** この文書を見て決めていただいてから実装する。

3問（指示書のとおり）:

| | 問い | 形 |
|---|---|---|
| Q1 | その会社を選んだ決め手 | 3つまで・等重み（★一番の決め手は無し）。選択肢は v2 の15個 |
| Q2 | 次の会社に、いちばん求めていたこと | 1つ（8択） |
| Q3 | 入って1年たったころ、合っていたか | 5段階（1〜5）＋回答した日 |

---

## 1. いまの状態（2026-10-27 実測 / 本番）

### 既存の回答データ

| 置き場所 | 行数（全体） | うち実在の利用者 | 備考 |
|---|---|---|---|
| `ow_experiences.join_reasons`（旧12個・3つまで） | **25** | **19** | 2026-09-12 の「選んだ理由」モーダルの答え |
| `ow_experiences.join_reason_primary`（★一番の決め手） | 10 | 10 | 新しい画面からは外す（列とデータは残す） |
| `ow_experiences.join_reason`（自由記述） | 4 | — | 触らない |
| `ow_experience_expectations`（v2 の15個・2026-10-16） | 3行 | 職歴1件ぶん | 画面からはもう書かれていない |
| `ow_workplace_reviews.fit_score`（0〜10・2026-10-17） | 2 | **0** | 合う会社の並び（`lib/forYou`）が読む |

### いまの読み取り権限

| 置き場所 | anon | 他のログイン利用者・企業 | 本人 | 仕組み |
|---|---|---|---|---|
| `ow_experiences` の行 | 「公開」の人の行 | **ログインしていれば他人の行も読める**（`ow_experiences_login_only_read`） | ○ | RLS（行） |
| └ `join_reasons` など回答の列 | ✗ | ✗ | PostgREST からは ✗（API 経由） | **列単位 GRANT だけで守っている**（authenticated の SELECT は 38列中28列） |
| `ow_experiences` の書き込み | — | — | **38列すべてに UPDATE**（表単位） | RLS（本人の行だけ） |
| `ow_workplace_reviews` | ✗ | ✗（RLS で本人の行だけ） | ○（PostgREST から直接読み書き） | RLS 4本＋authenticated に GRANT |
| v2 の6表（`ow_experience_expectations` ほか） | ✗ | ✗ | ✗（API 経由のみ） | **RLS 有効・ポリシー0本・GRANT なし**。書くのは service role だけ（`requireOwnExperience` で本人確認） |

---

## 2. 置き場所の案（権限の面での比較）

### 案A：`ow_experiences` に列を足す

`decisive_reasons text[]`／`next_priority text`／`fit_after_year smallint`／`fit_answered_at timestamptz`／`turn_skipped_at timestamptz`

### 案B（推奨）：専用の表を作る（v2 の6表と同じ形）

```
ow_career_turns
  experience_id   uuid PK  → ow_experiences(id) ON DELETE CASCADE   -- 転機 = その会社に入った職歴1件
  user_id         uuid     → ow_users(id)       ON DELETE CASCADE
  decisive_reasons text[]  CHECK (15個の部分集合・3つまで)            -- Q1
  next_priority   text     CHECK (8択のどれか)                        -- Q2
  fit_after_year  smallint CHECK (1〜5)                               -- Q3
  fit_answered_at timestamptz                                          -- Q3 を答えた日
  skipped_at      timestamptz                                          -- 「この転機は答えない」
  created_at / updated_at
RLS 有効・ポリシー0本・anon / authenticated に GRANT なし（読み書きは API ＝ service role だけ）
```

### 比較

| 観点 | 案A（`ow_experiences` に列） | 案B（専用の表） |
|---|---|---|
| 他人から読めるか | 行は**ログイン利用者なら誰でも読める**ので、守りは**列単位 GRANT 1枚だけ**。誰かが後で `grant select (列)` を配る・列リストを書き換えると、その瞬間に全員分が読める | 表ごと誰にも GRANT しない。**行も列も PostgREST から届かない**。漏らすには GRANT とポリシーの両方を書く必要がある |
| 本人が直接書けるか | authenticated に**表単位の UPDATE**があるので、本人は PostgREST から**任意の値を直接書ける**（API の検証を通らない）。CHECK で値の範囲は守れるが、「1年たったか」などの業務ルールは守れない | 書けるのは API（service role）だけ。検証を1か所に集められる |
| 職歴の編集で消えないか | 職歴の PUT は「送られなかった列を null に上書き」する作り（CLAUDE.md「経歴に列を足すときは4箇所を揃える」）。**列を足すと、職歴を1項目直しただけで回答が消える危険**を毎回避ける必要がある | 職歴の PUT とは別の表なので、**構造上消えない** |
| 職歴を消したとき | 行ごと消える | `ON DELETE CASCADE` で一緒に消える（同じ） |
| 本人の削除（1a-4） | `deleteCompanyAnswers` で列を null に戻す | `deleteCompanyAnswers` に表を1つ足す（v2 の表と同じ扱い） |
| 集計 | admin クライアントで読む（同じ） | admin クライアントで読む（同じ） |
| 前例 | `join_reasons` などはこの形（列単位 GRANT で守っている） | v2 の6表（2026-10-16）・`ow_transitions`・`ow_company_creations` がこの形。1a-5 の実測でも「他の利用者・anon から 0行／拒否」を確かめた形 |
| 型・コードの量 | 列を足すたびに4箇所（SELECT・PUT/POST・Stint・draft）を揃える | API 1本（GET/PUT/DELETE）と表1つ |

**推奨は案B。** 案A は「読めないこと」を列単位 GRANT 1枚に頼り、しかも本人が表単位の UPDATE で直接書けるので、
「本人と集計処理以外は読めない」「検証を通った値だけ」という条件を**守り続けるのに注意が要る**。
案B は v2 の6表と同じで、**何も足さなければ誰も読めない**側に倒れている。

⚠️ `ow_workplace_reviews`（2026-10-17）は本人が PostgREST から直接読み書きできる形（RLS で本人の行だけ）。案B はそれより閉じた v2 の形に合わせる。

---

## 3. Q1 の対応表（旧12個 → 新15個）

**旧12個のキーは、すべて v2 の15個に同じキーで入っている**（2026-10-16 に v2 を作ったとき、キーを揃えてある）。
したがって読み替えは**キーをそのまま写すだけ**で、意味の変わる付け替えは無い。表示名が変わるものが4つある。

| 旧キー | 旧の表示名 | → 新キー | 新の表示名 | 旧データの件数（全体／実在） | うち★一番の決め手 |
|---|---|---|---|---|---|
| `job_content` | 事業内容・プロダクト | `job_content` | **事業・プロダクト** | 11／5 | 1 |
| `skills` | 身につくスキル | `skills` | 身につくスキル | 10／10 | 1 |
| `position` | ポジション・役割 | `position` | **職種・役割** | 7／5 | 0 |
| `salary` | 年収・待遇 | `salary` | 年収・待遇 | 7／7 | 2 |
| `people` | 一緒に働く人 | `people` | **一緒に働く仲間** | 6／5 | 1 |
| `autonomy` | 裁量の大きさ | `autonomy` | **任される範囲** | 6／5 | 0 |
| `work_style` | 働き方（場所・時間） | `work_style` | 働き方（場所・時間） | 5／4 | 1 |
| `stability` | 知名度・安定性 | `stability` | 知名度・安定性 | 5／4 | 1 |
| `culture` | 組織のカルチャー | `culture` | 組織のカルチャー | 4／3 | 2 |
| `personal` | タイミング・個人の事情 | `personal` | タイミング・個人の事情 | 2／1 | 1 |
| `growth` | 事業の成長性 | `growth` | 事業の成長性 | 1／1 | 0 |
| `evaluation` | 評価・昇進の仕組み | `evaluation` | 評価・昇進の仕組み | 1／1 | 0 |
| — | — | `customer` | 顧客・業界 | （旧に無い） | — |
| — | — | `next_career` | 次のキャリアにつながる | （旧に無い） | — |
| — | — | `management` | 上司・経営陣 | （旧に無い） | — |

- 件数は `join_reasons` に入っている延べ数（2026-10-27 実測。1行に最大3つ）。対象の職歴は 25行（実在 19行）。
- ★一番の決め手（`join_reason_primary`・10行）は**読み替えない**。新しい画面にも集計にも使わない（列とデータは残す）。
- v2 の `ow_experience_expectations`（職歴1件・3行）も同じキーなので、取り込むならそのまま写せる。

### 旧データをどう扱うか（承認が要る）

| 案 | 中身 | DB の書き込み |
|---|---|---|
| **a（推奨）** | 新しい表に、旧 `join_reasons` を**そのまま Q1 として写す**（migration 1本・id を明示列挙）。本人が新しい画面で答え直せば上書き | あり（新しい表への INSERT だけ。旧の列は変えない） |
| b | 写さない。新しい表に Q1 が無い職歴だけ、読むときに旧 `join_reasons` を Q1 とみなす | なし（ただし読み手が2つの置き場所を見続ける） |

a を推奨するのは、読み手を新しい表1つに寄せられるため（b は「どちらを正とするか」が読み手ごとに割れる）。

---

## 4. Q2・Q3 の形の案

### Q2（列名 `next_priority`）

`join_reason_primary`（★一番の決め手）と取り違えないよう、「次に求めたもの」と分かる名前にする。

| キー（案） | 表示名 |
|---|---|
| `larger_customers` | もっと大きな顧客と向き合う |
| `deepen_expertise` | 専門性を深める |
| `wider_scope` | 裁量・任される範囲 |
| `salary` | 年収 |
| `flexibility` | 働き方の柔軟さ |
| `business_ownership` | 事業の当事者になる |
| `management` | マネジメントに挑戦 |
| `other` | その他 |

### Q3（`fit_after_year` 1〜5 ＋ `fit_answered_at`）

- 合う会社の並び（`lib/forYou/weights.ts` の `domainFitStatus`）は、Q3 があれば **4〜5 を「合った」・1〜2 を「合わなかった」**、3 はどちらにもしない。Q3 が無いときだけ旧 `fit_score`（7以上／すべて3以下）を使う。
- 旧 `fit_score`（0〜10）は残す。新しい画面からは書かない。

---

## 5. 決めていただきたいこと

1. **置き場所**: 案B（専用の表 `ow_career_turns`）でよいか。
2. **Q1 の旧データ**: 対応表（キーはそのまま・表示名だけ4つ変わる）でよいか。旧データを**写す（a）か、読むときに読み替える（b）か**。
3. **「転機」の単位**: 3問は**その会社に入った職歴1件**に付ける（Q1＝その会社を選んだ決め手、Q2＝その会社に移るときに求めていたこと、Q3＝その会社に入って1年後）でよいか。⚠️ Q2 を「その会社を辞めて次に移るとき」と読むなら、1つ前の職歴に付けることになり、最初の会社の Q2 が聞けなくなる。
4. **Q3 を聞く条件**: 入社から1年たっていない職歴では Q3 を出さない（または「まだ1年たっていない」を選べる）でよいか。
5. **Q2 のキー名**（上の表）でよいか。
6. **いまの「株式会社◯◯について」モーダル（入社後レビュー）との関係**: 3問は職歴を保存した直後に続けて聞く、と指示書にある。いまは保存直後に入社後レビューのモーダルが開く。**入れ替える（3問だけにする）か、3問の後にレビューを続けるか。**
