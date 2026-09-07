-- 事業領域の後片付け（2026-09-07 / 柴さんの承認済み）
--
--   ① 業種特化（vertical）の明細を消す ＝ 解体を完了させる
--   ② SAPジャパン・日本オラクルを 基幹業務システム（erp）へ付け替える
--
-- ── ⚠️★ハードウェア・半導体（hardware）は触らない ──────────────────────────
-- 当初この migration に含める予定だったが、2026-09-07 の実測で**外せない**と分かった。
-- 「業種側に電子機器・半導体があるので重複排除」という前提が3点とも崩れている:
--
--   ① `電子機器・半導体` の **`requires_business_domain = true`**（実測）。
--      外すと7社は事業領域0件になり `checkPublishable` を通らなくなる。
--      既に掲載中の企業は遡って落ちないが、**一度取り下げると戻せない**うえ、
--      `/admin/companies` の「要対応」に**7件が居座る**（0件が正常な一覧が埋まる）。
--   ② 7社は **hardware 以外の事業領域を持っていない**（実測）。外すとカードのタグも
--      企業詳細サイドバーの「事業領域」も消える。**業種は求職者側に出ていない**ので
--      （出しているのは企業ピッカーだけ）、7社は求職者から見て**無分類**になる。
--   ③ `?industry=hardware`（現在7社）の救済が**繋がらない**。`searchCompanies` は
--      `resolveIndustryKey` の戻り値を **`ow_business_domains` の中だけ**で引くので
--      （lib/search/companies.ts）、業種側の slug に読み替えても0件になる。
--      実測: `?industry=electronics-semiconductor` → **0件**。
--
-- → **現状維持。** 外すなら先に「業種を求職者側に出す経路」を作ること。
--   対象7社: アップルジャパン / インテル / エヌビディア / クアルコムジャパン /
--            デル・テクノロジーズ / レノボ・ジャパン / 日本HP
--
-- ── ⚠️ `20260906140000` の「明細は残す」を、ここで取り消している ───────────────
-- あの migration は「`?industry=vertical` のブックマークを生かすため明細を残す」と
-- 書いたが、**同じファイルの中で自ら訂正している** —— `ow_business_domains` の RLS が
-- `(is_active = true) OR auth_is_admin()` なので、無効化した時点で `!inner` の join が
-- 落ちて **0社**になっていた。残す理由が実測で消えているので、ここで明細も消す。
-- 実測（2026-09-07 / dev）: `?industry=vertical` も `?industry=healthcare` も **0件**。
--
-- ⚠️ 情報は失われない。Ubie（医療・ヘルスケア）と エヌシーノ（金融・保険）は
--    **軸2（ow_company_target_industries）に記録済み**で、両社とも
--    `target_industry_scope = 'vertical'`。実測で確認した。
--
-- ⚠️ **法務・契約の新設と DocuSign の付け替え／ワークデイの付け替えはやらない**（判断が未了）。

begin;

-- ── 事前アサート ────────────────────────────────────────────────────────────
do $$
declare
  n_vertical_links int;
  n_vertical_active int;
  n_erp int;
  sap_primary text;
  oracle_primary text;
  n_sap_rows int;
  n_oracle_rows int;
  n_listed int;
  n_no_primary int;
  n_hardware int;
