-- ★出向先（2026-09-12 / 柴さんの指示）
--
-- 出向は「籍はA社のまま、働く場所はB社」という状態。**B社の職歴として持たせない。**
-- A社の役割（= ow_experiences の1行）に「出向先」を持たせて表す。
--
-- ⚠️★**企業ページの社員抽出は `company_id` を見ている**（`getCompanyEmployees` /
--    面談対応者の在籍判定）。出向先を別の列に置くことで、
--    **出向先の企業ページには社員として出ない**（今回の要件）。
--    ⚠️ 出向先で絞りたくなっても、`company_id` に混ぜないこと。混ぜた瞬間に社員として出る。
--
-- ⚠️ 既存行には入れない（既定 NULL）。埋め込みもしない。

alter table public.ow_experiences
  add column if not exists secondment_company_id   uuid references public.ow_companies(id) on delete set null,
  add column if not exists secondment_company_text text;

comment on column public.ow_experiences.secondment_company_id is
  '出向先（企業マスタ）。2026-09-12 追加。NULL = 出向していない。ow_companies への参照は ON DELETE SET NULL。';
comment on column public.ow_experiences.secondment_company_text is
  '出向先（自由入力）。2026-09-12 追加。secondment_company_id と同時には入らない（experience_secondment_xor）。';

-- ⚠️ 会社の XOR（`experience_company_xor`）は「ちょうど1つ」だが、出向は**任意**なので
--    「1つ以下」にする。形（integer の足し算）は既存に揃えてある。
alter table public.ow_experiences
  drop constraint if exists experience_secondment_xor;
alter table public.ow_experiences
  add constraint experience_secondment_xor
  check (
    ((secondment_company_id   is not null)::integer
   + (secondment_company_text is not null)::integer) <= 1
  );

-- ⚠️★**出向先に自社は選べない。** 同じ会社なら出向ではなく異動。
--    ⚠️ 自由入力の会社（company_id が NULL）は比較が NULL になるので通る。そこは UI/API で見る。
alter table public.ow_experiences
  drop constraint if exists experience_secondment_not_self;
alter table public.ow_experiences
  add constraint experience_secondment_not_self
  check (secondment_company_id is null or company_id is null or secondment_company_id <> company_id);

-- ⚠️★**GRANT を既存の列と同じ範囲に合わせる。広げない**（2026-09-12 実測）。
--    ow_experiences の権限はこうなっている:
--      authenticated … INSERT / UPDATE は**テーブルレベル**（新しい列は自動で付く）
--                      SELECT は**列単位**（明示しないと読めない）
--      anon          … SELECT のみ列単位。**ここでは配らない**（`department` / `rank` と同じ）
--      service_role  … テーブルレベルで全部（新しい列は自動で付く）
--    ⇒ 明示が要るのは authenticated の SELECT だけ。
-- ⚠️ anon に配らないのは、出向先を出すのが `/mypage` と `/u/[id]` だけで、
--    どちらもログインが要り、取得も admin クライアントだから。
--    ⚠️★**anon 経路の select にこの2列を足さないこと。** 1列でも入るとクエリが丸ごと 403 になり、
--       `?? []` で受けている側では「0件」として静かに素通りする（CLAUDE.md）。
grant select (secondment_company_id, secondment_company_text)
  on public.ow_experiences to authenticated;

-- ★適用後のアサート（catalog を見るだけ。実応答は別途 PostgREST で確かめる）
do $$
begin
  if not has_column_privilege('authenticated','public.ow_experiences','secondment_company_id','SELECT')
     or not has_column_privilege('authenticated','public.ow_experiences','secondment_company_text','SELECT') then
    raise exception 'authenticated に SELECT が付いていない';
  end if;
  if not has_column_privilege('authenticated','public.ow_experiences','secondment_company_id','UPDATE')
     or not has_column_privilege('authenticated','public.ow_experiences','secondment_company_text','UPDATE') then
    raise exception 'authenticated に UPDATE が付いていない';
  end if;
  if has_column_privilege('anon','public.ow_experiences','secondment_company_id','SELECT')
     or has_column_privilege('anon','public.ow_experiences','secondment_company_text','SELECT') then
    raise exception 'anon に SELECT が付いている（広げてはいけない）';
  end if;
end $$;
