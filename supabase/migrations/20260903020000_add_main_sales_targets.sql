-- 主な営業先（どの部署に売っているか）を ow_companies に足す。
--
-- ⚠️★**`main_customers` を流用しない。** あちらは「顧客そのもの」で、
--    実測（2026-09-03 / 本番）では9社が持ち7社で表示中：
--      Datadog「NTTドコモ / KDDI / ソフトバンク」＝企業名
--      タイミー「コンビニ・小売チェーン」＝業種
--    一方この列に入れるのは「営業部 / 人事部 / 情報システム部」＝**顧客企業の中の部署**で、
--    粒度がまったく違う。同じ列に混ぜると、列名と中身が食い違う状態になる
--    （CLAUDE.md: `industry`(text) が「業界ではなく製品領域」だった件と同じ形）。
--
-- ⚠️ `market_decision_maker` も流用しない。あちらは散文1つ（Salesforce 1社のみ）で
--    「営業・IT 部門長〜CxO レベル。…」という文章。配列ではない。

alter table public.ow_companies
  add column if not exists main_sales_targets text[];

comment on column public.ow_companies.main_sales_targets is
  '主な営業先。顧客企業の中の「どの部署に売るか」を配列で持つ（例: 営業部 / 人事部 / 情報システム部）。'
  '⚠️ 顧客そのものは main_customers。混ぜないこと。';

-- ⚠️★**GRANT を必ず書く。** `ow_companies` はテーブルレベルの UPDATE を落として
--    列単位で配り直しているので、**新しい列は生まれた時点で書き込めない**
--    （authenticated から更新すると 403）。他のテーブルと違い「足せば使える」ではない。
grant update (main_sales_targets) on public.ow_companies to authenticated;

-- 適用後の実測（catalog を見るだけでなく、下の DO でその場で確かめる）
do $$
begin
  if not has_column_privilege('authenticated', 'public.ow_companies', 'main_sales_targets', 'UPDATE') then
    raise exception 'main_sales_targets の UPDATE 権限が authenticated に付いていない';
  end if;
  -- SELECT はテーブルレベルなので付いているはず。念のため確認する
  if not has_column_privilege('anon', 'public.ow_companies', 'main_sales_targets', 'SELECT') then
    raise exception 'main_sales_targets の SELECT 権限が anon に無い（求職者側で読めない）';
  end if;
end $$;
