-- 企業に「アクセンチュア株式会社」を足して掲載する（2026-10-04 / 柴さんの指示）
--
-- ── 登記の確認（CLAUDE.md ⑩「掲載企業は登記で存在を確かめる」）────────────────
-- 国税庁法人番号公表サイトで照合（2026-10-04）:
--   法人番号 **7010401001556** ／ 商号 アクセンチュア株式会社
--   本店 東京都港区赤坂１丁目８番１号 ／ 最終更新 令和8年7月7日
--   **登記記録の閉鎖等の印は無い。現存。** 変更履歴は吸収合併（取り込む側）のみ。
-- ⚠️ 「アクセンチュア」の部分一致は**全4件**（10件未満なので打ち切られていない）。
--    残り3件は別法人: アクセンチュア健康保険組合 ／ アクセンチュア・テック・ドライブ株式会社
--    （同じ住所だが別商号）／ 株式会社アクセンチュアパートナーズ（岡山）。**取り違えない。**
-- ⚠️ 検出器は先に対照（アドビ株式会社・閉鎖印なし）で効くことを確かめてから通した。
--
-- ── 入れた値の出どころ ────────────────────────────────────────────────────
-- 公式サイト https://www.accenture.com/jp-ja/about/company-index （2026-10-04 閲覧）:
--   本社 〒107-8672 東京都港区赤坂1-8-1 赤坂インターシティAIR ／ 創業1962年（事務所開設）
--   設立1995年12月 ／ 資本金3億5千万円 ／ 従業員 約30,000人（2026年6月1日時点）
--   国内拠点 北海道・宮城・福島・群馬・東京・愛知・京都・大阪・福岡・熊本
--   グローバル 52カ国200都市以上 ／ 約814,000人 ／ 創業1953年
-- ニュースルーム https://newsroom.accenture.com/ （2026-10-04 閲覧）:
--   **「Accenture (NYSE: ACN)」** ← `phase = 'listed'` と `capital_notes` の根拠
--
-- ⚠️★**裏が取れなかった列は入れていない**（CLAUDE.md「推測値を投入しない」）:
--      `parent_company_name` / `parent_company_country` … 公式サイトに記載が無い
--      `logo_url` … 画像は入れていない。**頭文字（ア）のフォールバックで出る**
--      `main_products` / `customer_cases` / `benefits` 等 … 取材・入力の領域

insert into public.ow_companies (
  name, name_en, slug, url, tagline, description,
  industry_id, location, headquarters_address, branch_locations,
  employee_count, global_employee_count, founded_year,
  capital_type, capital_notes, phase, target_industry_scope,
  search_aliases, source, is_approved, is_published, listing_status, published_at
) values (
  'アクセンチュア株式会社',
  -- ⚠️ 表示名は `companyDisplayName` が `name_en` を優先する。**法人の英文名ではなく
  --    ブランド名**を入れる（Salesforce / Datadog と同じ流儀。Accenture Japan Ltd にしない）
  'Accenture',
  'accenture',
  'https://www.accenture.com/jp-ja',
  'コンサルティングからシステム構築・運用までを手がける',
  -- ⚠️ 2段落（改行1つではなく**空行**で区切る。markdown で描画されるため）。
  --    ⚠️ 評価語と時点の無い数値を入れない。下の数値はすべて出典の記載どおり。
  '世界52カ国・200都市以上に拠点を持つコンサルティング会社の日本法人。1953年にゼネラル・エレクトリック社へコンピューターを導入したことからコンサルティング業務を始めた。

日本では1962年に事務所を開設し、1995年12月に現在の法人を設立した。北海道・宮城・福島・群馬・東京・愛知・京都・大阪・福岡・熊本に拠点を持つ。',
  -- 業種：コンサルティング > IT・システム
  (select id from public.ow_industries where slug = 'consulting-it'),
  '東京都',
  '東京都港区赤坂1-8-1 赤坂インターシティAIR',
  -- ⚠️ 本社のある東京は入れない（`location` が持つ）。**支社だけ**を並べる。
  array['北海道','宮城','福島','群馬','愛知','京都','大阪','福岡','熊本'],
  -- ⚠️ 括弧の中は `parseEmployeeCount` が落とすので「社員数順」の並びは 30000 で効く。
  --    詳細側は原文のまま出る（時点を残すのが約束。`employeeCount.ts` の注記）。
  '約30,000名（2026年6月1日時点）',
  '約814,000名',
  1995,
  'foreign_subsidiary',
  -- ⚠️ `parent_company_name` が無いので、この一文は**資本区分の行**に出る
  --    （CLAUDE.md「capital_notes の置き場所は2箇所ある」）。
  'グローバル本体はニューヨーク証券取引所に上場（NYSE: ACN）。',
  'listed',
  -- 全業界向け。⚠️ `vertical` ではないので `ow_company_target_industries` の明細は作らない
  'horizontal',
  -- ⚠️ 検索3経路が `search_aliases.ilike` を見る。**部分一致**なので表記ゆれを並べる
  'アクセンチュア Accenture Accenture Japan アクセンチュアジャパン',
  'migration',
  -- ⚠️★`is_approved` を先に true にしないと `check_listed_requires_approval` で落ちる。
  --    ⚠️ `trg_guard_company_approval` は **BEFORE UPDATE** なので INSERT では走らない
  --       （UPDATE で立てようとすると postgres ロールでは 42501 になる）。
  true, true, 'listed',
  -- ⚠️ `published_at` は「最初に公開した日時」。migration で公開するときは埋める
  --    （埋め忘れると「いつ何社公開したか」を再構成できなくなる）
  now()
);

