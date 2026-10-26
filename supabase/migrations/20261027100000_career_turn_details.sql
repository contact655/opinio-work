-- ════════════════════════════════════════════════════════════════════════
-- 転機の3問のあとの「もう少し詳しく（任意）」の置き場所（2026-10-27 / フェーズ1c・柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- 入れるもの（柴さんの指示）:
--   ・実際はどちら寄りだったか（6軸・5段階。軸はマスタ ow_review_axes）→ 新しい表 ow_career_turn_axes
--   ・働き方の事実（残業・出社・英語。各4択 0〜3）→ ow_career_turns の列
--   ・入る前に知りたかったこと（80字まで）→ ow_career_turns の列
--   ⚠️ 「入社前の期待との比較」と「どんな人に合う会社か（タグ）」は入れない
--
-- ★置き場所は ow_career_turns にそろえた（ow_workplace_reviews は使わない）。理由:
--   ① ow_workplace_reviews は authenticated に INSERT / UPDATE があり、RLS で本人の行だけとはいえ
--      本人が PostgREST から API を通さずに書ける。ow_career_turns は誰にも権限が無い（API だけ）
--   ② ow_workplace_reviews は CHECK（required_check）で 0〜10 のフィット度と期待との比較4項目を必須にしている。
--      新しい画面はそれを聞かないので、使い続けるには埋め草の値を入れるか制約を緩めるしかない
--   ③ 1つの転機の回答が2つの表に割れない（削除・集計・本人確認が1か所で済む）
--
-- ⚠️★新しい表も anon / authenticated に GRANT しない・ポリシーを書かない（ow_career_turns と同じ）。
-- データは変えない（列と表を足すだけ）。
-- 戻し方: drop table public.ow_career_turn_axes;
--         alter table public.ow_career_turns drop column detail_overtime, drop column detail_office,
--           drop column detail_english, drop column detail_memo;
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 働き方の事実（各4択。選択肢は lib/workplaceReview/constants.ts の FACT_ITEMS と同じ並び）と、入る前に知りたかったこと
alter table public.ow_career_turns
  add column detail_overtime smallint check (detail_overtime is null or detail_overtime between 0 and 3),
  add column detail_office   smallint check (detail_office   is null or detail_office   between 0 and 3),
  add column detail_english  smallint check (detail_english  is null or detail_english  between 0 and 3),
  add column detail_memo     text     check (detail_memo is null or char_length(btrim(detail_memo)) between 1 and 80);

-- 実際はどちら寄りだったか（軸ごとに 0〜4。軸のキーはマスタ）
create table public.ow_career_turn_axes (
  experience_id uuid not null references public.ow_career_turns(experience_id) on delete cascade,
  axis_key      text not null references public.ow_review_axes(key),
  value         smallint not null check (value between 0 and 4),
  primary key (experience_id, axis_key)
);

comment on table public.ow_career_turn_axes is
  '転機の3問のあとの任意の段「実際はどちら寄りだったか」（2026-10-27）。読み書きは API（service role）だけ。anon / authenticated に GRANT しない・ポリシーを書かない。';

alter table public.ow_career_turn_axes enable row level security;
revoke all on table public.ow_career_turn_axes from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_career_turn_axes to service_role;

do $$
begin
  if has_table_privilege('anon', 'public.ow_career_turn_axes', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_career_turn_axes', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.ow_career_turns', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'クライアントのロールに権限が残っている';
  end if;
  if (select count(*) from pg_policy where polrelid in ('public.ow_career_turn_axes'::regclass, 'public.ow_career_turns'::regclass)) <> 0 then
    raise exception 'ポリシーがある（0本のはず）';
  end if;
end $$;

commit;
