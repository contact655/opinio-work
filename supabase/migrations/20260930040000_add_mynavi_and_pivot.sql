-- 株式会社マイナビ / PIVOT株式会社 をマスタに追加する（職歴の企業ピッカー用）
--
-- 柴さんの指示（2026-09-30）。「ユーザーがこれまでの在籍企業を登録する際に
-- 検索で出てくるようにしたい」。
--
-- ⚠️★**ディレクトリには載せない。** `listing_status='draft'` / `is_published=false`。
--    どちらも IT/SaaS ではない（人材サービス／ビジネスメディア）ので掲載の対象外。
--    ピッカーが見るのは**マスタの軸**（`/api/companies/lookup` は `is_test=false`
--    だけで絞る）なので、これで検索には出る。CLAUDE.md ⑨「企業名を引く経路は3つ」。
--
-- ⚠️ `is_published=false` なので**企業ページは 404**。職歴からはリンクにならず
--    会社名がテキストで出る（`lib/utils/timeline.ts`）。利用者が作った企業7社と同じ形。
--
-- ⚠️★**`is_published` / `listing_status` を明示する。** DB の既定は
--    `true` / `'listed'` なので、name だけ INSERT すると**掲載中で公開**になる。
--
-- ⚠️ `name_en` は入れない。入れると `companyDisplayName` がそちらを優先し、
--    表示名が「Mynavi」になる。**日本でのブランドはカタカナの「マイナビ」**なので、
--    `stripLegalSuffix` に任せて「マイナビ」「PIVOT」にする。
--    ラテン表記で探す人は `search_aliases` で拾う。
--
-- ⚠️ `ow_company_creations` には書かない。`source='migration'`（＝運営が作った）で
--    足りるうえ、あの表の検査は `source in ('biz_self','user')` しか見ない。
--    作成者 NULL の行を足すと「記録が無い」と「作成者が居ない」が混ざる。
--
-- ── 登記で確かめたこと（2026-09-30 / 国税庁法人番号公表サイト）─────────────────
-- ⚠️★対照に「アドビ」を先に引き、閉鎖印の無い法人が正しく出ることを確認してから通した
--    （CLAUDE.md ⑩「対照を先に引くこと」）。
--
--   株式会社マイナビ   法人番号 3010001029968 ／ 東京都千代田区一ツ橋１丁目１番１号
--                      22件中に閉鎖印なし。公式サイトの本社所在地と一致
--   PIVOT株式会社      法人番号 9010401160615 ／ 東京都渋谷区神宮前６丁目１７番１１号
--                      ＪＰＲ原宿ビル２階。公式サイトの本社所在地と一致
--
-- ⚠️★**同名の別法人が4件あった**（Ｐｉｖｏｔ株式会社＝埼玉・東京渋谷２丁目、
--    ＰＩＶＯＴ株式会社＝岐阜）。**所在地まで突き合わせて特定している。**
--    表示件数を100件にして73件すべてを見た（CLAUDE.md ⑩ の 2026-09-28 追記）。
-- ⚠️ 登記は全角（ＰＩＶＯＴ）だが、**半角ラテンで入れる**（登記側の正規化なので）。

begin;

do $$
declare
  v_mynavi uuid;
  v_pivot  uuid;
  n int;
begin
  -- ── 事前検算。既にあれば中止する ────────────────────────────────────────
  select count(*) into n from public.ow_companies
   where name ilike '%マイナビ%' or name ilike '%mynavi%'
      or name ilike '%pivot%'   or coalesce(search_aliases,'') ilike '%マイナビ%';
  if n <> 0 then raise exception '既に似た名前の企業がある: % 件', n; end if;

  -- ── 株式会社マイナビ ────────────────────────────────────────────────────
  insert into public.ow_companies (
    name, brand_name, slug, search_aliases, url, industry_id,
    headquarters_address, founded_year, employee_count,
    source, is_published, listing_status, is_approved, is_test
  ) values (
    '株式会社マイナビ', 'マイナビ', 'mynavi',
    -- ⚠️ ラテン表記で探す人のため。`name` に「マイナビ」があるので和名は本来不要だが、
    --    別名だけを見る経路が将来できても困らないよう両方入れてある
    'Mynavi Mynavi Corporation マイナビ',
    'https://www.mynavi.jp/',
    '2310dd6f-04f9-43f5-a3a4-e344ca1946b7',            -- 人材サービス > 求人媒体・HRTech
    '東京都千代田区一ツ橋一丁目1番1号',
    1973,                                               -- 公式: 昭和48年8月15日
    '約8,070名（2025年12月現在・単体）',                 -- 公式。⚠️ 時点を落とさないこと
    'migration', false, 'draft', false, false
  ) returning id into v_mynavi;

  -- ── PIVOT株式会社 ───────────────────────────────────────────────────────
  -- ⚠️ 従業員数は公式サイトに記載が無いので**入れない**（推測で埋めない）
  insert into public.ow_companies (
    name, brand_name, slug, search_aliases, url, industry_id,
    headquarters_address, founded_year,
    source, is_published, listing_status, is_approved, is_test
  ) values (
    'PIVOT株式会社', 'PIVOT', 'pivot',
    'ピボット ピヴォット PIVOT',
    'https://pivot.inc/',
    'cd1e8992-4b87-436c-b7c6-c928574ae2ab',            -- メディア・広告・エンタメ > メディア・出版
    '東京都渋谷区神宮前6-17-11 JPR原宿ビル2階',
    2021,                                               -- 公式: 2021年6月1日
    'migration', false, 'draft', false, false
  ) returning id into v_pivot;

  -- ── 出典を記録する ──────────────────────────────────────────────────────
  -- ⚠️ `field` に入れてよいのは `headquarters_address` と `phase` だけ
  --    （`ow_company_data_sources_field_check`）。設立年・従業員数は入れられない。
  insert into public.ow_company_data_sources (company_id, field, source_kind, source_url, verified_at, note)
  values
    (v_mynavi, 'headquarters_address', 'registry',
     'https://www.houjin-bangou.nta.go.jp/', now(), '法人番号 3010001029968。公式サイトの本社所在地と一致'),
    (v_pivot,  'headquarters_address', 'registry',
     'https://www.houjin-bangou.nta.go.jp/', now(), '法人番号 9010401160615。同名の別法人4件と所在地で切り分け');

  -- ── 事後検算 ────────────────────────────────────────────────────────────
  select count(*) into n from public.ow_companies
   where id in (v_mynavi, v_pivot)
     and is_test = false and is_published = false and listing_status = 'draft'
     and normalized_name is not null;
  if n <> 2 then raise exception '追加後の状態が想定と違う: % 件', n; end if;

  raise notice 'マイナビ % / PIVOT %', v_mynavi, v_pivot;
end $$;

commit;
