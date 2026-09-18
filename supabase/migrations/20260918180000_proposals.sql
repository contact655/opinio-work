-- ═══════════════════════════════════════════════════════════════════════════
-- 根拠つき提案（②⑨④）の受け皿を作る（2026-09-18）
--
-- ⚠️ **追加のみ。** 既存の表・列・ポリシー・GRANT には一切触れない。
--
-- ── ★2表に分けた理由（列単位 GRANT では守れないため）──────────────────────
-- 「**求職者の見送り理由は企業に渡さない**」という約束は、
-- **列の権限では表現できない。** 本人も企業の管理者も同じ `authenticated` ロールで
-- 来るので、GRANT（ロール単位）では「企業にはこの行を見せるが、この列は見せない」が
-- 書けない。RLS は行単位なので、**理由を別の行に切り出せば**表現できる。
--   → `ow_proposal_declines` が `side`（candidate / company）を持ち、
--     RLS で「自分の side の行だけ」に絞る。
-- ⚠️★**見送り理由を `ow_proposals` の列に戻さないこと。** 戻した瞬間、
--    約束の担保が「画面ごとの実装」に落ちる（CLAUDE.md: `visibility_company` を
--    企業向けの画面が見落とす不具合を1か月で3件直している）。
--
-- ── ★製品のルールを CHECK にした ───────────────────────────────────────────
--   ・根拠が2件未満の組み合わせは提案に出さない → `evidence_min_2`
--   ・反証は必ず1件以上（出せないときは kind:'unknown'）→ `counter_min_1`
-- ⚠️ アプリ側（`isProposable` / `buildCounterEvidence`）と**二重管理**になるが、
--    これは意図的。**アプリを1行変えただけで約束が消えることを防ぐ。**
--
-- ── ★RLS は操作ごとに分ける。`FOR ALL` を使わない ──────────────────────────
-- 形は `ow_user_skills`（20260827200000）に揃えた。
-- ⚠️★**INSERT / UPDATE / DELETE は誰にも配らない**（`authenticated` は SELECT のみ）。
--    理由: 企業の管理者と候補者が同じロールなので、UPDATE を配ると
--    **企業が候補者の返答列を上書きできてしまう**（行は同じなので RLS で分けられない）。
--    書き込みは API ルート（service_role）だけを通す。
--    ⚠️ 将来 INSERT を配るなら、WITH CHECK で `side` と本人性を縛ること。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① 提案本体 ─────────────────────────────────────────────────────────────

create table public.ow_proposals (
  id uuid primary key default gen_random_uuid(),

  /* ⚠️★**ow_users.id 空間**（`auth.uid()` ではない）。列名で示している。
        CLAUDE.md「引数名でどちらの空間かを示す」と同じ趣旨。 */
  candidate_user_id uuid not null references public.ow_users(id)     on delete cascade,
  company_id        uuid not null references public.ow_companies(id) on delete cascade,
  /* 求人起点の提案のときだけ入る。⚠️ 求人が消えても提案は残す（set null） */
  job_id            uuid references public.ow_jobs(id) on delete set null,

  /* ── ★スナップショット ──────────────────────────────────────────────────
     ⚠️★**表示のたびに再計算しないこと。** 提案から面談までの間に在籍者が増減すると、
        候補者に見せた数字と後から見る数字が食い違う。
     ⚠️ `ow_transitions` は洗い替えで DELETE されるので、参照では復元できない。 */
  evidence         jsonb not null,
  counter_evidence jsonb not null,
  computed_at      timestamptz not null default now(),

  /* ── 双方の意思（③の双方合意がこの上に乗る。今回は状態を持つだけ）────────
     ⚠️ `null` = まだ答えていない。「答えていない」を「見送った」にしないこと。 */
  candidate_response     text,
  candidate_responded_at timestamptz,
  company_response       text,
  company_responded_at   timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* ⚠️ `nulls not distinct` が要る。既定では job_id が NULL の行が重複して入る
        （PostgreSQL 15+）。同じ候補者×企業×求人の提案は1つ。 */
  constraint ow_proposals_unique unique nulls not distinct (candidate_user_id, company_id, job_id),

  /* ★製品のルール。アプリと二重管理なのは意図的（冒頭を参照） */
  constraint evidence_min_2 check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) >= 2),
  constraint counter_min_1  check (jsonb_typeof(counter_evidence) = 'array' and jsonb_array_length(counter_evidence) >= 1),

  /* 3層のうち DB。語彙は `lib/constants/proposalResponses.ts` と揃える */
  constraint candidate_response_check check (candidate_response is null or candidate_response in ('interested', 'declined')),
  constraint company_response_check   check (company_response   is null or company_response   in ('want_to_meet', 'declined')),

  /* ⚠️ 返答と日時はセット。片方だけ入った行を作らない */
  constraint candidate_response_at check ((candidate_response is null) = (candidate_responded_at is null)),
  constraint company_response_at   check ((company_response   is null) = (company_responded_at   is null))
);

