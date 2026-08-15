-- フェーズ4-1: 実績・受賞を「どの職歴の話か」に紐づける
--
-- 数値実績（ow_user_achievements）と受賞歴（ow_user_awards）に experience_id を足す。
-- UI では職歴カードの中に畳んで出す（4-2）。
--
-- ⚠️ **ow_user_media_appearances には足さない。** メディア掲載は在籍先に属さない
--    （個人としての登壇・寄稿が多く、退職後の取材もある）。独立したカードのまま残す。
--
-- ── 実行前の実測（2026-08-15）────────────────────────────────────────────
--    ow_user_achievements 0件 / ow_user_awards 0件 / ow_user_media_appearances 0件
--    ow_experiences 19件
--    → **データ移行は不要**。値の入っていない列を足すだけ。
--
-- ── ON DELETE を SET NULL にする理由 ──────────────────────────────────────
--    職歴を消しても実績は消さない。実績は「その人がやったこと」であって、
--    在籍記録の付属物ではない。職歴を消したら UI では
--    「その他の実績・受賞」（experience_id が null）に移る。
--    ⚠️ CASCADE にしないこと。職歴の削除で実績まで消えると、
--       利用者は消えたことに気づけない（削除ダイアログは職歴の話しかしない）。

alter table ow_user_achievements
  add column if not exists experience_id uuid
  references ow_experiences(id) on delete set null;

alter table ow_user_awards
  add column if not exists experience_id uuid
  references ow_experiences(id) on delete set null;

comment on column ow_user_achievements.experience_id is
  'どの職歴での成果か。null は「その他の実績」（どの職歴にも属さない）。職歴削除時は null に落ちる';
comment on column ow_user_awards.experience_id is
  'どの職歴での受賞か。null は「その他の受賞」（どの職歴にも属さない）。職歴削除時は null に落ちる';

-- 職歴カードごとに引くので、experience_id の索引を張る
create index if not exists idx_ow_user_achievements_experience_id
  on ow_user_achievements(experience_id);
create index if not exists idx_ow_user_awards_experience_id
  on ow_user_awards(experience_id);

-- ── GRANT ────────────────────────────────────────────────────────────────
-- ⚠️ **「新しい列にも自動で付く」と決めつけない。**（2026-08-15 に headline で実際に外した）
--    この2テーブルは適用前の実測で **SELECT / INSERT / UPDATE / DELETE がテーブルレベル**
--    （`has_table_privilege('authenticated', …)` が4つとも true、anon は SELECT が true）。
--    テーブルレベルなら列を足しても権限は付いてくるが、**適用直後に測って確かめる**こと:
--
--      select has_column_privilege('authenticated','public.ow_user_achievements','experience_id','SELECT'),
--             has_column_privilege('authenticated','public.ow_user_achievements','experience_id','UPDATE');
--
--    ⚠️ `ow_experiences` は SELECT が**列単位**（26/35列）なので、あちらに列を足すときは
--       必ず `grant select (列名)` を書くこと。この migration は ow_experiences には触っていない。
--
-- ── RLS ──────────────────────────────────────────────────────────────────
-- 既存3テーブルは同じ形（select_all は true / insert・update・delete は
-- `user_id in (select id from ow_users where auth_id = auth.uid())`）。
-- ポリシーは行単位で列を列挙していないため、**列を足しても変更は不要**。
--
-- ⚠️ ただし RLS は「他人の職歴の id を experience_id に入れる」ことは防げない
--    （FK の検査は RLS を通らない）。**書き込み経路（API）で
--    「その職歴が本人のものか」を必ず確かめること。** 4-2 で実装する。
