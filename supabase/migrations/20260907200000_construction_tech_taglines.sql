-- 建設テック4社に tagline を入れ、3社に従業員数と本社住所を入れる（2026-09-07 / 柴さんの指示）
--
-- 2026-09-04 に掲載した4社が **tagline 空のまま**で、一覧は新着順なので
-- **訪問者が最初に見る4枚が社名とタグだけ**の状態が続いていた。
-- tagline が空だと同時に次が起きる（2026-08-28 に CTC で確認済みの症状）:
--   カードの説明が空 / meta description が汎用文に落ちる / OGP の sub がピルごと消える /
--   JSON-LD の description が空文字（`mapCompany` が `?? ""` で潰した後なのでフォールバックは効かない）/
--   詳細ヒーローに空の <p> が余白付きで出る / 企業検索の ilike が tagline から引けない
--
-- ⚠️★**企業の特定は `slug`。名前で引かない**（第1・第2バッチで確立した作法）。
--    名前は事前アサートの照合にだけ使う。
--
-- ── 出典 ────────────────────────────────────────────────────────────────────
-- ⚠️★**値は柴さんが公式サイト・有価証券報告書から取得したものをそのまま入れる**（2026-09-07 指示）。
--    二次情報は使っていない。
--      アンドパッド      … 公式 会社情報ページ
--      スパイダープラス   … 有価証券報告書 第27期（EDINET / Gビズインフォ経由）
--      フォトラクション   … 公式 会社概要ページ
-- ⚠️ **正確なURLは指示書に無かったので書いていない。** 推測でURLを書かない
--    （CLAUDE.md「`source_url` の NULL は『URLが記録されていない』という事実。推測で埋めない」）。
--    `ow_company_data_sources` への行追加は今回の範囲外。URLが分かった日に別途入れること。
--
-- ── 入れないもの（意図的な欠落。あとから「入れ忘れ」と読まないこと）──────────
-- ⚠️ **`founded_year` は4社とも入れない。** 実測で4社とも NULL。
--    アンドパッドとスパイダープラスは公式に記載が無く二次情報が割れており
--    （アンドパッド 2012年9月 / 2014年4月、スパイダープラス 1997年 / 2000年）、
--    フォトラクションだけ公式にある（2016年3月14日）が **4社で揃わないので見送る**。
--    推測で埋めると 2026-08-25 に洗い出した「根拠のないデータ」を自分で作ることになる。
-- ⚠️ **ダンドリワークの employee_count / headquarters_address は入れない。**
--    公式の会社概要ページが 404 で取得できなかったため。後日1本追加する。
-- ⚠️ `location` は触らない。本社住所を入れれば詳細ページの「本社」行が出るので、
--    サイドバーの「所在地」行（本社住所が無い社だけに出る）は自然に引っ込む。
--
-- ── tagline の字数（**数えてから書いた**）────────────────────────────────────
--    andpad       21字  建設現場の工程・図面・写真を1つに集約する
--    spiderplus   21字  建設現場の図面管理と検査業務をアプリで行う
--    photoruction 23字  建設の写真・書類管理をAIとBPOで自動化する
--    dandori-work 18字  建築現場の情報を元請と職人で共有する
--    ⚠️ 2026-08-28 に CTC で「19字」と書いて実測20字だった。**目分量で書かない。**

begin;

-- ── 事前アサート ────────────────────────────────────────────────────────────
do $$
declare
  expected constant text[][] := array[
    ['andpad',       '株式会社アンドパッド'],
    ['spiderplus',   'スパイダープラス株式会社'],
    ['photoruction', '株式会社フォトラクション'],
    ['dandori-work', '株式会社ダンドリワーク']
  ];
  i int; r record;
  n_empty_listed int; n_empty_all int; n_listed int; n_rows int;
  n_founded_notnull int;