comment on table public.ow_proposals is
  '根拠つき提案（②⑨）。evidence / counter_evidence は作成時点のスナップショットで、表示のたびに再計算しない。⚠ 見送り理由は ow_proposal_declines（列単位 GRANT では「求職者の理由を企業に渡さない」が表現できないため別表）。⚠ 書き込みは API（service_role）のみ。';
comment on column public.ow_proposals.candidate_user_id is '★ow_users.id 空間（auth.uid() ではない）';
comment on column public.ow_proposals.evidence is '作成時点の根拠のスナップショット（Evidence[]）。⚠ 2件以上（CHECK evidence_min_2）。再計算しない';
comment on column public.ow_proposals.counter_evidence is '作成時点の反証（CounterEvidence[]）。⚠ 1件以上（CHECK counter_min_1）。出せないときは kind:''unknown''';

create index ow_proposals_candidate_idx on public.ow_proposals (candidate_user_id, created_at desc);
create index ow_proposals_company_idx   on public.ow_proposals (company_id, created_at desc);

-- ── ② 見送り理由 ───────────────────────────────────────────────────────────

create table public.ow_proposal_declines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ow_proposals(id) on delete cascade,

  /* ★どちら側が見送ったか。**この列が「渡さない」の担保**（RLS がここで絞る） */
  side text not null,
  /* ⚠️ 1つだけ。配列にしないこと（いちばんの理由が取れなくなる） */
  reason text not null,
  /* 任意の自由記述1行 */
  note text,

  created_at timestamptz not null default now(),

  /* 1提案 × 1side につき1件 */
  constraint ow_proposal_declines_unique unique (proposal_id, side),

  constraint side_check check (side in ('candidate', 'company')),

  /* ★side ごとに許容値が違う。語彙は `lib/constants/declineReasons.ts` と揃える。
     ⚠️ 片方の選択肢をもう片方に保存できないようにしている。
     ⚠️ 共通スラッグは salary / timing / location / other の4つ（軸を突き合わせるため）。 */
  constraint reason_check check (
    (side = 'candidate' and reason in (
      'job_content', 'salary', 'work_style', 'location', 'phase', 'known', 'timing', 'other'))
    or
    (side = 'company' and reason in (
      'experience', 'role', 'salary', 'location', 'timing', 'other'))
  ),

  /* ⚠️ `DECLINE_NOTE_MAX` と同じ値。片方だけ変えないこと */
  constraint note_length check (note is null or char_length(note) <= 200)
);

comment on table public.ow_proposal_declines is
  '提案の見送り理由（④）。⚠★side で行を分けているのは「求職者の理由を企業に渡さない」を構造で担保するため（列単位 GRANT では本人と企業管理者がどちらも authenticated なので表現できない）。⚠ 選択肢は lib/constants/declineReasons.ts と CHECK の2層で揃える。';
comment on column public.ow_proposal_declines.side is '★どちら側が見送ったか。RLS がこの列で絞る。相手の side の行は読めない';

create index ow_proposal_declines_proposal_idx on public.ow_proposal_declines (proposal_id);
create index ow_proposal_declines_reason_idx   on public.ow_proposal_declines (side, reason);

-- ── ③ RLS / GRANT ──────────────────────────────────────────────────────────

alter table public.ow_proposals          enable row level security;
alter table public.ow_proposal_declines  enable row level security;

/* ★anon には配らない。authenticated は **SELECT のみ**（冒頭の理由を参照）。
   ⚠️ authenticated から剥がさないこと。運営も authenticated ロールで来る。 */
grant select on public.ow_proposals         to authenticated;
grant select on public.ow_proposal_declines to authenticated;

-- 提案: 本人 / その企業の有効な管理者 / 運営 が読める
create policy "ow_proposals_select_own" on public.ow_proposals for select
  using (candidate_user_id = public.auth_ow_user_id());

create policy "ow_proposals_select_company" on public.ow_proposals for select
  using (public.auth_is_company_admin(company_id));

create policy "ow_proposals_select_admin" on public.ow_proposals for select
  using (public.auth_is_admin());

