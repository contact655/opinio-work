# フェーズA 調査：入社の決め手／離れた理由（2026-08-19）

**調査のみ。実装・DB書き込みはしていない（SELECT と grep だけ）。**
数値はすべて 2026-08-19 の本番実測。実ユーザーの集計は
`is_test` / `is_system` / `@seed.internal` を除いた値。

---

## 要旨（先に3行）

1. **受け皿だけでなく、入力UI・API・CHECK・RLS まで既に全部ある。** 作るものは
   「入れてもらう設計」ではなく、**既にあるものを直す/置き換える**話になる。
2. それでも実データは **join_reasons / join_reason_primary / leave_reasons /
   ow_experience_gaps すべて0件**。機能が載った 2026-08-11 以降にも
   **経歴が5件作られ6件更新されている**のに0件。
3. 今回の設計前提（**3つまで・等重み・順位なし・7軸でグルーピング**）は、
   現行実装（**上限なし・「決め手」を1つ選ばせる・軸なし**）と**正面から食い違う**。
   選択肢スラッグも入社8／退職8で軸が揃っていない。詳細は「設計前提との差分」。

---

## 調査1：既存の受け皿の実態

### 1-1. テーブルか列か

| 受け皿 | 実体 | 型 |
|---|---|---|
| `join_reasons` | **`ow_experiences` の列** | `text[]` NULL可 デフォルト無し |
| `join_reason_primary` | **`ow_experiences` の列** | `text` NULL可 デフォルト無し |
| `leave_reasons` | **`ow_experiences` の列** | `text[]` NULL可 デフォルト無し |
| `ow_experience_gaps` | **別テーブル** | 下の 1-3 |

⚠️ 紛らわしい**旧列が2つ同居している**。

| 旧列 | 型 | 中身 | 実データ |
|---|---|---|---|
| `join_reason` | `text` | **自由記述。公開される**（`visibility_reason` boolean NOT NULL DEFAULT true で出し分け） | **4件** |
| `exit_reason` | `text` | 自由記述。画面から到達する入力UIは無い | **0件** |

`careerReasons.ts` の冒頭に「`join_reason`（自由記述）は撤去予定。それまで並存する」と書かれている。

### 1-2. `ow_experiences` の CHECK（`pg_get_constraintdef` の全文）

```sql
ow_experiences_join_reasons_check
  CHECK (((join_reasons IS NULL) OR (join_reasons <@ ARRAY[
    'business'::text, 'autonomy'::text, 'people'::text, 'salary'::text,
    'growth'::text, 'work_style'::text, 'skills'::text, 'stability'::text])))

ow_experiences_leave_reasons_check
  CHECK (((leave_reasons IS NULL) OR (leave_reasons <@ ARRAY[
    'salary'::text, 'evaluation'::text, 'management'::text, 'outlook'::text,
    'job_fit'::text, 'work_style'::text, 'relationships'::text, 'company'::text])))

ow_experiences_join_reason_primary_check
  CHECK (((join_reason_primary IS NULL)
      OR ((join_reasons IS NOT NULL) AND (join_reason_primary = ANY (join_reasons)))))
```

⚠️ **件数の上限は CHECK に無い。** いま3つに絞るなら CHECK を足す必要がある
（`array_length(join_reasons,1) <= 3`）。

⚠️ `salary` と `work_style` は**入社側と退職側で同じスラッグ**。別の列なので衝突しないが、
ラベルは違う（"年収・待遇" / "給与・待遇"）。**ラベル辞書を共通化しないこと**と
`careerReasons.ts` に明記されている。

### 1-3. `ow_experience_gaps`（テーブル）

| 列 | 型 | NOT NULL | デフォルト |
|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` |
| `experience_id` | uuid | ✓ | — |
| `axis` | text | ✓ | — |
| `rating` | text | ✓ | — |
| `created_at` | timestamptz | ✓ | `now()` |
| `updated_at` | timestamptz | ✓ | `now()` |

```sql
ow_experience_gaps_axis_check
  CHECK ((axis = ANY (ARRAY['autonomy'::text, 'onboarding'::text, 'work_hours'::text,
                            'evaluation'::text, 'decision_speed'::text, 'client_quality'::text])))
ow_experience_gaps_rating_check
  CHECK ((rating = ANY (ARRAY['better'::text, 'as_expected'::text, 'worse'::text])))
ow_experience_gaps_unique   UNIQUE (experience_id, axis)
ow_experience_gaps_experience_id_fkey
  FOREIGN KEY (experience_id) REFERENCES ow_experiences(id) ON DELETE CASCADE
