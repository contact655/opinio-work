-- ============================================================================
-- ① ow_companies.source に CHECK を張り、'user' を語彙に加える
-- ② ow_industries に description（選択肢の短い説明）を足し、5件だけ埋める
--
-- 作業前ダンプ: .dumps/20260905-1407-ow_industries-ow_companies.sql
-- ============================================================================

BEGIN;

-- ── ① source の語彙 ────────────────────────────────────────────────────────
--
-- ⚠️★**この列には CHECK が無かった。** `archive/104` が `source text` を足した
--    だけで、宣言した語彙（admin_seed / self_serve / NULL）は**コードにも
--    DBにも書かれていなかった。** 結果、語彙は静かにドリフトした:
--
--      実測（2026-09-05 / 100社）
--        migration 79 / NULL 9 / manual 8 / biz_self 3 / admin_seed 1
--        ★宣言にあった self_serve は **0件**
--        ★宣言に無い migration と manual が **87件**
--
--    「宣言が0件で、宣言に無い値が大多数」は、**CHECK の無い列挙列で必ず起きる形**。
--    誰もエラーを見ないので、気づくには数えるしかない。
--
-- ⚠️ **NOT NULL にはしない。** NULL 9件は「どの入口から来たか分からない」という
--    事実で、埋めると推測値の投入になる（CLAUDE.md「値が無いことを、ある値に
--    置き換えない」）。CHECK は NULL を通す。
DO $$
DECLARE v_bad int;
BEGIN
  SELECT count(*) INTO v_bad FROM public.ow_companies
   WHERE source IS NOT NULL
     AND source NOT IN ('migration', 'manual', 'biz_self', 'admin_seed', 'user');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '語彙に無い source が % 件ある。CHECK を張る前に確認すること', v_bad;
  END IF;
END $$;

ALTER TABLE public.ow_companies
  ADD CONSTRAINT ow_companies_source_check
  CHECK (source IS NULL OR source IN ('migration', 'manual', 'biz_self', 'admin_seed', 'user'));

COMMENT ON COLUMN public.ow_companies.source IS
  'どの入口から作られたか。**誰が作ったか（ロール）ではない。** '
  'migration=SQLで投入 / manual=運営が手で作成 / biz_self=POST /api/biz/companies（企業担当者の登録） / '
  'admin_seed=初期投入 / user=POST /api/jobseeker/companies（求職者が経歴入力から作成） / '
  'NULL=不明（2026-09-05 時点で9社。⚠ 推測で埋めないこと）。'
  '⚠ 値を足すときは、この CHECK と src/lib/constants/companySource.ts の両方を同じ migration で更新する。';

-- ── ② 業種の選択肢に短い説明を付ける ────────────────────────────────────────
--
-- ⚠️★**なぜ列にするか（UI 側の定数にしない理由）**
--    業種マスタはこの2週間で2回動いた（不動産・建設の分割 / インターネット・Web の統合）。
--    説明が別ファイルにあると、**値を足したり統合したりするたびに追従を忘れる**
--    ——「2組に割れて片方だけ直る」形になる。**同じ VALUES に並べれば忘れられない。**
--
-- ⚠️ `/admin` に業種マスタの管理画面は**無い**（`ow_industries` を UPDATE / INSERT
--    している src コードは0件）。したがって列を足しても入力欄は要らない。
--
-- ⚠️ 権限はテーブルレベル（`ow_industries` は列単位 GRANT のテーブルではない）ので、
--    追加した列はそのまま読める。
ALTER TABLE public.ow_industries
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.ow_industries.description IS
  '選択肢に添える短い説明。**迷いやすい組にだけ付ける。** '
  '⚠ 全21件に付けない —— 1つ付けると「無い方は説明が要らないほど自明」に見えるので、'
  '迷う組だけに絞る。2026-09-05 時点は製造3値と商社/小売の5件。'
  '⚠ 値を足したら、その行に説明が要るかをこの表の中で判断すること（別ファイルに分けない）。';

-- ⚠️ 対象は slug で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
UPDATE public.ow_industries AS i
   SET description = v.description
  FROM (VALUES
    -- ★製造の3値。「製造業」という親が無いので、素人は精密機器・自動車部品で迷う。
    --   ⚠️ どれかを「受け皿」にしない（2026-09-05 / 柴さんの判断）。
    --      片方に集めると、化学メーカーの人が「電機・機械」を選んでしまい、
    --      **2階層化しても『電機・機械』のまま固定されて移し直せない。**
    --      互いに排他だと分かる説明を3つとも付けて、正しい箱に入れてもらう。
    ('machinery',            '機械・電機・自動車・精密機器などの製造'),
    ('materials-chemicals',  '化学・素材・金属などの製造'),
    ('food-beverage',        '食品・飲料の製造'),
    -- ★商社と小売。判断軸を「誰に売るか」1つに揃えてある。
    ('trading-wholesale',    'メーカーと小売の間に立ち、仕入れて売る（総合商社・専門商社・卸）'),
    ('retail-distribution',  '消費者に直接売る（店舗・EC・チェーン）')
  ) AS v(slug, description)
 WHERE i.slug = v.slug;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_desc int; v_active int;
BEGIN
  SELECT count(*) INTO v_desc FROM public.ow_industries WHERE description IS NOT NULL;
  IF v_desc <> 5 THEN RAISE EXCEPTION '説明が付いた業種が 5 件でない（% 件）', v_desc; END IF;

  -- ⚠️ 説明を付けた5件がすべて**有効な**業種であること（無効な行に付けても画面に出ない）
  SELECT count(*) INTO v_active FROM public.ow_industries WHERE description IS NOT NULL AND is_active;
  IF v_active <> 5 THEN RAISE EXCEPTION '説明を付けた業種のうち有効なものが % 件しかない', v_active; END IF;

  RAISE NOTICE '事後チェック OK: source の CHECK を追加 / 説明つき業種 % 件', v_desc;
END $$;

COMMIT;
