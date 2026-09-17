-- 株式会社Opinio のロゴを現行ブランドに差し替える（2026-09-17 / 柴さんの指示）
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- 企業カードに出ていたのは **2026-09-06 に置き換えた旧ロゴ**だった:
--   1080x800（横長・OGP の規格）／紫の背景／円形の渦のシンボル／
--   「キャリアに真実を。」（現行のタグラインは "Truth to Careers"）
-- 現行のロゴは **右下が斜めに欠けた四角 ＋ ワードマーク OPINIO / #141414 の1色**
-- （CLAUDE.md「ロゴ」。旧ファイルは 3d671987 に残っている）。
--
-- ⚠️ CLAUDE.md が挙げている「ロゴの不揃い」そのものだった ——
--    **白背景の正方形アイコンと色付きの横長バナーが同じ一覧に混在する**問題。
--    差し替えで正方形（1:1）になる。
--
-- ── ⚠️★なぜ Storage ではなく自サイトの公開アセットを指すのか ──────────────────
-- `public/icons/pwa/icon-512.png` は **`scripts/gen-brand-icons.mjs` が
-- `public/brand/` の公式ロゴから生成している**ファイルで、本番で配信済み
-- （実測 2026-09-17: https://opinio.jp/icons/pwa/icon-512.png → 200 / image/png / 512x512）。
--   ① **ロゴが改訂されたら、あのスクリプトを流すだけでこの企業ロゴも最新になる。**
--      Storage に置くと、改訂のたびに**アップロードし直す手順が別に増える**。
--   ② Storage は **Supabase の日次バックアップに含まれない**（CLAUDE.md）。
--      上書きすると戻せない。リポジトリのファイルなら git で戻せる。
-- ⚠️ 代償: **あのパスに依存する。** `public/icons/pwa/icon-512.png` を
--    リネーム・削除するときは、この列も一緒に直すこと。
-- ⚠️ 他社のロゴは従来どおり Storage。**自社1社だけの例外**。
--
-- ── 戻し方 ────────────────────────────────────────────────────────────────
-- 旧 URL は Storage に**そのまま残してある**（消していない）。戻すならこれを当てる:
--   update public.ow_companies set logo_url =
--     'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/cf44d740-b835-454d-91a3-f1e2eddc7251/logo.png'
--    where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';
--
-- ⚠️ CLAUDE.md「全社一括の UPDATE を禁止する。対象を id で明示列挙する」。1社だけ。
-- ⚠️ この列を一括で触った migration は無い（2026-09-17 に確認）。打ち消しは起きない。

update public.ow_companies
   set logo_url = 'https://opinio.jp/icons/pwa/icon-512.png',
       updated_at = now()
 where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';  -- 株式会社Opinio

-- ★1行ちょうど変わったことを確かめる。多くても少なくても中止する。
do $$
declare n integer;
begin
  select count(*) into n from public.ow_companies
   where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251'
     and logo_url = 'https://opinio.jp/icons/pwa/icon-512.png';
  if n <> 1 then
    raise exception 'Opinio のロゴが差し替わっていない（% 件）', n;
  end if;

  -- ⚠️ 自サイトを指すロゴは**この1社だけ**であること。他社に広がっていないか見る。
  select count(*) into n from public.ow_companies where logo_url like 'https://opinio.jp/%';
  if n <> 1 then
    raise exception '自サイトを指す logo_url が % 社ある（1 のはず）', n;
  end if;
end $$;
