-- フェーズ2: 肩書き1行（headline）と 希望勤務地（desired_prefectures）
--
-- ── GRANT を書かない理由（2026-08-15 実測）────────────────────────────────
-- ⚠️ **`ow_users` は `ow_companies` と権限運用が違う。**
--    `ow_companies` はテーブルレベルの UPDATE を落として列単位で配り直してあるため、
--    列を足すと**書けない状態で生まれる**（CLAUDE.md）。`ow_users` はそうではない。
--
--    実測（`has_table_privilege` / `has_column_privilege`）:
--      authenticated … UPDATE は **テーブルレベル**（31/31列）。INSERT もテーブルレベル
--                      SELECT だけが列単位で、剥奪されているのは `email` と `birth_date` の2列
--      anon          … SELECT のみ
--
--    したがって新しい列は **SELECT も UPDATE も自動で付く**。GRANT の追記は不要。
--    ⚠️ 逆に、将来この2列以外の SELECT を剥がすときは列単位で明示すること。
--
-- ── 実行前の実測 ────────────────────────────────────────────────────────
--    ow_users 35行 / ow_profiles 49行

-- ① 肩書き1行。プロフィールの名前の直下に出す
alter table ow_users
  add column if not exists headline text;

-- ⚠️ 上限は DB と UI の両方に置く（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
--    char_length を使う。octet_length だと日本語で 40 に届かない。
alter table ow_users
  drop constraint if exists ow_users_headline_length;
alter table ow_users
  add constraint ow_users_headline_length
  check (headline is null or char_length(headline) <= 40);

comment on column ow_users.headline is
  '肩書き1行（40字以内）。一覧やスカウト画面で最初に読まれる行。空は null（空文字を入れない）';

-- ② 希望勤務地。値は src/lib/utils/location.ts の PREFECTURES（47件）を正とする
-- ⚠️ DB では CHECK を張らない。都道府県は 47 固定だが、配列要素ごとの CHECK は
--    値を1つ足すたびに migration が要る形になり、API 側のホワイトリスト検証と
--    二重管理になる。**検証は API（career-preferences と同じ作法）で行う。**
alter table ow_profiles
  add column if not exists desired_prefectures text[];

comment on column ow_profiles.desired_prefectures is
  '希望勤務地。値は location.ts の PREFECTURES。検証は API のホワイトリストで行う（DB に CHECK は張らない）';
