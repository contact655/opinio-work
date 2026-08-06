-- ═══════════════════════════════════════════════════════════════════════════
-- ow_job_roles を職種の唯一の正とする（案A）
--
-- 背景:
--   求人の職種が3系統に分かれ、互いに矛盾していた。
--     (1) ow_jobs.job_category      … フリーテキスト。廃止予定
--     (2) ow_jobs.role_category_id  … ow_roles への FK。migration 260/261 の
--                                      一括投入で 20/20 埋まっているが、
--                                      biz UI は一切更新しない（古い値が残る）
--     (3) ow_job_roles              … biz UI が実際に読み書きする正規の経路。
--                                      13/20 しか無かった
--
--   判断基準は「biz UI が更新するほう」。よって (3) を正とする。
--   ただし (3) は7件欠落しているため、(2) から補完してから正に据える。
--
--   また (2) と (3) は5件で矛盾していた。ow_roles の階層では
--   セールスエンジニア / ソリューションエンジニア / ソリューションズアーキテクトは
--     営業 → ソリューションエンジニア・プリセールス → 各職種
--   と営業配下だが、(3) はこれらを「エンジニア」に紐づけていた。
--   ow_roles の階層を正とする方針に従い、(2) の具体職種で置き換える。
--
-- 方針:
--   ow_job_roles には role_category_id の「具体職種」をそのまま入れる。
--   9大分類への集約は参照側で祖先を辿って行う（情報を落とさないため）。
--   biz の職種ピッカーの追加操作は親→子の2階層だが、roles には全階層が
--   渡っているため、既存の孫世代（プリセールス系）の選択は表示も再保存も通る。
--
-- 適用後の想定: published 18件すべてが 9大分類のいずれかに到達可能になる
--   営業 13 / カスタマーサクセス 3 / 事業開発 1 / エンジニア 1
--   （残る5分類が0件なのは在庫の実態。件数は偽らない方針に従いそのまま出す）
--
-- ⚠️ role_category_id はこの migration では削除しない。
--    参照箇所のコード移行が済むまで残す。
--
-- ── 2026-08-06 追記: 「biz UI は一切更新しない」は解消した ──────────────────
--   上の (2) について「biz UI は一切更新しない（古い値が残る）」と書いたが、
--   2026-08-06 に保存パスで主ロールと同期するようにした。
--     ・企業側: syncJobCategoryFromRoles()（POST /api/biz/jobs と PUT /api/biz/jobs/[id]）
--     ・運営側: updateJobRoles()（/admin/jobs/[id] の職種編集）
--   どちらも ow_job_roles の主ロールで job_category と role_category_id を揃える。
--   同日時点で全20件、主ロールと role_category_id が一致している。
--   ⚠️ 正は引き続き ow_job_roles。role_category_id はそこから派生する値であって、
--      第二の正ではない。読み側の移行が済んだら列ごと落とす。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 祖先解決テーブル（トランザクション終了時に自動破棄）────────────────────
CREATE TEMP TABLE _role_root ON COMMIT DROP AS
WITH RECURSIVE up AS (
  SELECT id, id AS role_id, parent_id FROM ow_roles
  UNION ALL
  SELECT p.id, u.role_id, p.parent_id FROM up u JOIN ow_roles p ON p.id = u.parent_id
)
SELECT role_id, id AS top_id FROM up WHERE parent_id IS NULL;

DO $$
DECLARE
  v_null_rc         int;
  v_missing_before  int;
  v_mismatch_before int;
  v_deleted         int;
  v_inserted        int;
  v_missing_after   int;
  v_mismatch_after  int;
  v_multi_root      int;
