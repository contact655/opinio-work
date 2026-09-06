-- 事業領域「業種特化」を選択肢から下げる（柴さんの判断・2026-09-06）。
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- 同じ日に**対象業界（軸2）を求職者側の絞り込みに出した**ので、
-- 「業種特化」は役割が重複した。しかも中身を言えていない:
--
--     事業領域「業種特化」   … 何に特化しているかは分からない
--     対象業界「医療・ヘルスケア」「金融・保険」 … 具体的に言える
--
-- 該当2社（Ubie / エヌシーノ）は**どちらも `is_primary = false`** で、
-- カードにも企業詳細にも出ていない（どちらも主の事業領域を表示する）。
-- **情報は失われない** —— 2社とも対象業界が記録済み。
--
-- ── やること: `is_active = false` にするだけ ─────────────────────────────────
-- ⚠️ **行を消さない。明細（ow_company_business_domains）も消さない。**
--    UPDATE 1本で元に戻せる形にしておく:
--      update ow_business_domains set is_active = true where slug = 'vertical';
--
-- ⚠️★**適用後に実測して、当初の想定が1つ外れていたので訂正した（2026-09-06）。**
--
--    当初は「アプリ側で `is_active` を見ているのは `fetchBusinessDomainOptions` だけなので、
--    `?industry=vertical` のブックマークは2社を返し続ける」と書いていた。**間違い。**
--    `ow_business_domains` の RLS が **`(is_active = true) OR auth_is_admin()`** なので、
--    無効化した行は **anon から丸ごと見えなくなる**。`!inner` の join が落ちて **0社**になる。
--
--    実測（適用後 / 未ログイン）:
--      ・選択肢から消えた … /companies・/jobs・LPのファセット・フッター（14 → 13件）
--      ・`?industry=vertical` … **0社**（2社ではない）
--      ・表示テキストに「業種特化」… /companies・/jobs・LP とも **0件**
--        （/jobs の RSC ペイロードには3件残るが、検証用企業のぶんで画面には出ない。
--          admin クライアントで引いており RLS を通らないため）
--
--    ⚠️ **アプリのコードだけを読んで「RLS は関係ない」と判断しないこと。**
--       CLAUDE.md「アプリを読んでも気づけない。行数を見る以外に検知する方法が無い」と同根。
--
--    0社になるのは許容した。**リンク元がもう無い**（フッターが唯一で、それも消えた）／
--    sitemap にも出していない（実測0件）ため。
--
-- ⚠️ 企業詳細は `primaryBusinessDomain()` で**主だけ**を出すので影響なし（実画面で確認済み）。
--
-- ⚠️ **表示側は `is_active` を見ていない**（`mapCompany` の join は素通し）。
--    だから検証用企業のカードは「業種特化」を出し続ける。壊れない。
--
-- ⚠️ フッターは `getBusinessDomainFacets()` から動的にリンクを組んでおり、
--    **`grep "industry=vertical"` では見つからない。** ここも自動で消える。

begin;

do $$
declare
  n_master int;
  n_links  int;
  n_primary int;
begin
  select count(*) into n_master from ow_business_domains where slug = 'vertical' and is_active;
  select count(*) into n_links  from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id where d.slug = 'vertical';
  /* ⚠️★**`is_test` を除く。** 検証用企業（【テスト】株式会社サンプルワークス）が
        「業種特化」を主にしているが、求職者側では46箇所で無条件に除外されるので
        カードが壊れる先が無い。**除外しないとこの migration は永久に通らない。**
        ⚠️ このガード自体は残す —— 実企業が主にしていたら止めるためのもの。
           実際、最初に書いたときは掲載中だけを見ていて**この1社を見落としていた**。 */
  select count(*) into n_primary from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id
    join ow_companies c on c.id = l.company_id
   where d.slug = 'vertical' and l.is_primary and coalesce(c.is_test, false) = false;

  if n_master <> 1 then
    raise exception '対象のマスタ行が % 件（期待 1）', n_master;
  end if;
  /* ⚠★**主として使っている企業がいたら中止する。** いればカードから事業領域が消え、
        「事業領域 —」になる（CLAUDE.md「値が無いことを、ある値に置き換えない」の逆で、
        こちらは値そのものが消える事故）。 */
  if n_primary <> 0 then
    raise exception '「業種特化」を主の事業領域にしている企業が % 社いる。先にそちらを直すこと', n_primary;
  end if;
  raise notice '明細 % 件は残す（? industry=vertical のブックマークを生かすため）', n_links;
end $$;

update ow_business_domains set is_active = false where slug = 'vertical';

do $$
declare
  still int;
begin
  select count(*) into still from ow_business_domains where slug = 'vertical' and is_active;
  if still <> 0 then
    raise exception '無効化できていない';
  end if;
end $$;

comment on table ow_business_domains is
  '事業領域（何を作っているか）。⚠️ 「誰に売っているか」は別の軸で、'
  'ow_company_target_industries（対象業界）が持つ。混ぜないこと。'
  '⚠️ slug=''vertical''（業種特化）は 2026-09-06 に is_active=false にした —— '
  '対象業界を求職者側に出したことで役割が重複し、かつ何に特化しているかを言えないため。';

commit;
