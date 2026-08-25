-- ow_experiences.employment_type に CHECK 制約を足す（2026-08-26）
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」の
-- うち、この列だけ **DB の CHECK が無かった**。
--   UI  : CareerHistoryEditor.tsx の <select>  → careerOptions.ts の EMPLOYMENT_TYPES
--   API : POST/PUT /api/jobseeker/experiences → 同じ EMPLOYMENT_TYPES で 400
--   DB  : ★無い ← これを足す
-- コード側の検証は「これから API を通るもの」しか止められない。migration や
-- 直接 SQL で綴りのずれた値を入れると、エラーにならず**フィルタから静かに消える**。
--
-- ⚠️ 許容値は src/lib/constants/careerOptions.ts の EMPLOYMENT_TYPES と同じ6値。
--    **値を足すときは careerOptions.ts / API / この CHECK の3つとも直すこと。**
--    求人側の JOB_EMPLOYMENT_TYPES とは別の語彙（インターンあり・派遣社員なし）。
--    混同しないこと。
--
-- ⚠️ NULL は許可する。**24件中18件が NULL**（2026-08-26 実測）。
--    唯一の入力欄が任意セレクトで、オンボーディングでは雇用形態を聞いていないため。
--    NULL を弾くと既存の職歴が保存できなくなる。
--
-- ── 適用前の実測（2026-08-26）────────────────────────────────────────────
--   総数 24 / NULL 18 / 非 NULL 6（すべて '正社員'）
--   6値に含まれない値: **0件** → 既存行は1件も弾かれない
--   確認クエリ:
--     select count(*) filter (where employment_type is not null
--       and employment_type not in (...6値...)) from ow_experiences;
--
-- ⚠️ 直近にこの列を触った migration は無い（列自体は初期スキーマ由来）。
--    打ち消しの心配は無いことを確認済み。

alter table public.ow_experiences
  add constraint ow_experiences_employment_type_check
  check (
    employment_type is null
    or employment_type = any (array[
      '正社員'::text,
      '契約社員'::text,
      '派遣社員'::text,
      '業務委託'::text,
      'アルバイト・パート'::text,
      'その他'::text
    ])
  );
