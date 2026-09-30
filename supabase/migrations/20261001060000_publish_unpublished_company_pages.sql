-- 非公開だった企業14社のページを見えるようにする（一覧には出さない）
--
-- 柴さんの指示（2026-10-01）。「利用者が登録した企業の在籍者を見られるようにしたい」。
-- ⚠️★**一覧（`listing_status`）は動かさない。** IT/SaaS に絞った方針（2026-09-14 に
--    83社 → 22社）はそのまま。動かすのは `is_published`（＝ページが開けるか）だけ。
--
-- ── なぜ両方まとめて倒すか ──────────────────────────────────────────────────
-- ⚠️★**いま「ページが見えるかどうか」が日によってバラバラだった。**
--    ・運営が入れた非掲載企業でも、2026-10-01 に足した9社は `is_published = true`
--    ・同じ経路で足したはずの PIVOT / マイナビ（09-30）は false
--    ・ゼネコン6社（09-04）も false
--    ⇒ **「ページは見える／一覧には出さない」を全社で揃える。**
--
-- ⚠️ 見えるようになっても、ディレクトリ・sitemap・LP には出ない。`noindex` も付く。
--    たどり着けるのは**誰かの職歴からのリンク**と URL 直打ちだけ。
--    `lib/utils/timeline.ts` が `is_published=false` の会社をテキスト表示に落とすので、
--    **職歴のリンクが張られるようになるのが主な効果。**
--
-- ── ★2026-09-09 の保留 migration は、そのままでは通らない ──────────────────
-- `supabase/pending/20260909023500_publish_user_created_company_pages.sql` は
-- `is_published = true` を素で UPDATE しているが、**`trg_guard_company_approval` が
-- `is_approved = false` の企業を 42501 で弾く**（CLAUDE.md にその日の記録がある）。
-- ⇒ 本 migration が置き換える。**あちらは適用しないこと。**
--
-- ⚠️★**`is_approved` は倒さない。** あれは「運営が内容を確認した」という意味で、
--    利用者が作った6社は誰も確認していない。**フラグに嘘をつかせない**
--    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
-- ⚠️★**トリガーを書き換えて解決しない。** 「承認は一覧掲載に掛ける」という方針
--    （2026-08-13）と現物がずれているのは事実だが、それを直すと**企業が自分の
--    ページを未承認で公開できる**ようになる。今回の指示の範囲を超える。
-- ⇒ **この UPDATE のあいだだけトリガーを外す。**
--    ⚠️ `ALTER TABLE ... DISABLE TRIGGER` はトランザクション内なので、
--       途中で失敗すれば ROLLBACK で元に戻る。末尾で有効に戻ったことを検算する。
--    ⚠️★**ロールを切り替えない**（`SET LOCAL ROLE service_role`）。CLAUDE.md が禁じている
--       —— GRANT は COMMIT されるのに台帳への INSERT が 42501 で落ちる。

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_companies where is_published = false and is_test = false;
  if n <> 14 then raise exception '非公開の企業が14社ではない: % 社', n; end if;
end $$;

alter table public.ow_companies disable trigger trg_guard_company_approval;

update public.ow_companies
   set is_published = true,
       /* ⚠️ CLAUDE.md「migration で is_published を true にするときも published_at を埋める」。
             過去に80社ぶん取り逃している。⚠️ 既に入っていれば上書きしない（初回公開の日時） */
       published_at = coalesce(published_at, now()),
       updated_at   = now()
 where is_published = false and is_test = false;

alter table public.ow_companies enable trigger trg_guard_company_approval;

-- ── 検算 ────────────────────────────────────────────────────────────────────
do $$
declare n_unpub int; n_listed int; n_noapproved int; v_tg char;
begin
  select count(*) into n_unpub from public.ow_companies where is_published = false and is_test = false;
  if n_unpub <> 0 then raise exception '非公開が残っている: % 社', n_unpub; end if;

  -- ★一覧が増えていないこと（ディレクトリは触っていない）
  select count(*) into n_listed from public.ow_companies
   where listing_status='listed' and is_published and not is_test;
  if n_listed <> 21 then raise exception '掲載社数が動いた: % 社', n_listed; end if;

  -- ★is_approved は倒していないこと
  select count(*) into n_noapproved from public.ow_companies
   where is_published and not is_test and is_approved = false;
  if n_noapproved < 13 then
    raise exception 'is_approved を倒してしまった（未承認が % 社しかない）', n_noapproved;
  end if;

  -- ★トリガーが有効に戻っていること（'O' = origin で有効 / 'D' = 無効）
  select t.tgenabled into v_tg from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where c.relname='ow_companies' and t.tgname='trg_guard_company_approval';
  if v_tg = 'D' then raise exception 'トリガーが無効のまま'; end if;

  raise notice 'ページを公開 14社 / 掲載は % 社のまま / 未承認のまま公開 % 社 / トリガー %',
    n_listed, n_noapproved, v_tg;
end $$;

commit;