begin
  select count(*) into n_vertical_links from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id where d.slug = 'vertical';
  select count(*) into n_vertical_active from ow_business_domains where slug = 'vertical' and is_active;
  select count(*) into n_erp from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id where d.slug = 'erp';
  select d.slug into sap_primary from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id join ow_companies c on c.id = l.company_id
   where c.name = 'SAPジャパン株式会社' and l.is_primary;
  select d.slug into oracle_primary from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id join ow_companies c on c.id = l.company_id
   where c.name = '日本オラクル株式会社' and l.is_primary;
  select count(*) into n_sap_rows from ow_company_business_domains l
    join ow_companies c on c.id = l.company_id where c.name = 'SAPジャパン株式会社';
  select count(*) into n_oracle_rows from ow_company_business_domains l
    join ow_companies c on c.id = l.company_id where c.name = '日本オラクル株式会社';
  select count(*) into n_listed from ow_companies
   where is_published and listing_status = 'listed' and coalesce(is_test, false) = false;
  select count(*) into n_no_primary from ow_companies c
   where exists (select 1 from ow_company_business_domains l where l.company_id = c.id)
     and not exists (select 1 from ow_company_business_domains l where l.company_id = c.id and l.is_primary);
  select count(*) into n_hardware from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id where d.slug = 'hardware';

  if n_vertical_links <> 3 then raise exception 'vertical の明細が % 行（期待 3）', n_vertical_links; end if;
  if n_vertical_active <> 0 then raise exception 'vertical がまだ有効（期待 is_active = false）'; end if;
  if n_erp <> 1 then raise exception 'erp の紐づけが % 社（期待 1 = nCino のみ）', n_erp; end if;
  if sap_primary is distinct from 'finance' then raise exception 'SAPジャパンの主が %（期待 finance）', sap_primary; end if;
  if oracle_primary is distinct from 'ai' then raise exception '日本オラクルの主が %（期待 ai）', oracle_primary; end if;
  /* ⚠️ PK が (company_id, domain_id) なので、付け替え先の行が既にあると衝突する。
        2社とも事業領域が1行だけであることを確かめてから UPDATE する。 */
  if n_sap_rows <> 1 then raise exception 'SAPジャパンの事業領域が % 行（期待 1）', n_sap_rows; end if;
  if n_oracle_rows <> 1 then raise exception '日本オラクルの事業領域が % 行（期待 1）', n_oracle_rows; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_no_primary <> 0 then raise exception '主が無い企業が既に % 社いる（期待 0）', n_no_primary; end if;
  /* ⚠️ hardware は**触らない**が、想定と件数が違えば前提が変わっているので止める。 */
  if n_hardware <> 7 then raise exception 'hardware の紐づけが % 社（期待 7・触らないが前提確認）', n_hardware; end if;

  raise notice '事前アサート OK: vertical明細=% / erp=%社 / 掲載中=%社', n_vertical_links, n_erp, n_listed;
end $$;

-- ── ① 業種特化（vertical）の明細を消す ──────────────────────────────────────
-- 旧値（2026-09-07 実測 / 3行）:
--   【テスト】株式会社サンプルワークス  vertical  is_primary=true   display_order=0
--   Ubie株式会社                        vertical  is_primary=false  display_order=2
--   エヌシーノ合同会社                  vertical  is_primary=false  display_order=2
delete from ow_company_business_domains l
 using ow_business_domains d
 where d.id = l.domain_id and d.slug = 'vertical';

-- ⚠️★検証用企業（サンプルワークス）は vertical が**主**だったので、消すと主が0件になる。
--    `UNIQUE (company_id) WHERE is_primary` は「2件目を禁じる」だけで1件を要求しないため
--    DB は壊れないが、`checkPublishable` が通らなくなり**一度取り下げると戻せない**。
--    しかも `/admin/companies` の「要対応」は is_test を除外するので**警告も出ない**。
--    → もう一方（AI・データ）を主に昇格させる。**行ごと消さない** ——
--      消すと「事業領域0件のIT企業」という、実企業には存在しない別の異常形になる。
-- ⚠️ 順序が重要: **先に delete、あとで昇格。** 逆にすると主が2件になり一意制約に当たる。
-- 旧値: 【テスト】株式会社サンプルワークス  ai  is_primary=false  display_order=1
update ow_company_business_domains l
   set is_primary = true
  from ow_companies c, ow_business_domains d
 where c.id = l.company_id and d.id = l.domain_id
   and c.name = '【テスト】株式会社サンプルワークス' and d.slug = 'ai';

-- 解体済みであることを description に残す（旧文は「UI に出す日に解体して消す」という予告だった）
update ow_business_domains
   set description = '⚠️ 2026-09-06 に is_active=false、2026-09-07 に明細も削除して解体済み。'
                     '役割は対象業界（ow_company_target_industries）が引き継いだ —— '
                     'こちらは「何に特化しているか」を言えなかったが、あちらは言える。'
                     '⚠️ 行は残してある（マスタは論理削除を正とする）。復活させないこと。'
 where slug = 'vertical';

