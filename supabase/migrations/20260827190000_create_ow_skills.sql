-- ═══════════════════════════════════════════════════════════════════════════
-- 標準スキルのマスタ ow_skills を作る（2026-08-27）
--
-- 背景と方針は docs/phase0-skills-20260827.md。
-- 語彙は3層で、**`/search` の解決先になるのはこのマスタだけ**:
--   ① 標準スキル（このテーブル。運営が管理）
--   ② 利用者の自由入力（溜めるだけ・検索には効かない）… ★まだ作らない
--   ③ 運営が汎用的なものを①へ昇格
-- 職種で `ow_company_job_roles` → `ow_role_aliases` をやったのと同じ形。
--
-- ── ★職種マスタと重複する語を入れないこと ──────────────────────────────────
-- 「法人営業」「インサイドセールス」のような**職種で表現できる語は入れない**。
-- ここに置くのは職種では表せないもの:
--   プロダクト・ツール / 手法・型 / 売り先ドメイン
-- ⚠️ **語学は入れない。** `ow_user_languages`（2026-08-24）が
--    習熟度（native/full/professional/limited/elementary）まで持っており、
--    重ねると入力欄が2つになる。
--
-- ── 初期投入 ────────────────────────────────────────────────────────────────
-- `ow_tool_masters`（78行）から **48行**だけ取り込む。
--   取り込む: dev 23 / data 8 / marketing 7 / crm 5 / sales 3 ＝ 46
--            ＋ other から Splunk と Okta の2行
--   ⚠️ **取り込まない30行**: communication 7 / email 2 / calendar 2 /
--      ai 6 / other の汎用オフィス13（Notion / Asana / Jira / Confluence /
--      Microsoft 365 / Google Workspace / Backlog / Monday.com / Garoon /
--      CrowdStrike / Palo Alto Networks / Zscaler / KnowBe4）。
--      **全員が使うもの・企業が導入するもので、検索の語彙にならない。**
--      削除済みの旧スキルにも `Word` `Excel` `PowerPoint` が入っていて
--      同じ問題を起こしていた（docs/phase0-skills-20260827.md §2）。
--
-- ⚠️ 「手法・型」「売り先ドメイン」の行は**このコミットでは作らない**（別途決める）。
--    CHECK には値を用意してあるので、後から INSERT するだけで足せる。
--
-- ── `tool_id` の意味 ────────────────────────────────────────────────────────
-- ★**ツールに対応する行にだけ入れる。ツール以外のスキル（手法・売り先）は NULL。**
-- これがあると「Salesforce を使っている企業」（ow_company_tools）と
-- 「Salesforce を使えるスキル」が**同じ `ow_tool_masters.id` で辿れる**。
-- ⚠️ `ON DELETE SET NULL`。ツールのマスタ行が消えても**スキルは残す**
--    （人が「持っている」と申告した事実は、企業側の都合で消さない）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

create table public.ow_skills (
  id uuid primary key default gen_random_uuid(),

  -- 表示名。⚠️ UNIQUE。`/search` はこの綴りで引く
  label text not null unique,

  /* 区分。⚠️ UI / API / DB の CHECK の3つを揃える方針に従い CHECK を張る。
     値を足すときは lib 側の定数も同時に直すこと。
     ⚠️ `sales_domain` は「売り先の業界」。`ow_business_domains`（企業の事業領域）
        とは**別物**。`domain` という名前にすると必ず混同されるので避けている。 */
  category text not null
    check (category in ('product', 'method', 'sales_domain')),

  /* 別名。`ow_tool_masters.aliases` と同じ形（テーブル内の text[]）。
     ⚠️ 職種は別テーブル（`ow_role_aliases`）だが、こちらは件数が桁違いに少なく、
        マスタと1対1で動くので配列で持つ。ツールから引き継げる利点もある。 */
  aliases text[] not null default '{}',

  is_active boolean not null default true,
  sort_order integer not null default 0,

  /* ★ツールに対応する行だけ埋める。手法・売り先ドメインは NULL。 */
  tool_id uuid references public.ow_tool_masters(id) on delete set null,

  created_at timestamptz not null default now()
);

comment on table public.ow_skills is
  '標準スキルのマスタ。/search の解決先になるのはここだけ。運営が管理する（RLS で書き込みは auth_is_admin のみ）。';
