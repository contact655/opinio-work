-- 旧「対象業界」（ow_company_target_industries）と、それに書く RPC を落とす（2026-10-18 / 柴さんの指示）
--
-- ■ なぜ
--   2026-10-12 から企業（/biz/company）と運営（/admin の分類タブ）が入力するのは
--   「主なお客さまの業界」（ow_company_customer_industries ＋ ow_companies.customer_all_industries / serves_consumers）。
--   旧表に書くのは運営の旧 API（/api/admin/companies/[id]/target-industries）だけで、その画面からの呼び手は0件だった。
--   2026-10-18 に読み手3つ（/companies の ?target=・/mypage の「経験が活きる会社」・企業ページ）を新しい表へ移し、
--   src から旧表を読む箇所は0件になった（同じ変更で API と lib/companies/targetIndustries.ts も削除）。
--
-- ■ 消す前に数えたもの（2026-10-18 実測）
--   行数 10（新しい表と同じ10社。違いは建設4社が 旧=建設・設計（小分類）/ 新=不動産・建設（大分類）だけ）
--   この表を指す FK 0 ／ ビュー 0 ／ トリガー 0
--   関数の本体で参照するもの: set_company_target_industries の1本だけ（下で落とす）
--   ポリシー: この表自身の2本（company_target_industries_anon_read / _auth_read。表と一緒に消える）
--   作業前ダンプ: .dumps/20261018-0319-ow_company_target_industries.sql（スキーマ＋データ・10行）
--
-- ■ 残すもの
--   ow_companies.target_industry_scope … /admin/companies がまだ読んでいる（未設定の絞り込み）。別に判断する。
--   ow_companies の (id, target_industry_scope) の一意制約 … 複合FKの相手だった。残しても害は無い。
--
-- ⚠️ CASCADE を付けない。想定外の依存があれば失敗させたい。
-- ■ 戻し方: 作業前ダンプを psql で流し、set_company_target_industries を
--   20261018050000_target_industries_allow_horizontal.sql（またはそれ以前の定義）から作り直す。

begin;

do $$
declare n int;
begin
  -- 関数の本体（行コメントを除く）で、この表を参照するのが set_company_target_industries だけであること
  select count(*) into n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname <> 'set_company_target_industries'
     and regexp_replace(prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'ow_company_target_industries';
  if n <> 0 then raise exception '想定外: 他の関数が ow_company_target_industries を参照している (%)', n; end if;

  select count(*) into n from pg_constraint where confrelid = 'public.ow_company_target_industries'::regclass;
  if n <> 0 then raise exception '想定外: この表を指す FK がある (%)', n; end if;

  select count(*) into n from pg_views where schemaname = 'public' and definition ~ 'ow_company_target_industries';
  if n <> 0 then raise exception '想定外: この表を参照するビューがある (%)', n; end if;

  select count(*) into n from public.ow_company_target_industries;
  if n <> 10 then raise exception '想定外: 行数が10ではない (%)。ダンプを取り直してから流すこと', n; end if;
end $$;

drop function public.set_company_target_industries(uuid, text, uuid[], uuid);
drop table public.ow_company_target_industries;

-- 検算
do $$
begin
  if to_regclass('public.ow_company_target_industries') is not null then raise exception '表が残っている'; end if;
  if exists (select 1 from pg_proc where proname = 'set_company_target_industries') then raise exception '関数が残っている'; end if;
end $$;

commit;
