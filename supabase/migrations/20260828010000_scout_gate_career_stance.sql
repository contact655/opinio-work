-- ═══════════════════════════════════════════════════════════════════════════
-- can_send_scout の条件1を `scout_enabled` → `career_stance` に付け替える
-- 適用日: **2026-08-28**
--
--   いま : coalesce((select scout_enabled from ow_profiles …), false)
--   以降 : career_stance is not null and career_stance <> 'no_contact'
--
-- ⚠️ 条件2・2b・3・4（現在の在籍・自由入力の社名・手動ブロック・転職勧奨の
--    禁止期間）は**触らない。**
--
-- ── ★なぜ規約改定（9/27）を待たずに当てるのか ──────────────────────────────
-- **これはバグ修正だから。** 当初は利用規約 第8条の改定日に合わせる予定だったが、
-- 2026-08-28 に前提が2つ変わった。
--
-- ① **アプリ側だけが先に移行しており、2層が食い違っている。**
--    `/biz/candidates` は 2026-08-27 に母集合を `career_stance` へ付け替えた
--    （`biz/candidates/page.tsx`）。一方この関数は `scout_enabled` のまま。
--    両者は **AND** で重なるので、実際に企業に見えるのは積集合になる。
--    実測（2026-08-28 / is_test とシステムを除く実ユーザー）:
--
--      アプリ条件（career_stance）を通る : 2人
--      DB 条件（scout_enabled = true）  : 1人
--      ★実際に企業へ見えている（AND）    : **0人**
--      ★この migration の適用後          : **2人**
--
--    ⚠️ **画面には「0件」としか出ない。** 壊れていることに気づけない形
--       （CLAUDE.md「起きなかった0か、起こせなかった0かを分ける」）。
--    ⚠️ `biz/candidates/page.tsx` のコメントは「`can_send_scout()` と**同じ条件**に
--       してある。片方だけ変えないこと」と書いているが、**実際には片方だけ
--       変わっていた。** この migration で初めて宣言どおりになる。
--
-- ② **当てても現行規約が許す範囲を超えない。**
--    現行 第8条第1項は「登録時の初期設定において**「受け取る」**となります」＝
--    全員が対象。付け替え後の条件は「**答えた人だけ**（`no_contact` を除く）」で、
--    **依然として規約より製品のほうが厳しい。** 新たに誰かを規約の想定より
--    広く開示することにはならない。
--    ⚠️ 新たに見えるようになる2人は、どちらも意思表示で
--       **`active`（積極的に検討中）を自ら選んだ人**（2026-08-28 実測）。
--    ⚠️ 一覧に出ること自体は 第7条3項（初期値＝ログインユーザーのみ）の範囲内。
--
-- ── ★規約側は別途 2026-09-27 に改定する ────────────────────────────────────
-- **9/1 にはできない。** 第24条2項が「効力発生日の**30日前まで**に周知」と
-- 定めており、**例外規定が無い**（1項1号「利用者の一般の利益に適合する」は
-- *変更できる要件*であって、周知期間の免除ではない）。
-- 8/28 に周知 → **効力発生日は 2026-09-27**。
--   対象は 第8条 第1項（初期設定は「受け取る」＝実装と逆）と
--          第3項（「声をかけられてもよいか」＝2026-08-27 に削除済みの画面名）。
--   ⚠️ 第24条2項は**掲示に加えて「登録メールアドレスへの通知」も要求**している。
--      掲示だけでは足りない。
--
-- ── ★スカウト送信は引き続き止めたまま ──────────────────────────────────────
-- `SCOUT_SENDING_ENABLED` は未設定のままにする。この関数の結果は
-- `/biz/candidates` の一覧にしか効かず、**送信は別のフラグで止まっている。**
-- ⚠️ **規約の改定が効力を生じる 2026-09-27 より前に有効化しないこと。**
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   適用前の定義: .dumps/20260828-can_send_scout-before.sql（そのまま流せる）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.can_send_scout(p_company_id uuid, p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    -- ★条件1: ここだけが変更点。未設定と no_contact の2つが止める
    coalesce(
      (select career_stance is not null and career_stance <> 'no_contact'
         from ow_profiles where user_id = p_candidate_id),
      false
    )
    -- 条件2: 現在の在籍企業からは送れない（company_id で一致）
    and not exists (
      select 1
      from ow_experiences e
      join ow_users u on u.id = e.user_id
      where u.auth_id = p_candidate_id
        and e.is_current
        and e.company_id = p_company_id
    )
    -- 条件2b: 自由入力の社名でも一致させる
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
  'スカウト送信可否。条件1は ow_profiles.career_stance（未設定と no_contact が止める）。2026-08-28 に scout_enabled から付け替えた（/biz/candidates のアプリ側は 2026-08-27 に移行済みで、2層が食い違い候補者一覧が0人になっていたため）。利用規約 第8条の改定は 2026-09-27 に別途行う。';
