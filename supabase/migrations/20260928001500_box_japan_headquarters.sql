-- ★Box Japan の本社所在地を入れる（2026-09-28 / 柴さんの指示）
--
-- 掲載21社で `headquarters_address` が空だったのは**この1社だけ**だった。
--
-- ── 出典は登記（本店）。公式サイトではない ──────────────────────────────────
--
--   法人番号   9010401107327
--   商号       株式会社Ｂｏｘ　Ｊａｐａｎ（フリガナ: ボックスジャパン）
--   本店       東京都千代田区丸の内１丁目８番２号鉄鋼ビルディング１５階
--   最終更新   平成30年9月11日
--   変更履歴   平成29年11月27日に本店移転（旧: 千代田区丸の内２丁目４番１号
--              丸の内ビルディング３４階）
--   状態       ★**「状態」の欄が無い＝登記記録の閉鎖等は無い**（現存）
--
-- ⚠️★**状態の欄まで見た**（CLAUDE.md ⑩）。マルケトの件は、登記から住所だけ取って
--    同じ画面の「閉鎖等」を見落としたのが原因だった。同じ轍を踏まない。
--
-- ⚠️★**`official_site` ではなく `registry` として記録する。**
--    `www.box.com/ja-jp/about-us` と `/ja-jp/contact` を実際に開いたが、
--    **日本法人の住所の掲載が見つからなかった**（contact はトップへ転送）。
--    CLAUDE.md「登記は**本店**所在地、公式サイトは**オフィス**所在地で、
--    一致する保証がない。同じ住所として扱わない」に従い、
--    **登記の本店であることを出典に残す。**
--
-- ⚠️ 表記は DB の既存の形に合わせて**半角＋ハイフン**にする
--    （例: 「東京都千代田区丸の内2-6-1 丸の内パークビルディング8F」）。
--    登記の全角（１丁目８番２号）をそのまま入れると同じ列に2つの表記が混ざる。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-2347-ow_companies.sql（214,721 バイト / 106行）
-- ⚠️★対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20260813061500_fill_company_profile_9_companies.sql`
--    の9社に Box Japan は**含まれていない**。打ち消しにはならない。

do $$
declare
  n bigint;
  n_src bigint;
begin
  select count(*) into n from public.ow_companies
   where id = 'c7353772-0c07-4f0d-8d20-294215125303'
     and name = '株式会社Box Japan'
     and headquarters_address is null;
  -- ⚠️ 既に値が入っていたら中止する（上書きしない）
  if n <> 1 then
    raise exception 'Box Japan が「社名が一致し、かつ住所が空」の状態で見つからない（%件）。中止する', n;
  end if;

  select count(*) into n_src from public.ow_company_data_sources
   where company_id = 'c7353772-0c07-4f0d-8d20-294215125303' and field = 'headquarters_address';
  if n_src <> 0 then
    raise exception '出典の行が既にある（%件）。中止する', n_src;
  end if;
end $$;

update public.ow_companies
   set headquarters_address = '東京都千代田区丸の内1-8-2 鉄鋼ビルディング15階'
 where id = 'c7353772-0c07-4f0d-8d20-294215125303';

-- ★出典を必ず同時に記録する。値だけ入れると「どこから来たか」が消える
insert into public.ow_company_data_sources
  (company_id, field, source_kind, source_url, verified_at, note, created_at, updated_at)
values
  ('c7353772-0c07-4f0d-8d20-294215125303', 'headquarters_address', 'registry',
   'https://www.houjin-bangou.nta.go.jp/', now(),
   '国税庁法人番号公表サイトの本店所在地（法人番号 9010401107327）。公式サイトに日本法人の住所の掲載が見つからなかったため登記を出典にした。平成29年11月27日に丸の内2-4-1 丸の内ビルディング34階から移転。',
   now(), now());

-- ⚠️ 検算。**件数では足りない**ので id と値の組で見る（ui-debugging ⑱）。
do $$
declare
  addr text;
  kind text;
  url text;
  n_null bigint;
begin
  select c.headquarters_address, s.source_kind, s.source_url
    into addr, kind, url
    from public.ow_companies c
    join public.ow_company_data_sources s
      on s.company_id = c.id and s.field = 'headquarters_address'
   where c.id = 'c7353772-0c07-4f0d-8d20-294215125303';

  if addr <> '東京都千代田区丸の内1-8-2 鉄鋼ビルディング15階' then
    raise exception '住所が想定と違う: %', addr;
  end if;
  if kind <> 'registry' then
    raise exception '出典の区分が想定と違う: %', kind;
  end if;
  if url is null then
    raise exception '出典の URL が記録されていない';
  end if;
  -- ★全角が混ざっていないこと（DB の既存表記に合わせる）
  if addr ~ '[０-９]' then
    raise exception '住所に全角数字が混ざっている: %', addr;
  end if;

  -- ★掲載中で住所が空の企業が0社になったこと（これが今回の目的）
  select count(*) into n_null from public.ow_companies
   where listing_status = 'listed' and is_test is not true
     and coalesce(headquarters_address, '') = '';
  if n_null <> 0 then
    raise exception '掲載中で住所が空の企業がまだ残っている: %社', n_null;
  end if;

  raise notice 'OK: % / 出典=% / 掲載中の空欄=%社', addr, kind, n_null;
end $$;
