-- 企業フェーズ（ow_companies.phase）を2段階の語彙にする（柴さんの判断・2026-09-06）。
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- 「成長ステージ（シード〜シリーズC）」というバケットが「シリーズB」の隣に並んでおり、
-- 実データでは**どちらも同じ1社**を指していた（series_b が1社しか無いため）。
-- 親（スタートアップ / 上場企業 / 非上場）と子（各ラウンド・各市場）に分ける。
--
-- ⚠️★あわせて **UI と DB の語彙が噛み合っていなかったのを直す。**
--    `/biz/company` の「事業ステージ」は `lib/business/mockCompany.ts` の独自8値
--    （シード / シリーズA / シリーズB-C / レイターステージ / 上場(東証グロース) /
--     上場(東証プライム) / 上場(東証スタンダード) / その他）を出しており、
--    **1つもこの CHECK を通らなかった。** `ow_companies` は UPDATE が列単位 GRANT なので、
--    企業が事業ステージを選ぶと**企業情報の保存が丸ごと失敗していた。**
--    コード側は同じコミットで `lib/constants/phase.ts` の1系統に寄せてある。
--
-- ── この migration がやること ───────────────────────────────────────────────
-- CHECK に **5値を追加**するだけ。既存の値は1つも消さず、データも動かさない。
--   追加: startup / listed_prime / listed_standard / listed_growth / listed_overseas
--   維持: seed / series_a / series_b / series_c / series_d / listed / unicorn / non_listed
--
-- ⚠️ **既存の `listed` 56社を市場別に振り分けていない。**
--    52社は外資系子会社で「親会社が海外市場に上場」だが、
--    `capital_type = foreign_subsidiary` から機械的に決めると推測値の投入になる
--    （外国企業が東証に上場している例もある）。企業ごとに確かめて入れる。
--    → CLAUDE.md「migration を書くときのルール③ 推測値を投入しない」
--
-- ⚠️ したがって適用直後は市場別の子が0件で、絞り込みの選択肢にも出ない
--    （「0件の選択肢を出さない」規則）。**それが正しい状態。**
--
-- ⚠️ 同じ列を触った直近の migration を確認済み: 20260727000000_baseline.sql が
--    この CHECK を作ったきり、以降 phase の制約を変えたものは無い（grep で 0 件）。

begin;

-- 事前チェック: いま入っている値がすべて新しい CHECK に収まるか
do $$
declare
  bad text;
begin
  select string_agg(distinct phase, ', ') into bad
    from ow_companies
   where phase is not null
     and phase not in ('seed','series_a','series_b','series_c','series_d',
                       'listed','unicorn','non_listed',
                       'startup','listed_prime','listed_standard','listed_growth','listed_overseas');
  if bad is not null then
    raise exception '新しい CHECK に収まらない既存値がある: %', bad;
  end if;
end $$;

alter table ow_companies drop constraint if exists ow_companies_phase_check;

alter table ow_companies add constraint ow_companies_phase_check
  check (
    phase is null
    or phase = any (array[
      -- 親
      'startup', 'listed', 'non_listed',
      -- スタートアップの子（資金調達ラウンド）
      'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'unicorn',
      -- 上場企業の子（市場）
      'listed_prime', 'listed_standard', 'listed_growth', 'listed_overseas'
    ])
  );

comment on column ow_companies.phase is
  '企業グループとしてのステージ。**最終親会社の状態**で判定する（日本法人が外資子会社でも、'
  '親が上場していれば listed 系）。2段階の語彙で、親（startup / listed / non_listed）と'
  '子（各ラウンド・各市場）のどちらを入れてもよい。詳細が分からないうちは親を入れる。'
  '選択肢の唯一の出どころは src/lib/constants/phase.ts。';

/* ⚠️ `business_stage` は**本番100行すべて NULL**（2026-09-06 実測）。
      `lib/business/company.ts` が `row.phase ?? row.business_stage` と読んでいるだけで、
      書く経路は無い。**DROP はしていない**が、新しく読み書きしないこと。 */
comment on column ow_companies.business_stage is
  '【廃止】本番は全行 NULL（2026-09-06 実測）。書き込む経路が無い。phase を使うこと。';

-- 事後チェック: 新しい値が入ること／不正な値が弾かれることを実際に試す
do $$
declare
  probe uuid;
  rejected boolean := false;
begin
  select id into probe from ow_companies where phase = 'listed' limit 1;
  if probe is null then
    raise exception '検証に使える行が無い';
  end if;

  -- 新しい値が通る
  update ow_companies set phase = 'listed_overseas' where id = probe;
  update ow_companies set phase = 'startup'         where id = probe;
  -- 元に戻す
  update ow_companies set phase = 'listed'          where id = probe;

  -- 旧 UI の値は弾かれる
  begin
    update ow_companies set phase = '上場(東証プライム)' where id = probe;
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'CHECK が効いていない（日本語の値が通った）';
  end if;
end $$;

commit;
