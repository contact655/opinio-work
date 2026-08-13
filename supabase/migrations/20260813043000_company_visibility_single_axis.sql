-- 企業の可視性を1軸にする（2026-08-13）
--
-- ── これまで ────────────────────────────────────────────────────────────────
-- 承認 → ページ公開 → 一覧掲載 の3段。運営が3つのトグルを順に押していた。
--
-- ── 何が問題だったか ─────────────────────────────────────────────────────────
-- `is_published`（ページ公開）が守っていたものが実質何も無かった。
--
--   ・作成時に企業が入れられるのは name / description / industry /
--     employee_count / url / logo_url の6項目だけ。取材データ
--     （culture_description / org_teams / capital_type 等）は運営しか入れられない。
--     **空のページは何も主張しない。**
--   ・薄いページの SEO は sitemap 側で既に守られている
--     （src/app/sitemap.ts が filterListedCompanies を通す）。
--
-- 一方で害があった。企業ページには**一覧以外の入口**がある——求職者の経歴である。
-- ページを閉じると経歴のリンクが行き止まりになる（2026-08-12 に
-- 「経歴に出る6社のうち4社が is_published=false」で実際に起きていた）。
--
-- ── これから ────────────────────────────────────────────────────────────────
-- **ページは作った時点で存在する。運営が判断するのは「一覧に載せるか」だけ。**
--
--   listing_status = 'listed' … 一覧・検索・サジェスト・sitemap に出す
--   listing_status = 'draft'  … 出さない。ページは見える（経歴のリンク先になる）
--
-- `is_published` は列としては残すが、**意味を反転させる**。
--   既定 true。運営が「このページは不要」と判断したときだけ false にする取り下げ用。
--   ⚠️ 列も、false のときページが404になる挙動も変えていない。**既定値だけ**を変える。
--
-- ── 承認（is_approved）の掛け先を移す ────────────────────────────────────────
-- 旧 check_published_requires_approval を落とすと、承認は**何も制御しなくなる**
-- （is_approved を参照している処理はこの CHECK 以外に存在しない。src 全体で確認済み）。
-- 捨てずに「一覧掲載するには承認が要る」に付け替える。
-- 審査はディレクトリに載せる判断に対して行うほうが自然で、
-- 未承認の企業がディレクトリに漏れることも防げる。
--
-- ── 公開側の見え方を変えないこと ─────────────────────────────────────────────
-- 本 migration の後もディレクトリに出るのは**同じ79社**。
-- is_published=false だった4社はページが見えるようになるが、
-- listing_status='draft' に倒すので一覧には出ない。
--
-- 対象4社（CLAUDE.md「全社一括の UPDATE を禁止する。対象を id で明示列挙する」）:
--   60304f29-e070-4ef6-9b44-8a899a411a8d  アサヒビール株式会社     （未承認）
--   d079cdfe-f8f1-49db-b871-117651136362  スマートキャンプ株式会社 （承認済み）
--   7a048a8e-2c44-4f09-a727-8d7e6350851c  株式会社エージェント     （未承認・説明なし）
--   899441dc-9d15-4427-b701-253e591a3614  株式会社データプール     （未承認・説明なし）
--
-- ⚠️ **CHECK 制約は is_test の行にも効く。** 検証用の1社が未承認のまま
--    listing_status='listed' で残っており、最初の適用はここで弾かれた（23514）。
--    公開側は filterListedCompanies が is_test を除くので画面には影響しないが、
--    制約は行を選ばない。**is_test を「対象外」と考えないこと。**
--
--   81cae8d8-38bf-4497-8fa1-1fbb2741239d  株式会社Third Box（is_test）
--     → listing_status のみ draft にする。is_published は false のまま触らない
--       （検証用スタブなので、ページを見せる理由が無い）。
--
-- ⚠️ 直近に同じ列を触った migration を確認した:
--      20260812120937_company_is_test_flag.sql … is_test を追加。上の4社は
--        「説明も製品もある未公開の実企業／確認中」として **is_test にしていない**。
--        本 migration はその判断を打ち消さない（is_test には触れない）。
--      20260812060545_company_master_normalization.sql … listing_status には触れていない。
--
-- ⚠️ published_at を埋める（CLAUDE.md「migration で is_published を true に
--    するときも published_at を埋める」）。4社とも現在 null で、
--    公開するのは今なので now() が推測値ではなく事実になる。
--
-- ⚠️ 列は追加していないので GRANT の追記は不要
--    （ow_companies はテーブルレベル UPDATE を落として列単位で配っている。
--      docs/ow-companies-grants.md）。

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_constraint int;
  v_default    text;
  v_targets    int;
  v_listed     int;
  v_violating  int;