/* ★見送り理由: **自分の side の行しか読めない。**
   ⚠️ ここが「相手に渡さない」の実体。片方だけ緩めないこと。 */
create policy "ow_proposal_declines_select_own" on public.ow_proposal_declines for select
  using (
    side = 'candidate'
    and exists (
      select 1 from public.ow_proposals p
       where p.id = ow_proposal_declines.proposal_id
         and p.candidate_user_id = public.auth_ow_user_id()
    )
  );

create policy "ow_proposal_declines_select_company" on public.ow_proposal_declines for select
  using (
    side = 'company'
    and exists (
      select 1 from public.ow_proposals p
       where p.id = ow_proposal_declines.proposal_id
         and public.auth_is_company_admin(p.company_id)
    )
  );

create policy "ow_proposal_declines_select_admin" on public.ow_proposal_declines for select
  using (public.auth_is_admin());

-- ── ④ 検証。★「エラーが出なかった」を成功にしない ──────────────────────────
DO $$
DECLARE
  v_pol int; v_anon boolean; v_auth_sel boolean; v_auth_ins boolean; v_id uuid; v_ok boolean;
BEGIN
  -- RLS が有効か
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'ow_proposals') THEN
    RAISE EXCEPTION 'ow_proposals の RLS が無効。中止'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'ow_proposal_declines') THEN
    RAISE EXCEPTION 'ow_proposal_declines の RLS が無効。中止'; END IF;

  -- ポリシーは SELECT だけ、各3本
  SELECT count(*) INTO v_pol FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_proposals';
  IF v_pol <> 3 THEN RAISE EXCEPTION 'ow_proposals のポリシーが % 本（3本のはず）。中止', v_pol; END IF;
  SELECT count(*) INTO v_pol FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_proposal_declines';
  IF v_pol <> 3 THEN RAISE EXCEPTION 'declines のポリシーが % 本（3本のはず）。中止', v_pol; END IF;

  -- ★FOR ALL を使っていないこと（polcmd = '*' が無いこと）
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
              WHERE c.relname IN ('ow_proposals','ow_proposal_declines') AND p.polcmd = '*') THEN
    RAISE EXCEPTION 'FOR ALL のポリシーがある。操作ごとに分けること。中止'; END IF;

  -- GRANT: anon は読めない / authenticated は SELECT だけ
  FOR v_anon, v_auth_sel, v_auth_ins IN
    SELECT has_table_privilege('anon', t, 'SELECT'),
           has_table_privilege('authenticated', t, 'SELECT'),
           has_table_privilege('authenticated', t, 'INSERT')
      FROM (VALUES ('public.ow_proposals'), ('public.ow_proposal_declines')) v(t)
  LOOP
    IF v_anon THEN RAISE EXCEPTION 'anon が SELECT できてしまう。中止'; END IF;
    IF NOT v_auth_sel THEN RAISE EXCEPTION 'authenticated が SELECT できない。運営も読めなくなる。中止'; END IF;
    IF v_auth_ins THEN RAISE EXCEPTION 'authenticated に INSERT が付いている。書き込みは API だけ。中止'; END IF;
  END LOOP;

  -- ★CHECK が本当に効くかを実データで試す（入れて→落ちることを確かめて→消す）
  SELECT id INTO v_id FROM public.ow_users LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'ow_users が空。検証できない。中止'; END IF;

  -- 根拠1件は弾かれるはず
  BEGIN
    INSERT INTO public.ow_proposals (candidate_user_id, company_id, evidence, counter_evidence)
    VALUES (v_id, (SELECT id FROM public.ow_companies LIMIT 1), '[{"kind":"talkable"}]'::jsonb, '[{"kind":"unknown"}]'::jsonb);
    RAISE EXCEPTION '根拠1件の行が入ってしまった。evidence_min_2 が効いていない。中止';
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;

  -- 反証0件は弾かれるはず
  BEGIN
    INSERT INTO public.ow_proposals (candidate_user_id, company_id, evidence, counter_evidence)
    VALUES (v_id, (SELECT id FROM public.ow_companies LIMIT 1), '[{"kind":"a"},{"kind":"b"}]'::jsonb, '[]'::jsonb);
    RAISE EXCEPTION '反証0件の行が入ってしまった。counter_min_1 が効いていない。中止';
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;

  IF NOT v_ok THEN RAISE EXCEPTION '検証が走っていない。中止'; END IF;
  RAISE NOTICE '完了: 2表 / ポリシー各3本(SELECT のみ) / anon なし / authenticated は SELECT のみ / CHECK 2本が実際に弾いた';
END $$;

COMMIT;
