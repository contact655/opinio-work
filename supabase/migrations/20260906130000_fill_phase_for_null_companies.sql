-- フェーズが空だった掲載中9社を、公開情報で確認して埋める（2026-09-06）。
--
-- ⚠️ **1社ずつ調べた値だけを入れている。** 推測は入れない
--    （CLAUDE.md「migration を書くときのルール③」／remote_work_status を64社に
--     一括投入して誤情報を公開した前例）。
--
-- ⚠️★**ラウンド名を確認できなかった未上場企業には、子ではなく親（`startup`）を入れる。**
--    「未上場のスタートアップである」ことは確かめられたが、シリーズ〇まではどの
--    公開情報でも特定できなかった。**それらしい段を当てはめない。**
--    2段階の語彙にしたのは、まさにこの「粗いところまでは分かる」を表せるようにするため。
--
-- ⚠️ 出典は `ow_company_data_sources` に記録する。そのために `field` の CHECK を
--    `phase` まで広げる（それまで `headquarters_address` 1値だった）。
--    ⚠️ コード側の `COMPANY_SOURCE_FIELDS` も同じコミットで直してある
--       （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
--
-- ── 調べた結果 ──────────────────────────────────────────────────────────────
--   スパイダープラス     listed_growth  東証グロース 4192
--   株式会社タイミー     listed_growth  東証グロース 215A（2024-07-26 上場）
--   株式会社シンカ       listed_growth  東証グロース 149A（2024-03-27 上場）
--   株式会社アンドパッド series_d       自社リリース: シリーズD 約122億円（2022-09）
--   フォトラクション     startup        未上場。累計約38億円だがラウンド名は非公表
--   株式会社irodas       startup        未上場。ラウンド名を確認できず
--   ダンドリワーク       startup        未上場。ラウンド名を確認できず
--   株式会社Translead    startup        未上場。ラウンド名を確認できず
--   株式会社Opinio       startup        自社。未上場
--
-- ⚠️ アンドパッドを `unicorn` にしていない。「時価総額1,000億円規模のユニコーン」は
--    二次情報の**推定**で、自社が公表しているのはシリーズDまで。確かめられるほうを入れる。

begin;

-- ── 出典の記録先を phase まで広げる ───────────────────────────────────────
alter table ow_company_data_sources drop constraint if exists ow_company_data_sources_field_check;
alter table ow_company_data_sources add constraint ow_company_data_sources_field_check
  check (field = any (array['headquarters_address', 'phase']));

-- ── 事前チェック: 9社が実在し、まだ phase が空であること ──────────────────
do $$
declare
  n int;
begin
  select count(*) into n from ow_companies
   where id in ('0b93a8f2-d378-4d5a-aecc-9040fde2113c','2e54ff06-2f4d-420c-9a5c-9a80a85ca55a',
                '28b826eb-fb86-4124-aa08-c489cad662f1','b1d7996c-d260-4025-b495-bd1e2b9bb795',
                'd71a7da6-a769-456e-99ab-a077d89a0d43','63d390da-e8c4-464a-8c30-e112fcd2709c',
                '78560eee-1a82-44b8-b9f6-d9c88fb60f4b','d1c26664-5643-42bc-84e4-6f0c940bb39d',
                'cf44d740-b835-454d-91a3-f1e2eddc7251')
     and phase is null;
  if n <> 9 then
    raise exception 'phase が空の対象が % 社（期待 9）。誰かが先に埋めた可能性があるので中止する', n;
  end if;
end $$;

-- ── 値を入れる（id を明示列挙。全社一括の UPDATE はしない）────────────────
update ow_companies set phase = 'listed_growth' where id = '0b93a8f2-d378-4d5a-aecc-9040fde2113c'; -- スパイダープラス
update ow_companies set phase = 'listed_growth' where id = '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a'; -- タイミー
update ow_companies set phase = 'listed_growth' where id = '28b826eb-fb86-4124-aa08-c489cad662f1'; -- シンカ
update ow_companies set phase = 'series_d'      where id = 'b1d7996c-d260-4025-b495-bd1e2b9bb795'; -- アンドパッド
update ow_companies set phase = 'startup'       where id = 'd71a7da6-a769-456e-99ab-a077d89a0d43'; -- フォトラクション
update ow_companies set phase = 'startup'       where id = '63d390da-e8c4-464a-8c30-e112fcd2709c'; -- irodas
update ow_companies set phase = 'startup'       where id = '78560eee-1a82-44b8-b9f6-d9c88fb60f4b'; -- ダンドリワーク
update ow_companies set phase = 'startup'       where id = 'd1c26664-5643-42bc-84e4-6f0c940bb39d'; -- Translead
update ow_companies set phase = 'startup'       where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251'; -- Opinio

-- ── 出典を記録する ────────────────────────────────────────────────────────
-- ⚠️ URL を確認できたものだけ `source_url` を入れる。**それらしい URL で埋めない。**
--    `unknown` は URL を持てない（CHECK）。
insert into ow_company_data_sources (company_id, field, source_kind, source_url, verified_at, note) values
  ('0b93a8f2-d378-4d5a-aecc-9040fde2113c', 'phase', 'official_site', 'https://spiderplus.co.jp/ir/stock/', now(), '東証グロース 4192'),
  ('2e54ff06-2f4d-420c-9a5c-9a80a85ca55a', 'phase', 'official_site', null, now(), '東証グロース 215A（2024-07-26 上場）'),
  ('28b826eb-fb86-4124-aa08-c489cad662f1', 'phase', 'official_site', null, now(), '東証グロース 149A（2024-03-27 上場）'),
  ('b1d7996c-d260-4025-b495-bd1e2b9bb795', 'phase', 'official_site', 'https://andpad.co.jp/news/1380/', now(), 'シリーズD 約122億円（2022-09）。ユニコーンの評価は二次情報の推定なので採らない'),
  ('d71a7da6-a769-456e-99ab-a077d89a0d43', 'phase', 'unknown', null, now(), '未上場は確認。累計約38億円だがラウンド名は非公表のため親（startup）止まり'),
  ('63d390da-e8c4-464a-8c30-e112fcd2709c', 'phase', 'unknown', null, now(), '未上場は確認。ラウンド名を特定できず親（startup）止まり'),
  ('78560eee-1a82-44b8-b9f6-d9c88fb60f4b', 'phase', 'unknown', null, now(), '未上場は確認。ラウンド名を特定できず親（startup）止まり'),
  ('d1c26664-5643-42bc-84e4-6f0c940bb39d', 'phase', 'unknown', null, now(), '未上場は確認。ラウンド名を特定できず親（startup）止まり'),
  ('cf44d740-b835-454d-91a3-f1e2eddc7251', 'phase', 'company_input', null, now(), '自社。未上場')
on conflict (company_id, field) do update
  set source_kind = excluded.source_kind,
      source_url  = excluded.source_url,
      verified_at = excluded.verified_at,
      note        = excluded.note;

-- ── 事後チェック ──────────────────────────────────────────────────────────
do $$
declare
  still_null int;
  sources    int;
begin
  select count(*) into still_null from ow_companies
   where phase is null and is_published and listing_status = 'listed' and coalesce(is_test,false) = false;
  if still_null <> 0 then
    raise exception '掲載中でフェーズが空の企業が % 社残っている', still_null;
  end if;

  select count(*) into sources from ow_company_data_sources where field = 'phase';
  if sources <> 9 then
    raise exception '出典の記録が % 件（期待 9）', sources;
  end if;
end $$;

commit;
