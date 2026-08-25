-- 事業領域を「運営が付け直せる」状態にする（2026-08-25 / 業種分類フェーズ2の下ごしらえ）
--
-- ── なぜ要るか ──────────────────────────────────────────────────────────────
--   事業領域の初期値は migration で入れたが、**入力する画面が無い**。
--   運営も企業も後から付け直せないので、
--     ・公開ゲート（分類が欠けた企業を掲載させない）を先に入れると**詰む**
--       — 新規企業は事業領域0件で生まれ、付ける手段が無い
--     ・求職者側の読み手を事業領域へ移しても、新規企業は空のままフィルタに出ない
--   **道具を先に用意してから規則を課す。** この migration は道具側。
--
-- ── ① `ow_industries.requires_business_domain` ─────────────────────────────
--   公開ゲートで「事業領域が必須か」を業種ごとに決める。
--
--   ⚠️ **判定を SQL やアプリにハードコードしないこと。** 業種の slug をコードに
--      書くと、`INDUSTRY_GROUPS` を直書きしていた頃と同じ問題に戻る
--      （マスタと別のリストが増え、片方だけ古くなる）。
--
--   実測（2026-08-25）— 必須にする3業種と、しない2業種はきれいに分かれている:
--     IT・ソフトウェア          76社 / 主の事業領域あり 73 / 0件 3（旧値 `IT / SaaS` の3社）
--     インターネット・Webサービス  2社 /              2 /     0
--     電子機器・半導体            7社 /              7 /     0
--     食品・飲料                1社 /              0 /     1（アサヒビール）
--     商社・卸売                1社 /              0 /     1（海光電業）
--
--   ⚠️ **非IT企業に事業領域を必須にしない。** 必須にすると、掲載したいときに
--      合わない領域を1つ選ぶしかなくなり、**推測値を投入することになる**
--      （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
--
--   ⚠️ **true にしたのは、実際に事業領域を持つ企業がいる3業種だけ。**
--      残り17業種は false。企業が入ってきたら運営が上げる。
--      「IT系だから」で先回りして true にしない（根拠のある値だけを入れる）。
--
-- ── ② `set_company_business_domains()` ─────────────────────────────────────
--   入れ替え（DELETE → INSERT）を**1トランザクションで**行うための RPC。
--
--   ⚠️ **アプリから DELETE / INSERT を2回叩く形にしないこと。** supabase-js の
--      呼び出しは1回ずつ別トランザクションなので、DELETE のあと INSERT が落ちると
--      **その企業の分類が消えたまま残る**。分類が消えると公開ゲートに引っかかり、
--      掲載中の企業が編集しただけで掲載できなくなる。
--
--   ⚠️ **1社あたりの上限（3件）はここで見ない。API 側で検証する。**
--      DB で縛ると運営が直せない場面が出る（トリガーにしないのと同じ理由）。
--      ここで守るのは「マスタに実在すること」と「主がちょうど1件であること」だけ。
--
--   ⚠️ SECURITY INVOKER（既定）のままにする。DEFINER にすると RLS を素通りして
--      他社の分類を書き換えられる関数になる。運営経路は service_role で呼ぶので
--      INVOKER でも通る。
--
-- 作業前ダンプ: .dumps/20260825-2151-ow_industries-ow_business_domains-ow_company_business_domains.sql

BEGIN;

-- ── ① 業種ごとの「事業領域が必須か」──────────────────────────────────────
ALTER TABLE public.ow_industries
  ADD COLUMN requires_business_domain boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ow_industries.requires_business_domain IS
  '公開ゲートで事業領域（ow_company_business_domains の is_primary 1件）を必須にするか。⚠️ 非IT企業には立てない（合わない領域を選ばせると推測値の投入になる）。⚠️ 判定をコードにハードコードせず、必ずこの列を読むこと';

-- ⚠️ 対象を slug で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）
UPDATE public.ow_industries
   SET requires_business_domain = true
 WHERE slug IN ('it-software', 'internet-web', 'electronics-semiconductor');

