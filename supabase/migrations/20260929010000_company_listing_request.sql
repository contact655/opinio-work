-- 企業からの「掲載を依頼する」を記録する（2026-09-29 / 柴さんの指示）
--
-- ── なぜ列を足すか ────────────────────────────────────────────────────────
-- それまで `/biz/company` の「掲載状態」は、未掲載のとき
-- **`/business/contact`（公開のフォーム）へのリンク**しか出していなかった。
-- ログイン済みの企業担当者に、会社名・氏名・メールを**打ち直させていた**うえ、
-- あのフォームは **メール1本で DB に残らない**（`business/contact/page.tsx`）ので、
-- 運営が見落とすと追えず、企業側も「依頼したかどうか」が画面から分からなかった。
--
-- ★この列があると次の3つが同時に成り立つ:
--   ① 二重送信を防げる（押した後は「依頼済み」を出す）
--   ② `/admin` の要対応タスクに「掲載依頼 N社」として出せる（メールを見落としても残る）
--   ③ いつ依頼されたかが残る（`ops_reviewed_at` / `source_verified_at` と同じ形）
--
-- ── ⚠️★なぜ「誰が押したか」を持たないか ──────────────────────────────────
-- `ow_companies` の SELECT は **anon にテーブルレベル**（CLAUDE.md / 2026-09-28 実測
-- 153/153列）。`ow_users.id` を持つ列をここに足すと、`is_published = true` の企業に
-- ついて**その id が誰にでも読める。** CLAUDE.md の
-- 「`ow_companies` に作成者の列を足す形に変えないこと」と同じ理由で持たない。
--   → 押した人の氏名とメールは**運営へのメール本文**に入れる。
--   → 運営が後から辿るなら `/admin/biz-accounts`（その会社の担当者一覧）。
-- ⚠️ 必要になったら `ow_company_creations` と同じ形（運営専用・RLS 有効・ポリシー0本・
--    GRANT 無し）の別表にすること。**この列に user_id を足さない。**
--
-- ── ⚠️ GRANT を配らない ───────────────────────────────────────────────────
-- `ow_companies` は **UPDATE が列単位 GRANT**（CLAUDE.md）。この列は**あえて配らない。**
-- 書くのは `POST /api/biz/company/listing-request` の **admin クライアントだけ**で、
-- 「その企業の有効な管理者か」はルート側で確かめる。
-- ⚠️★**`PATCH /api/biz/company` からは書かせないこと。** あちらは企業側が送った値を
--    そのまま当てる経路で、掲載まわりの操作は 2026-09-18 に企業側から外してある
--    （`isPublished` は 400 で断っている）。同じ扱いにする。
-- ⚠️ 配っていないので、authenticated から直接 UPDATE しようとすると 403 になる。
--    **それが意図した状態。** 「保存できない」と読んで grant を足さないこと。
--
-- ── 直近に `ow_companies` を触った migration ─────────────────────────────
-- `20260928043000`（株式会社テストを is_test に）/ `20260927235500`（登記に合わせて社名5社）/
-- `20260927235000`（マルケトを draft に）。**いずれも既存行の値の更新で、列の追加は無い。**
-- したがって**何も打ち消していない。**

begin;

-- ① 事前チェック：まだ無いこと
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ow_companies'
       and column_name = 'listing_requested_at'
  ) then
    raise exception '中止: listing_requested_at が既に存在する（適用済みか、別の変更が入っている）';
  end if;
end $$;

alter table public.ow_companies
  add column listing_requested_at timestamptz;

comment on column public.ow_companies.listing_requested_at is
  '企業が「掲載を依頼する」を押した日時（最後の1回）。NULL は未依頼。'
  '⚠ 書くのは POST /api/biz/company/listing-request（admin クライアント）だけ。'
  'UPDATE の GRANT は意図して配っていない（authenticated からは 403）。'
  '⚠ 掲載そのものの正は listing_status / is_published / is_approved の3軸。この列は依頼の記録で、掲載状態ではない。'
  '⚠ 運営が対応したら NULL に戻す（/admin/companies の「掲載依頼」）。';

-- ② 事後チェック：列があり、authenticated に UPDATE が配られていないこと
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ow_companies'
       and column_name = 'listing_requested_at'
  ) then
    raise exception '中止: 列が作られていない';
  end if;

  -- ⚠ CLAUDE.md「列を足したあと必ず実測する」。ここは**配っていないこと**を確かめる
  if has_column_privilege('authenticated', 'public.ow_companies', 'listing_requested_at', 'UPDATE') then
    raise exception '中止: authenticated に UPDATE が配られている（この列は admin だけが書く）';
  end if;

  raise notice 'OK: listing_requested_at を追加（authenticated の UPDATE は無し）';
end $$;

commit;

-- ── 戻し方 ────────────────────────────────────────────────────────────────
-- alter table public.ow_companies drop column listing_requested_at;
