-- ============================================================================
-- ★Storage の「誰でも読み書きできる」ポリシー8本を落とす（2026-10-09 / 柴さんの承認済み）
-- ============================================================================
-- ⚠️ supabase/pending/ に書いたもの。適用時に supabase/migrations/ へ移す。
--
-- 何が問題だったか（2026-10-09 実測）:
--   ダッシュボードで作られた「Give users authenticated access to folder …」が
--   `documents`（非公開バケット）と `candidate-documents`（2026-08-23 にバケットごと削除済み）
--   に4本ずつ残っていた。条件は「bucket が一致 ∧ 先頭フォルダが private ∧ ログイン済み」だけで、
--   **ログインしていれば誰でも `documents/private/` 配下を読み書き・一覧・削除できた。**
--   実測: is_test の一般ユーザー（求職者）で 書き込み/読み出し/一覧/削除 がすべて通った。
--   ⚠️ `documents` は 0件で、`src` から参照するコードも0件（陽性対照: `ow-uploads` は13件当たる）。
--
-- 保全: .dumps/20261009-storage-policies-documents.sql（8本の CREATE POLICY を原文で）
--
-- ⚠️ バケット `documents` 自体の削除は SQL ではできない（storage.buckets に保護トリガー
--    `protect_buckets_delete` がある）。**Storage API（サービスロール）で消す**
--    （`candidate-documents` を消した 20260823070000 と同じ手順）。
-- ⚠️ 前例: 20260815150000 が migration から storage.objects のポリシーを DROP / CREATE している。
-- ============================================================================

begin;

do $$
declare n int;
begin
  select count(*) into n from storage.objects where bucket_id in ('documents', 'candidate-documents');
  if n <> 0 then raise exception '中止: documents / candidate-documents に %件のオブジェクトがある（0件のはず）', n; end if;

  select count(*) into n from pg_policy
   where polrelid = 'storage.objects'::regclass
     and polname like 'Give users authenticated access to folder %';
  if n <> 8 then raise exception '中止: 対象のポリシーが %本（8本のはず）', n; end if;
end $$;

drop policy "Give users authenticated access to folder 19b0df2_0" on storage.objects;
drop policy "Give users authenticated access to folder 19b0df2_1" on storage.objects;
drop policy "Give users authenticated access to folder 19b0df2_2" on storage.objects;
drop policy "Give users authenticated access to folder 19b0df2_3" on storage.objects;
drop policy "Give users authenticated access to folder flreew_0" on storage.objects;
drop policy "Give users authenticated access to folder flreew_1" on storage.objects;
drop policy "Give users authenticated access to folder flreew_2" on storage.objects;
drop policy "Give users authenticated access to folder flreew_3" on storage.objects;

-- 検算: 対象が0本 ／ ow-uploads のポリシー（残すもの）は4本のまま
do $$
declare n int;
begin
  select count(*) into n from pg_policy
   where polrelid = 'storage.objects'::regclass
     and polname like 'Give users authenticated access to folder %';
  if n <> 0 then raise exception '検算失敗: 対象のポリシーが %本残っている', n; end if;

  select count(*) into n from pg_policy
   where polrelid = 'storage.objects'::regclass and polname like 'ow_uploads_%';
  if n <> 4 then raise exception '検算失敗: ow-uploads のポリシーが %本（4本のはず）', n; end if;
end $$;

commit;
