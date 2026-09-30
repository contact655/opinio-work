-- 「営業」（大分類）で止まっている職歴2件を「フィールドセールス」に直す（運営の代理入力）
--
-- 柴さんの指示（2026-09-30）。オンボーディングの職種欄を「大分類／小分類」の2欄にした
-- （`c02b3fc9`）のは、大分類のまま終わる人を減らすため。それ以前に登録した実ユーザーの
-- うち、大分類「営業」のまま止まっていた2件を運営が直す。
--
-- ⚠️★**2件は根拠の強さが違う。まとめて「調べた値」と読まないこと。**
--
--   ① 堀部 隼人（株式会社SmartHR / 現職）
--      `role_title` に**本人が「フィールドセールス」と書いている。** 推測ではない。
--
--   ② 木村雅樹（みずほ証券株式会社 / 退職済み）
--      `role_title` は「兵庫県明石店 ウェルスマネジメント課 / 法人・個人営業」で、
--      ★**フィールドセールスとは書かれていない。**
--      それでもこの値を入れるのは**柴さんの判断**（2026-09-30）。
--      ⚠️ CLAUDE.md「推測値を投入しない」に照らすと、①と同じ扱いにはできない。
--         **本人が選び直したら、その値が正。** ここで入れた値を根拠に上書きしないこと。
--
-- ⚠️ `ow_experience_roles` は2件とも**0行**なので触らない（職種が1つのときは書かない仕様）。
-- ⚠️ `ow_transitions` は導出テーブル。この migration では触らない。
--    ★**適用後に `select public.rebuild_ow_transitions();` を実行すること**
--      （木村さんの「みずほ証券 → セールスフォース」の `from_role_category_id` が変わる）。
--      日次 cron でも直るが、確認は自分で流したほうが早い。

begin;

-- ── 事前検算。想定と違えば中止する ──────────────────────────────────────────
do $$
declare
  v_field_sales uuid;
  v_sales       uuid;
  n int;
begin
  select id into v_field_sales from public.ow_roles
   where name = 'フィールドセールス' and is_active = true;
  if v_field_sales is null then
    raise exception '職種「フィールドセールス」が見つからない（is_active = true のもの）';
  end if;
  if v_field_sales <> '133c74c0-e432-4c52-8235-7ad9bc7d96b8'::uuid then
    raise exception 'フィールドセールスの id が想定と違う: %', v_field_sales;
  end if;

  select id into v_sales from public.ow_roles where name = '営業' and parent_id is null;
  if v_sales is null then raise exception '大分類「営業」が見つからない'; end if;

  -- 対象2件が、いま大分類「営業」であること
  select count(*) into n from public.ow_experiences
   where id in ('396b8d04-a744-4b8f-9857-f2d78f3d2550','61bd3d56-8716-4d74-8ff4-d3b5709dd9da')
     and role_category_id = v_sales;
  if n <> 2 then
    raise exception '対象が2件ではない（大分類「営業」のもの）: % 件', n;
  end if;

  -- ⚠️ 本人が既に直していないかの確認も兼ねる。0件でないこと自体が「まだ営業のまま」の証拠
  raise notice '事前: 大分類「営業」のまま = % 件', n;
end $$;

-- ── ① 堀部 隼人（SmartHR）。role_title に本人の記載あり ──────────────────────
update public.ow_experiences
   set role_category_id = '133c74c0-e432-4c52-8235-7ad9bc7d96b8'::uuid
 where id = '396b8d04-a744-4b8f-9857-f2d78f3d2550';

-- ── ② 木村雅樹（みずほ証券）。★柴さんの判断。本人の記載ではない ─────────────
update public.ow_experiences
   set role_category_id = '133c74c0-e432-4c52-8235-7ad9bc7d96b8'::uuid
 where id = '61bd3d56-8716-4d74-8ff4-d3b5709dd9da';

-- ── 事後検算 ────────────────────────────────────────────────────────────────
do $$
declare n_done int; n_left int;
begin
  select count(*) into n_done from public.ow_experiences
   where id in ('396b8d04-a744-4b8f-9857-f2d78f3d2550','61bd3d56-8716-4d74-8ff4-d3b5709dd9da')
     and role_category_id = '133c74c0-e432-4c52-8235-7ad9bc7d96b8'::uuid;
  if n_done <> 2 then raise exception '更新後が2件ではない: % 件', n_done; end if;

  -- 実ユーザーで大分類のまま残っている職歴を数える（0 が目標だが、0 でなくても中止しない）
  select count(*) into n_left
    from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
    join public.ow_roles r on r.id = e.role_category_id
   where r.parent_id is null
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;

  raise notice '事後: 更新 % 件 / 実ユーザーで大分類のまま残る職歴 % 件', n_done, n_left;
end $$;

commit;