begin
  for i in 1 .. array_length(expected, 1) loop
    select slug, name, tagline, employee_count, headquarters_address, founded_year,
           (is_published and listing_status='listed' and coalesce(is_test,false)=false) as listed
      into r from ow_companies where slug = expected[i][1];
    if r.slug is null then raise exception 'slug=% の企業が見つからない', expected[i][1]; end if;
    if r.name is distinct from expected[i][2] then
      raise exception 'slug=% の社名が「%」（期待「%」）', expected[i][1], r.name, expected[i][2];
    end if;
    if not r.listed then raise exception '% が掲載中でない', expected[i][2]; end if;
    /* ⚠️ 既に入っていたら止める。上書きしないため。 */
    if coalesce(r.tagline,'') <> '' then
      raise exception '% の tagline が既に入っている（「%」）。上書きしないので中止', expected[i][2], r.tagline;
    end if;
    /* ダンドリワーク以外は従業員数・本社住所も空のはず */
    if expected[i][1] <> 'dandori-work' then
      if coalesce(r.employee_count,'') <> '' then
        raise exception '% の employee_count が既に入っている（「%」）', expected[i][2], r.employee_count;
      end if;
      if coalesce(r.headquarters_address,'') <> '' then
        raise exception '% の headquarters_address が既に入っている', expected[i][2];
      end if;
    end if;
    /* ⚠️ founded_year は**変更しない**。事後に不変を確かめるため、ここで NULL であることを記録する。
          実測（2026-09-07）: 4社とも NULL。 */
    if r.founded_year is not null then
      raise exception '% の founded_year が % （期待 NULL）。この migration は触らないので前提を確認すること', expected[i][2], r.founded_year;
    end if;
  end loop;

  /* ⚠️★全件と掲載中の両方で数える。両者は draft 17社ぶんズレる（実測）。 */
  select count(*) into n_empty_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false
     and (tagline is null or tagline='');
  select count(*) into n_empty_all from ow_companies where tagline is null or tagline='';
  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_rows from ow_companies;
  select count(*) into n_founded_notnull from ow_companies
   where slug in ('andpad','spiderplus','photoruction','dandori-work') and founded_year is not null;

  if n_empty_listed <> 4 then raise exception 'tagline が空の掲載企業が % 社（期待 4）', n_empty_listed; end if;
  if n_empty_all <> 21 then raise exception 'tagline が空の企業が 全件 % 社（期待 21）', n_empty_all; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_rows <> 103 then raise exception 'ow_companies が % 行（期待 103）', n_rows; end if;
  if n_founded_notnull <> 0 then raise exception '4社の founded_year に値が入っている'; end if;

  raise notice '事前アサート OK: tagline空 掲載中%社 / 全件%社 / 掲載中%社 / 全%行',
    n_empty_listed, n_empty_all, n_listed, n_rows;
end $$;

-- ── tagline（4社）────────────────────────────────────────────────────────────
-- 旧値: 4社とも tagline = '' または NULL（事前アサートで確認済み）
update ow_companies set tagline = '建設現場の工程・図面・写真を1つに集約する' where slug = 'andpad';
update ow_companies set tagline = '建設現場の図面管理と検査業務をアプリで行う' where slug = 'spiderplus';
update ow_companies set tagline = '建設の写真・書類管理をAIとBPOで自動化する' where slug = 'photoruction';
update ow_companies set tagline = '建築現場の情報を元請と職人で共有する'       where slug = 'dandori-work';

-- ── employee_count（3社。ダンドリワークは入れない）─────────────────────────
-- 旧値: 3社とも employee_count = '' または NULL
-- ⚠️ 書式は既存に揃えて「N名（YYYY年M月D日時点）」の**全角括弧**。
--    括弧の中は `parseEmployeeCount` が捨てるので、年号を人数として拾わない。
-- ⚠️ 一覧のカードは `formatEmployeeCountBand` が帯に落とす（実測で確認した値）:
--      アンドパッド 1,023名 → **1,001-5,000名**
--        ⚠️★指示書は「501-1,000名」としていたが**誤り**。1,023 は 1,000 を超える。
--      スパイダープラス 258名 → 201-500名
--      フォトラクション  88名 → 51-200名
update ow_companies set employee_count = '1,023名（2026年9月1日時点）'   where slug = 'andpad';
update ow_companies set employee_count = '258名（2025年12月31日時点）'   where slug = 'spiderplus';
update ow_companies set employee_count = '88名（2026年4月1日時点）'      where slug = 'photoruction';