BEGIN
  -- ── 事前チェック1: role_category_id が全件埋まっていること ───────────────
  --    埋まっていない求人があると、その求人は職種を失う
  SELECT count(*) INTO v_null_rc FROM ow_jobs WHERE role_category_id IS NULL;
  IF v_null_rc > 0 THEN
    RAISE EXCEPTION 'role_category_id が NULL の求人が % 件ある。補完元が無いため中止', v_null_rc;
  END IF;

  -- ── 事前チェック2: 祖先が一意に決まること ───────────────────────────────
  --    ow_roles に循環や多重ルートがあると集約が壊れる
  SELECT count(*) INTO v_multi_root
    FROM (SELECT role_id FROM _role_root GROUP BY role_id HAVING count(*) <> 1) x;
  IF v_multi_root > 0 THEN
    RAISE EXCEPTION 'ow_roles の祖先が一意に決まらない職種が % 件ある（循環の疑い）。中止', v_multi_root;
  END IF;

  SELECT count(*) INTO v_missing_before
    FROM ow_jobs j WHERE NOT EXISTS (SELECT 1 FROM ow_job_roles jr WHERE jr.job_id = j.id);

  SELECT count(*) INTO v_mismatch_before
    FROM ow_jobs j
    JOIN ow_job_roles jr ON jr.job_id = j.id
    JOIN _role_root a ON a.role_id = jr.role_id
    JOIN _role_root b ON b.role_id = j.role_category_id
    WHERE a.top_id <> b.top_id;

  RAISE NOTICE '適用前: 求人 % 件 / ow_job_roles 欠落 % 件 / 大分類の不一致 % 件',
    (SELECT count(*) FROM ow_jobs), v_missing_before, v_mismatch_before;

  -- 実測値（2026-08-03）と一致しない場合は状況が変わっているので止める
  IF v_missing_before <> 7 OR v_mismatch_before <> 5 THEN
    RAISE EXCEPTION '想定と異なる（欠落 % 件・不一致 % 件、想定は 7 と 5）。データが変わっているため中止',
      v_missing_before, v_mismatch_before;
  END IF;

  -- ── ① 大分類が矛盾している行を削除する ──────────────────────────────────
  --    対象5件はいずれもプリセールス系。「エンジニア」紐づけを外し、
  --    ②で role_category_id の具体職種（営業配下）を入れ直す。
  DELETE FROM ow_job_roles jr
   USING ow_jobs j, _role_root a, _role_root b
   WHERE jr.job_id = j.id
     AND a.role_id = jr.role_id
     AND b.role_id = j.role_category_id
     AND a.top_id <> b.top_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- ── ② 欠落分（7件）と①で空になった分（5件）を role_category_id から補完 ──
  INSERT INTO ow_job_roles (job_id, role_id, is_primary)
  SELECT j.id, j.role_category_id, true
    FROM ow_jobs j
   WHERE NOT EXISTS (SELECT 1 FROM ow_job_roles jr WHERE jr.job_id = j.id)
  ON CONFLICT (job_id, role_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- ── 事後チェック ────────────────────────────────────────────────────────
  SELECT count(*) INTO v_missing_after
    FROM ow_jobs j WHERE NOT EXISTS (SELECT 1 FROM ow_job_roles jr WHERE jr.job_id = j.id);
  IF v_missing_after > 0 THEN
    RAISE EXCEPTION '適用後も ow_job_roles が無い求人が % 件ある。ロールバック', v_missing_after;
  END IF;

  SELECT count(*) INTO v_mismatch_after
    FROM ow_jobs j
    JOIN ow_job_roles jr ON jr.job_id = j.id
    JOIN _role_root a ON a.role_id = jr.role_id
    JOIN _role_root b ON b.role_id = j.role_category_id
    WHERE a.top_id <> b.top_id;
  IF v_mismatch_after > 0 THEN
    RAISE EXCEPTION '適用後も大分類の不一致が % 件ある。ロールバック', v_mismatch_after;
  END IF;

  -- primary が1つも無い求人が生まれていないこと
  IF EXISTS (
    SELECT 1 FROM ow_jobs j
     WHERE NOT EXISTS (SELECT 1 FROM ow_job_roles jr WHERE jr.job_id = j.id AND jr.is_primary)
  ) THEN
    RAISE EXCEPTION 'is_primary が無い求人が生まれた。ロールバック';
  END IF;

  RAISE NOTICE '完了: 不一致行を % 件削除 / % 件を role_category_id から補完', v_deleted, v_inserted;
END $$;

COMMIT;
