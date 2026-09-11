-- ★入社理由（自由記述）の公開を「既定は出さない」に変える（2026-09-11）
--
-- ── 背景 ──────────────────────────────────────────────────────────────────
-- `ow_experiences.join_reason`（自由記述）は、入力画面が紫バッジで
-- 「**公開プロフィールに表示**」と約束しているのに、**描画する JSX が src 全体で0件**
-- だった（2026-08-12 の「空振りのスイッチ」は今も正しい）。
-- ⇒ 描画を入れる方針になった。ただし**既に書かれているものを、決めた瞬間に公開しない。**
--
-- ⚠️★**害の向きに注意。** 公開範囲が広すぎたのではなく「**公開すると書いてあるのに出ない**」。
--    描画を入れる側の作業なので、**先に非公開へ倒してから**でないと出てしまう。

begin;

-- ── (a) 既に書かれている自由記述を、非公開に倒す ──────────────────────────────
--
-- ⚠️★**対象は `id` で明示列挙せず、条件で書く**（CLAUDE.md の「明示列挙」の例外）。
--    適用日までに行が増えても**同じ意味**になるため。**そのかわり件数で止める。**
--
-- 実測（2026-09-11 / 本番）: 自由記述がある行は4件。人でいうと**2人**。
--   生藤 弘樹 … 3件（`visibility_reason = true`）← ★これが対象
--     ⚠️ `auth_id IS NULL` ＝ **本人は一度も登録していない。** email は placeholder で、
--        **運営が履歴書から書き起こした行**（`archive/154_add_users_narifuji_komatsu.sql`）。
--        いまは `isRegisteredUser` が7面から除外しているので誰にも見えないが、
--        **本人が登録して `auth_id` が入った瞬間に表示対象へ戻る。** だから倒しておく。
--   大塚悠貴 … 1件（`visibility_reason = false`）← ⚠️**触らない**（本人が非公開にしたもの）
do $$
declare v_target int;
begin
  select count(*) into v_target
    from public.ow_experiences
   where join_reason is not null and btrim(join_reason) <> ''
     and visibility_reason = true;

  raise notice '倒す対象 % 件（想定 3）', v_target;

  -- ⚠️ 4件以上なら**知らない誰かの分が増えている**。機械で倒さず人が見る。
  if v_target <> 3 then
    raise exception '対象が3件ではない（実測 % 件）。増えた分が誰のものかを確かめてから当てること', v_target;
  end if;
end $$;

update public.ow_experiences
   set visibility_reason = false
 where join_reason is not null and btrim(join_reason) <> ''
   and visibility_reason = true;

-- ── (b) 列の既定を true → false にする ──────────────────────────────────────
--
-- ⚠️★「値が取れないときは狭いほうへ」に揃える。**UI だけ変えて DB を放置しない**
--    （CLAUDE.md「UI / API / DB を揃える」）。入力欄の既定も非公開にする。
-- ⚠️★**既定の変更は既存行に波及しない**（`ALTER COLUMN ... SET DEFAULT` は
--    これから INSERT される行にしか効かない）。下のアサートで事後にも確かめる。
alter table public.ow_experiences
  alter column visibility_reason set default false;

comment on column public.ow_experiences.visibility_reason is
  'join_reason（自由記述）を公開プロフィールに出すか。'
  '★2026-09-11 に既定を true → false に変えた（迷ったら狭いほうへ）。'
  '⚠️ アプリ側も ?? true をやめている。片方だけ戻さないこと。'
  '⚠️ 行ごとの設定。visibility_company（職歴全体の1設定）とは性質が違う。';

-- ── 事後チェック ───────────────────────────────────────────────────────────
do $$
declare v_false int; v_true int; v_default text;
begin
  select count(*) filter (where visibility_reason = false),
         count(*) filter (where visibility_reason = true)
    into v_false, v_true
    from public.ow_experiences;

  select column_default into v_default
    from information_schema.columns
   where table_schema = 'public' and table_name = 'ow_experiences'
     and column_name = 'visibility_reason';

  raise notice '適用後: false % 件 / true % 件 / 既定 %', v_false, v_true, v_default;

  -- ⚠️ 倒したのは3件だけ。既に false だった1件と合わせて 4件。
  if v_false <> 4 then
    raise exception 'false が4件でない（実測 %）。既存行に波及した可能性がある', v_false;
  end if;
  -- ⚠️ 残り25件は true のまま（既定の変更が既存行に波及していないことの確認）
  if v_true <> 25 then
    raise exception 'true が25件でない（実測 %）。既存行に波及した可能性がある', v_true;
  end if;
  if v_default is distinct from 'false' then
    raise exception '既定が false になっていない（実測 %）', v_default;
  end if;
end $$;

commit;