```

- **FK の向き**: gaps → experiences の片方向。
- **被参照 FK: 0本**（このテーブルを指している外部キーは無い）。
- **RLS: `ow_experience_gaps_own_manage`（FOR ALL）1本のみ。**
- **GRANT: `authenticated` に SELECT / INSERT / UPDATE / DELETE。anon は無し。**

### 1-4. 自由文字列か固定選択肢か → **固定選択肢**（TS定数 + DB CHECK）

定義は [src/lib/constants/careerReasons.ts](../src/lib/constants/careerReasons.ts) の1箇所。
**要約せず全件そのまま貼る。**

**入社理由 `JOIN_REASONS`（8件）**

| value | label |
|---|---|
| `business` | 事業内容・プロダクト |
| `autonomy` | 裁量・ポジション |
| `people` | 面接で会った人 |
| `salary` | 年収・待遇 |
| `growth` | 事業の成長性 |
| `work_style` | 働き方 |
| `skills` | 身につくスキル |
| `stability` | 知名度・安定性 |

**退職理由 `LEAVE_REASONS`（8件）**

| value | label |
|---|---|
| `salary` | 給与・待遇 |
| `evaluation` | 評価のされ方・昇進 |
| `management` | マネジメント・組織体制 |
| `outlook` | 事業の先行き |
| `job_fit` | 仕事内容が合わない・伸び代 |
| `work_style` | 働き方 |
| `relationships` | 人間関係 |
| `company` | 会社都合・組織変更 |

**ギャップの軸 `GAP_AXES`（6件）**

| value | label |
|---|---|
| `autonomy` | 裁量の大きさ |
| `onboarding` | 教育・オンボーディング |
| `work_hours` | 労働時間 |
| `evaluation` | 評価の納得感 |
| `decision_speed` | 意思決定のスピード |
| `client_quality` | 顧客・案件の質 |

**ギャップの回答 `GAP_RATINGS`（3件）**

| value | label |
|---|---|
| `better` | 想像より良かった |
| `as_expected` | 想像通り |
| `worse` | 想像より厳しかった |

⚠️ ファイルに「**値は英字スラッグで固定。削除と改名はしない（追加のみ）**」
「**『未回答』という value を作らない**（gaps は行が無いことで表す）」と既に書かれている。
今回の前提「選択肢IDは絶対に再利用しない」と同じ方針が既に採られている。

### 1-5. 実データ（0件の再確認）

| | 全件 | 実ユーザーのみ |
|---|---|---|
| `ow_experiences` | 19 | **18** |
| `join_reasons` が NOT NULL | **0** | **0** |
| `join_reason_primary` が NOT NULL | **0** | **0** |
| `leave_reasons` が NOT NULL | **0** | **0** |
| `ow_experience_gaps` の行 | **0** | **0** |
| 旧 `join_reason`（自由記述）が空でない | 4 | — |
| 旧 `exit_reason` が空でない | 0 | — |

⚠️ **「まだ誰も使っていない0」と断定できない。** 受け皿を作った migration
`20260811184225` の適用日以降に、**経歴は5件作られ6件更新されている**
（`ow_experiences` の最終更新は 2026-08-14 14:36 UTC）。
CLAUDE.md「0件を読むときは、起きなかった0か起こせなかった0かを分ける」の判定手順では

1. **書き込むコードが存在するか** → **存在する**（調査2）
2. **その経路に到達できるか** → **✅ フェーズB（同日）で疎通を確認した。**

**→ 結論は「起きなかった0」。** is_test アカウントで UI から入力して保存したところ、
POST（201）も PUT（200）も通り、3列と `ow_experience_gaps` に値が入った。
編集で他の項目だけ変えても理由データは消えなかった。**保存経路は壊れていない。**
（検証行は削除し、`ow_experiences` 19件 / gaps 0件 / 理由データ0件の作業前の状態に戻した）

⚠️ ただし**入口は深い**。追加モーダルの本文は 1280px で 2,105px・375px で 2,773px あり、
このブロックはその **1,086px / 1,103px 目**（＝約2画面ぶん下、下から2番目）に出る。

---

## 調査2：入力経路があるか → **ある**

**「無い」ではない。UI・API・検証・保存の一式が揃っている。**

| 層 | 実体 |
|---|---|
| UI | [CareerHistoryEditor.tsx](../src/components/profile/CareerHistoryEditor.tsx) の `StintForm` 内、**1123〜1257行**（直後の1259行から自由記述） |
| 検証 | `parseReasonFields()`（[careerReasons.ts](../src/lib/constants/careerReasons.ts)）。POST と PUT が**同じ関数**を呼ぶ |
| 保存(新規) | `POST /api/jobseeker/experiences`（route.ts:273 で `parseReasonFields`） |
| 保存(更新) | `PUT /api/jobseeker/experiences/[id]`（[id]/route.ts:105 で同じ関数） |
| gaps の保存 | 同 PUT 内で `delete` → `insert` の入れ替え。行の絞り込みは RLS |
| 読み出し | `GET /api/jobseeker/experiences` と `/mypage` の SSR。**どちらも `createAdminClient`** |

### 画面の説明（コードから）

職歴の追加／編集モーダル（`ProfileEditModal`）の中、**自由記述「なぜこの会社を選んだか」の直前**に、
薄い背景（`--bg-tint`）で囲われた1ブロックがある。

```
┌────────────────────────────────────────────────┐
│ 入社・退職の背景（すべて任意）  [この内容は公開されません]│
│ あなた以外には表示されません。企業にも、ほかの登録者にも…│
│                                                │
│ この会社に入った理由（複数選べます）              │
│  [事業内容・プロダクト][裁量・ポジション][面接で会った人]│
│  [年収・待遇][事業の成長性][働き方][身につくスキル]…    │
│                                                │
│ その中で、いちばんの決め手は     ← 1つ以上選ぶと出現   │
│  [選んだ理由だけがチップで並ぶ／もう一度押すと解除]      │
│                                                │
│ この会社を離れた理由（複数選べます） ← 現職には出さない  │
│  [給与・待遇][評価のされ方・昇進][マネジメント…]…      │
│                                                │
│ 入る前の想像と、実際のギャップ                    │
│  裁量の大きさ    [想像より良かった][想像通り][厳しかった]│
│  教育・オンボーディング  [ 〃 ]                   │
│  …（6軸ぶん縦に並ぶ）                           │
└────────────────────────────────────────────────┘
```

- チップは `ReasonChip`（トグル）。**自由記述欄は無い**（「その他」も無い）。
- 「公開されません」の緑バッジと説明文が**ブロック先頭に常時出る**。
- **折りたたみは無い。** 常に展開された状態でフォーム内に置かれている。
- 上限は**無い**（8個すべて選べる）。

---

## 調査3：職歴入力UIの現状

### 3-1. ファイルと構成

[src/components/profile/CareerHistoryEditor.tsx](../src/components/profile/CareerHistoryEditor.tsx)（約1,760行）。

- 一覧・鉛筆・ゴミ箱・「＋」は**このファイルには無い**。公開部品（`MergedTimeline`）が描く。
  このファイルが持つのは **モーダル（追加・編集の共通フォーム）と削除確認だけ**。
- フォーム本体は `StintForm`（759行〜）。モーダルは `ProfileEditModal`（1720行）。
  保存ボタンはモーダル右下の1つだけ、閉じるときは未保存なら破棄確認。

フォームの並び（上から。行番号は実測）:

| 行 | 項目 |
|---|---|
| 847 | 会社名（必須） |
| 896 | 職種（必須） |
| 911 | 役職 |
| 926 | 雇用形態 |
| 953 | 社内での呼び方（任意） |
| 969 | 部署名（任意） |
| 983 | 入社年月（必須） |
| 1009 | 現職 or 退職年月（必須） |
| 1056 | 勤務地・勤務形態 |
| 1108 | 業務内容 |
| **1123** | **入社・退職の背景（本件）** |
| 1261 | なぜこの会社を選んだか（自由記述・公開） |

⚠️ **公開設定（`visibility_company` など）の入力欄は 2026-08-16 に外れている。**
   保存時は `draft` が持つ既存値がそのまま送られる。
   本件のブロックは**フォームのいちばん下から2番目**にあり、
   その上に「業務内容」のテキストエリアがある。

### 3-2. 1社ぶんのカードの単位 → **設問を入れられる構造**

- モーダルは **`Stint`（＝`ow_experiences` の1行）単位**で開く。
  同じ会社で役割が複数ある場合は `groupStints()` が表示上まとめるが、
  **編集フォームは1行ずつ**（「この会社に役割を追加」は別の行を作る）。
- したがって設問は**すでに正しい単位に入っている**。会社単位ではなく在籍1本ごとに答える形。

⚠️ 同じ会社で役割を分けている人は、**同じ会社に対して入社理由を複数回聞かれる**構造になる。
集計時に人単位で寄せるのか在籍単位で数えるのかを決める必要がある（調査5参照）。

### 3-3. 終了日での出し分け → **できるが、いまは終了日で判定していない**

現行は **`!draft.isCurrent`（現職チェックが外れているか）** で出し分けている
（CareerHistoryEditor.tsx:1204）。`ended_at` の有無では見ていない。

| | 実測（実ユーザー18件） |
|---|---|
| `is_current = true` | **9** |
| `ended_at IS NOT NULL` | **9** |

いまは一致しているが、**構造上は一致が保証されていない**（`is_current=false` で
`ended_at` 未入力の行を作れる。フォームは終了日を必須にしていない）。
「終了日がある職歴にだけ出す」を厳密にやるなら判定式を変えることになる。

⚠️ 保存側は `leave_reasons: d.isCurrent ? [] : d.leaveReasons` として
**現職なら空を送る**（`buildReasonBody`）。DB の CHECK では縛っていない
（列コメントに「現職に変更したのに退職理由が残っていて保存が落ちる、を避けるため」と明記）。

### 3-4. 保存時のリクエスト形式

新規は `POST /api/jobseeker/experiences`、更新は `PUT /api/jobseeker/experiences/[id]`。
理由データの部分は `buildReasonBody()` が作る（**POST と PUT で同じ関数**）。

```jsonc
{
  // …会社・職種・期間などの通常フィールド…
  "prefecture": "東京都",
  "remote_work_status": "hybrid",
  "join_reasons": ["business", "autonomy"],     // スラッグの配列
  "join_reason_primary": "autonomy",            // join_reasons に含まれる1つ or null
  "leave_reasons": [],                          // 現職なら必ず []
  "gaps": [{ "axis": "autonomy", "rating": "better" }]  // 別テーブルぶん
}
```

⚠️ `gaps` キーが**無ければ触らない／`[]` なら全消し**という約束になっている
（`parseReasonFields` の戻り値 `gaps: null` と `[]` の区別）。

---

## 調査4：選択肢マスタの置き場

### 4-1. このプロジェクトの3方式（代表例）

| # | 方式 | 代表例 | 実測 |
|---|---|---|---|
| ① | **マスタテーブル** | `ow_roles`（職種）／`ow_tool_masters`（ツール） | `ow_roles` 154行・トップレベル18件。2階層。`parent_id` / `merged_into_id` / `is_active` / `display_order` を持つ |
| ② | **TS定数 + DB CHECK** | `careerReasons.ts` + `ow_experiences_*_check`（本件）／`workStyle.ts` + `ow_experiences_remote_work_status_check` | `ow_experiences` の CHECK は9本 |
| ③ | **TS定数のみ（CHECK なし）** | `roleTracks.ts` の `ROLE_NAME_TRACK`／**`careerOptions.ts` の `EMPLOYMENT_TYPES`** | 下の⚠️ |

⚠️ **`ow_experiences.employment_type` には CHECK が無い**（実測: 0本）。
   一方 `ow_jobs.employment_type` には**ある**（1本）。
   CLAUDE.md「UI / API / DB の CHECK を3つ揃える」は 2026-08-07 に
   `employment_type` の事故を受けて確立された規則だが、**経歴側は CHECK が入っていない。**
   本件の作業とは独立だが、同じ表を触るときに気づける位置なので記録しておく。

### 4-2. 過去に採用された方針

**CLAUDE.md「⚠️ 選択肢が決まっている値は『UI / API / DB の CHECK』を3つ揃える」（2026-08-07 確立）。**
1日で同じ形のバグが4件出たことを受けて確立されたもの。要点は4つ:

1. 許可値は `src/lib/constants/` の1箇所に置く（route の中に `new Set([...])` を書かない）
2. DB にも CHECK を張る（コードの検証は「これから入るもの」しか止められない）
3. 画面に出す値と DB に入れる値が違うなら `{value, label}` で持つ
4. 値を1つ足すときは3つとも足す

補足の記録が [docs/current-state-20260812.md:465](current-state-20260812.md) にあり、
**「`ow_roles` は CHECK ではなくテーブルなので migration 1本で済むが、
振り分け定数と `/people` のフィルタ定数も同時に見ること」**と書かれている。
つまり**①でも②でも「1箇所に集めて全部同時に直す」が方針**で、方式そのものは使い分けている。

### 4-3. 今回はどの方式に揃えるべきか（意見）

**②（TS定数 + DB CHECK）を維持するのを薦める。** 理由:

- **既に②で動いている。** 定数・CHECK・検証関数・UI が揃っており、
  マスタテーブル化は「動いているものを作り直す」ことになる。
- 選択肢が**運営の日常運用で増減しない**。`ow_roles` や `ow_schools` がテーブルなのは
  運営が随時足すから。決め手の選択肢は**設計判断であって運用データではない**。
- 集計時に **JOIN が1本減る**。企業ページの分布は `ow_experiences` 単体で GROUP BY できる。

ただし今回の前提「**軸を裏側のタグとして各選択肢に持たせる**」は、
②のまま `careerReasons.ts` に `axis` フィールドを足すだけで実現できる。

```ts
export const JOIN_REASONS = [
  { value: "business", label: "事業内容・プロダクト", axis: "work" },
  …
] as const;
```

⚠️ **DB に軸は持たせない**ことを薦める。軸は後から切り方を変える前提なので、
CHECK に入れると変更のたびに migration が要る。**軸はコード側だけに置き、
DB には選択肢スラッグだけを保存する**（前提の「軸を変えても選択肢IDが不変」と整合する）。

⚠️ **`rank` 列（nullable）を用意するなら、`join_reasons` が配列なので置き場が無い。**
配列に順位を持たせられないため、選択肢ごとの順位が要るなら
**`ow_experience_join_reasons`（experience_id, reason, rank）のような別テーブル**に
移すか、`jsonb` にするかの判断が要る。現行の `join_reason_primary`（1位だけ持つ）は
その簡易版として既に存在する。**ここは設計判断が要るので、次フェーズで決めること。**

---

## 調査5：集計の実現可能性

### 5-1. 経路は引ける

`ow_experiences.company_id` → `ow_companies.id` の FK があり、理由データは
同じ `ow_experiences` の行に載っている。**JOIN 1本で企業ごとの分布が出る。**

```sql
-- 例（いまは0件しか返らない）
select unnest(join_reasons) as reason, count(*) 
from ow_experiences where company_id = $1 and join_reasons is not null
group by 1 order by 2 desc;
```

⚠️ **読み出しは admin クライアントが要る。** `join_reasons` /
`join_reason_primary` / `leave_reasons` は `authenticated` に SELECT が無い
（実測: SELECT=false / UPDATE=true）。集計をページで出すなら `createAdminClient` で引く。

### 5-2. 閾値に届くか（現状の上限）

| | 実測（実ユーザー18件） |
|---|---|
| 経歴が1件でもある企業 | **6社**（`ow_companies` は87社） |
| 経歴が**3件以上**の企業（＝入社の決め手の閾値） | **2社** |
| 経歴が**5件以上**の企業（＝退職理由の閾値） | **1社** |
| うち**退職済み**（`ended_at` あり）が5件以上の企業 | **0社** |
| 1社あたりの最大 | 6件 |

⚠️ **仮に全員が今すぐ回答しても、退職理由を出せる企業は0社。**
入社の決め手でも2社。**閾値の設計より先に、母数が要る。**
「集計を出す」を成果指標に置かない方がよい。

### 5-3. 自由入力企業（`company_text`）の扱い（意見）

| | 実測（実ユーザー18件） |
|---|---|
| `company_id` あり（マスタ紐づけ） | **13**（72.2%） |
| `company_text` のみ（自由入力） | **5**（27.8%） |
| `company_anonymized` のみ | **0** |
| 自由入力の異なり社名 | **5**（重複なし） |

**意見: 集計からは落とす。ただし「落ちている」ことを運営が見られるようにする。**

- 表記ゆれを名寄せして集計に入れると、**別会社を1社として数える事故**が起きうる。
  企業ページに出す数字なので、そこは保守的にするべき。
- 一方で「27.8%が集計に乗らない」は**データが足りない話ではなく、名寄せの宿題**。
  `ow_companies.normalized_name` / `canonical_company_id` 列が既にある（運営用）。
  **自由入力の社名を運営画面で棚卸しして `company_id` に寄せる導線**を作れば、
  回答データを触らずに集計対象が増える。
- 回答する本人には**何も変えない**。「マスタから選んでください」と強制すると入口が重くなる
  （オンボーディングで自由入力を許した判断と揃える）。

⚠️ **同一人物が同じ会社で複数行を持つケース**（役割を分けている人）を、
集計で1人として数えるか在籍ごとに数えるかを決めること。
「入社の決め手」は**入社イベント1回**に対する回答なので、
`user_id × company_id` で重複排除するのが自然（ただし転職して出戻った人は別イベント）。

---

## 設計前提との差分（★ここが本題）

指示の「設計の前提」と、**いま動いている実装**の食い違い。

| 前提 | 現行実装 | 差分の重さ |
|---|---|---|
| 選択は**3つまで** | **上限なし**（8個すべて選べる）。CHECK にも上限なし | UI・API・CHECK の3箇所を足す |
| **等重み・順位は取らない** | **「その中で、いちばんの決め手は」で1つ選ばせている**（`join_reason_primary` + CHECK） | **設問を1つ消すことになる**。列も CHECK も残すか消すかの判断が要る |
| `rank` 列を nullable で用意 | 配列なので**置き場が無い**。`join_reason_primary` が1位だけの簡易版 | 別テーブル化 or jsonb 化の設計判断 |
| **7軸でグルーピング**（仕事の中身/裁量・役割/人・組織/待遇/働き方/会社の状態/個人の事情） | **軸は無い。フラット8件** | 選択肢の再設計。**スラッグは再利用しない前提なので、新旧の対応表が要る** |
| 入社側と退職側で**軸を揃える** | 揃っていない（入社8 / 退職8 で意味が対応していない。例: 入社に `growth`・退職に `outlook`） | 同上 |
| 「その他」の自由記述を置かない | **置いていない** ✓ | 一致 |
| 職歴カードの中に埋める | **埋まっている** ✓ | 一致 |
| 離れた理由は終了日がある職歴だけ | **`is_current` で判定**（実データでは一致するが構造上は別物） | 判定式を変えるかの判断 |
| 個人プロフィールに出さない | **出していない** ✓（緑バッジで明示・GRANT でも塞いである） | 一致 |

⚠️ **既存データが0件なので、スラッグを作り直しても既存行との整合を考えなくてよい。**
作り直すなら**いまが唯一のタイミング**（1件でも入ると
「削除と改名はしない（追加のみ）」の縛りが効き始める）。

---

## CLAUDE.md との差分

| # | CLAUDE.md の記述 | 実測（2026-08-19） |
|---|---|---|
| ① | 「トップレベルは **17件**（2026-08-10 実測）」 | **18件**（`parent_id is null` かつ `merged_into_id is null` かつ `is_active`）。1件増えている |
| ② | `ow_experiences` の列単位 GRANT は「26 / 35」 | 本調査の範囲では確認していないが、**`join_reason`（旧・自由記述）は anon にも SELECT がある**（`has_column_privilege('anon',…,'join_reason','SELECT') = true`）。公開列なので意図どおりだが、CLAUDE.md には anon 側の記述が無い |
| ③ | — | `careerReasons.ts` のコメント「**DB 側でも GRANT を付けていないので admin クライアント以外からは読めない**」は、**`ow_experience_gaps` については誤り**。同テーブルは `authenticated` に SELECT/INSERT/UPDATE/DELETE があり、RLS（`ow_experience_gaps_own_manage`）で本人に絞っている。正しいのは `ow_experiences` の3列のほう |
| ④ | 「`ow_experiences` 14件 / 実人数5人」（2026-08-10） | **19件（実ユーザー18件）**。増えている |
| ⑤ | 「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」（2026-08-07 確立） | **`ow_experiences.employment_type` に CHECK が無い**（`ow_jobs` 側にはある）。規則が確立された当の列で、経歴側だけ揃っていない |

---

## 次にやるべき検証（実装の前に）

**0件が「使われていない0」か「保存できていない0」かを、まだ誰も確かめていない。**
CLAUDE.md の判定手順②が空欄のままなので、設計を作り直す前にここを埋める。

1. `is_test` のアカウントでログインし、**職歴の編集モーダルを実際に開く**
   → 「入社・退職の背景」ブロックが**画面に見えるか**（モーダルのどの位置にあるか・
     375px で何スクロール下か）を測る
2. チップを押して**保存し、DB に行が入るか**を SELECT で確かめる
   （HTTP 200 では判定しない）
3. 確認後、**作業前の値に戻して一致を実測する**

⚠️ 2 が通るなら「入口が見えていない／面倒で飛ばされている」問題であり、
**選択肢を作り直すより先に、設問の見せ方の問題**ということになる。
2 が通らないなら、直すのは選択肢ではなく保存経路。**どちらかで打ち手が変わる。**
