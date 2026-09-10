-- ★スカウトの通知メールの送信結果を記録する（2026-09-10）
--
-- ⚠️ なぜ要るか: 解禁前の作業で、送信結果がどこにも残っていないことが分かった。
--    `notify()` が例外を飲み、`sendEmail()` は Resend の error を console に出すだけで、
--    さらに `sendScoutEmail` の catch が受ける——**3重に握り潰していた。**
--    企業には常に {ok:true} が返るので、届いていなくても「送信しました」と出る。
--    本番で RESEND_API_KEY が外れていると mock で正常終了し、誰にも届かないまま気づけない。
--
-- ⚠️★`status`（スカウトの状態: sent / read / replied …）と混ぜないこと。
--    あれは**スカウトそのもの**の状態で、ここは**通知メール**の結果。別の軸。
--
-- ⚠️★本番の `ow_scouts` は 0件（2026-09-10 実測）なので NOT NULL DEFAULT で入れられる。
--    「NULL は記録が無いという意味」という曖昧さを最初から作らない。
--    ⚠️ 行が増えてからでは同じことはできない。

begin;

-- 想定と違えば中止する（CLAUDE.md「migration を書くときのルール」）
do $$
declare n int;
begin
  select count(*) into n from public.ow_scouts;
  if n <> 0 then
    raise exception 'ow_scouts が 0件ではない（実測 % 件）。既存行の既定値を決めてから当てること', n;
  end if;
end $$;

alter table public.ow_scouts
  add column email_status      text        not null default 'pending',
  add column email_sent_at     timestamptz,
  add column email_error       text,
  add column email_provider_id text;

-- ⚠️★CHECK の無い列挙列を増やさない（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
--    綴りが1文字ずれても**エラーにならず、集計から静かに消える**のを防ぐ。
alter table public.ow_scouts
  add constraint ow_scouts_email_status_check
  check (email_status in ('pending', 'sent', 'skipped', 'failed', 'mocked'));

comment on column public.ow_scouts.email_status is
  '通知メールの結果。pending=まだ試していない / sent=Resend が受理 / skipped=本人が配信停止(正常) / failed=送信に失敗 / mocked=RESEND_API_KEY が無く送っていない。'
  '⚠️ status（スカウトそのものの状態）と混ぜないこと。別の軸。'
  '⚠️ skipped は正常。failed と一緒に数えない。'
  '⚠️ 値の一覧は src/lib/constants/scoutEmail.ts と同じ。片方だけ増やさないこと。';

comment on column public.ow_scouts.email_sent_at is
  'Resend が受理した時刻。⚠️ 受信を意味しない（到達・開封は記録していない）。sent 以外では NULL。';

comment on column public.ow_scouts.email_error is
  'failed のときに Resend が返した内容。⚠️ NULL は「失敗していない」ではなく「記録が無い」。';

comment on column public.ow_scouts.email_provider_id is
  'Resend の message id。⚠️ 後から問い合わせるときの唯一の手がかりなので、送信時に必ず入れる。'
  '⚠️ 後から足すほうが高くつくので、行が0件のうちに入れてある。';

-- 運営の「要対応」で使う。⚠️ 0件が正常な状態なので、部分インデックスで十分。
create index if not exists ow_scouts_email_undelivered_idx
  on public.ow_scouts (sent_at desc)
  where email_status in ('failed', 'mocked');

commit;
