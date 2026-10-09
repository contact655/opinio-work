-- ════════════════════════════════════════════════════════════════════════
-- 候補者検索と提案の「この企業にこの候補者を見せてよいか」を締める（2026-10-09）
-- ════════════════════════════════════════════════════════════════════════
--
-- 対象は public.can_send_scout(p_company_id uuid, p_candidate_id uuid) の1本だけ。
-- ⚠️★名前に反して中身は「見せてよいか」の判定で、**候補者検索（/biz/candidates）と
--    提案（lib/evidence/generate.ts）の両方がこの関数を通る。** 条件を TS に書き写さない。
-- ⚠️ p_candidate_id は **auth 空間**（auth.users.id）。引数名は既存のまま変えていない
--    （変えると PostgREST の呼び出し契約が変わり、デプロイの窓ができる）。
--
-- 差し替え前の定義は `.dumps/20261009-can_send_scout-before.sql` に保全した
-- （.gitignore 済み）。戻すときは同ファイルを CREATE OR REPLACE で当てる。
-- ⚠️★DROP FUNCTION を使わないこと。CREATE OR REPLACE なら EXECUTE の権限が保たれる。
--
-- ── 足した条件（柴さんの決定 2026-10-09）────────────────────────────────
--   (1) 見る企業の**有効な管理者本人**は出さない
--       （実測: 職歴を登録していない管理者が自社の候補者検索に出ていた）
--   (2) 見る企業と候補者の **is_test が一致するときだけ**出す
--       ・検証用の企業からは実在の利用者を出さない（実測: 4社から22人が実名で見えていた）
--       ・実在の企業からは検証用アカウントを出さない（提案ではラベル付きで出ていた）
--   (3) 自由入力の勤務先の照合先に **name_en と search_aliases** を加える
--   (4) **同じ親会社を持つ会社（グループ会社）**を、見る企業と同じ扱いにする
--       在籍歴（現職・過去）がグループのどこかにあれば出さない
--
-- ── グループの判定（★照合の仕方）──────────────────────────────────────
--   `parent_company_name` を **normalize_company_name で正規化して一致**させる。
--   次の3つのどれかに当たる会社を「見る企業のグループ」とする:
--     ① 見る企業そのもの
--     ② 親会社名（正規化）が見る企業と同じ会社       … 兄弟（例: セールスフォース・ジャパン と Slack Japan）
--     ③ 見る企業の名前・英語名が、相手の親会社名と一致 … 子
--     ④ 見る企業の親会社名が、相手の名前・英語名と一致 … 親
--   ⚠️ 親会社の id を持たせる案は採らなかった。親会社の大半（Salesforce, Inc. 等）は
--      ow_companies に行が無く、id を持たせるには親会社のマスタを別に作ることになる。
--      実測（2026-10-09）: 親会社名は56通りで、同じ親会社が2通りに書かれている例は0件。
--   ⚠️ 正規化は「Inc. / Corporation / Ltd. 等」と記号・空白を落とすが、
--      「SE」「N.V.」「Limited」は落とさない。**いまは各親会社が1通りで書かれているので
--      漏れは無い**が、同じ親会社を別表記で入れると兄弟として認識されない。
--
-- ── 自由入力の照合 ──────────────────────────────────────────────────────
--   本人の職歴の自由入力（company_text）を正規化し、**グループ内の各社の**
--   name / name_en / search_aliases（空白区切りの各語）/ parent_company_name の
--   正規化と比べる。⚠️ 親会社名も照合先に含める（「Salesforce」とだけ書いた人を、
--   セールスフォース・ジャパンから除くため）。
--   ⚠️ 照合は**完全一致**（正規化後）。部分一致にしない（「タイセイ」などの短い別名で
--      無関係な会社まで除くことになる）。外れたときは**出さない側**に倒れる。
--
-- ── 変えていないもの ────────────────────────────────────────────────────
--   転職意欲（未設定と no_contact は出さない）／手動ブロック／転職勧奨の禁止期間。
--   出向先（secondment_company_*）は今回の判定に入れていない（残りに記録）。
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.can_send_scout(p_company_id uuid, p_candidate_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with viewer as (
    select c.id,
           c.is_test,
           normalize_company_name(c.name)                as name_norm,
           normalize_company_name(c.name_en)             as en_norm,
           normalize_company_name(c.parent_company_name) as parent_norm
      from ow_companies c
     where c.id = p_company_id
  ),
  cand as (
    -- ⚠️ ow_experiences.user_id / ow_company_admins.user_id は ow_users 空間
    select u.id, u.is_test from ow_users u where u.auth_id = p_candidate_id
  ),
  -- ★見る企業のグループ（冒頭の①〜④）
  grp as (
    select c.id, c.name, c.name_en, c.search_aliases, c.parent_company_name
      from ow_companies c, viewer v
     where c.id = v.id
        or (v.parent_norm is not null
            and normalize_company_name(c.parent_company_name) = v.parent_norm)
        or normalize_company_name(c.parent_company_name) in (v.name_norm, v.en_norm)
        or (v.parent_norm is not null
            and v.parent_norm in (normalize_company_name(c.name), normalize_company_name(c.name_en)))
  ),
  -- ★自由入力と突き合わせる名前（正規化済み）
  grp_names as (
    select normalize_company_name(t.n) as nn
      from grp,
           lateral (
             select grp.name
             union all select grp.name_en
             union all select grp.parent_company_name
             union all select regexp_split_to_table(coalesce(grp.search_aliases, ''), '\s+')
           ) t(n)
  )
  select
    -- 前提: 見る企業と候補者が存在する
    exists (select 1 from viewer)
    and exists (select 1 from cand)
    -- ★(2) is_test が一致するときだけ
    and (select v.is_test from viewer v) = (select c.is_test from cand c)
    -- 条件1: 未設定と no_contact は出さない（変更なし）
    and coalesce(
      (select career_stance is not null and career_stance <> 'no_contact'
         from ow_profiles where user_id = p_candidate_id),
      false
    )
    -- ★条件2 ＋ (4): グループのどこかに在籍歴（現職・過去）がある人は出さない
    and not exists (
      select 1 from ow_experiences e, cand
       where e.user_id = cand.id
         and e.company_id in (select id from grp)
    )
    -- ★条件2b ＋ (3)(4): 自由入力の勤務先を、グループ各社の名前・英語名・別名・親会社名と照合
    and not exists (
      select 1 from ow_experiences e, cand
       where e.user_id = cand.id
         and e.company_id is null
         and e.company_text is not null
         and normalize_company_name(e.company_text) in (
               select nn from grp_names where nn is not null
             )
    )
    -- ★(1) 見る企業の有効な管理者本人は出さない（招待中の行は user_id が NULL なので当たらない）
    and not exists (
      select 1 from ow_company_admins a, cand
       where a.user_id = cand.id
         and a.company_id = p_company_id
         and a.is_active
    )
    -- 条件3: 手動ブロック（変更なし）
    and not exists (
      select 1 from ow_scout_blocks
       where candidate_id = p_candidate_id
         and company_id = p_company_id
    )
    -- 条件4: 転職勧奨の禁止期間（変更なし）
    and not is_solicitation_blocked(p_candidate_id);
$function$;

-- ── 適用後の検算（想定と違えば全体をロールバックする）──────────────────────
do $$
declare
  v_leak int;
  v_test_in_real int;
  v_admin_self int;
  v_control int;
begin
  -- (2) 検証用の企業から、実在の候補者が1人も見えない
  select count(*) into v_leak
    from ow_companies c
    join ow_users u on not u.is_test and u.auth_id is not null
   where c.is_test
     and public.can_send_scout(c.id, u.auth_id);
  if v_leak <> 0 then
    raise exception '検算失敗: 検証用の企業から実在の候補者が % 組見えている', v_leak;
  end if;

  -- (2) 実在の企業から、検証用アカウントが1人も見えない
  select count(*) into v_test_in_real
    from ow_companies c
    join ow_users u on u.is_test and u.auth_id is not null
   where not c.is_test
     and public.can_send_scout(c.id, u.auth_id);
  if v_test_in_real <> 0 then
    raise exception '検算失敗: 実在の企業から検証用アカウントが % 組見えている', v_test_in_real;
  end if;

  -- (1) 有効な管理者本人が、自社から見えない
  select count(*) into v_admin_self
    from ow_company_admins a
    join ow_users u on u.id = a.user_id
   where a.is_active
     and public.can_send_scout(a.company_id, u.auth_id);
  if v_admin_self <> 0 then
    raise exception '検算失敗: 管理者本人が自社から % 組見えている', v_admin_self;
  end if;

  -- ★陽性対照: 締めすぎていないこと。実在の企業から実在の候補者は見える
  select count(*) into v_control
    from ow_companies c
    join ow_users u on not u.is_test and u.auth_id is not null
   where c.id = 'cf44d740-b835-454d-91a3-f1e2eddc7251'  -- 株式会社Opinio
     and public.can_send_scout(c.id, u.auth_id);
  if v_control = 0 then
    raise exception '検算失敗（陽性対照）: 実在の企業から誰も見えない。締めすぎている';
  end if;

  -- 権限が保たれていること（CREATE OR REPLACE は EXECUTE を変えない）
  if not has_function_privilege('authenticated', 'public.can_send_scout(uuid, uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.can_send_scout(uuid, uuid)', 'EXECUTE') then
    raise exception '検算失敗: EXECUTE の権限が変わった';
  end if;

  raise notice '検算OK: 検証用→実在 % / 実在→検証用 % / 管理者本人 % / 陽性対照（Opinio から実在）%',
    v_leak, v_test_in_real, v_admin_self, v_control;
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════════
-- ★戻すときの定義（差し替え前。2026-10-09 に本番の pg_get_functiondef から取得）
--   ⚠️ 戻すときはコメントを外して CREATE OR REPLACE で当てる（DROP FUNCTION は使わない。
--      CREATE OR REPLACE なら EXECUTE の権限が保たれる）。
--   ⚠️ 戻すと 管理者本人／is_test の一致／英語名・別名／グループ会社 の4つがすべて外れる。
--      文言（IntentCard・StanceQuestion・mypage/settings・proposals）も同時に戻すこと。
-- ════════════════════════════════════════════════════════════════════════
-- CREATE OR REPLACE FUNCTION public.can_send_scout(p_company_id uuid, p_candidate_id uuid)
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
--   select
--     -- 条件1: 未設定と no_contact の2つが止める（★ここは変更していない）
--     coalesce(
--       (select career_stance is not null and career_stance <> 'no_contact'
--          from ow_profiles where user_id = p_candidate_id),
--       false
--     )
--     -- ★条件2: 在籍したことのある企業からは送れない（company_id で一致）
--     --   ⚠️★2026-09-21 に `e.is_current` を外した。規約は「現在の勤務先および
--     --      過去の勤務先のすべて」と書いており、現職だけでは足りない。
--     --   ⚠️★**戻さないこと。** 戻すと公開中の規約2箇所と食い違う。
--     and not exists (
--       select 1
--       from ow_experiences e
--       join ow_users u on u.id = e.user_id
--       where u.auth_id = p_candidate_id
--         and e.company_id = p_company_id
--     )
--     -- ★条件2b: 自由入力の社名でも一致させる（同じく `is_current` を外した）
--     --   ⚠️ 表記ゆれは `normalize_company_name` で吸収する。
--     and not exists (
--       select 1
--       from ow_experiences e
--       join ow_users u on u.id = e.user_id
--       join ow_companies c on c.id = p_company_id
--       where u.auth_id = p_candidate_id
--         and e.company_id is null
--         and e.company_text is not null
--         and normalize_company_name(e.company_text) = normalize_company_name(c.name)
--     )
--     -- 条件3: 手動ブロック
--     and not exists (
--       select 1 from ow_scout_blocks
--       where candidate_id = p_candidate_id
--         and company_id = p_company_id
--     )
--     -- 条件4: 転職勧奨の禁止期間（許可条件）
--     and not is_solicitation_blocked(p_candidate_id);
-- $function$;
