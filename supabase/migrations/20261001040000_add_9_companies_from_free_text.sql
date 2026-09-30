-- 自由入力に落ちていた勤務先9社をマスタに追加する
--
-- 柴さんの指示（2026-10-01）。きっかけは「キーエンスの在籍者を一覧で見られない」。
-- ⚠️★**原因は掲載の仕様ではなく、キーエンスが `ow_companies` に無かったこと。**
--    実測（同日 / 直近30時間 / 実ユーザー）: 職歴18件のうち**9件が自由入力**に落ちていた。
--
-- ⚠️★**ディレクトリには載せない**（`listing_status='draft'`）。IT/SaaS に絞った
--    一覧の方針（2026-09-14 に 83社 → 22社）は変えない。ピッカーは**マスタの軸**なので、
--    掲載しなくても検索に出て職歴に紐づく。
--
-- ⚠️★**ページは見えるようにする**（`is_published = true`）。在籍者が見えるのはこの列。
--    ⚠️ DB のトリガー `trg_guard_company_approval` が `is_approved = true` を要求するので、
--       **同じ INSERT で `is_approved = true` を入れる**（トリガーは BEFORE UPDATE なので
--       INSERT は素通りするが、あとで運営が触ったときに弾かれないよう最初から揃える）。
--    ⚠️ アプリの公開ゲート（`checkPublishable`）は**画面からの操作にだけ掛かる**。
--       migration はそこを通らない。業種が NULL の2社があるのはそのため（下記）。
--
-- ── 登記で確認（2026-10-01 / 国税庁法人番号公表サイト）─────────────────────
-- ⚠️★対照に「マルケト」（閉鎖済みと分かっている）を先に引き、
--    `alt="閉鎖等"` の印が HTML に出ることを確かめてから9社を通した（CLAUDE.md ⑩）。
--    **9社とも閉鎖印なし。** 所在地は登記のもの。
--
-- ⚠️★同名・類似で迷ったもの（所在地と法人番号まで突き合わせて特定）:
--    ・JTB … **「ジェイティービー」で引くと本体が出ない**（関連会社が五十音順で先に並ぶ）。
--            登記商号が「株式会社ＪＴＢ」なので **「株式会社ＪＴＢ」で引き直した。**
--            ⚠️ 同じ検索結果に **閉鎖済みの関連会社が4社**あった（JTB東北・関西ほか）。
--    ・DXC … **合同会社と株式会社が同じ住所で両方生きている。** 利用者の入力どおり
--            **株式会社**（5010601049983）を採った。合同会社は別法人として残る。
--    ・ディオール … 登記は**中黒あり**「クリスチャン・ディオール合同会社」。
--            利用者の入力は中黒なし。**登記どおり**で登録する。
--            ⚠️ 香水部門の「パルファン・クリスチャン・ディオール・ジャポン株式会社」は別法人。
--
-- ⚠️★**コインタックスは追加しない。** 「コインタックス株式会社」（大阪）と
--    「有限会社コインタックス」（横浜）があり、利用者の入力は「コインタックス」だけ。
--    **どちらか決められないので推測しない。** その1件は自由入力のまま残す。
--
-- ⚠️ `url` は入れない（公式サイトを確かめていないため）。運営が `/admin` で入れる。
-- ⚠️★**業種は確信のあるものだけ入れた。** トランス・コスモスとセゾンテクノロジーは
--    どの区分に当てるか判断が割れるので **NULL のまま**にしてある。
--    **推測で埋めないこと**（CLAUDE.md「推測値を投入しない」）。`/admin/companies/[id]` で入る。

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_companies
   where slug in ('keyence','otsuka-pharmaceutical','transcosmos','jtb','saison-technology',
                  'quollio','dior','dxc-technology-japan','mufg-morgan-stanley');
  if n <> 0 then raise exception 'slug が既に使われている: % 件', n; end if;
end $$;

insert into public.ow_companies
  (name, brand_name, slug, search_aliases, headquarters_address, industry_id,
   source, is_published, published_at, listing_status, is_approved, is_test)
