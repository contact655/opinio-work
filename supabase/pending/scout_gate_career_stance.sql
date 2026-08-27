-- ═══════════════════════════════════════════════════════════════════════════
-- ★★適用日: **2026-09-01**（利用規約 第8条の改定日）。それより前に当てないこと。
--
--   このファイルが `supabase/pending/` にあるのは、**日が来ていないから**。
--   ⚠️ `supabase/migrations/` に置かないこと。`db push` は保留分を全部当てるので、
--      別の人が自分の migration を出した瞬間に一緒に出ていく。
--      **2026-08-26 に実際にそれで踏んだ**（20260827090000 → 20260827140000 で打ち消し）。
--
-- ── 何をするか ──────────────────────────────────────────────────────────────
-- `can_send_scout` の条件1を **`scout_enabled` → `career_stance`** に付け替える。
--
--   いま（打ち消し後）: coalesce((select scout_enabled from ow_profiles …), false)
--   これ以降          : career_stance is not null and career_stance <> 'no_contact'
--
-- ⚠️ 条件2〜4（現在の在籍・手動ブロック・転職勧奨の禁止期間）は**触らない。**
--
-- ── なぜ 9/1 まで待つのか ───────────────────────────────────────────────────
-- **既定の意味が逆になるから。**
--   規約 第8条第1項: 「登録時の初期設定において**「受け取る」**となります」
--   付け替え後     : **未設定（＝答えていない人）には届かない**
-- 規約が「受け取る」と書いているあいだにこれを当てると、
-- **規約より製品のほうが厳しい**状態になる。
--
-- ⚠️ ただし **2026-08-28 時点で、規約と製品は既に食い違っている**（下記）。
--    この migration を当てるかどうかとは別に、規約側の改定が要る。
--
-- ── ★9/1 にやること（この順で）──────────────────────────────────────────
--   1. 規約 第8条の改定が**公開されていること**を確認する
--      ⚠️ 第1項（初期設定は「受け取る」）と
--         第3項（設定は「声をかけられてもよいか」から）の**両方**が対象。
--         **第3項が名指ししている UI は 2026-08-27 に削除済み**で、
--         いまは「意思表示」の「転職について」に変わっている。
--   2. このファイルを `supabase/migrations/YYYYMMDDHHMMSS_scout_gate_career_stance.sql`
--      へ**移動**し、その日の日時で採番し直す
--   3. `npx supabase migration list` で**保留が自分のものだけ**か確認してから `db push`
--   4. 適用後、`can_send_scout` が `career_stance` を見ていることを実測する
--
-- ── 実測（2026-08-28・付け替えたときの影響）────────────────────────────────
--   送れる実ユーザー: **1人 → 2人**（減るのではなく入れ替わる）
--   `scout_enabled` は 16 true / 36 null、`career_stance` は 47 null / active 2 /
--   researching 2 / open 1 ——**未回答が多いので、答えた人だけが対象になる。**
--
-- ⚠️ **いまスカウト送信は止まっている**（`SCOUT_SENDING_ENABLED` 未設定）。
--    したがってこの関数の結果は誰にも届かない。
--    ★**9/1 より前に `SCOUT_SENDING_ENABLED` を有効にしないこと。**
--      有効にすると、規約より先に新しい挙動が動き出す。
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
  'スカウト送信可否。条件1は ow_profiles.career_stance（未設定と no_contact が止める）。2026-09-01 の利用規約 第8条の改定にあわせて scout_enabled から付け替えた。';