-- ── ② 基幹業務システム（erp）への付け替え ───────────────────────────────────
-- ⚠️ `is_primary` は動かさず `domain_id` だけ差し替える。主のフラグを落として立て直すと
--    `UNIQUE (company_id) WHERE is_primary` を踏む余地ができる。
-- ⚠️ **ワークデイ（HR・人材）は対象外。** 基幹業務システムと HR・人材のどちらが妥当か
--    判断が付いていないため（2026-09-07）。
-- 旧値: SAPジャパン株式会社  finance（経理・財務）  is_primary=true  display_order=0
update ow_company_business_domains l
   set domain_id = (select id from ow_business_domains where slug = 'erp')
  from ow_companies c
 where c.id = l.company_id
   and c.name = 'SAPジャパン株式会社'
   and l.domain_id = (select id from ow_business_domains where slug = 'finance');

-- 旧値: 日本オラクル株式会社  ai（AI・データ）  is_primary=true  display_order=0
update ow_company_business_domains l
   set domain_id = (select id from ow_business_domains where slug = 'erp')
  from ow_companies c
 where c.id = l.company_id
   and c.name = '日本オラクル株式会社'
   and l.domain_id = (select id from ow_business_domains where slug = 'ai');

-- ── 事後アサート ────────────────────────────────────────────────────────────
-- ⚠️★**「掲載中」と「全件」を取り違えないこと。** 指示書の「erp 1→3 / finance 7→6 /
--    ai 13→12」は**掲載中**の数。全件では ai は 15→14（検証用企業ぶんが1件多い）。
--    最初この assert を全件で書いて 12 と比べており、**そのままなら migration が中止していた。**
--    両方数えて、両方に対して止める。
do $$
declare
  v_all int; v_listed int;
  e_all int; e_listed int;
  f_all int; f_listed int;
  a_all int; a_listed int;
  h_all int; h_listed int;
  n_listed int;
  n_no_primary int;
  n_no_primary_real int;
  n_sample_primary int;
begin
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into v_all, v_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='vertical';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into e_all, e_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='erp';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into f_all, f_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='finance';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into a_all, a_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='ai';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into h_all, h_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='hardware';

  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_no_primary from ow_companies c
   where exists (select 1 from ow_company_business_domains l where l.company_id=c.id)
     and not exists (select 1 from ow_company_business_domains l where l.company_id=c.id and l.is_primary);
  select count(*) into n_no_primary_real from ow_companies c
   where coalesce(c.is_test,false)=false
     and exists (select 1 from ow_company_business_domains l where l.company_id=c.id)
     and not exists (select 1 from ow_company_business_domains l where l.company_id=c.id and l.is_primary);
  select count(*) into n_sample_primary from ow_company_business_domains l
    join ow_companies c on c.id=l.company_id join ow_business_domains d on d.id=l.domain_id
   where c.name='【テスト】株式会社サンプルワークス' and l.is_primary and d.slug='ai';

  if v_all <> 0 or v_listed <> 0 then raise exception 'vertical の明細が 全件% / 掲載中%（期待 0 / 0）', v_all, v_listed; end if;
  if e_all <> 3 or e_listed <> 3 then raise exception 'erp が 全件% / 掲載中%（期待 3 / 3）', e_all, e_listed; end if;
  if f_all <> 6 or f_listed <> 6 then raise exception 'finance が 全件% / 掲載中%（期待 6 / 6）', f_all, f_listed; end if;
  /* ⚠️ ai だけ全件と掲載中がずれる（検証用企業が ai を持つため）。14 / 12 が正。 */
  if a_all <> 14 or a_listed <> 12 then raise exception 'ai が 全件% / 掲載中%（期待 14 / 12）', a_all, a_listed; end if;
  /* ⚠️ 触っていないことの確認。7 のままでなければどこかで巻き込んでいる。 */
  if h_all <> 7 or h_listed <> 7 then raise exception 'hardware が 全件% / 掲載中%（期待 7 / 7・触っていないはず）', h_all, h_listed; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  /* ⚠️ 検証用企業を含めて0件であること。昇格が効いていれば is_test も含めて0になる。 */
  if n_no_primary <> 0 then raise exception '主が無い企業が % 社（期待 0）', n_no_primary; end if;
  if n_no_primary_real <> 0 then raise exception '主が無い実企業が % 社（期待 0）', n_no_primary_real; end if;
  if n_sample_primary <> 1 then raise exception '検証用企業の主が AI・データ になっていない'; end if;

  raise notice '事後アサート OK: erp=%/% finance=%/% ai=%/% hardware=%/%（全件/掲載中）掲載中=%社 主なし=0',
    e_all, e_listed, f_all, f_listed, a_all, a_listed, h_all, h_listed, n_listed;
end $$;

commit;
