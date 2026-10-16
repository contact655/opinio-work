-- ★「この会社について」モーダル（新形式 reason_version = 2）の受け皿（2026-10-16 / 柴さんの判断）
--   設計は docs/phase0-reason-modal-20261016.md。回答の単位は会社（その会社でいちばん古い役割の行に保存）。
--
-- ⚠️ 追加のみ。ow_experiences と ow_experience_gaps の列・CHECK・データは触らない。
--    ・旧形式（join_reasons / join_reason_primary / leave_reasons / ow_experience_gaps）はそのまま残す
--    ・新形式の「期待していたこと」は join_reasons に書かない（＝旧の回答を上書きしない）
--      → join_reasons の CHECK は 12 値のまま。「相性のものさし」画面と提案の根拠（shared_motive）は影響を受けない
--    ・新形式の「離れた理由」も leave_reasons に書かない（答え直しで旧の回答が消えるため）。新しい表 ow_experience_leave_reasons に入れる
--
-- ── 権限 ────────────────────────────────────────────────────────────────────
--   6つの表とも RLS 有効・ポリシー0本・anon / authenticated に権限なし（ow_transitions と同じ形）。
--   読み書きは API（service_role）だけ。API が「その職歴が本人のものか」を確かめてから書く。
--   ⚠️ ow_experiences に列を足さないのは、authenticated が UPDATE をテーブル単位で持っており
--      PostgREST から直接書けてしまうため（検証を API の1か所に置けない）。
--
-- 戻し方: drop table public.ow_reason_modal_closes, public.ow_experience_notes, public.ow_experience_leave_reasons,
--                     public.ow_experience_gap_shifts, public.ow_experience_expectations,
--                     public.ow_experience_reviews;

begin;

-- ① 回答の見出し（どの形式で答えたか・合っていたか 0〜10）
create table public.ow_experience_reviews (
  experience_id  uuid primary key references public.ow_experiences(id) on delete cascade,
  /* 1 = 旧形式（2026-10-16 より前の「選んだ理由」）／2 = 新形式（「期待していたこと」） */
  reason_version smallint not null,
  /* C: この会社は、あなたに合っていましたか（0〜10・任意） */
  fit_score      smallint,
  /* 新形式で答えた日時。⚠️ 旧形式は記録が無いので null（推測で埋めない） */
  answered_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ow_experience_reviews_version_check check (reason_version in (1, 2)),
  constraint ow_experience_reviews_fit_check check (fit_score is null or fit_score between 0 and 10),
  constraint ow_experience_reviews_v1_check check (reason_version = 2 or (fit_score is null and answered_at is null)),
  constraint ow_experience_reviews_v2_check check (reason_version = 1 or answered_at is not null)
);

-- ② A: 期待していたこと（選んだ項目）と、実際の評価
create table public.ow_experience_expectations (
  experience_id uuid not null references public.ow_experiences(id) on delete cascade,
  /* ⚠️ src/lib/constants/careerReasons.ts の EXPECTATIONS と同じ15値（並び順もそこが正） */
  reason        text not null,
  is_primary    boolean not null default false,
  /* -2 期待を下回った … 0 期待通り … +2 期待を上回った。null = 未回答 */
  rating        smallint,
  created_at    timestamptz not null default now(),
  primary key (experience_id, reason),
  constraint ow_experience_expectations_reason_check check (reason in (
    'job_content','customer','position','autonomy','skills','next_career','management',
    'people','culture','salary','evaluation','work_style','growth','stability','personal')),
  constraint ow_experience_expectations_rating_check check (rating is null or rating between -2 and 2),
  /* 「タイミング・個人の事情」は評価を聞かない */
  constraint ow_experience_expectations_personal_check check (reason <> 'personal' or rating is null)
);
/* いちばん期待していたことは1つまで。⚠️ 3つまで・2つ以上ならいちばんが必須、は API で見る（件数の制約は DB に置かない） */
create unique index ow_experience_expectations_one_primary
  on public.ow_experience_expectations (experience_id) where is_primary;

-- ③ B: 入社前の想像と比べて、どちらにずれたか（共通6項目・任意）
create table public.ow_experience_gap_shifts (
  experience_id uuid not null references public.ow_experiences(id) on delete cascade,
  /* ⚠️ eval_basis（評価の基準）と client_size（顧客の規模）は旧の evaluation / client_quality とは別の問い */
  axis          text not null,
  /* -2 左の端 … 0 想像通り … +2 右の端（左右の言葉は careerReasons.ts の GAP_SHIFT_AXES）
       autonomy       大きかった ↔ 小さかった
       onboarding     手厚かった ↔ 少なかった
       work_hours     長かった ↔ 短かった
       eval_basis     数字重視 ↔ 過程も見る
       decision_speed 速かった ↔ 遅かった
       client_size    大手中心 ↔ 中小中心 */
  value         smallint not null,
  created_at    timestamptz not null default now(),
  primary key (experience_id, axis),
  constraint ow_experience_gap_shifts_axis_check check (axis in (
    'autonomy','onboarding','work_hours','eval_basis','decision_speed','client_size')),
  constraint ow_experience_gap_shifts_value_check check (value between -2 and 2)
);

