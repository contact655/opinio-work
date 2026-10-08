-- ============================================================================
-- ★Storage バケットの入れ替えの記録と検算（2026-10-09）
-- ============================================================================
-- storage.buckets には保護トリガー（protect_bucket_control_* / protect_buckets_delete）があり、
-- バケットの作成・削除は SQL ではできない。**Storage API（サービスロール）で行った。**
-- この migration は**状態を検算するだけ**で、何も変更しない
-- （20260823070000_record_candidate_documents_bucket_removal.sql と同じ形）。
--
--   削除: documents（非公開・0件。「誰でも読み書きできる」ポリシーは 20261009010000 で落とした）
--   作成: company-documents（非公開・10MB・PDF / docx / pptx / txt / md）
--         パスは {company_id}/{document_id}/{ファイル名}。
--         ★クライアント向けのポリシーは0本。読み出しはサーバー側の短時間の署名 URL だけ。
--         ⚠️★**ポリシーを足さないこと。** 内部のみの資料を含む。
-- ============================================================================

do $$
declare n int;
begin
  select count(*) into n from storage.buckets where id = 'documents';
  if n <> 0 then raise exception 'documents バケットがまだある。Storage API で削除すること'; end if;

  select count(*) into n from storage.buckets where id = 'company-documents' and public = false;
  if n <> 1 then raise exception 'company-documents（非公開）が無い。Storage API で作ること'; end if;

  select count(*) into n from pg_policy
   where polrelid = 'storage.objects'::regclass
     and (coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), ''))
         ~ 'company-documents';
  if n <> 0 then raise exception 'company-documents を対象にしたポリシーが %本ある（0本のはず）', n; end if;
end $$;
