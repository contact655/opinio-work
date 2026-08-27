-- 伊藤忠テクノソリューションズ（CTC）に tagline を入れる（2026-08-28）
--
-- ── 背景 ────────────────────────────────────────────────────────────────────
-- 公開79社のうち `tagline` が空なのは**この1社だけ**（2026-08-28 実測）。
-- そのため /companies の 375px（1列表示）で**このカードだけ高さが 124px** になり、
-- 他の 143px と揃わない。1440 / 1199 / 768 は CSS Grid の行内 stretch で
-- 揃うので影響しない（＝1列のときだけ露出する）。
--
-- 空であることの影響は一覧の高さだけではない（すべて本番で実測 / 2026-08-28）:
--   meta description  … 分岐が else に落ち「社名＋汎用文」だけになっていた
--   OGP 画像の sub    … `&sub=`（空）でピルごと描かれない
--   JSON-LD           … `description: ""`（キーは出るが中身が無い）
--   詳細ページのヒーロー … 空の <p> が marginBottom 付きで出て**余白だけ空いていた**
--   企業検索の ilike  … 対象は description / industry / tagline の3列。この列では引けない
--
-- ── 文言の根拠 ──────────────────────────────────────────────────────────────
-- 「企業のITインフラを設計から運用まで担う」（19字）
--   ・事業内容型（公式ミッションは採らない）。`description` の
--     「コンサルティングから運用・保守までのITライフサイクル全体」を圧縮したもの
--   ・カードに出る**事業領域は「クラウドインフラ」**（`is_primary = true`）なので矛盾しない
--   ・375px のカード内寸は 309px。**20字**（適用後に実描画幅で確認する）
--     ⚠️ 当初「19字」と数えていたが実測は20字。**字数は数えてから書くこと。**
--
-- ⚠️ **`description` の実態は「インフラ」より広い**（AI・データ分析・
--    サイバーセキュリティ・科学工学系IT）。それでもタグに合わせている。
--    tagline だけ広げると**カードのタグと食い違う**ため。
--    実態に寄せたいなら**事業領域を足す別タスク**にすること。ここで tagline だけ
--    広げないこと。
--
-- ⚠️ **`mission` には影響しない。** `queries.ts` の
--    `mission: row.mission ?? row.tagline ?? ""` は **mission が優先**で、
--    CTC は mission が入っている（「明日を変えるITの可能性に挑み、…」）。
--    ⚠️ 逆に、**将来 mission を消すとこの tagline がミッション欄に昇格する。**
--
-- ── やらないこと ────────────────────────────────────────────────────────────
-- ⚠️ **`employee_count` は触らない。** 現在の
--    「単体6,425名 / グループ12,862名（2026年4月現在）」は正確な値で、
--    一覧は既にレンジ表記（5,001-10,000名）なので併記は表に出ていない。
--    詳細ページで単体と連結が読めるのは情報として正しい。消すと実データが減る。
-- ⚠️ 他の空列（why_join / main_products / benefits ほか）も**ついでに埋めない**。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-0233-ow_companies.sql（スキーマ+データ / 87行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
--   1行だけ戻すなら:
--     update public.ow_companies set tagline = null
--      where id = '138ff010-8671-414a-ab06-752d61f50dd7';
--
-- ⚠️ 対象は id で明示列挙（CLAUDE.md「全社一括の UPDATE を禁止する」）。

-- ── 適用前の確認 ────────────────────────────────────────────────────────────
do $$
declare v_before text; v_empty int;
begin
  select tagline into v_before from public.ow_companies
   where id = '138ff010-8671-414a-ab06-752d61f50dd7';
  -- ★旧値は NULL。既に入っていたら別の誰かが入れているので中止する
  if v_before is not null then
    raise exception 'CTC の tagline が既に入っている（%）。中止', v_before;
  end if;

  select count(*) into v_empty from public.ow_companies
   where is_published and listing_status = 'listed' and not coalesce(is_test, false)
     and (tagline is null or btrim(tagline) = '');
  if v_empty <> 1 then
    raise exception 'tagline が空の掲載企業が % 社（1 のはず）。前提が違う。中止', v_empty;
  end if;
  raise notice '適用前: CTC の tagline は NULL / 空の掲載企業は % 社', v_empty;
end $$;

update public.ow_companies
   set tagline = '企業のITインフラを設計から運用まで担う'
 where id = '138ff010-8671-414a-ab06-752d61f50dd7'
   and tagline is null;   -- ⚠️ 既に入っていたら触らない

-- ── 適用後の検証。★「エラーが出なかった」を成功にしない ──────────────────
do $$
declare v_after text; v_empty int; v_emp text; v_mission text;
begin
  select tagline, employee_count, mission into v_after, v_emp, v_mission
    from public.ow_companies where id = '138ff010-8671-414a-ab06-752d61f50dd7';

  if v_after is distinct from '企業のITインフラを設計から運用まで担う' then
    raise exception 'CTC の tagline が想定と違う（%）。中止', v_after;
  end if;

  -- ★ついでに他の列を触っていないこと
  if v_emp is distinct from '単体6,425名 / グループ12,862名（2026年4月現在）' then
    raise exception 'employee_count が変わっている（%）。中止', v_emp;
  end if;
  if v_mission is null then
    raise exception 'mission が消えている。中止';
  end if;

  -- ★掲載企業で tagline が空の会社が 0 になったこと
  select count(*) into v_empty from public.ow_companies
   where is_published and listing_status = 'listed' and not coalesce(is_test, false)
     and (tagline is null or btrim(tagline) = '');
  if v_empty <> 0 then
    raise exception 'tagline が空の掲載企業がまだ % 社ある。中止', v_empty;
  end if;

  raise notice '完了: CTC の tagline = "%" / 空の掲載企業 % 社', v_after, v_empty;
end $$;
