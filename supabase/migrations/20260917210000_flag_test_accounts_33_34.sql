-- contact+33 / +34 の2アカウントに is_test を立てる（2026-09-17 / 柴さんの指示）
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- 社内の検証用アカウント `contact+NN@opinio.co.jp` のうち、
-- **`+01`〜`+32` は全て `is_test = true` なのに `+33` `+34` の2件が false** だった。
-- どちらも 2026-09-15 作成で、**フラグの立て忘れ**。
-- 2026-08-26 に `+16`〜`+27` を、2026-09-14 に `+28`〜`+32` を倒したのと同じ形で、
-- **今回は「その後に作られた2件」を追いかけて倒す。**
--
-- ⚠️ **実害が出ていた。** `/people`（登録ユーザー一覧）に
--    「テスト 太郎」「問 合せ対応」として並び、**件数の「7 名」にも入っていた**
--    （2026-09-17 実測 / 本番）。さらに2件とも
--    **株式会社セールスフォース・ジャパン（listing_status = 'listed'）**に
--    `is_current = true` / `visibility_company = 'real'` の職歴を持つので、
--    **同社の企業ページに現役社員として出ていた。**
--    ⚠️ 未ログインには氏名は漏れていない（2件とも `visibility = 'login_only'`）。
--    漏れていたのは**ログイン済みの訪問者に対して**と、**人数の表示**。
--
-- `lib/people/directory.ts` / `getCompanyEmployees` / `getPublicAmbassadorsCached` は
-- `is_test` を除外するので、**フラグを立てるだけで消える。コード変更は不要。**
--
-- ── 対象の選び方 ────────────────────────────────────────────────────────────
-- ⚠️ CLAUDE.md「全社一括の UPDATE を禁止する。対象を id または name で明示列挙する」。
--    `email like 'contact+%'` では書かない。**2件の id を並べる。**
-- ⚠️ 実ユーザーには触らない。同じ `@opinio.co.jp` でも
--    `hiroki.ikuto.placeholder@opinio.co.jp`（生藤 弘樹・運営が履歴書から書き起こした実在の人物）と
--    `system@opinio.co.jp`（システムユーザー）は**対象外**。
--
-- ── 直近にこの列を触った migration ────────────────────────────────────────────
-- `ow_users.is_test` を一括で触ったのは `20260826100000`（+16〜+27）が最後。
-- `+28`〜`+32` は migration ではなく直接 UPDATE で倒されている（2026-09-14）。
-- **どちらも打ち消しは起きない**（今回の2件はそのどちらにも含まれない。2026-09-17 に確認）。
--
-- ⚠️ **行を消さない。** CLAUDE.md「本番で検証用アカウントを作らない」の理由と同じで、
--    `ow_users` を参照する FK 45列のうち29列が ON DELETE CASCADE。
--    フラグを立てるだけにする。**戻すのは UPDATE 1本。**

update public.ow_users
   set is_test = true, updated_at = now()
 where id in (
   '1848a0e1-1e97-41b8-9275-fb44d09b4b1b',  -- contact+33 テスト 太郎    ★/people と SF の現役社員に出ていた
   'cb932cc5-0df0-4790-8c47-c5a9e399af13'   -- contact+34 問 合せ対応    ★同上
 );

-- ★2行ちょうど変わったことを確かめる。多くても少なくても中止する。
do $$
declare n integer;
begin
  select count(*) into n from public.ow_users
   where email like 'contact+%@opinio.co.jp' and is_test = false;
  if n <> 0 then
    raise exception 'contact+NN で is_test=false が % 件残っている（0 のはず）', n;
  end if;

  -- ⚠️ 適用前の実測（2026-09-17）: is_test=true は **37件**（総数48）。
  select count(*) into n from public.ow_users where is_test = true;
  if n <> 39 then
    raise exception 'is_test=true の総数が % 件（37 + 2 = 39 のはず）', n;
  end if;

  -- ⚠️★登録ユーザー（is_test=false かつ is_system=false かつ auth_id あり）は 9 -> 7 になる。
  --    CLAUDE.md にこの数字が出てくるので、変わったことをここで確定させておく。
  select count(*) into n from public.ow_users
   where is_test = false and is_system = false and auth_id is not null;
  if n <> 7 then
    raise exception '登録ユーザーが % 人（9 - 2 = 7 のはず）', n;
  end if;
end $$;