-- ②' 離れた理由（新形式）。選択肢は今の退職理由のまま（LEAVE_REASONS の13値）・複数選択・任意
--     ⚠️ 終了した会社だけ・3つまで、は API で見る（終了かどうかは ow_experiences の列なので DB の CHECK では書けない）
create table public.ow_experience_leave_reasons (
  experience_id uuid not null references public.ow_experiences(id) on delete cascade,
  reason        text not null,
  created_at    timestamptz not null default now(),
  primary key (experience_id, reason),
  constraint ow_experience_leave_reasons_reason_check check (reason in (
    'job_content','skills','autonomy','position','people','culture','management',
    'salary','evaluation','work_style','growth','restructure','personal'))
);

-- ④ D: ひとこと（任意・80字）。★他の利用者には表示しない（規約の改定まで）。運営の確認状態つき
create table public.ow_experience_notes (
  experience_id uuid primary key references public.ow_experiences(id) on delete cascade,
  /* wish_known 入る前に知りたかったのは… ／ fits_who 合うのは、…な人 ／ pleasant_surprise 意外と良かったのは… */
  prompt        text not null,
  body          text not null,
  /* 本文を変えたら API が pending に戻す */
  status        text not null default 'pending',
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.ow_users(id) on delete set null,
  /* ★他の利用者への表示に同意したか（任意）。⚠️ 同意していないひとことは、規約改定後も表示しない
       同意した日時と、そのとき画面に出ていた文言の版（careerReasons.ts の NOTE_CONSENT_VERSION）を一緒に持つ。
       取り消したら3つとも外す（false / null / null） */
  display_consent       boolean not null default false,
  display_consented_at  timestamptz,
  display_consent_version smallint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ow_experience_notes_prompt_check check (prompt in ('wish_known','fits_who','pleasant_surprise')),
  constraint ow_experience_notes_body_check check (char_length(btrim(body)) between 1 and 80),
  constraint ow_experience_notes_status_check check (status in ('pending','approved','rejected')),
  constraint ow_experience_notes_review_check check ((status = 'pending') = (reviewed_at is null)),
  constraint ow_experience_notes_consent_check check (
    (display_consent and display_consented_at is not null and display_consent_version is not null)
    or (not display_consent and display_consented_at is null and display_consent_version is null))
);

-- ⑤ 計測: 「あとで答える」と × で閉じたとき、どのステップだったか
create table public.ow_reason_modal_closes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.ow_users(id) on delete cascade,
  /* 職歴を消しても件数は残す */
  experience_id  uuid references public.ow_experiences(id) on delete set null,
  step           text not null,
  via            text not null,
  created_at     timestamptz not null default now(),
  constraint ow_reason_modal_closes_step_check check (step in ('step1','step2')),
  constraint ow_reason_modal_closes_via_check check (via in ('later','close'))
);
create index ow_reason_modal_closes_created_idx on public.ow_reason_modal_closes (created_at);

-- 権限（6表とも同じ）
alter table public.ow_experience_reviews      enable row level security;
alter table public.ow_experience_expectations enable row level security;
alter table public.ow_experience_gap_shifts   enable row level security;
alter table public.ow_experience_leave_reasons enable row level security;
alter table public.ow_experience_notes        enable row level security;
alter table public.ow_reason_modal_closes     enable row level security;
revoke all on public.ow_experience_reviews, public.ow_experience_expectations, public.ow_experience_gap_shifts,
              public.ow_experience_leave_reasons, public.ow_experience_notes, public.ow_reason_modal_closes from anon, authenticated;
grant all on public.ow_experience_reviews, public.ow_experience_expectations, public.ow_experience_gap_shifts,
             public.ow_experience_leave_reasons, public.ow_experience_notes, public.ow_reason_modal_closes to service_role;

-- ⑥ 旧形式の回答に reason_version = 1 の印を付ける（★新しい表への INSERT だけ。ow_experiences は UPDATE しない）
--    対象 = 入社理由・離れた理由・ギャップのどれかがある職歴（hasReasonAnswers と同じ条件）。2026-10-16 実測 26行（うち is_test 5）
do $$
declare v_expected int; v_inserted int;
begin
  select count(*) into v_expected from public.ow_experiences x
   where x.join_reasons is not null or x.leave_reasons is not null
      or exists (select 1 from public.ow_experience_gaps g where g.experience_id = x.id);
  if v_expected < 26 or v_expected > 40 then
    raise exception '旧形式の回答の件数が想定と違う（% 行）。中止', v_expected;
  end if;
  insert into public.ow_experience_reviews (experience_id, reason_version)
  select x.id, 1 from public.ow_experiences x
   where x.join_reasons is not null or x.leave_reasons is not null
      or exists (select 1 from public.ow_experience_gaps g where g.experience_id = x.id);
  get diagnostics v_inserted = row_count;
  if v_inserted <> v_expected then
    raise exception '印を付けた件数（%）が対象（%）と違う。中止', v_inserted, v_expected;
  end if;
end $$;

-- 検算: 6表とも anon / authenticated から読めない
do $$
declare t text;
begin
  foreach t in array array['ow_experience_reviews','ow_experience_expectations','ow_experience_gap_shifts',
                           'ow_experience_leave_reasons','ow_experience_notes','ow_reason_modal_closes'] loop
    if has_table_privilege('anon', 'public.'||t, 'SELECT') or has_table_privilege('authenticated', 'public.'||t, 'SELECT')
       or has_table_privilege('authenticated', 'public.'||t, 'INSERT') then
      raise exception '% に anon / authenticated の権限が残っている', t;
    end if;
  end loop;
end $$;

commit;