values
  -- 4120001051530 / 大阪府大阪市東淀川区東中島１丁目３番１４号
  ('株式会社キーエンス', 'キーエンス', 'keyence', 'KEYENCE',
   '大阪府大阪市東淀川区東中島1-3-14',
   '5c98ba45-2943-491d-ac2d-2a90f3450a05',   -- 製造業 > 電機・機械（FAセンサ・測定器）
   'migration', true, now(), 'draft', true, false),

  -- 7010001012986 / 東京都千代田区神田司町２丁目９番地
  ('大塚製薬株式会社', '大塚製薬', 'otsuka-pharmaceutical', 'Otsuka Pharmaceutical オオツカセイヤク',
   '東京都千代田区神田司町2-9',
   '08b1be8d-1c85-4ba3-b597-a46bd7a41230',   -- 医療・ヘルスケア
   'migration', true, now(), 'draft', true, false),

  -- 3011001041302 / 東京都渋谷区東１丁目２番２０号
  ('トランス・コスモス株式会社', 'トランス・コスモス', 'transcosmos', 'transcosmos トランスコスモス',
   '東京都渋谷区東1-2-20',
   null,                                      -- ★未確定（BPO / デジタルマーケ / EC）
   'migration', true, now(), 'draft', true, false),

  -- 8010701012863 / 東京都港区東新橋１丁目５番２号汐留シティセンター
  ('株式会社JTB', 'JTB', 'jtb', 'ジェイティービー',
   '東京都港区東新橋1-5-2 汐留シティセンター',
   '6c40f98e-15c6-4136-983a-5ad60a0f7094',   -- その他サービス（旅行業に当たる区分が無い）
   'migration', true, now(), 'draft', true, false),

  -- 7013301005882 / 東京都港区赤坂１丁目８番１号
  ('株式会社セゾンテクノロジー', 'セゾンテクノロジー', 'saison-technology', 'SAISON TECHNOLOGY',
   '東京都港区赤坂1-8-1',
   null,                                      -- ★未確定（ミドルウェア製品とITサービス）
   'migration', true, now(), 'draft', true, false),

  -- 7010901049293 / 東京都港区芝大門２丁目１番１６号
  ('株式会社Quollio Technologies', 'Quollio Technologies', 'quollio', 'クオリオ',
   '東京都港区芝大門2-1-16',
   '72994b94-8e8f-417d-837b-1eb0a7ffec8d',   -- IT・ソフトウェア > AI・データ
   'migration', true, now(), 'draft', true, false),

  -- 8010001015187 / 東京都千代田区平河町２丁目１番１号
  ('クリスチャン・ディオール合同会社', 'クリスチャン・ディオール', 'dior', 'Dior ディオール',
   '東京都千代田区平河町2-1-1',
   '496915c6-c6b8-4abd-ac06-710e14db4021',   -- 小売・流通 > 小売店舗
   'migration', true, now(), 'draft', true, false),

  -- 5010601049983 / 東京都中央区京橋２丁目２番１号京橋エドグラン
  ('DXCテクノロジー・ジャパン株式会社', 'DXCテクノロジー・ジャパン', 'dxc-technology-japan',
   'DXC ディーエックスシー',
   '東京都中央区京橋2-2-1 京橋エドグラン',
   '708225d3-0311-4e1c-b43f-c4894213a454',   -- IT・ソフトウェア > 受託開発・SIer
   'migration', true, now(), 'draft', true, false),

  -- 4010001129098 / 東京都千代田区大手町１丁目９番２号
  ('三菱UFJモルガン・スタンレー証券株式会社', '三菱UFJモルガン・スタンレー証券', 'mufg-morgan-stanley',
   'ミツビシユーエフジェイモルガンスタンレーショウケン MUFG',
   '東京都千代田区大手町1-9-2',
   '97dec389-5a70-4df0-b83d-82b8ddc6d7cb',   -- 金融・保険 > 証券・投資
   'migration', true, now(), 'draft', true, false);

-- ── 出典を記録する（`field` に入れてよいのは headquarters_address と phase だけ）──
insert into public.ow_company_data_sources (company_id, field, source_kind, source_url, verified_at, note)
select c.id, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', now(), v.note
  from (values
    ('keyence','法人番号 4120001051530'),
    ('otsuka-pharmaceutical','法人番号 7010001012986'),
    ('transcosmos','法人番号 3011001041302'),
    ('jtb','法人番号 8010701012863。関連会社に閉鎖済みが4社あり、本体を法人番号で特定'),
    ('saison-technology','法人番号 7013301005882'),
    ('quollio','法人番号 7010901049293'),
    ('dior','法人番号 8010001015187。パルファン・クリスチャン・ディオール・ジャポンとは別法人'),
    ('dxc-technology-japan','法人番号 5010601049983。同住所に DXC…合同会社(1010001076772) も現存'),
    ('mufg-morgan-stanley','法人番号 4010001129098')
  ) as v(slug, note)
  join public.ow_companies c on c.slug = v.slug;

-- ── 検算 ────────────────────────────────────────────────────────────────────
do $$
declare n int; n_src int; n_listed int;
begin
  select count(*) into n from public.ow_companies
   where slug in ('keyence','otsuka-pharmaceutical','transcosmos','jtb','saison-technology',
                  'quollio','dior','dxc-technology-japan','mufg-morgan-stanley')
     and is_test=false and is_published=true and listing_status='draft'
     and search_key is not null;
  if n <> 9 then raise exception '追加後の状態が想定と違う: % 件', n; end if;

  select count(*) into n_src from public.ow_company_data_sources s
    join public.ow_companies c on c.id=s.company_id
   where c.slug in ('keyence','jtb','dior','mufg-morgan-stanley');
  if n_src <> 4 then raise exception '出典の記録が足りない: % 件', n_src; end if;

  -- ★ディレクトリの社数が変わっていないこと
  select count(*) into n_listed from public.ow_companies
   where listing_status='listed' and is_published and not is_test;
  if n_listed <> 21 then raise exception '掲載社数が動いた: % 社', n_listed; end if;

  raise notice '9社を追加。掲載は % 社のまま', n_listed;
end $$;

commit;
