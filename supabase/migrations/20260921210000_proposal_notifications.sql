-- ═══════════════════════════════════════════════════════════════════════════
-- ②③ 提案と紹介をベルに出す（2026-09-21）
--
-- ⚠️ **追加のみ。** 既存の種別（like / comment / scout / message）には触らない。
--
-- ── ★なぜ要るか ────────────────────────────────────────────────────────────
-- 2026-09-21 まで、**提案が届いても紹介が成立しても、当事者に何も知らせていなかった。**
-- `/proposals` への導線も0件だったので、**誰も答えようがなく、
-- mutual は原理的に起こせなかった**（CLAUDE.md「起こせなかった0」）。
--
-- ── 2種類ある。混ぜないこと ────────────────────────────────────────────────
--   proposal     … 提案が届いた（→ /mypage/proposals）
--   introduction … 双方合意して話せるようになった（→ /mypage/conversations/[id]）
-- ⚠️★**1つの種別で兼ねない。** 押したときの行き先が違う。
--
-- ⚠️★**`survives()` に `case` を足すこと**（`GET /api/jobseeker/notifications`）。
--    既定は**投稿の存在**を求めるので、投稿にぶら下がらない種別を足し忘れると
--    **その種別が丸ごと静かに消える。** スカウトとメッセージで2回危なかった。
--    → 同じコミットで足してある。
--
-- ⚠️★**受け取るのは候補者だけ。** `/biz` には通知の面が1つも無い（実測 2026-09-21:
--    `ow_notifications` も `NotificationBell` も `src/app/biz` からの参照0件）。
--    企業は**ナビの「提案」から自分で見に行く**形にした。
--    ⚠️ 企業にメールを出す案は採らなかった —— 掲載22社のうち通知の宛先を持つのは2社で、
--       残りは運営フォールバックで `ADMIN_EMAIL` に落ちる（＝運営に大量に届く）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① どの提案かを持つ ─────────────────────────────────────────────────────
-- ⚠️ `on delete cascade`。提案を消したら通知も消す（押すと行き先が無い通知を残さない）。
--    `post_id` が消えた通知を `survives()` が落としているのと同じ考え方だが、
--    **こちらは行ごと消す**（提案は運営が消すもので、復活しない）。

alter table public.ow_notifications
  add column if not exists proposal_id uuid references public.ow_proposals(id) on delete cascade;

comment on column public.ow_notifications.proposal_id is
  'type=proposal / introduction のときだけ入る。⚠ ON DELETE CASCADE（提案を消したら通知も消す）';

create index if not exists ow_notifications_proposal_idx
  on public.ow_notifications (proposal_id) where proposal_id is not null;

-- ── ② 種別を2つ足す ────────────────────────────────────────────────────────

alter table public.ow_notifications drop constraint if exists ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check
  check (type = any (array['like', 'comment', 'scout', 'message', 'proposal', 'introduction']));

-- ── ③ 種別ごとに何がぶら下がるかを DB でも保証する ─────────────────────────
-- ⚠️★**既存の3行を消さないこと。** 張り替えなので、全部書き直す必要がある。

alter table public.ow_notifications drop constraint if exists ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check check (
  (type = any (array['like', 'comment']) and post_id is not null and actor_user_id is not null)
  or (type = 'scout'   and scout_id is not null        and actor_company_id is not null)
  or (type = 'message' and conversation_id is not null and actor_user_id is not null)
  /* ★提案。送り主は企業（ユーザーではない）。押すと /mypage/proposals へ */
  or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
  /* ★紹介。会話へ飛ばすので conversation_id が要る。
     ⚠️ `proposal_id` も要求する —— どの提案から来た紹介かを後から辿れるようにする。 */
  or (type = 'introduction'
      and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
);

-- ── ④ 適用後のアサート ─────────────────────────────────────────────────────

DO $$
DECLARE
  v_def text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_notifications' AND column_name='proposal_id'
  ) THEN
    RAISE EXCEPTION 'proposal_id が無い';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid='public.ow_notifications'::regclass AND conname='ow_notifications_target_check';

  /* ★既存の3種別が残っていること（張り替えで落としていないか） */
  IF position('scout' in v_def) = 0 OR position('message' in v_def) = 0
     OR position('post_id' in v_def) = 0 THEN
    RAISE EXCEPTION '張り替えで既存の種別が落ちている: %', v_def;
  END IF;
  IF position('introduction' in v_def) = 0 OR position('proposal_id' in v_def) = 0 THEN
    RAISE EXCEPTION '新しい種別が入っていない: %', v_def;
  END IF;
END $$;

COMMIT;
