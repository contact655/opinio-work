-- ★求人の労働条件（法律で明示が必要な項目）を持てるようにする（2026-10-11 / 柴さんの指示）
--
-- 根拠: 職業安定法 第5条の3・施行規則 第4条の2（募集時の労働条件の明示）。
--       2024年4月の改正で「就業場所・業務の変更の範囲」「有期契約の更新上限」が加わった。
-- 選択肢は厚生労働省の労働条件通知書（モデル様式）の言い方に合わせた。
--
-- ⚠️ 追加だけ。既存の行は1つも変えない（全部 NULL のまま）。既に公開中の求人は自動で下ろさず、
--    運営の画面で「要対応」として出す。
-- ⚠️★選択肢は src/lib/jobs/laborTerms.ts と同じ値。片方だけ変えないこと（UI・API・DB の CHECK を揃える）。
-- ⚠️ ow_jobs の GRANT はテーブル単位（列単位ではない）ので、列を足しても GRANT は要らない。
--    適用後に has_column_privilege で確かめる（下）。
-- 作業前ダンプ: .dumps/20261011-1606-ow_jobs.sql（26行）

alter table public.ow_jobs
  add column if not exists contract_period text
    constraint ow_jobs_contract_period_check check (contract_period in ('indefinite','fixed')),
  add column if not exists contract_period_detail text,
  add column if not exists contract_renewal text
    constraint ow_jobs_contract_renewal_check check (contract_renewal in ('auto','possible','none')),
  add column if not exists contract_renewal_limit text,
  add column if not exists workplace_change_scope text
    constraint ow_jobs_workplace_change_scope_check check (workplace_change_scope in ('none','company')),
  add column if not exists workplace_change_note text,
  add column if not exists duties_change_scope text
    constraint ow_jobs_duties_change_scope_check check (duties_change_scope in ('none','company')),
  add column if not exists duties_change_note text,
  add column if not exists break_time text,
  add column if not exists overtime text
    constraint ow_jobs_overtime_check check (overtime in ('yes','no')),
  add column if not exists fixed_overtime text
    constraint ow_jobs_fixed_overtime_check check (fixed_overtime in ('yes','no')),
  add column if not exists fixed_overtime_hours numeric(5,1)
    constraint ow_jobs_fixed_overtime_hours_check check (fixed_overtime_hours > 0),
  add column if not exists fixed_overtime_pay integer
    constraint ow_jobs_fixed_overtime_pay_check check (fixed_overtime_pay > 0),
  add column if not exists social_insurance text[]
    constraint ow_jobs_social_insurance_check check (social_insurance <@ array['health','pension','employment','workers_comp']::text[]),
  add column if not exists smoking_measure text
    constraint ow_jobs_smoking_measure_check check (smoking_measure in ('indoor_ban','indoor_ban_with_room','other')),
  add column if not exists smoking_note text;

comment on column public.ow_jobs.contract_period is '契約期間: indefinite=期間の定めなし / fixed=期間の定めあり（職安法5条の3）';
comment on column public.ow_jobs.contract_renewal is '有期のときの更新: auto=自動的に更新 / possible=更新する場合があり得る / none=更新しない';
comment on column public.ow_jobs.contract_renewal_limit is '有期のときの更新上限（通算期間・回数）。自由記述';
comment on column public.ow_jobs.workplace_change_scope is '就業場所の変更の範囲: none=変更なし / company=会社の定める場所（テレワークを行う場所を含む）';
comment on column public.ow_jobs.duties_change_scope is '業務の変更の範囲: none=変更なし / company=会社の定める業務';
comment on column public.ow_jobs.break_time is '休憩時間。自由記述（始業・終業時刻は work_hours）';
comment on column public.ow_jobs.overtime is '時間外労働の有無: yes / no';
comment on column public.ow_jobs.fixed_overtime is '固定残業代の有無: yes / no。yes なら時間と金額（円/月）を持つ';
comment on column public.ow_jobs.social_insurance is '加入する社会保険: health / pension / employment / workers_comp';
comment on column public.ow_jobs.smoking_measure is '受動喫煙防止の措置: indoor_ban=屋内禁煙 / indoor_ban_with_room=屋内原則禁煙（喫煙専用室あり） / other=その他（smoking_note に内容）';

-- 検算: 既存の行は全部 NULL のまま
do $$
declare n int;
begin
  select count(*) into n from public.ow_jobs
   where contract_period is not null or workplace_change_scope is not null or social_insurance is not null or smoking_measure is not null;
  if n <> 0 then raise exception '想定外: 既存の行に値が入っている (%件)', n; end if;
  if not has_column_privilege('authenticated', 'public.ow_jobs', 'smoking_measure', 'UPDATE') then
    raise exception 'authenticated が新しい列を更新できない';
  end if;
  if not has_column_privilege('authenticated', 'public.ow_jobs', 'smoking_measure', 'SELECT') then
    raise exception 'authenticated が新しい列を読めない';
  end if;
end $$;
