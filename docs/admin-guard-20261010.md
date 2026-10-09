# /admin の中身が、運営でないアカウントに RSC で渡っていた（2026-10-10）

## 何が起きていたか

`/admin/layout.tsx` は運営でなければ「この画面は運営メンバーだけが開けます」を返すが、
**ページ側のサーバーコンポーネントは並行して実行され、その結果が RSC ペイロード（HTML 内の `self.__next_f`）に載っていた。**

実測（2026-10-10 / 本番 opinio.jp）: 運営でない検証用アカウント（contact+15）で `/admin/plans` を開くと、
画面は権限エラーなのに、HTML に**企業名とプランの一覧**が入っていた。dev でも同じ（`/admin/approach-range` も同じ形）。
未ログインは middleware が `/auth` へ飛ばすので漏れていない。漏れていたのは「ログインしている、運営でない人」。

## 直し方

`src/middleware.ts` で、`/admin` 配下はログイン済みでも**運営でなければ 403**（`/no-admin-access` へ書き換え）。
判定は `ow_user_roles` に `role='admin'`（`auth_is_admin()` と同じ表）。判定できなかったときも止める（503）。
layout.tsx の判定は残してある（二重防御）。

確認（dev）: 非運営で `/admin`・`/admin/plans`・`/admin/approach-range`・`/admin/candidates`・`/admin/companies` が 403・データ0件 ／
server action の POST も 403 ／ 運営は 200 ／ 未ログインは 307。

## ほかに同じ形が無いか

**layout だけで守っているページは、同じ形で漏れる。** `/biz` は各ページが `getTenantContext()` を自分で呼ぶので該当しない想定だが、
確かめるなら「権限の無いアカウントで開いて、HTML にデータが入っていないか」を数える。
