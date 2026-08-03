-- ═══════════════════════════════════════════════════════════════════════════
-- 生藤さんの Enterprise Account Executive 2件を「エンタープライズセールス」に統一
--
-- ── 背景 ────────────────────────────────────────────────────────────────────
-- /people のカードは 2026-08-04 から ow_experiences.role_category_id →
-- ow_roles の職種名を出す。自由記述の role_title は
--   「営業」「Enterprise Account Executive」「セールス（デジタルセールス）」
--   「営業（金融ソリューション）」
-- のように粒度がばらばらで、読み手が毎回解釈することになるため。
--
-- カードには「子階層があれば子、無ければ大分類」を出す。
-- 実ユーザー4名のうち3名は子階層まで入っているが、
-- 生藤さんの現職だけ親（営業）のままで、カードに「営業」と粗く出てしまう。
--
--   大塚悠貴  → フィールドセールス
--   木村雅樹  → エンタープライズセールス
--   福永陽貴  → フィールドセールス
--   生藤 弘樹 → 営業            ← これを直す
--
-- ── なぜ「エンタープライズセールス」か ──────────────────────────────────────
-- 「営業」の子は12件。候補は3つあった。
--   エンタープライズセールス … 肩書き "Enterprise Account Executive" の直訳。採用
--   アカウントエグゼクティブ … より広い。エンタープライズ限定という情報が落ちる
--   フィールドセールス      … 選ぶと4名中3名が同じ職種になり、粒度を細かくした意味が薄れる
--
-- ── 1つ前の職歴も揃える ─────────────────────────────────────────────────────
-- 同じ肩書きの1つ前の職歴（2024-02〜2026-06、id=7176c7f0-...）は
-- 「フィールドセールス」だった。/u/[id] の経歴タイムラインでは
-- 同じ「Enterprise Account Executive」が2つの職種で隣り合って並ぶことになる。
-- 2行まとめて「エンタープライズセールス」に揃える。
--
-- ⚠️ この2行は **別会社**（フライル → セールスフォース・ジャパン）。
--    同じ会社の重複ではなく、転職をまたいで同じ肩書きを続けているケース。
--    揃える根拠は「同じ肩書きが違う職種で並ぶのを避ける」ことであって、
--    同一会社であることではない。会社一致をガードに入れないのはこのため。
--
-- ⚠️ さらに前の3件（富士フイルム時代の「営業（メジャー営業統括部…）」、
--    SDR、Account Executive）は肩書きが違うので触らない。
--    それぞれ フィールドセールス / インサイドセールス / フィールドセールス のままでよい。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  -- 生藤さんの「Enterprise Account Executive」2件（セールスフォース・ジャパン）
  v_exp_id  uuid := '1dbd2637-f107-4029-a299-14e1ae3e4897';  -- 現職（2026-07〜）
  v_prev_id uuid := '7176c7f0-20e7-4047-9129-b8e2e0d1c2b5';  -- 1つ前（2024-02〜2026-06）
  v_field   uuid;
  v_sales   uuid;
  v_target  uuid;
  v_current uuid;
  v_updated int;
  v_parent_left int;
BEGIN
  -- ── ① 大分類「営業」を特定 ──────────────────────────────────────────────
  SELECT id INTO v_sales FROM ow_roles WHERE parent_id IS NULL AND name = '営業';
  IF v_sales IS NULL THEN
    RAISE EXCEPTION 'ow_roles にトップレベルの「営業」が無い。中止';
  END IF;

  -- ── ② 移動先が「営業」の子で、有効かつ統合されていないこと ──────────────
  --    統合済み（merged_into_id あり）のロールに紐づけると、
  --    2026-08-03 のロール統合と同じ問題（引けないロールに紐づく）が再発する。
  SELECT id INTO v_target
    FROM ow_roles
   WHERE parent_id = v_sales
     AND name = 'エンタープライズセールス'
     AND is_active IS TRUE
     AND merged_into_id IS NULL;
  IF v_target IS NULL THEN
    RAISE EXCEPTION '「エンタープライズセールス」が営業配下に有効な形で見つからない。中止';
  END IF;

  -- ── ③ 対象行が想定どおりであること ──────────────────────────────────────
  --    現職であること・現在の紐づけが親（営業）であることを両方確かめる。
  --    既に子階層が入っているなら、誰かが直した後なので上書きしない。
  SELECT role_category_id INTO v_current
    FROM ow_experiences
   WHERE id = v_exp_id AND is_current IS TRUE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION '対象の職歴が見つからない、または現職でない（id=%）。中止', v_exp_id;
  END IF;
  IF v_current <> v_sales THEN
    RAISE EXCEPTION
      '現在の role_category_id が親「営業」ではない（%）。既に修正済みの可能性。中止', v_current;
  END IF;

  -- 人物と肩書きの取り違え防止。2行とも同じ人・同じ肩書きであること。
  -- 会社は一致しない（フライル → セールスフォース）ので条件に入れない。
  IF (
    SELECT count(*) FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
     WHERE e.id IN (v_exp_id, v_prev_id)
       AND u.name = '生藤 弘樹'
       AND e.role_title = 'Enterprise Account Executive'
  ) <> 2 THEN
    RAISE EXCEPTION '対象2行の氏名または役職名が想定と違う。中止';
  END IF;

  -- 1つ前の職歴が「フィールドセールス」であること（既に直されていれば中止）
  SELECT id INTO v_field
    FROM ow_roles WHERE parent_id = v_sales AND name = 'フィールドセールス';
  IF NOT EXISTS (
    SELECT 1 FROM ow_experiences WHERE id = v_prev_id AND role_category_id = v_field
  ) THEN
    RAISE EXCEPTION
      '1つ前の職歴が「フィールドセールス」ではない。既に修正済みの可能性。中止';
  END IF;

  -- ── ④ 適用 ──────────────────────────────────────────────────────────────
  UPDATE ow_experiences
     SET role_category_id = v_target, updated_at = NOW()
   WHERE id IN (v_exp_id, v_prev_id);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 2 THEN
    RAISE EXCEPTION '更新が % 件（想定2件）。ロールバック', v_updated;
  END IF;

  -- ── ⑤ 事後チェック ──────────────────────────────────────────────────────
  --    実ユーザーの現職で、role_category_id が大分類のままの行が残っていないこと。
  --    残っていればカードに粗い職種が出続けるので気づけるようにする。
  SELECT count(*) INTO v_parent_left
    FROM ow_experiences e
    JOIN ow_users u ON u.id = e.user_id
    JOIN ow_roles r ON r.id = e.role_category_id
   WHERE e.is_current IS TRUE
     AND u.is_test IS NOT TRUE
     AND u.is_system IS NOT TRUE
     AND r.parent_id IS NULL;

  IF v_parent_left > 0 THEN
    RAISE EXCEPTION
      '現職の role_category_id が大分類のままの行が % 件残っている。ロールバック', v_parent_left;
  END IF;

  -- 同じ肩書きの2行が1つの職種に揃ったこと
  IF (
    SELECT count(DISTINCT role_category_id) FROM ow_experiences
     WHERE id IN (v_exp_id, v_prev_id)
  ) <> 1 THEN
    RAISE EXCEPTION '同じ肩書きの2行が同じ職種に揃っていない。ロールバック';
  END IF;

  RAISE NOTICE
    '完了: Enterprise Account Executive 2件を「エンタープライズセールス」に統一。大分類のまま残る現職: % 件',
    v_parent_left;
END $$;

COMMIT;
