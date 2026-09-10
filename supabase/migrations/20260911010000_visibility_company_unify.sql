-- ★会社名の公開範囲を `visibility_company` 1本にする（2026-09-11）
--
-- ── なぜ2列あったか、なぜ畳むか ──────────────────────────────────────────────
-- `visibility_company_profile` は `archive/191_add_visibility_company_profile.sql` が
-- **意図的に**足した列で、当時の分担はこうだった:
--     visibility_company          … **キャリア軌跡ページ**向け
--     visibility_company_profile  … プロフィールページ（/u/[id]）向け
--
-- ⚠️★**その「キャリア軌跡ページ」は現存しない。** `src/app` に該当ディレクトリが無く、
--    当時の唯一の読み手だった `get_public_career_steps()` も **src からの呼び出しが0件**
--    （関数自体は残っているが、誰も呼んでいない）。
--    結果として `visibility_company` は元の用途を失ったあと**6面**に広がり、
--    `visibility_company_profile` だけが **/u/[id] の1面**に取り残されていた。
--
-- ⇒ **同じ問い（会社名を伏せるか）に2つの答えを持たせない。**
--    伏せたい動機は「転職を考えていると今の会社に知られたくない」で、**面によって変わらない。**
--    むしろ /u/[id] のほうが露出が広い（ログインすれば同僚も見られる）ので、
--    弱いほうを別設定にしておく意味が無い。しかも候補者検索から /u/ へ**1クリックで飛べる**。
--
-- ⚠️★**列は DROP しない。** COMMENT で【廃止】と印を付けて残す（CLAUDE.md の方針）。
--
-- ⚠️★**データ移行は無い。UPDATE を1行も書かない。**
--    実測（2026-09-11 / 本番）: 29行すべて `real` / `real`。**片方だけ伏せている人は0人。**
--    だからこの統合は**誰の意思も上書きしない。** 下のガードでそれを毎回確かめる。

begin;

-- ★ガード: 両列が全件 'real' でなければ中止する。
--   ⚠️ そうでない日に流すと「どちらを残すか」を機械が勝手に決めることになる。
--      その判断は人がすること。
do $$
declare v_total int; v_not_real int;
begin
  select count(*) into v_total from public.ow_experiences;
  select count(*) into v_not_real
    from public.ow_experiences
   where visibility_company <> 'real' or visibility_company_profile <> 'real';

  raise notice 'ow_experiences % 行 / real でない行 %', v_total, v_not_real;

  if v_not_real <> 0 then
    raise exception '両列が全件 real ではない（% 行）。どちらを残すかを決めてから当てること', v_not_real;
  end if;
end $$;

comment on column public.ow_experiences.visibility_company is
  '会社名の公開範囲: real=実名 / masked=伏せる / hidden=この職歴を出さない。'
  '★2026-09-11 に visibility_company_profile を畳んでここへ一本化した。'
  '⚠️ /u/[id] のタイムラインもこの列を見る（あちらは masked のとき会社マスタから代替表示を作る）。'
  '⚠️ 面ごとに「どう表示するか」は違ってよいが、「伏せるかどうか」の値は1つ。';

comment on column public.ow_experiences.visibility_company_profile is
  '【廃止】visibility_company に一本化（2026-09-11）。この列は未使用。'
  '⚠️ 新しく読み書きしないこと。読む先が2つに戻る。'
  '経緯: archive/191 が「キャリア軌跡ページ向け／プロフィールページ向け」で分けたが、'
  'キャリア軌跡ページも get_public_career_steps() の呼び出しも現存しない。';

commit;
