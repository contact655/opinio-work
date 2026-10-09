-- ════════════════════════════════════════════════════════════════════════
-- クライアントのロールから実行を許している SECURITY DEFINER 関数6本に、説明を付ける（2026-10-09）
-- ════════════════════════════════════════════════════════════════════════
--
-- CLAUDE.md「DB 関数の書き方」⑤の決まりに合わせて、**なぜ実行を許しているか**を関数そのものに書く。
-- `scripts/check-definer-grants.sh` の許可リストと同じ6本。
-- ⚠️★関数の本体と権限は変えていない（COMMENT ON FUNCTION だけ）。
-- ⚠️ COMMENT ON は文字列リテラルしか受けない（`||` で連結できない）。改行は E'…\n…' で書く。
-- ⚠️ 既に説明があった2本（auth_is_active_company_admin / auth_ow_user_id）は、元の文を残して前に足した。
--    COMMENT ON は**上書き**なので、元の文を書き写さないと消える。
-- ════════════════════════════════════════════════════════════════════════

begin;

comment on function public.auth_is_admin() is
  '【実行を許している理由】RLS ポリシーの中で使う補助関数。呼んだ本人のことしか答えない（本人が運営か）。authenticated・anon に実行を許している。外すとポリシーの評価ごと 403 になる。';

comment on function public.auth_is_company_admin(uuid) is
  '【実行を許している理由】RLS ポリシーの中で使う補助関数。呼んだ本人のことしか答えない（本人がその企業の管理者権限を持つか）。authenticated・anon に実行を許している。外すとポリシーの評価ごと 403 になる。';

comment on function public.auth_is_company_member(uuid) is
  '【実行を許している理由】RLS ポリシーの中で使う補助関数。呼んだ本人のことしか答えない（本人がその企業の担当者か）。authenticated・anon に実行を許している。外すとポリシーの評価ごと 403 になる。';

comment on function public.auth_ow_user_id() is
  E'【実行を許している理由】RLS ポリシーの中で使う補助関数。呼んだ本人のことしか答えない（本人の ow_users.id）。authenticated・anon に実行を許している。外すとポリシーの評価ごと 403 になる。\n\nログイン中のユーザーの ow_users.id を返す（未ログインなら NULL）。 ⚠️ user_id が ow_users.id 空間のテーブルでポリシーを書くときは、 auth.uid() と直接比較せずこれを使う。空間の取り違えで常に false になる事故が 2026-08-06 時点で7本あった。どちらの空間かは docs/user-id-spaces.md を見ること。';

comment on function public.auth_is_active_company_admin(uuid) is
  E'【実行を許している理由】RLS ポリシーの中で使う補助関数。呼んだ本人のことしか答えない（本人がその企業の有効な担当者か）。authenticated・anon に実行を許している。外すとポリシーの評価ごと 403 になる。\n\n在籍が有効な企業管理者か（is_active のみ。⚠️ permission は見ない）。auth_is_company_admin() は permission=admin を追加で要求するので別物。混ぜないこと。';

comment on function public.create_conversation(text, uuid, uuid, uuid) is
  E'【実行を許している理由】セッションのクライアントから呼ぶ RPC（応募・カジュアル面談の API）。中で auth.uid() による本人確認をする（呼んだ本人が p_candidate_user_id であること。service_role は素通し）。authenticated に実行を許している。\n⚠️ 企業が掲載中か・面談を受け付けているか・応募や面談申込が実際にあるかは見ていない（企業の実在は FK が保証する）。';

-- ── 検算 ─────────────────────────────────────────────────────────────────
do $$
declare
  n int;
begin
  select count(*) into n
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('auth_is_admin','auth_is_company_admin','auth_is_company_member',
                       'auth_ow_user_id','auth_is_active_company_admin','create_conversation')
     and obj_description(p.oid, 'pg_proc') like '【実行を許している理由】%';
  if n <> 6 then
    raise exception '検算失敗: 説明が付いた関数が % 本（想定 6）', n;
  end if;
  -- 元の説明が残っていること
  if obj_description('public.auth_ow_user_id()'::regprocedure, 'pg_proc') not like '%docs/user-id-spaces.md%'
     or obj_description('public.auth_is_active_company_admin(uuid)'::regprocedure, 'pg_proc') not like '%混ぜないこと%' then
    raise exception '検算失敗: 元の説明が消えた';
  end if;
  raise notice '検算OK: 6本に説明が付いた（元の説明も残っている）';
end $$;

commit;
