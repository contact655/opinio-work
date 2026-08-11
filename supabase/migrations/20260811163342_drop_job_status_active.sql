-- ow_jobs.status から 'active' を外す（6値 → 5値）
--
-- ── なぜ消せるか（2026-08-11 調査）────────────────────────────────────────────
--   ① 実データ 0件
--   ② `ow_jobs.status = 'active'` を**書き込むコードが src に存在しない**
--      （`status: "active"` の3箇所はすべて ow_conversations / ow_tenant_plans）
--      `SETTABLE_JOB_STATUSES` も元から active を除いていた
--   ③ published との違いを説明した記述がどこにも無い。見つかったのは全部
--      「published と同じ」と言っている記述だった:
--        archive/113        … 「旧来の "active" と新しい "published" の不整合を解消」
--        admin/jobs         … 「"published" 相当として扱う（113 適用前の互換）」
--        StatusPill         … 「公開中（旧値）— alias for published」
--
-- ⚠️ **CHECK・読み取り側・表示側を同時に変える**こと（CLAUDE.md「3つ揃える」）。
--    コード側は同じコミットで直してある:
--      ・`.in(["published","active"])` 16箇所 → `.eq("status","published")`
--      ・`normalizedStatus()` の active → published 変換を削除
--      ・JobStatus 型 / StatusPill / JobStatusBadge / JobListCard から active を削除
--    CHECK だけ先に外すと、まだ active を読むコードが空振りする。
--    コードだけ先に直すと、CHECK に残った active を入れられた瞬間に画面から消える。
--
-- ⚠️ 残す5値と、それぞれ現に使われている場所:
--      published      … 公開中
--      draft          … 下書き
--      pending_review … 企業が申請 → 運営が審査（/admin/jobs の「審査待ち」タブ）
--      rejected       … 差し戻し（rejection_reason とセット）
--      private        … 運営が公開を止める（privateJob()）
--
-- ⚠️ `closed` / `expired` は**あえて入れない**。表示側が知らないので、
--    入れると「DB には入るが画面で draft に化ける」状態を作る。
--
-- ⚠️ NULL の許容は今回変えない（実データ0件だが、表示側が NULL → draft に寄せている）。

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_active int;
  v_other  text;
BEGIN
  SELECT count(*) INTO v_active FROM ow_jobs WHERE status = 'active';
  IF v_active <> 0 THEN
    RAISE EXCEPTION 'status = active の行が % 件ある。消す前に扱いを決めること', v_active;
  END IF;

  -- 新しい CHECK に通らない値が他に無いこと
  SELECT string_agg(DISTINCT status, ', ') INTO v_other
    FROM ow_jobs
    WHERE status IS NOT NULL
      AND status NOT IN ('draft', 'pending_review', 'published', 'rejected', 'private');
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION '新しい CHECK に通らない値がある: %', v_other;
  END IF;
END $$;

-- ── 本処理 ──────────────────────────────────────────────────────────────────
ALTER TABLE ow_jobs DROP CONSTRAINT IF EXISTS ow_jobs_status_check;

ALTER TABLE ow_jobs ADD CONSTRAINT ow_jobs_status_check
  CHECK (status IS NULL OR status IN (
    'draft', 'pending_review', 'published', 'rejected', 'private'
  ));

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
  v_ok  boolean;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.ow_jobs'::regclass AND conname = 'ow_jobs_status_check';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'CHECK が存在しない';
  END IF;
  IF position('active' in v_def) > 0 THEN
    RAISE EXCEPTION 'CHECK にまだ active が残っている: %', v_def;
  END IF;

  -- 残す5値がすべて通ること
  FOR v_ok IN
    SELECT s IN ('draft', 'pending_review', 'published', 'rejected', 'private')
    FROM unnest(ARRAY['draft','pending_review','published','rejected','private']) s
  LOOP
    IF NOT v_ok THEN RAISE EXCEPTION '残す5値の検査に失敗'; END IF;
  END LOOP;

  RAISE NOTICE 'ow_jobs.status から active を削除。残りは5値。';
END $$;

COMMIT;

-- ⚠️ 実際に active を弾くかは、この migration の外で確かめる（トランザクション内で
--    INSERT して ROLLBACK すると、db push の1トランザクション全体を壊すため）。
