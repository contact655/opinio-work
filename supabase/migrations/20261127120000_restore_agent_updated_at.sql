-- ★株式会社エージェントの updated_at を、空文字の確認（2026-11-27）の前に戻す
--
-- 対象: ow_companies の1行（id = 7a048a8e-2c44-4f09-a727-8d7e6350851c / 株式会社エージェント）・updated_at の1列だけ
-- なぜ: 運営画面で「空欄のまま保存しても '' にならない」ことを確かめるため、何も変えずに1回保存した。
--       保存前のダンプ（.dumps/20261127-1006-ow_companies.sql）と170列を比べ、違いは updated_at だけだった（空文字の列も0）。
--
-- ⚠️ 検証の保存の時刻のときだけ戻す（違えば、そのあとに誰かが保存したので中止）。

do $$
declare
  v_id constant uuid := '7a048a8e-2c44-4f09-a727-8d7e6350851c';
  v_n int;
begin
  update public.ow_companies
     set updated_at = '2026-10-15 10:52:57.442+00'::timestamptz
   where id = v_id
     and updated_at = '2026-11-27 01:07:13.751+00'::timestamptz;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception '中止: 更新した行が % 行（1行のはず。updated_at が検証の保存のあとに変わっている）', v_n;
  end if;
end $$;