comment on column public.ow_skills.category is
  'product=プロダクト・ツール / method=手法・型 / sales_domain=売り先の業界。⚠️ sales_domain は ow_business_domains（企業の事業領域）とは別物。';
comment on column public.ow_skills.tool_id is
  'ツールに対応する行だけ ow_tool_masters を指す。手法・売り先ドメインは NULL。企業の導入ツールと同じ ID で辿るためのもの。';

create index ow_skills_category_idx on public.ow_skills (category, sort_order);
create index ow_skills_tool_id_idx  on public.ow_skills (tool_id) where tool_id is not null;

-- ── 権限。★`ow_tool_masters` と同じ形 ──────────────────────────────────────
-- 読みは誰でも（マスタなので隠す理由が無い）。書き込みは RLS で運営だけに絞る。
-- ⚠️ `authenticated` から GRANT を剥がさないこと。**運営も authenticated ロールで来る**
--    ので、剥がすと RLS まで到達せず運営でも書けなくなる（CLAUDE.md）。
alter table public.ow_skills enable row level security;

grant select on public.ow_skills to anon;
grant select, insert, update, delete on public.ow_skills to authenticated;

create policy "public read skills"
  on public.ow_skills for select using (true);
create policy "admins manage skills"
  on public.ow_skills for all using (auth_is_admin());

-- ── 初期投入 ────────────────────────────────────────────────────────────────
insert into public.ow_skills (label, category, aliases, sort_order, tool_id)
select t.name, 'product', t.aliases, t.sort_order, t.id
  from public.ow_tool_masters t
 where t.category in ('dev', 'data', 'marketing', 'crm', 'sales')
    or t.name in ('Splunk', 'Okta');

-- ── 検証。★「エラーが出なかった」を成功にしない ────────────────────────────
DO $$
DECLARE
  v_total    int;
  v_with_tool int;
  v_leaked   text;
  v_mismatch text;
BEGIN
  SELECT count(*) INTO v_total FROM public.ow_skills;
  IF v_total <> 48 THEN RAISE EXCEPTION 'ow_skills が % 行（48 のはず）。中止', v_total; END IF;

  -- ★全行がツール由来なので tool_id は全部埋まっているはず
  SELECT count(*) INTO v_with_tool FROM public.ow_skills WHERE tool_id IS NOT NULL;
  IF v_with_tool <> 48 THEN RAISE EXCEPTION 'tool_id が % 行しか埋まっていない（48 のはず）。中止', v_with_tool; END IF;

  -- ★取り込まないと決めた行が紛れていないこと（ラベルで確認）
  SELECT string_agg(label, ', ') INTO v_leaked FROM public.ow_skills
   WHERE label IN ('Slack','Microsoft Teams','Zoom','Google Meet','Chatwork','LINE WORKS','Webex',
                   'Gmail','Outlook','Google カレンダー','Outlook カレンダー',
                   'ChatGPT','Claude','Claude Code','GitHub Copilot','Cursor','Gemini',
                   'Notion','Asana','Jira','Confluence','Microsoft 365','Google Workspace',
                   'Backlog','Monday.com','Garoon','CrowdStrike','Palo Alto Networks',
                   'Zscaler','KnowBe4');
  IF v_leaked IS NOT NULL THEN RAISE EXCEPTION '取り込まない行が入っている: %。中止', v_leaked; END IF;

  -- ★ラベルが元のツール名と1対1で対応していること（取りこぼし・ズレの検出）
  SELECT string_agg(x.name, ', ') INTO v_mismatch FROM (
    SELECT t.name FROM public.ow_tool_masters t
     WHERE (t.category IN ('dev','data','marketing','crm','sales') OR t.name IN ('Splunk','Okta'))
       AND NOT EXISTS (SELECT 1 FROM public.ow_skills s WHERE s.label = t.name AND s.tool_id = t.id)
  ) x;
  IF v_mismatch IS NOT NULL THEN RAISE EXCEPTION '対応していないツール: %。中止', v_mismatch; END IF;

  RAISE NOTICE '完了: ow_skills % 行 / tool_id 埋まり % 行', v_total, v_with_tool;
END $$;

COMMIT;
