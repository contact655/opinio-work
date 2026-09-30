-- 田利 聖吾さんの「セールスフォース」を 株式会社セールスフォース・ジャパン に紐づける
--
-- 柴さんの指示（2026-10-01）。
--
-- ⚠️★**企業は新しく作られていない。** `ow_companies` に「セールスフォース」という行は無く、
--    `company_id` が NULL で **`company_text='セールスフォース'`（自由入力）**に落ちていた。
--    画面のロゴが「セ」の letter フォールバックだったのはそのため
--    （マスタに紐づいていれば Salesforce のロゴが出る）。
--    → **企業を消す作業ではない。職歴1行の紐づけ直し。**
--
-- ⚠️ 自由入力のままだと業界に結びつかず、`/mypage`「◯◯の経験が活きる会社」や
--    求人の経験者・企業ページの現役社員から外れる（`api/companies/lookup` の冒頭に理由）。
--
-- ── なぜ自由入力に落ちたか（実測 2026-10-01）───────────────────────────────
-- ピッカーの検索条件で「セールスフォース」を引くと**候補は1件だけ**出る
-- （株式会社セールスフォース・ジャパン）。**候補が無かったのではなく、選ばれなかった。**
-- ⚠️ 候補の主ラベルは `companyDisplayName` が `name_en` から作る**「Salesforce」**で、
--    打った文字（カタカナ）と字面が違う。CLAUDE.md
--    「社名を画面へ返す口では必ず `companyDisplayName` を通す」の**逆向きの副作用**。
--    ★**この migration では直せない。UI 側の検討は別途。**
--
-- ⚠️ `experience_company_xor` は3つのうち**ちょうど1つ**を要求するので、
--    `company_id` を入れるのと同時に `company_text` を NULL にする。
--
-- ⚠️★**同じ人の「株式会社キーエンス」は触らない。** キーエンスはマスタに無く
--    （検索しても0件）、紐づけ先が存在しない。**先に企業を追加するかどうかの判断が要る。**
--
-- ⚠️★`trg_update_company_member_counts` が `ow_companies.current_member_count` /
--    `obog_count` を**その場で数え直す**（+1 ではない）。しかもこの2列は
--    **`@deprecated` の非正規化カラムで、値が古いまま放置されている**
--    （実測 2026-10-01: 列は 6 なのに、実際に在籍中の職歴は 16 件）。
--    ⚠️★**この2列を直しにいかないこと。** 画面が読むのは `live_current_count` /
--       `live_obog_count`（その都度数える）で、古い値は表に出ていない。
--       唯一の参照は `lib/search/companies.ts` の `?? current_member_count` という
--       **フォールバックで、live 側が必ず来るので発火しない。**
--    ⚠️ したがって「+1 になるはず」と検算すると**必ず落ちる**（最初にそう書いて落とした）。
--       ここでは「トリガーが数え直した結果が、live で数えた値と一致するか」を見る。
--
-- ⚠️ 適用後に `rebuild_ow_transitions()` も流すこと（会社が変わるため）。

begin;

do $$
declare
  v_exp uuid := '968b89ab-46f7-4e78-a337-889b47f68480';
  v_sf  uuid := 'c3664ef1-5571-4645-b30f-1474e7961c17';
  n int; v_text text; v_cnt_after int; v_live int; v_real int;
begin
  -- ── 事前検算 ────────────────────────────────────────────────────────────
  select company_text into v_text from public.ow_experiences
   where id = v_exp and company_id is null and company_anonymized is null;
  if v_text is distinct from 'セールスフォース' then
    raise exception '対象の職歴が想定と違う（company_text = %）', coalesce(v_text,'(null)');
  end if;

  select count(*) into n from public.ow_companies
   where id = v_sf and name = '株式会社セールスフォース・ジャパン' and is_test = false;
  if n <> 1 then raise exception '紐づけ先の企業が見つからない'; end if;

  -- ⚠️ 同じ人が同じ会社の行を既に持っていないか（重複を作らない）
  select count(*) into n from public.ow_experiences
   where company_id = v_sf
     and user_id = (select user_id from public.ow_experiences where id = v_exp);
  if n <> 0 then raise exception '同じ人が既にセールスフォースの職歴を持っている: % 件', n; end if;


  -- ── 紐づけ直す。⚠️ XOR があるので同時に company_text を落とす ──────────────
  update public.ow_experiences
     set company_id = v_sf, company_text = null
   where id = v_exp;

  -- ── 事後検算 ────────────────────────────────────────────────────────────
  select count(*) into n from public.ow_experiences
   where id = v_exp and company_id = v_sf and company_text is null and company_anonymized is null;
  if n <> 1 then raise exception '更新後の状態が想定と違う'; end if;

  -- ⚠️ トリガーが数え直した値が、いま数えた値と一致すること（＝トリガーが効いたこと）
  select current_member_count into v_cnt_after from public.ow_companies where id = v_sf;
  select count(distinct user_id) into v_live from public.ow_experiences
   where company_id = v_sf and is_current;
  if v_cnt_after <> v_live then
    raise exception 'トリガーが効いていない（列 % / 実数 %）', v_cnt_after, v_live;
  end if;

  -- ⚠️ 実ユーザーだけの数も出す。上の値は検証用アカウントを含むので別物
  select count(distinct e.user_id) into v_real
    from public.ow_experiences e join public.ow_users u on u.id = e.user_id
   where e.company_id = v_sf and e.is_current
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;

  raise notice '紐づけ完了。在籍カウント列 %（うち実ユーザー %人）', v_cnt_after, v_real;
end $$;

commit;
