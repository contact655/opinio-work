-- ★「入社前の想像と比べて」の6項目を差し替え、2項目を足して8項目にする（2026-10-16 / 柴さんの判断）。
--
-- 片方の端が良いほうに聞こえる言い方（手厚い／少ない・速い／遅い・過程「も」見る）は答えを誘導するので、
-- 左右どちらも良し悪しを含まない項目に入れ替えた。言葉は src/lib/constants/careerReasons.ts の GAP_SHIFT_AXES。
--
--   旧                         新
--   autonomy       任される範囲        → work_process   仕事の進め方   決まった型で進める ↔ 自分で決めて進める
--   onboarding     教育・オンボーディング → ramp_up       立ち上がりの支え方 自分で調べて覚える ↔ 研修・OJTで教わる
--   eval_basis     評価の基準          → eval_style     評価のされ方   成果の数字が中心 ↔ 行動やプロセスが中心
--   decision_speed 意思決定のスピード    → decision_style 物事の決め方   上が決める ↔ 話し合って決める
--   work_hours     労働時間            → work_hours     労働時間      短かった ↔ 長かった（★向きを逆にした）
--   client_size    顧客の規模          → change_pace    変化の多さ    落ち着いている ↔ 方針や組織がよく変わる
--   （新規）                          → english_use    英語を使う場面 ほぼ使わない ↔ 日常的に使う
--   （新規）                          → role_boundary  役割の線引き   はっきり分かれている ↔ 兼務・越境が多い
--
-- ⚠️ work_hours はキーを残して向きを逆にした（旧は 長かった ↔ 短かった）。回答0件なので読み替える行は無い。
-- ⚠️ 適用前の実測（2026-10-16 / 本番）: ow_experience_gap_shifts は 0 行。1行でもあれば止める。
--
-- 戻し方（新しいキーの行が無いときだけ）: 下の CHECK を旧の6キーで張り直す。

begin;

do $$
begin
  if (select count(*) from public.ow_experience_gap_shifts) > 0 then
    raise exception 'ow_experience_gap_shifts に行がある。キーの読み替えを決めてから当てること';
  end if;
end $$;

alter table public.ow_experience_gap_shifts drop constraint ow_experience_gap_shifts_axis_check;
alter table public.ow_experience_gap_shifts add constraint ow_experience_gap_shifts_axis_check check (axis in (
  'work_process','ramp_up','eval_style','decision_style','work_hours','change_pace',
  'english_use','role_boundary'));

comment on column public.ow_experience_gap_shifts.value is
  '-3 左の端 … 0 想像通り … +3 右の端。左右の言葉は careerReasons.ts の GAP_SHIFT_AXES（2026-10-16 に8項目へ差し替え）';

commit;
