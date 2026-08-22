-- ============================================================================
-- Storage バケット candidate-documents を削除したことの記録と検算
--
-- 2026-08-23。旧ATSの44表を落とした（20260823060000）あと、
-- **参照元が消えて宙に浮いていたバケット**を削除した。
--
-- ⚠️ **削除そのものは migration では行えない。** バケットの削除は
--    `storage.buckets` の行を消すだけでは足りず（実体のファイルが
--    ストレージ側に残る）、Storage API の `remove()` → `deleteBucket()` を
--    通す必要がある。**そのため API 経由で実行し、ここには記録と検算だけを置く。**
--    CLAUDE.md「SQL Editor での手動適用を禁止する」の趣旨（記録を残す）は
--    このファイルで満たす。
--
-- ── 何を消したか ────────────────────────────────────────────────────────
--   バケット: candidate-documents（非公開）
--   ファイル: 2件 / 計 1,994,215 バイト（スクリーンショット画像。履歴書ではない）
--   参照元  : `candidate_documents` 表 → 20260823060000 で DROP 済み
--
-- ── 保全 ────────────────────────────────────────────────────────────────
--   .dumps/storage-candidate-documents/
--     ・実ファイル2件（PNG形式とバイト数の一致を確認済み）
--     ・manifest.json … 元のバケットとパスを記録（復元時にパスを再現できる）
--   ⚠️ `.gitignore` 済み。**コミットしない。**
--
-- ── 削除前後の実測 ──────────────────────────────────────────────────────
--   candidate-documents  2件 / 1,994,215 バイト  →  バケットごと削除
--   ow-uploads         103件 / 17,102,452 バイト →  **変化なし**（実ファイル取得も200で確認）
--   documents            0件                     →  変化なし
-- ============================================================================

DO $$
DECLARE
  v_bucket int;
  v_obj    int;
  v_up     int;
BEGIN
  SELECT count(*) INTO v_bucket FROM storage.buckets WHERE id = 'candidate-documents';
  SELECT count(*) INTO v_obj    FROM storage.objects WHERE bucket_id = 'candidate-documents';

  IF v_bucket <> 0 THEN
    RAISE EXCEPTION 'candidate-documents バケットがまだ存在する。Storage API で削除すること';
  END IF;
  IF v_obj <> 0 THEN
    RAISE EXCEPTION 'candidate-documents のオブジェクトが%件残っている', v_obj;
  END IF;

  /* ⚠️ 巻き添えが無いことを数える。ow-uploads はアバター・企業ロゴ・
        投稿画像の実体で、**消えると画面から画像が消える。** */
  SELECT count(*) INTO v_up FROM storage.objects WHERE bucket_id = 'ow-uploads';
  IF v_up <> 103 THEN
    RAISE EXCEPTION 'ow-uploads のオブジェクト数が103ではない（%件）。巻き添えの疑い', v_up;
  END IF;

  RAISE NOTICE 'candidate-documents: バケット0/オブジェクト0 / ow-uploads: %件（無傷）', v_up;
END $$;