-- ── headquarters_address（3社。ダンドリワークは入れない）───────────────────
-- 旧値: 3社とも headquarters_address = '' または NULL
-- ⚠️ これを入れると詳細ページの「拠点・資本関係」に**本社の行が出る**ようになり、
--    サイドバー（と本文）の「所在地」行は出なくなる（本社住所がある社では出さない設計）。
--    ⚠️ この3社は `location` も空なので、**入れる前は所在地も本社も出ていなかった。**
update ow_companies set headquarters_address = '東京都港区三田三丁目5番19号 住友不動産東京三田ガーデンタワー37F' where slug = 'andpad';
update ow_companies set headquarters_address = '東京都港区虎ノ門2-2-1 住友不動産虎ノ門タワー27階28階'             where slug = 'spiderplus';
update ow_companies set headquarters_address = '東京都品川区西五反田7-9-5 SGテラス4階'                            where slug = 'photoruction';

-- ── 事後アサート ────────────────────────────────────────────────────────────
do $$
declare
  r record;
  n_empty_listed int; n_empty_all int; n_listed int; n_rows int; n_founded_notnull int;
begin
  /* tagline を文字単位で突き合わせる */
  for r in select * from (values
      ('andpad',       '建設現場の工程・図面・写真を1つに集約する'),
      ('spiderplus',   '建設現場の図面管理と検査業務をアプリで行う'),
      ('photoruction', '建設の写真・書類管理をAIとBPOで自動化する'),
      ('dandori-work', '建築現場の情報を元請と職人で共有する')
    ) as t(slug, want)
  loop
    if (select tagline from ow_companies where slug = r.slug) is distinct from r.want then
      raise exception '% の tagline が一致しない: 「%」', r.slug, (select tagline from ow_companies where slug = r.slug);
    end if;
  end loop;

  /* employee_count / headquarters_address（3社） */
  for r in select * from (values
      ('andpad',       '1,023名（2026年9月1日時点）', '東京都港区三田三丁目5番19号 住友不動産東京三田ガーデンタワー37F'),
      ('spiderplus',   '258名（2025年12月31日時点）', '東京都港区虎ノ門2-2-1 住友不動産虎ノ門タワー27階28階'),
      ('photoruction', '88名（2026年4月1日時点）',    '東京都品川区西五反田7-9-5 SGテラス4階')
    ) as t(slug, emp, hq)
  loop
    if (select employee_count from ow_companies where slug = r.slug) is distinct from r.emp then
      raise exception '% の employee_count が一致しない', r.slug;
    end if;
    if (select headquarters_address from ow_companies where slug = r.slug) is distinct from r.hq then
      raise exception '% の headquarters_address が一致しない', r.slug;
    end if;
  end loop;

  /* ⚠️ ダンドリワークは**入れていない**ことを確かめる。「入れ忘れ」ではなく意図した欠落。 */
  if (select coalesce(employee_count,'') from ow_companies where slug='dandori-work') <> '' then
    raise exception 'ダンドリワークの employee_count が入っている（今回は入れない約束）';
  end if;
  if (select coalesce(headquarters_address,'') from ow_companies where slug='dandori-work') <> '' then
    raise exception 'ダンドリワークの headquarters_address が入っている（今回は入れない約束）';
  end if;

  select count(*) into n_founded_notnull from ow_companies
   where slug in ('andpad','spiderplus','photoruction','dandori-work') and founded_year is not null;
  select count(*) into n_empty_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false
     and (tagline is null or tagline='');
  select count(*) into n_empty_all from ow_companies where tagline is null or tagline='';
  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_rows from ow_companies;

  if n_founded_notnull <> 0 then raise exception 'founded_year が変わっている（触っていないはず）'; end if;
  if n_empty_listed <> 0 then raise exception 'tagline が空の掲載企業が % 社（期待 0）', n_empty_listed; end if;
  /* ⚠️ 全件は 21 → 17 になる（掲載中の4社だけ埋めたので、draft の17社は空のまま）。 */
  if n_empty_all <> 17 then raise exception 'tagline が空の企業が 全件 % 社（期待 17）', n_empty_all; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_rows <> 103 then raise exception 'ow_companies が % 行（期待 103）', n_rows; end if;

  raise notice '事後アサート OK: tagline空 掲載中0社 / 全件%社（draft のみ）/ 掲載中%社 / founded_year 不変',
    n_empty_all, n_listed;
end $$;

commit;
