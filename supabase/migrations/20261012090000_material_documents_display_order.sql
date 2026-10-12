-- ★企業資料の並び順（2026-10-12 / 柴さんの指示：資料一覧をドラッグで並び替える）。
--   既存の行は NULL のまま（新しい列は NULL で始める）。並べ替えを1回したら、その会社の全件に番号が入る。
--   一覧の並び: display_order が NULL の行（並べ替えた後に足した資料）を先頭に新しい順 → 番号の順。
--   ⚠️ この表は RLS 有効・ポリシー0本・anon / authenticated に GRANT なし（読み書きは admin クライアントだけ）。
--      列を足しても GRANT は要らない（配っていないので配らない）。
alter table public.ow_company_material_documents add column display_order integer;

comment on column public.ow_company_material_documents.display_order is
  '資料一覧の並び順（小さいほど上）。NULL は並べ替えより後に足した資料（先頭に新しい順で出す）。2026-10-12';

do $$
begin
  if has_table_privilege('anon', 'public.ow_company_material_documents', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_material_documents', 'SELECT') then
    raise exception '企業資料の表にクライアントの権限がある。中止';
  end if;
end $$;
