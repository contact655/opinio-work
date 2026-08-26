-- 求人の「企業が書く列」と「求職者が読む列」の統合（2026-08-26）
--
-- 経緯: /biz の求人フォームは配列列（required_skills / preferred_skills）に書き、
--       旧データはテキスト列（requirements / preferred）に入っていた。
--       求職者側は pickFilled() で両方見ているので表示は出るが、
--       **企業側の編集フォームは配列列しか読まない**ため、
--       テキスト列にデータがある求人は「必須スキルが未入力」に見えていた。
--       企業がそのまま保存すると、正と食い違う入力を作りかねない。
--
-- ⚠️ 分割規則は mapJob と同一にすること（src/lib/supabase/queries.ts）:
--      /\n|\\n|・|、/ で分割 → trim → 空を除去
--    リテラルの2文字 "\n" が本文に混ざっている行があるため、先に改行へ潰す。

begin;

-- ── 事前確認: 想定件数と違ったら中止する ─────────────────────────────────
do $$
declare
  v_req int;
  v_pref int;
begin
  select count(*) into v_req from ow_jobs
   where coalesce(array_length(required_skills,1),0) = 0
     and requirements is not null and requirements <> '';
  select count(*) into v_pref from ow_jobs
   where coalesce(array_length(preferred_skills,1),0) = 0
     and preferred is not null and preferred <> '';

  raise notice '移行対象: requirements=% / preferred=%', v_req, v_pref;

  if v_req <> 18 or v_pref <> 5 then
    raise exception '想定と違う（requirements 18 / preferred 5 のはず。実際 % / %）。中止する', v_req, v_pref;
  end if;
end $$;

-- ── requirements(text) → required_skills(text[]) ─────────────────────────
update ow_jobs
   set required_skills = (
         select array_agg(t order by ord)
           from (
             select trim(x) as t, ord
               from unnest(
                      regexp_split_to_array(replace(requirements, '\n', chr(10)), '\n|・|、')
                    ) with ordinality as u(x, ord)
           ) s
          where s.t <> ''
       )
 where coalesce(array_length(required_skills,1),0) = 0
   and requirements is not null and requirements <> '';

-- ── preferred(text) → preferred_skills(text[]) ───────────────────────────
update ow_jobs
   set preferred_skills = (
         select array_agg(t order by ord)
           from (
             select trim(x) as t, ord
               from unnest(
                      regexp_split_to_array(replace(preferred, '\n', chr(10)), '\n|・|、')
                    ) with ordinality as u(x, ord)
           ) s
          where s.t <> ''
       )
 where coalesce(array_length(preferred_skills,1),0) = 0
   and preferred is not null and preferred <> '';

-- ── 事後確認 ─────────────────────────────────────────────────────────────
do $$
declare
  v_req int;
  v_pref int;
begin
  select count(*) into v_req from ow_jobs where coalesce(array_length(required_skills,1),0) > 0;
  select count(*) into v_pref from ow_jobs where coalesce(array_length(preferred_skills,1),0) > 0;
  raise notice '移行後: required_skills=% / preferred_skills=%', v_req, v_pref;
  if v_req <> 18 or v_pref <> 5 then
    raise exception '移行後の件数が想定と違う（% / %）。中止する', v_req, v_pref;
  end if;
end $$;

-- ── 廃止する列に印を付ける（DROP しない）─────────────────────────────────
-- ⚠️ CLAUDE.md「テーブル・カラム・関数を DROP するときのチェックリスト」に従い、
--    列は残す。読む経路を無くしたうえで、次に見る人が分かるようにコメントを置く。
comment on column ow_jobs.requirements is
  '【廃止】2026-08-26 に required_skills(text[]) へ統合。読み書きしないこと。データは移行済み。';
comment on column ow_jobs.preferred is
  '【廃止】2026-08-26 に preferred_skills(text[]) へ統合。読み書きしないこと。データは移行済み。';
comment on column ow_jobs.selection_process is
  '【廃止】2026-08-26 に selection_steps(text[]) へ統合。本番0件だったのでデータ移行は無い。';
comment on column ow_jobs.description_markdown is
  '【廃止】2026-08-26 に description へ統合。本番0件。求職者側の描画は plain text（改行で段落分け）で markdown を解釈しない。';

comment on column ow_companies.about_markdown is
  '【廃止】2026-08-26 に description へ統合。本番0件。描画は plain text（companies/[id] の detail.about）。';
comment on column ow_companies.established_at is
  '【廃止】2026-08-26 に founded_year(int) へ統合。求職者側は年しか表示しない。既存1件は founded_year にも入っていたので移行不要だった。';
comment on column ow_companies.gender_ratio is
  '【廃止】2026-08-26 に female_ratio へ統合。本番0件。';

commit;
