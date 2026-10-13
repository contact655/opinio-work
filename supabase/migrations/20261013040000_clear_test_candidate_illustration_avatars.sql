-- 検証用アカウント3名の avatar_url に入っていた「人型のイラスト」を外す（2026-10-13 / 柴さんの指示）
--
-- なぜ:
--   候補者を探す（/biz/candidates）で、写真が無い人は頭文字の色丸に揃えた。ところが Third Box の画面で
--   この3名だけ人型のイラストが出ていた。調べると、アプリが割り当てる既定画像ではなく、
--   2026-10-12 に Storage（ow-uploads/users/avatars/<id>/179179281*.png・各2.6〜2.8KB・owner なし）へ
--   直接置かれた画像が avatar_url に入っていた（リポジトリの migration・スクリプトには出どころが無い）。
--   写真の有無はコードでは「avatar_url が入っているか」だけで判定する（URL で既定画像を見分ける仕組みは作らない）ので、
--   データの方を外す。
--
-- 対象: is_test の3名だけ（id を明示列挙。実在の利用者は触らない）。
--   cb2bfe2f-f4c2-48fe-988b-ad26267fe042  鈴木 鉄平（contact+48）
--   33050b69-97c4-46d9-a555-89cb8b92b541  鈴木 亮平（contact+46）
--   3742d051-e7d3-4ec5-875c-93b8ad07c515  鈴木 涼太（contact+45）
--
-- 戻し方（Storage のファイルは消していない）:
--   update ow_users set avatar_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/users/avatars/cb2bfe2f-f4c2-48fe-988b-ad26267fe042/1791792817853.png' where id = 'cb2bfe2f-f4c2-48fe-988b-ad26267fe042';
--   update ow_users set avatar_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/users/avatars/33050b69-97c4-46d9-a555-89cb8b92b541/1791792818166.png' where id = '33050b69-97c4-46d9-a555-89cb8b92b541';
--   update ow_users set avatar_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/users/avatars/3742d051-e7d3-4ec5-875c-93b8ad07c515/1791792818408.png' where id = '3742d051-e7d3-4ec5-875c-93b8ad07c515';
--
-- 確認したこと:
--   - ow_users.avatar_url を触った直近の migration は無い（avatar_url を UPDATE する migration は 2026-10 に0本）
--   - ow_users の UPDATE トリガー（trg_ow_users_mark_profile_edited）は本人のセッションのときだけ profile_edited_at を動かす。
--     この migration では動かない（「プロフィール更新」の日付は変わらない）
--   - 作業前ダンプ: .dumps/20261013-1141-ow_users.sql

do $$
declare
  n int;
begin
  select count(*) into n from public.ow_users
   where id in ('cb2bfe2f-f4c2-48fe-988b-ad26267fe042', '33050b69-97c4-46d9-a555-89cb8b92b541', '3742d051-e7d3-4ec5-875c-93b8ad07c515')
     and is_test = true
     and avatar_url like '%/ow-uploads/users/avatars/%/17917928%.png';
  if n <> 3 then
    raise exception '対象が想定（3名・is_test・イラストのURL）と違う: %', n;
  end if;

  update public.ow_users set avatar_url = null
   where id in ('cb2bfe2f-f4c2-48fe-988b-ad26267fe042', '33050b69-97c4-46d9-a555-89cb8b92b541', '3742d051-e7d3-4ec5-875c-93b8ad07c515')
     and is_test = true;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception '更新した行数が3でない: %', n;
  end if;

  -- 実在の利用者の写真は1件も変えていない
  select count(*) into n from public.ow_users where is_test is not true and avatar_url is not null;
  if n <> 12 then
    raise exception '実在の利用者の写真の件数が想定（12）と違う: %', n;
  end if;
end $$;
