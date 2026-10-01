-- 職歴に「社内での役職の呼び方」を足す（2026-10-01 / 柴さんの指示）
--
-- ── なぜ要るか ──────────────────────────────────────────────────────────────
-- 職種は**2つ**持っている:
--     role_category_id … 職種マスタ（選択肢）
--     role_title       … 「社内での呼び方」（自由入力）
-- ところが役職は `rank`（5択）しか無く、**社内での呼び名を書く場所が無かった。**
-- 「ユニットリーダー」「本部長代理」のような呼称は 5択のどれにも収まらない。
-- → 職種と同じ形（選択肢＋自由入力）に揃える。
--
-- ⚠️★**`rank` と混ぜないこと。** 5択は会社をまたいで比べるための区分で、
--    こちらは**その会社の中だけで通じる呼び名**。片方に寄せると比較ができなくなる。
--
-- ⚠️ CHECK は張らない。`role_title` と同じ自由入力で、取りうる値の集合が無い。
--    長さ（100字）は API が切る（`role_title` と同じ）。
--    CLAUDE.md「3層を揃える」は**値の集合**の制約についての約束で、長さは対象外。

alter table public.ow_experiences
  add column if not exists rank_title text;

comment on column public.ow_experiences.rank_title is
  '社内での役職の呼び方（自由入力）。例「ユニットリーダー」「本部長代理」。'
  '⚠️ 5択の区分は rank。職種側の role_title と対になる列で、混ぜないこと。';

-- ── GRANT ──────────────────────────────────────────────────────────────────
-- ⚠️★このテーブルは **SELECT だけが列単位**で、INSERT / UPDATE / DELETE は
--    テーブルレベル（実測 2026-10-01）。したがって:
--      書き込み … 足した時点で authenticated から可能（grant 不要）
--      読み取り … **足した時点では誰にも見えない**
--
-- ⚠️ SELECT を**意図して配っていない**。いまこの列を読む経路は全部 admin
--    クライアント（`/mypage` ・ `/u/[id]` ・ `GET /api/jobseeker/experiences`）で、
--    PUT も `.select("id")` しか返さないため権限が要らない。
--    ⚠️★**ブラウザ側（anon / authenticated）から読む必要が出たら、そのとき
--       `grant select (rank_title) on public.ow_experiences to authenticated;`
--       を別の migration で明示的に足すこと。** ここで先回りして配らない
--       （`ow_company_members.approved_at` と同じ扱い）。
--    ⚠️ 配り忘れたまま session クライアントの select に混ぜると、
--       **クエリが丸ごと 403 になり `?? []` で「0件」に化ける。**

do $$
begin
  if not has_column_privilege('authenticated', 'public.ow_experiences', 'rank_title', 'UPDATE') then
    raise exception 'rank_title を authenticated が更新できない。テーブルレベル UPDATE の前提が崩れている';
  end if;
  if not has_column_privilege('authenticated', 'public.ow_experiences', 'rank_title', 'INSERT') then
    raise exception 'rank_title を authenticated が挿入できない。テーブルレベル INSERT の前提が崩れている';
  end if;
  if has_column_privilege('authenticated', 'public.ow_experiences', 'rank_title', 'SELECT') then
    raise exception 'rank_title が authenticated から見えている。列単位 SELECT の前提が崩れている';
  end if;
  if has_column_privilege('anon', 'public.ow_experiences', 'rank_title', 'SELECT') then
    raise exception 'rank_title が anon から見えている';
  end if;
end $$;

-- ⚠️ バックフィルしない。`rank` から文字列を作ると**推測値の投入**になる
--    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
