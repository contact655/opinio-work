# サービスを一言で表す文言の一覧（2026-09-17 実測）

★**今回は変えていない。どれに揃えるかは柴さんが決める。**
この文書は「いま何種類あって、どこに出ているか」を数えた記録。

⚠️ 数えたのは `src` と `content`。**メール・OG画像・metadata を含む。**
⚠️ 変えるときは**全部を同時に**動かすこと。1つだけ直すと種類が増えるだけで減らない。

---

## 5種類ある

| # | 文言 | 主にどこに出るか | ファイル |
|---|---|---|---|
| **A** | **IT業界のキャリアインフラ** | ★**メール4種のヘッダー**と**OG画像** | `lib/notify/templates.ts` / `lib/auth/postAuth.ts` / `api/cron/weekly-jobs` / `api/cron/weekly-match` / `api/admin/invite` / `api/og/route.tsx` |
| **B** | **IT業界特化のキャリアプラットフォーム** | ★**フッター右下**と `<title>` | `app/layout.tsx`（title）/ `app/(jobseeker)/layout.tsx` / `app/(jobseeker)/people/role/[slug]/page.tsx` / `components/jobseeker/JobseekerFooter.tsx` |
| **C** | IT業界**に特化した**キャリアプラットフォーム | metadata の description / `/business` | `app/layout.tsx`（description）/ `app/business/page.tsx` / `api/admin/invite` |
| **D** | IT企業の求人と人を探せるプラットフォーム | ★**フッターの1行目** | `components/jobseeker/JobseekerFooter.tsx` |
| **E** | IT業界の企業情報・求人 | `<title>` の一部 | `app/layout.tsx` / `app/(jobseeker)/companies/(list)/page.tsx` / `app/(auth)/layout.tsx` |

⚠️★**B と C は「特化」の書き方が違うだけ**（「IT業界特化の」／「IT業界に特化した」）。
   意味は同じで、**見比べないと気づかない**。減らすならまずここ。

⚠️★**A だけがサイト本体に1度も出ていない。** メールと OG画像の中にしかない。
   ＝ **サイトを見ている人と、メールを受け取った人が、別の看板を見ている。**

⚠️ **D はフッターの1行目、B はフッターの右下。** 同じフッターに2種類ある。

---

## いま LP の見出しと揃っているもの — 無い

2026-09-17 に LP の見出しを **「会社を、そこで働く人から知る。」** に、
metadata の title を **「OPINIO — 会社を、そこで働く人から知る」** にした。
A〜E のどれとも重ならない。⚠️ **6種類目を増やした形になっている。**

---

## 揃えるときの注意

⚠️★**メール（A）を変えるときは PNG のロゴと同じ行にあることに注意。**
   `templates.ts` のヘッダーはロゴ画像の右に小さく置いてある。長い文言にすると折り返す。

⚠️★**`app/layout.tsx` には B・C・E の3つが同居している**（title / description / OG）。
   1ファイルの中でも揃っていない。

⚠️ フッター（B・D）は **2026-09-17 時点で別セッションと共有中**。
   触るときは `git status` を見てから。

⚠️★**「キャリアインフラ」と「キャリアプラットフォーム」は別の主張。**
   インフラは「無いと困るもの」、プラットフォームは「場」。
   語を選ぶ前に、**どちらを名乗るのか**を決めること。文字数の問題ではない。
