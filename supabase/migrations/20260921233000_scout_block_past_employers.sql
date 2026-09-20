-- ═══════════════════════════════════════════════════════════════════════════
-- E-3: 過去の勤務先からもスカウトを止める（2026-09-21）
--
-- 調査は [docs/e3-past-employer-20260921.md](../../docs/e3-past-employer-20260921.md)。
--
-- ── ★何が食い違っていたか ──────────────────────────────────────────────────
-- 規約は**3箇所**で「現在の勤務先および**過去の勤務先のすべて**」を
-- スカウトの対象から除外すると書いている:
--   ① 求職者利用規約 第8条第4項（公開中）
--   ② プライバシーポリシー 5-4（公開中）
--   ③ legal-recruitment-info.md 5-3（未公開の下書き）
-- ⚠️★**2026-09-27 の改定でも第8条第4項は変わらない**（改定予告に
--    「第4項から第7項…に変更はありません」と明記）。**待っても解消しない。**
--
-- 実装は `can_send_scout()` の条件2・2b がどちらも `e.is_current` で、
-- **過去の勤務先は素通り**していた。→ `is_current` を外す。
--
-- ── ⚠️★実データへの影響は 0 件（それでも直す理由）────────────────────────
-- 実測（2026-09-21）: 過去の勤務先のペアは**すべて他の条件で既に止まっていた**
--   現職でもある（条件2が正しく止める）… 1件
--   career_stance が null / no_contact（条件1）… 5件
-- ⚠️★**つまり条件1に助けられていただけで、コードは規約と食い違っていた。**
--    `career_stance` を答えた人が過去の勤務先を登録した瞬間に漏れる。
-- ⚠️ 検証用アカウントには**まさにその形が2件**あり、この migration の前後で
--    `true → false` に変わることを確認した（下の「実測」）。
--
-- ── ⚠️★`DROP FUNCTION` を使わない ─────────────────────────────────────────
-- `guard_scout_insert`（`ow_scouts` の INSERT トリガー）がこの関数を呼んでいる。
-- **常に `CREATE OR REPLACE`。**
--
-- ⚠️ 参照は2箇所だけ（2026-09-21 実測）:
--    ① `/biz/candidates`（候補者一覧。★スカウトの3ゲートを通らないので、
--       **一覧はフラグが off でも描かれる**）
--    ② `guard_scout_insert`（送信を DB で止める）
--    ポリシーからの参照は0件。
--
-- ⚠️★**条件1（`career_stance`）は触っていない。** ここで変えるのは条件2・2b だけ。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

create or replace function public.can_send_scout(p_company_id uuid, p_candidate_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    -- 条件1: 未設定と no_contact の2つが止める（★ここは変更していない）
    coalesce(
      (select career_stance is not null and career_stance <> 'no_contact'
         from ow_profiles where user_id = p_candidate_id),
      false
    )
    -- ★条件2: 在籍したことのある企業からは送れない（company_id で一致）
    --   ⚠️★2026-09-21 に `e.is_current` を外した。規約は「現在の勤務先および
    --      過去の勤務先のすべて」と書いており、現職だけでは足りない。
    --   ⚠️★**戻さないこと。** 戻すと公開中の規約2箇所と食い違う。
    and not exists (
      select 1
      from ow_experiences e
      join ow_users u on u.id = e.user_id
      where u.auth_id = p_candidate_id
        and e.company_id = p_company_id
    )
    -- ★条件2b: 自由入力の社名でも一致させる（同じく `is_current` を外した）
    --   ⚠️ 表記ゆれは `normalize_company_name` で吸収する。
    and not exists (
      select 1
      from ow_experiences e
      join ow_users u on u.id = e.user_id
      join ow_companies c on c.id = p_company_id
      where u.auth_id = p_candidate_id
        and e.company_id is null
        and e.company_text is not null
        and normalize_company_name(e.company_text) = normalize_company_name(c.name)
    )
    -- 条件3: 手動ブロック
    and not exists (
      select 1 from ow_scout_blocks
      where candidate_id = p_candidate_id
        and company_id = p_company_id
    )
    -- 条件4: 転職勧奨の禁止期間（許可条件）
    and not is_solicitation_blocked(p_candidate_id);
$function$;

comment on function public.can_send_scout(uuid, uuid) is
  'スカウトを送ってよいか。条件1 career_stance / 条件2・2b 在籍したことのある企業（★2026-09-21 に is_current を外し、過去の勤務先も止めるようにした。規約 第8条第4項・プライバシーポリシー 5-4 と合わせるため。戻さないこと）/ 条件3 手動ブロック / 条件4 勧奨禁止期間。⚠ 参照は /biz/candidates と guard_scout_insert の2箇所。';

-- ── 適用後のアサート ───────────────────────────────────────────────────────

DO $$
DECLARE v_def text;
BEGIN
  /* ⚠️★**行コメントを落としてから照合する。** 落とさないと、この migration 自身が
        本文に書いた注意書き（「`e.is_current` を外した」）に当たって**必ず落ちる。**
        CLAUDE.md に記録のある罠（`20260804143145` が一度これで転けている）で、
        ★**2026-09-21 にこの migration も1回踏んだ。** */
  v_def := regexp_replace(
    pg_get_functiondef('public.can_send_scout(uuid,uuid)'::regprocedure),
    '--[^' || chr(10) || ']*', '', 'g');

  /* ★`is_current` が1つも残っていないこと（条件2・2b の両方から外れたか） */
  IF position('is_current' in v_def) > 0 THEN
    RAISE EXCEPTION 'can_send_scout に is_current が残っている';
  END IF;

  /* ★他の条件を落としていないこと */
  IF position('career_stance' in v_def) = 0
     OR position('normalize_company_name' in v_def) = 0
     OR position('ow_scout_blocks' in v_def) = 0
     OR position('is_solicitation_blocked' in v_def) = 0 THEN
    RAISE EXCEPTION '書き換えで他の条件が落ちている: %', v_def;
  END IF;

  /* ★トリガーが生きていること（DROP していないので消えないはずだが、確かめる） */
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname = 'ow_scouts' AND NOT t.tgisinternal
       AND pg_get_triggerdef(t.oid) ~ 'guard_scout_insert'
  ) THEN
    RAISE EXCEPTION 'ow_scouts の guard_scout_insert トリガーが見つからない';
  END IF;
END $$;

COMMIT;
