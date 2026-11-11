-- ★「相談可能なユーザー」を本人がマイページからオンにできる形にする（2026-11-12 / 柴さんの決定「誰でも」）
--
-- それまで（20261112090000）は運営が登録・同意を記録・承認していた。これを次の形に変える:
--   本人がオン … 行を作る（無ければ）か is_listed = true にし、同意の記録を「本人がマイページで設定（self）」で自動で入れる
--   本人がオフ … is_listed = false（同意の記録は残す）
--   運営が停止 … stopped_at を入れて is_listed = false。停止中は本人がオンにできない（解除で元に戻せるようになる）
--
-- 変更:
--   ① consent_method の選択肢に 'self' を足す（CHECK を張り替える）
--   ② 「掲載には運営の承認が要る」制約（listed_requires_approval）を外す。承認の列（approved_at / approved_by）は残す（使わない）
--   ③ 停止の列（stopped_at / stopped_by / stop_reason）を足し、停止中は掲載できない制約を足す
--   ⚠️ 「掲載には同意の記録が要る」（consent_required）と「日時と方法はそろえる」（consent_pair）は残す
--
-- ⚠️ 2026-10-16 に撤去した「面談OK」と同じく、利用者が自分でオンにする形になる（柴さんが承知のうえで決めた）。
--    運営は止められる（③）。
-- ⚠️ 選択肢は src/lib/constants/careerRoutes.ts の CONSULTANT_CONSENT_METHODS と同じ（テストが突き合わせる）。
--    転職ルートの経験者（ow_route_hosts）の選択肢には 'self' を足さない（あちらは運営が確認する）。
-- ⚠️ 既存の行: 2026-11-12 時点で 0 行。下の検算で、適用前に制約を破る行が無いことを確かめる。
--
-- 権限は変えない（anon / authenticated に権限なし。書くのはサーバーの admin クライアントだけ）。
--
-- 戻し方:
--   alter table public.ow_featured_consultants
--     drop constraint ow_featured_consultants_stopped_not_listed,
--     drop column stop_reason, drop column stopped_by, drop column stopped_at,
--     drop constraint ow_featured_consultants_consent_method_check,
--     add constraint ow_featured_consultants_consent_method_check
--       check (consent_method is null or consent_method in ('email', 'line', 'meeting', 'other')),
--     add constraint ow_featured_consultants_listed_requires_approval check (is_listed = false or approved_at is not null);
--   （'self' の行があると戻せない。先にその行を消すか is_listed を倒す）

begin;

-- ★検算: 適用前の行数（0 のはず。行があっても壊れないが、想定と違うので止める）
do $$
declare n integer;
begin
  select count(*) into n from public.ow_featured_consultants;
  if n > 0 then
    raise exception 'ow_featured_consultants に % 行ある（想定は0行）。中身を確かめてから当てること', n;
  end if;
end $$;

alter table public.ow_featured_consultants
  drop constraint ow_featured_consultants_consent_method_check,
  add constraint ow_featured_consultants_consent_method_check
    check (consent_method is null or consent_method in ('email', 'line', 'meeting', 'other', 'self')),
  drop constraint ow_featured_consultants_listed_requires_approval,
  add column stopped_at  timestamptz,
  add column stopped_by  uuid references public.ow_users(id) on delete set null,
  add column stop_reason text check (stop_reason is null or char_length(stop_reason) <= 200),
  add constraint ow_featured_consultants_stopped_not_listed check (stopped_at is null or is_listed = false);

comment on table public.ow_featured_consultants is
  '「相談可能なユーザー」（ホームの右の列・/people の左サイドバー）。本人がマイページでオンにすると載る（同意は consent_method = self で記録）。運営は stopped_at で止められる。読み書きは admin クライアントのみ';
comment on column public.ow_featured_consultants.consent_method is
  '同意の方法（email / line / meeting / other / self）。self は本人がマイページでオンにした。値は CONSULTANT_CONSENT_METHODS と同じ';
comment on column public.ow_featured_consultants.stopped_at is
  '運営が止めた日時。止めている間は掲載できず、本人もオンにできない';

-- ★検算: 権限が増えていないこと
do $$
begin
  if has_table_privilege('anon', 'public.ow_featured_consultants', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_featured_consultants', 'SELECT') then
    raise exception 'ow_featured_consultants に一般の権限が残っている';
  end if;
end $$;

commit;
