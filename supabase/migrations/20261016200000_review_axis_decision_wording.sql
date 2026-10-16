-- ★④の見出し「決め方・左」の言い回しを直す（2026-10-16 / 柴さんの承認）。
--   「上が方針を決め／上が方針を決める」だと「変化」の軸（方針や組織が…）と並んだときに「方針」が重なる。
--   → つなぐ形「上が決めて進め」／言い切る形「上が決めて進める」。
-- 対象: ow_review_axes の key = 'decision' の1行だけ。回答の表には文言を持たせていないので、回答は変わらない。
-- 戻し方: left_headline_join = '上が方針を決め', left_headline_end = '上が方針を決める' に戻す UPDATE。

begin;

update public.ow_review_axes
   set left_headline_join = '上が決めて進め',
       left_headline_end  = '上が決めて進める'
 where key = 'decision'
   and left_headline_join = '上が方針を決め'
   and left_headline_end  = '上が方針を決める';

do $$
begin
  if (select count(*) from public.ow_review_axes
       where key = 'decision' and left_headline_join = '上が決めて進め' and left_headline_end = '上が決めて進める') <> 1 then
    raise exception '決め方・左の言い回しが想定どおりに変わっていない';
  end if;
end $$;

commit;
