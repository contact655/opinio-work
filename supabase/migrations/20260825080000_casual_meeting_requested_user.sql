-- カジュアル面談で「誰に聞きたいか」を記録する（2026-08-25）
--
-- ── 何が壊れていたか ────────────────────────────────────────────────────────
-- `/u/[id]` の「〇〇さんに話を聞く」は `?person={ow_users.id}` を、
-- 企業ページの社員カードは `?member_id={ow_company_members.id}` を渡していたが、
-- **受け側（casual-meeting/page.tsx）の searchParams の型は `{ job_id?: string }` だけ**で、
-- どちらも**そのまま捨てられていた**。
-- → **人単位のCTAが、企業宛の申込にしか繋がっていなかった。**
--    申込を受けた企業側も「誰を指名されたのか」を知る手段が無かった。
--
-- ⚠️ CLAUDE.md「未実装課題メモ」に将来実装として書かれていたもの。ここで実装する。
--
-- ── 空間 ────────────────────────────────────────────────────────────────────
-- ⚠️ **`ow_users.id`**。同じ表の `user_id`（申込者）と `assignee_user_id`（対応者）も
--    ow_users を参照しており、揃えてある。**auth.users.id を入れないこと。**
--    `ow_company_members.id`（在籍の行）ではなく**人**を指す。行は増減するが人は変わらない。
--
-- ⚠️ `assignee_user_id` と**別の列**にする。意味が違う:
--      requested_user_id … 求職者が「この人に聞きたい」と指名した人（変わらない）
--      assignee_user_id  … 企業側で実際に対応することになった人（後から決まる・変わる）
--    ⚠️ 同じ列に入れると、企業が別の人を割り当てた瞬間に「誰を指名されたか」が消える。
--
-- ⚠️ **NULL を許す。** 企業ページの「話を聞いてみる」からの申込は指名なしで来る。
--    指名は任意であって、必須にすると企業宛の申込ができなくなる。
--
-- ⚠️ `on delete set null`。指名された人が退会しても**申込そのものは残す**
--    （申込は企業との間の記録で、指名は付随情報）。

alter table public.ow_casual_meetings
  add column requested_user_id uuid references public.ow_users(id) on delete set null;

comment on column public.ow_casual_meetings.requested_user_id is
  '求職者が指名した「話を聞きたい人」（ow_users.id）。任意。⚠️ assignee_user_id（企業側の担当）とは別物';

-- ⚠️ 索引は張らない。`ow_casual_meetings` は 0件（2026-08-25 実測）で、
--    絞り込む用途も無い（申込の詳細を開くときに1行ぶん読むだけ）。
--    このDBは既に索引が過剰（ユーザーテーブル10MBに対し索引6MB・411本）。

-- ⚠️ GRANT は不要。この表は**テーブルレベル**で配られている（列単位の付与は0件・実測）。
--    列を足せばそのまま読み書きできる。

-- ── 適用後の実測 ───────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_attribute
     where attrelid='public.ow_casual_meetings'::regclass
       and attname='requested_user_id' and not attisdropped
  ) then
    raise exception 'requested_user_id が作られていない';
  end if;
  -- 列単位の表ではないので、テーブルレベルの権限で読めることを確かめる
  if not has_column_privilege('authenticated','public.ow_casual_meetings','requested_user_id','SELECT') then
    raise exception 'authenticated から新しい列が読めない';
  end if;
  if not has_column_privilege('authenticated','public.ow_casual_meetings','requested_user_id','INSERT') then
    raise exception 'authenticated から新しい列に書けない';
  end if;
end $$;
