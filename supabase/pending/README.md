# supabase/pending/ — まだ当てない migration の置き場

**適用日が決まっていない migration は、ここに置く。`supabase/migrations/` に置かない。**

## なぜこの置き場が要るか

`supabase db push` は **保留中の migration を全部当てる。** 1本だけを選べない。

したがって、ファイルの冒頭に

```sql
-- ⚠️ このファイルは、利用規約の改定日が決まるまで適用しないこと
```

と書いても **ロックにはならない。** 別の人が自分の migration を当てるために
`db push` した瞬間、保留分としてまとめて適用される。

⚠️ **2026-08-26 に実際に踏んだ。**
`20260827090000_scout_gate_career_stance.sql`（スカウト送信可否を
`ow_profiles.career_stance` に付け替えるもの）が、冒頭の「適用しないこと」に反して
本番へ当たった。打ち消す migration を別に足して戻している
（`20260827140000_revert_scout_gate_career_stance.sql`）。

**コメントは人に読ませるもので、CLI は読まない。** 置き場所で分ける。

## 使い方

| いつ | どうする |
|---|---|
| 適用日が未定のものを書いた | **`supabase/pending/` に置く**（`supabase/migrations/` には置かない） |
| **コミット単位を揃えるための一時退避** | **ここを使う**（scratchpad は使わない。⚠️ 消えるし、他のセッションから見えない） |
| 適用日が決まった | `supabase/migrations/` へ **移動**し、そのとき採番を振り直す |
| `db push` する前 | **必ず `supabase migration list` で保留分を確認する** |

```bash
# 当てる前に、自分のファイル以外が保留になっていないかを見る
npx supabase migration list
```

⚠️ 保留が複数あるときは、**他人のものも一緒に出ていく前提**で判断すること。
   自分のものだけを当てたい場合、先に持ち主へ確認する。

## 採番について

**ここに置いている間の採番は仮。** 移すときに、そのときの日時で振り直す。

⚠️ 古い採番のまま `migrations/` へ移すと、**既に適用済みの migration より前の番号**に
なることがある。台帳（`supabase_migrations.schema_migrations`）は採番順に並ぶので、
順序が壊れると後から追えなくなる。

## ここに置いてよくないもの

- **既に本番へ当たっているもの**（履歴なので `migrations/` に残す）
- **打ち消し（revert）**。あれは「いま当てる」ものなので `migrations/` に置く

---

⚠️ 運用の根拠は CLAUDE.md「**保留したい migration を `supabase/migrations/` に置かない**」。
   片方だけ直すと食い違うので、変えるときは両方を直すこと。