-- ── 事業領域（主） ────────────────────────────────────────────────────────
-- ⚠️ 業種「IT・システム」は `requires_business_domain = false` なので公開ゲートは通るが、
--    入れないとカードのタグと `?industry=` の絞り込みから外れる（「事業領域 —」になる）。
-- ⚠️ 列は `domain_id`。`business_domain_id` ではない（一度書き間違えて 42703 で止めた）
insert into public.ow_company_business_domains (company_id, domain_id, is_primary)
select (select id from public.ow_companies where slug = 'accenture'),
       (select id from public.ow_business_domains where slug = 'consulting'),
       true;

-- ── 出典の記録 ────────────────────────────────────────────────────────────
-- ⚠️ `field` の CHECK は `headquarters_address` と `phase` の2つだけ。増やしていない。
insert into public.ow_company_data_sources (company_id, field, source_kind, source_url, verified_at, note)
select c.id, v.field, v.kind, v.url, now(), v.note
  from public.ow_companies c,
       (values
         ('headquarters_address', 'official_site',
          'https://www.accenture.com/jp-ja/about/company-index',
          '登記の本店（東京都港区赤坂１丁目８番１号）と一致。建物名は公式サイトの表記。'),
         ('phase', 'official_site',
          'https://newsroom.accenture.com/',
          'グローバル本体の表記「Accenture (NYSE: ACN)」による。')
       ) as v(field, kind, url, note)
 where c.slug = 'accenture';

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
declare
  c record; 主 int; 出典 int;
begin
  select * into c from public.ow_companies where slug = 'accenture';
  if c is null then raise exception 'アクセンチュアが作られていない'; end if;
  if c.industry_id is null then raise exception '業種が入っていない'; end if;
  if c.listing_status <> 'listed' or c.is_published is not true or c.is_approved is not true then
    raise exception '掲載状態が想定と違う（listing=% / published=% / approved=%）',
      c.listing_status, c.is_published, c.is_approved;
  end if;
  -- ★正規化名はトリガーが作る。空なら検索3経路が当たらない
  if coalesce(c.normalized_name,'') = '' then raise exception 'normalized_name が空'; end if;

  select count(*) into 主 from public.ow_company_business_domains
   where company_id = c.id and is_primary;
  if 主 <> 1 then raise exception '主の事業領域が 1 件のはずが %', 主; end if;

  select count(*) into 出典 from public.ow_company_data_sources where company_id = c.id;
  if 出典 <> 2 then raise exception '出典が 2 件のはずが %', 出典; end if;

  -- ★掲載企業の数（適用前 21社）
  if (select count(*) from public.ow_companies
       where listing_status = 'listed' and is_published and coalesce(is_test,false) = false) <> 22 then
    raise exception '掲載企業が 22 社にならなかった';
  end if;
end $$;
