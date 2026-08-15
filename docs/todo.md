# 宿題（日付の付かない置き場）

⚠️ **日付入りのスナップショット（`current-state-YYYYMMDD.md` など）に宿題を書かないこと。**
   次の版が出た時点で読まれなくなる。恒久的な宿題はこのファイルに集める。

書くときは「対象」「なぜ残っているか」「やるなら何をするか」の3つを入れる。
片付いたら行ごと消す（済みの一覧にしない。履歴は git にある）。

---

## 宿題: avatar_color / cover_color に値の検証が無い（2026-08-15 記録）

`PUT /api/jobseeker/profile` の `avatar_color` / `cover_color` は、
**100字以内の任意の文字列を受け取る**。CSS の値としてそのまま
`style` に埋まるため、本来はホワイトリスト（既定のグラデーション一覧）で
検証すべき列。

2026-08-15 の空入力正規化では**空→null だけを揃え、形式の検証は入れていない**。
入力UIは色の選択肢しか出さないので現状の実害は無いが、API を直接叩けば任意の値が入る。

対象: `ow_users.avatar_color` / `ow_users.cover_color`（どちらも 2026-08-15 時点で `''` は0件）

---

## 宿題: プロフィール画像・カバーに圧縮 / リサイズ / サイズ上限が無い（2026-08-15 記録）

**対象**: `/profile/edit` のアップロード（`ProfileEditClient.tsx` の `uploadPhoto`）。
バケットは `ow-uploads`、パスは `users/{avatars|covers}/{owUserId}/{Date.now()}.{ext}`。

**なぜ残っているか**: クライアントが `File` をそのまま `supabase.storage.upload` に渡しており、
**圧縮・リサイズ・サイズ上限のチェックがコード上に1つも無い**。
スマホで撮った数MBの写真がそのまま公開プロフィールに載る。

**やるなら**: アップロード前にクライアントで長辺をリサイズ（Canvas か `createImageBitmap`）し、
上限（例: 5MB）を超えるものは弾く。**弾いたことを画面に出す**（黙って落とさない）。

---

## 宿題: `social_links` の空文字がキーごと残る（2026-08-15 記録）

**対象**: `PUT /api/jobseeker/profile` の `social_links`（`ow_users.social_links` / JSONB）。

**なぜ残っているか**: 2026-08-15 に空入力を null へ寄せた（`lib/api/normalize.ts`）が、
対象は **text 列だけ**で JSONB は素通し（`patch.social_links = body.social_links as Json | null`）。
SNS の入力を空にして保存すると `null` ではなく **`{"x": ""}`** が残る（実測）。
表示側は truthy 判定なので画面は無事だが、キー存在判定（`social_links ? 'x'`）や
充填率の集計は誤る。

**やるなら**: 空文字の値を持つキーを落とし、全キーが空になったら列ごと null にする。
正規化は `normalize.ts` に足し、`profile/route.ts` がそれを通る形にする
（route に if を書き足さない）。既存データの掃除は**別コミットの migration**。
