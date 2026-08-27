-- ============================================================================
-- スカウトの送信可否を `ow_profiles.scout_enabled` から
-- **`ow_profiles.career_stance`** に付け替える   2026-08-27 / フェーズ3
--
-- ⚠️★**このファイルは、利用規約 第8条の改定日が決まるまで適用しないこと。**
--    適用した瞬間に「初期設定は『受け取る』」が事実でなくなる。
--    規約・LP の FAQ・登録画面の一文と**同時に**出す。
--
-- ── 何が変わるか ────────────────────────────────────────────────────────────
--   旧: coalesce(scout_enabled, false)                        … 既定 true（登録時に自動でオン）
--   新: career_stance is not null and career_stance <> 'no_contact'
--                                                             … **本人が答えるまで送れない**
--
-- ⚠️★**null（未設定）を「送れる」に読み替えない。** 本人が一度も選んでいない状態を
--    「受け取る」と解釈して企業に開示することになる。2026-08-04 に見送った
--    「null → true」と同じ形。**`coalesce(..., true)` を書かないこと。**
--
-- ⚠️ 止めるのは `'no_contact'`（いまは声をかけられたくない）**だけ**。
--    `researching`（情報収集として）でも声はかかる。「転職を考えていない人には
--    送らない」ではなく「**連絡を望まない人には送らない**」が軸。
--
-- ── 切り替えの影響（2026-08-26 実測 / 本番データ・読み取りのみで突き合わせ）──────
--   掲載中企業 × 候補者のペアで、送信可能になる人（実ユーザー）:
--     大塚悠貴  送れない → **送れる**（scout_enabled が null のまま `active` と答えていた）
--     福永陽貴  送れない → **送れる**（同上）
--     柴 久人   送れる  → **送れない**（scout_enabled=true だが career_stance 未設定）
--   実ユーザーで送れる人数: **1人 → 2人**（ペア 79 → 157）
--   テストユーザー: 15人 → 0人（全員 未設定）
--
-- ⚠️ **減るのではなく入れ替わる。** 旧方式は「登録しただけでオン」なので、
--    **本人が『積極的に検討中』と答えているのに届かない**人が2人いた。
--
-- ⚠️ `scout_enabled` は **DROP しない**。読み手を外すだけ（列とデータは残す）。
--    2026-08-04 以降の登録者に自動で付いた true を「本人の意思」として
--    引き継がないための境界線であり、消すと経緯が追えなくなる。
--
-- ⚠️ 呼び出し元は2つ。**どちらもこの関数を通るので、ここだけ直せば揃う。**
--    ① `guard_scout_insert`（`ow_scouts` の BEFORE INSERT トリガー）
--    ② `/biz/candidates` の RPC（送信可否の表示）
-- ============================================================================

create or replace function public.can_send_scout(p_company_id uuid, p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    -- 1. ★本人が「連絡を望まない」と言っていない。**未設定（null）は送れない。**
    --    ⚠️ ow_profiles.user_id は auth 空間。p_candidate_id と同じ空間。
    --    ⚠️ 行が無い人も送れない（サブクエリが null → false）。
    coalesce(
      (select career_stance is not null and career_stance <> 'no_contact'
         from ow_profiles where user_id = p_candidate_id),
      false
    )

    -- 2. ★**現在**その企業に在籍していない（前職は除外しない＝出戻りには送れる）
    --    ⚠️ `ow_experiences.user_id` は **ow_users 空間**。p_candidate_id（auth 空間）
    --       と直接比べてはいけない。**必ず ow_users を join して auth_id で引く。**
    and not exists (
      select 1
      from ow_experiences e
      join ow_users u on u.id = e.user_id
      where u.auth_id = p_candidate_id
        and e.is_current
        and e.company_id = p_company_id
    )

    --    company_id が NULL で、会社名の自由入力のみの場合
    --    正規化した名前で突き合わせる（こちらも現職だけ）
    and not exists (
      select 1
      from ow_experiences e
      join ow_users u on u.id = e.user_id
      join ow_companies c on c.id = p_company_id
      where u.auth_id = p_candidate_id
        and e.is_current
        and e.company_id is null
        and e.company_text is not null
        and normalize_company_name(e.company_text) = normalize_company_name(c.name)
    )

    -- 3. 手動ブロックされていない（ow_scout_blocks.candidate_id は auth 空間）
    and not exists (
      select 1 from ow_scout_blocks
      where candidate_id = p_candidate_id
        and company_id = p_company_id
    )

    -- 4. 転職勧奨の禁止期間中でない（ow_placements.candidate_id は auth 空間）
    and not is_solicitation_blocked(p_candidate_id);
$function$;

comment on column public.ow_profiles.scout_enabled is
  '⚠️ 2026-08-27 に**読み手を外した**。スカウトの送信可否は career_stance が決める
   （can_send_scout / 画面のどちらからも参照していない）。
   DROP していないのは、2026-08-04 以降の登録者に既定値 true が自動で付いており、
   それを「本人の意思」として引き継がないと決めた経緯を残すため。
   ⚠️ 新しい参照を足さないこと。';