BEGIN
  SELECT count(*) INTO v_constraint
    FROM pg_constraint
   WHERE conrelid = 'public.ow_companies'::regclass
     AND conname  = 'check_published_requires_approval';
  IF v_constraint <> 1 THEN
    RAISE EXCEPTION '事前チェック: check_published_requires_approval が想定と違う (% 件)', v_constraint;
  END IF;

  SELECT column_default INTO v_default
    FROM information_schema.columns
   WHERE table_name = 'ow_companies' AND column_name = 'is_published';
  IF v_default IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION '事前チェック: is_published の既定値が想定と違う (%)', v_default;
  END IF;

  -- 対象4社が「未公開のまま」であること
  SELECT count(*) INTO v_targets
    FROM ow_companies
   WHERE id IN ('60304f29-e070-4ef6-9b44-8a899a411a8d',
                'd079cdfe-f8f1-49db-b871-117651136362',
                '7a048a8e-2c44-4f09-a727-8d7e6350851c',
                '899441dc-9d15-4427-b701-253e591a3614')
     AND is_published = false
     AND published_at IS NULL;
  IF v_targets <> 4 THEN
    RAISE EXCEPTION '事前チェック: 未公開の対象4社が揃っていない (% 件)', v_targets;
  END IF;

  -- 今ディレクトリに出ている社数を控える（事後に一致することを確かめる）
  SELECT count(*) INTO v_listed
    FROM ow_companies
   WHERE is_published = true AND listing_status = 'listed' AND coalesce(is_test, false) = false;
  IF v_listed <> 79 THEN
    RAISE EXCEPTION '事前チェック: ディレクトリ掲載が79社でない (% 社)。別セッションが変更した可能性', v_listed;
  END IF;

  -- 新しい CHECK に違反する行が、下で扱う5社だけであること
  -- ⚠️ is_test を除外しない。制約は行を選ばない（初回適用はここで弾かれた）。
  SELECT count(*) INTO v_violating
    FROM ow_companies
   WHERE listing_status = 'listed' AND is_approved = false
     AND id NOT IN ('60304f29-e070-4ef6-9b44-8a899a411a8d',
                    '7a048a8e-2c44-4f09-a727-8d7e6350851c',
                    '899441dc-9d15-4427-b701-253e591a3614',
                    '81cae8d8-38bf-4497-8fa1-1fbb2741239d');
  IF v_violating <> 0 THEN
    RAISE EXCEPTION '事前チェック: 想定外の未承認×一覧掲載の行がある (% 件)', v_violating;
  END IF;
END $$;

-- ── 1. is_published の既定を true にする ─────────────────────────────────────
-- ⚠️ 既存行の値は書き換えない。既定値の変更だけ。
ALTER TABLE public.ow_companies ALTER COLUMN is_published SET DEFAULT true;

-- ── 2. 承認の掛け先を「ページ公開」から「一覧掲載」へ移す ─────────────────────
ALTER TABLE public.ow_companies DROP CONSTRAINT check_published_requires_approval;

-- ⚠️ 先に対象4社を draft に倒してから制約を張る。順序を逆にすると
--    未承認3社が listing_status='listed' のままで制約違反になる。
UPDATE public.ow_companies
   SET is_published  = true,
       published_at  = now(),
       listing_status = 'draft',
       updated_at    = now()
 WHERE id IN ('60304f29-e070-4ef6-9b44-8a899a411a8d',
              'd079cdfe-f8f1-49db-b871-117651136362',
              '7a048a8e-2c44-4f09-a727-8d7e6350851c',
              '899441dc-9d15-4427-b701-253e591a3614');

-- 検証用スタブ（is_test）。ページは見せないので listing_status だけ倒す。
UPDATE public.ow_companies
   SET listing_status = 'draft',
       updated_at     = now()
 WHERE id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d';

ALTER TABLE public.ow_companies
  ADD CONSTRAINT check_listed_requires_approval
  CHECK (listing_status <> 'listed' OR is_approved = true);

COMMENT ON COLUMN public.ow_companies.is_published IS
  '詳細ページが見えるか（404ゲート）。既定 true。運営がページを取り下げるときだけ false にする。'
  '一覧・検索に出すかは listing_status。src/lib/companies/visibility.ts のヘルパーを通すこと。';

COMMENT ON COLUMN public.ow_companies.is_approved IS
  '運営が内容を確認したか。一覧掲載（listing_status=listed）の前提条件'
  '（check_listed_requires_approval）。ページの可視性とは無関係。';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_default   text;
  v_old       int;
  v_new       int;
  v_listed    int;
  v_unpub     int;
  v_bad       int;
BEGIN
  SELECT column_default INTO v_default
    FROM information_schema.columns
   WHERE table_name = 'ow_companies' AND column_name = 'is_published';
  IF v_default IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION '事後チェック: is_published の既定値が true になっていない (%)', v_default;
  END IF;

  SELECT count(*) INTO v_old FROM pg_constraint
   WHERE conrelid = 'public.ow_companies'::regclass AND conname = 'check_published_requires_approval';
  SELECT count(*) INTO v_new FROM pg_constraint
   WHERE conrelid = 'public.ow_companies'::regclass AND conname = 'check_listed_requires_approval';
  IF v_old <> 0 OR v_new <> 1 THEN
    RAISE EXCEPTION '事後チェック: 制約の付け替えに失敗 (旧 % / 新 %)', v_old, v_new;
  END IF;

  -- **ディレクトリの見え方が変わっていないこと**（ここが本 migration の肝）
  SELECT count(*) INTO v_listed
    FROM ow_companies
   WHERE is_published = true AND listing_status = 'listed' AND coalesce(is_test, false) = false;
  IF v_listed <> 79 THEN
    RAISE EXCEPTION '事後チェック: ディレクトリ掲載が79社から変わった (% 社)', v_listed;
  END IF;

  -- 未公開の企業が残っていないこと（is_test を除く）
  SELECT count(*) INTO v_unpub
    FROM ow_companies WHERE is_published = false AND coalesce(is_test, false) = false;
  IF v_unpub <> 0 THEN
    RAISE EXCEPTION '事後チェック: 未公開の企業が残っている (% 社)', v_unpub;
  END IF;

  -- 未承認なのにディレクトリに載っている企業が無いこと
  SELECT count(*) INTO v_bad
    FROM ow_companies WHERE listing_status = 'listed' AND is_approved = false;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '事後チェック: 未承認なのに一覧掲載の企業がある (% 社)', v_bad;
  END IF;
END $$;

COMMIT;
