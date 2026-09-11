# 「候補から外れた職種を持つレコード」の確認手順（2026-09-12 に実施）

2026-08-06 作成 / **2026-09-12 に希望職種で実施**（結果は下記）。
手順そのものは作成時のまま。求人・職歴で実施するときはこの通りに。

## なぜ確認が要るか

職種セレクトに絞り込みを入れた（2026-08-06）。

| 画面 | 絞り込み |
|---|---|
| `/profile/edit`（職歴） | `is_active = true` |
| `/biz/jobs/new` `/biz/jobs/[id]/edit`（求人） | `is_active = true` かつ `is_it_saas = true` |
| **希望職種 / 関心のある職種**（`/mypage` ＋ オンボーディング step2。2026-09-12 追加） | `is_active = true` かつ `is_it_saas = true` |

⚠️★希望職種の条件は [src/lib/roles/desiredRoleOptions.ts](../src/lib/roles/desiredRoleOptions.ts) の
   1箇所にまとめてある。**2つの画面が同じ関数を通る。** 画面側に書き写さないこと。
   ⚠️ 職歴は**全職種のまま**（非IT の8分類を含む）。これまでの経歴なので絞らない。

絞り込みだけを足すと、**条件から外れた職種を既に持っているレコードを編集画面で開いたとき、
セレクトから値が消える**。ユーザーが別項目だけ直して保存すると、その瞬間に職種が失われる。

これを防ぐため、両画面で「現在選択中の職種」と「その親」を候補に足し戻している。

- `src/app/(jobseeker)/profile/edit/page.tsx` — `extraRoles` を UNION
- `src/app/biz/jobs/[id]/edit/page.tsx` — 同じ形

⚠️ **親も足すこと。** 子だけ足しても、親セレクトに親が無ければ子セレクトが開かず結局選べない。

## ✅ 実施した（2026-09-12）

**希望職種で実施した。結果は「足し戻しが効いている」。**

きっかけは別件。2026-09-12 に「関心のある職種」（オンボーディング）と「希望職種」（`/mypage`）の
**絞り込みが食い違っていた**（オンボーディング18分類 / `/mypage` 10分類）ことが分かり、
`/mypage` に揃える（案B）ことになった。その前に、**対象外の職種を持っている人の選択が
消えないか**を確かめた。

### 手順（下の「手順」の希望職種版）

1. 検証用アカウント（`is_test`）に、**対象外の職種**を1件持たせる
   （`医療・介護・福祉` … `is_it_saas = false`）。API `PUT /api/jobseeker/career-preferences` から。
2. `/mypage` の「希望職種」と、オンボーディングの `?step=2` を開く。
3. **別の職種を1件足して保存**する。
4. DB を見て、対象外の職種が残っているかを確かめる。

### 結果

| | 結果 |
|---|---|
| 選択中のチップに出るか | **出る**（「医療・介護・福祉（全般）」） |
| 一覧（アコーディオン）に出るか | **出る**。IT/SaaS の10分類 ＋ 足し戻しの1分類 = **11行** |
| 別の職種を足して保存したあと | **両方残った**（`医療・介護・福祉` ＋ `経営・CxO`） |
| オンボーディングの送信 body | **両方の id を含んでいた**（`fetch` を差し替えて実測） |

⚠️★**保存は差分更新だが、意味としては全件入れ替え**（送られなかったものは DELETE される）。
   だから**画面に出ること＝送られること**が、消えないための唯一の条件になる。
   足し戻しが無ければ、この検証で消えていた。

### 実データの件数（2026-09-12 実測）

- 対象外の職種を持つ **実ユーザー**（`is_test` を除く）: **0件**（全6件が対象内）
- 職種マスタ: 大分類 18（IT/SaaS 10 ／ 非IT 8）／ 有効な職種 148（うち IT/SaaS 102）

⚠️ 実ユーザーが0件なので、**今回の確認は検証用アカウントで作って行った**。
   検証後は削除し、`ow_profile_desired_roles` の件数を作業前（6件）に戻している。

---

## （参考）当時なぜ未実施だったか

**ローカルDBが無い。** `.env.local` は本番の Supabase を指しており、Docker も入っていないため
`supabase start` でローカルスタックを立てられない（CLAUDE.md の「ダンプ手順（Docker なし環境）」と同じ事情）。

この経路を踏むには「候補から外れた職種を持つレコード」が要るが、
2026-08-06 時点で該当は **0件**。作るには本番データの UPDATE が必要になるため実施していない。

- 職歴で `is_active = false` の職種を持つもの: 0件
- 求人で `is_active = false` または `is_it_saas = false` の職種を持つもの: 0件

## いつ実行するか

**本番で初めて職種の統合（`merge_role`）または無効化を行った直後。**
そのとき初めて「候補から外れた職種を持つレコード」が実データとして生まれる。

## 手順

### 1. 対象を特定する

```sql
-- 候補から外れた職種を持つ職歴
select e.id, u.name as ユーザー, r.name as 職種, r.is_active
  from ow_experiences e
  join ow_roles r on r.id = e.role_category_id
  join ow_users u on u.id = e.user_id
 where not r.is_active;

-- 候補から外れた職種を持つ求人
select j.id, j.title, r.name as 職種, r.is_active, r.is_it_saas
  from ow_jobs j
  join ow_roles r on r.id = j.role_category_id
 where not (r.is_active and r.is_it_saas)
union all
select j.id, j.title, r.name, r.is_active, r.is_it_saas
  from ow_job_roles jr
  join ow_jobs j on j.id = jr.job_id
  join ow_roles r on r.id = jr.role_id
 where not (r.is_active and r.is_it_saas);
```

### 2. 画面で確認する

1. `/profile/edit` の該当職歴を開く
   - **職種カテゴリー（親）と職種（子）の両方に値が入っていること**
   - 空になっていたら足し戻しが効いていない
2. **何も変えずに保存**する
3. `role_category_id` が変わっていないことを確認する

```sql
select id, role_category_id, updated_at from ow_experiences where id = '<対象のid>';
```

4. 求人側も同じ（`/biz/jobs/[id]/edit` を開く → 職種タグが残っているか → 保存 → `ow_job_roles` を確認）

### 3. 壊れていた場合

**保存前に気づくこと。** セレクトが空の状態で保存すると `role_category_id` が失われる
（クライアント側の `isValid` で弾かれるはずだが、`ow_job_roles` は配列なので静かに減る可能性がある）。

⚠️ 確認は**読み取りだけで完結させる**。値が保持されているかは画面を見れば分かる。
保存まで試すのは、対象が検証用データのときだけにする。
