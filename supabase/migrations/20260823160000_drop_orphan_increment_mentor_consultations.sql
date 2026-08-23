-- 孤児のトリガー関数 increment_mentor_consultations を削除する（2026-08-23）
--
-- この関数は存在しない表 `mentors` を UPDATE しようとしており、
-- **もし実行されれば必ず 42P01（relation does not exist）で落ちる。**
-- メンター機能自体が無く（CLAUDE.md「メンター機能自体が無い」）、
-- `ow_mentors` は archive/132 で作られ 140 で DROP 済み。`mentors` に至っては
-- 一度も存在した形跡が無い。
--
-- ── 削除前の実測（2026-08-23 / 本番）──────────────────────────────────────
--   この関数を使うトリガー ………………… 0
--   本体からこの関数を呼ぶ他の関数 ……… 0
--   参照する RLS ポリシー ………………… 0
--   参照するビュー ………………………… 0
--   src からの参照 ………………………… 0（types.ts にも出てこない）
--   to_regclass('public.mentors') ……… NULL（表が存在しない）
--   to_regclass('public.ow_mentors') …… NULL
--
-- ⚠️ **「0件」は検出器を先に検証してから数えている**（CLAUDE.md ルール⑱）。
--    ・トリガー検出 … 同じクエリで update_updated_at(3) / guard_member_consent(1) /
--      guard_scout_insert(1) / handle_new_ow_user(1) / guard_job_status_transition(1)
--      を検出できることを確認した
--    ・関数本体の全文検索 … 同じ手法で auth_is_company_admin の呼び出し元
--      （ow_uploads_can_write）を検出できることを確認した
--    ⚠️ PL/pgSQL の本体は Postgres が依存として追跡しない。FK を見ても分からない。
--
-- ⚠️ **GRANT ALL が anon にも付いていた。** トリガー関数なので直接は呼べないが、
--    権限としては配られたままだった。DROP すれば ACL ごと消える。
--
-- ── 復旧用（この関数の定義。戻す必要が出たときのために残す）──────────────
--   CREATE OR REPLACE FUNCTION public.increment_mentor_consultations()
--    RETURNS trigger LANGUAGE plpgsql AS $function$
--   BEGIN
--     UPDATE mentors
--     SET total_consultations = total_consultations + 1
--     WHERE id = NEW.mentor_id;
--     RETURN NEW;
--   END;
--   $function$
--   ⚠️ 戻すとしても、そのままでは動かない（`mentors` 表が無い）。
--
-- ⚠️ CASCADE を付けない。依存が残っていたらエラーで止まるのが正しい。

drop function if exists public.increment_mentor_consultations();

-- 消えたことを同じ migration の中で確かめる（消えていなければここで止める）
do $$
begin
  if exists (
    select 1 from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname = 'increment_mentor_consultations'
  ) then
    raise exception 'increment_mentor_consultations がまだ存在する';
  end if;
end $$;