-- ── ② 事業領域の入れ替え（1トランザクション）────────────────────────────
CREATE OR REPLACE FUNCTION public.set_company_business_domains(
  p_company_id        uuid,
  p_domain_ids        uuid[],
  p_primary_domain_id uuid
) RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_ids   uuid[];
  v_count integer;
  v_valid integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ow_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION '企業が見つかりません' USING ERRCODE = '22023';
  END IF;

  -- 重複を落とす（同じ領域を2回送られても1行にする）
  SELECT coalesce(array_agg(DISTINCT d), '{}'::uuid[])
    INTO v_ids
    FROM unnest(coalesce(p_domain_ids, '{}'::uuid[])) AS d;

  v_count := coalesce(array_length(v_ids, 1), 0);

  -- すべてマスタに実在し、有効であること
  IF v_count > 0 THEN
    SELECT count(*) INTO v_valid
      FROM ow_business_domains
     WHERE id = ANY(v_ids) AND is_active = true;
    IF v_valid <> v_count THEN
      RAISE EXCEPTION '事業領域マスタに無い、または無効な id が含まれています'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 主はちょうど1件。0件なら主は無し
  IF v_count = 0 THEN
    IF p_primary_domain_id IS NOT NULL THEN
      RAISE EXCEPTION '事業領域が0件のときは主を指定できません' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_primary_domain_id IS NULL THEN
      RAISE EXCEPTION '主の事業領域を1つ選んでください' USING ERRCODE = '22023';
    END IF;
    IF NOT (p_primary_domain_id = ANY(v_ids)) THEN
      RAISE EXCEPTION '主の事業領域は、選んだ事業領域の中から指定してください'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ⚠️ `WHERE true` ではなく company_id で必ず絞る
  DELETE FROM ow_company_business_domains WHERE company_id = p_company_id;

  IF v_count > 0 THEN
    INSERT INTO ow_company_business_domains (company_id, domain_id, is_primary, display_order)
    SELECT p_company_id,
           m.id,
           (m.id = p_primary_domain_id),
           -- 主を先頭にし、あとはマスタの並び順
           row_number() OVER (ORDER BY (m.id = p_primary_domain_id) DESC, m.display_order, m.name)
      FROM ow_business_domains m
     WHERE m.id = ANY(v_ids);
  END IF;

  RETURN v_count;
END $$;

COMMENT ON FUNCTION public.set_company_business_domains(uuid, uuid[], uuid) IS
  '企業の事業領域を入れ替える（DELETE→INSERT を1トランザクションで）。⚠️ 1社あたりの上限はここで見ない（API 側で検証する）。⚠️ SECURITY INVOKER のままにすること';

-- 既定の PUBLIC 実行権限を落とし、必要なロールにだけ配る
REVOKE ALL ON FUNCTION public.set_company_business_domains(uuid, uuid[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_company_business_domains(uuid, uuid[], uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_company_business_domains(uuid, uuid[], uuid)
  TO authenticated, service_role;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_required bigint; v_listed_bad bigint;
BEGIN
  SELECT count(*) INTO v_required FROM public.ow_industries WHERE requires_business_domain;
  IF v_required <> 3 THEN
    RAISE EXCEPTION '事後チェック失敗: requires_business_domain が % 件（3件のはず）', v_required;
  END IF;

  -- ⚠️ 掲載中の企業が新しい必須条件に1社でも引っかかるなら、
  --    公開ゲートを入れた瞬間にその企業が掲載できなくなる。ここで気づけるようにする
  SELECT count(*) INTO v_listed_bad
    FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id
   WHERE c.listing_status = 'listed' AND c.is_published AND NOT coalesce(c.is_test, false)
     AND i.requires_business_domain
     AND NOT EXISTS (SELECT 1 FROM public.ow_company_business_domains l
                      WHERE l.company_id = c.id AND l.is_primary);
  IF v_listed_bad <> 0 THEN
    RAISE EXCEPTION '事後チェック失敗: 掲載中なのに主の事業領域が無い企業が % 社ある', v_listed_bad;
  END IF;

  -- 列を足したら権限を測る（CLAUDE.md）
  IF NOT has_column_privilege('anon', 'public.ow_industries', 'requires_business_domain', 'SELECT') THEN
    RAISE EXCEPTION '事後チェック失敗: anon が requires_business_domain を読めない';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.ow_industries', 'requires_business_domain', 'SELECT') THEN
    RAISE EXCEPTION '事後チェック失敗: authenticated が requires_business_domain を読めない';
  END IF;
END $$;

COMMIT;
