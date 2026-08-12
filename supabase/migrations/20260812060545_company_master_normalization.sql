-- ═══════════════════════════════════════════════════════════════════════════
-- 企業マスタに「正規化名」と「統合先ポインタ」を用意する
--
-- ── なぜ今やるか（2026-08-12）──────────────────────────────────────────────
-- これからユーザー登録を本格的に集める。人が増えてから企業名の表記ゆれで
-- 重複が出ると、「A社を出た人の行き先」の集計が割れる。
-- 中核価値が入力の表記ゆれで直接壊れるので、集め始める前に検出の土台を作る。
--
-- ⚠️ **normalized_name に UNIQUE は張らない。** 同名の別会社が実在するため
--    （美容室・飲食店・地方の中小企業）。あくまで**検出**に使う。
--    実測では既存85社に正規化後の重複は **0組**。いまは綺麗な状態。
--
-- ⚠️ **統合しても参照は付け替えない。** ow_companies を参照する FK は
--    **40列/40テーブル**あり、うち12本は company_id を含む UNIQUE を持つ
--    （ow_company_admins / ow_company_members / ow_company_departments 等）。
--    職種の merge_role() は8テーブルで済んだが、企業版は5倍規模になる。
--    統合対象が0組の現状では回収できない。
--    canonical_company_id は**印**であって、解決は集計クエリ側で行う。
--
-- ── このmigrationがやること ────────────────────────────────────────────────
--   ① normalize_company_name() を**強化して置き換える**（既存関数。下記参照）
--   ② normalized_name / canonical_company_id を追加（+ index / CHECK）
--   ③ BEFORE INSERT OR UPDATE トリガーで normalized_name を必ず再計算
--   ④ 既存85行の normalized_name をバックフィル
--   ⑤ source が NULL の77社のうち、archive の INSERT 文で実在を確認できた
--      **69社だけ** 'migration' を入れる（8社は確認できないので NULL のまま）
--   ⑥ authenticated から2列の UPDATE を列単位で REVOKE
--   ⑦ find_companies_by_normalized_name() … 照合を1往復で行う RPC
--
-- ⚠️ **既存データは normalized_name と source（69行）以外 一切触らない。**
--    事後チェックで、他の列と行数が不変であることをチェックサムで実測する。
--
-- ── 直近に同じ列を触った migration（確認済み）──────────────────────────────
--   104_add_source_to_ow_companies … source 列の追加。値は admin_seed 1件のみ
--   275_add_smartcamp_update_irodas … 最後に企業を INSERT した archive
--   本migrationが打ち消すものは無い（source の既存値 8件には触れない）。
--
-- ── ⑤ の裏取り手順（記録）──────────────────────────────────────────────────
-- ⚠️ `supabase_migrations.schema_migrations` に**適用時刻の列が無い**
--    （version/statements/name/created_by/idempotency_key/rollback のみ）。
--    さらに85社すべて baseline(20260727000000) より前の作成で、
--    archive/*.sql は履歴テーブルに載っていない。
--    → 「created_at と migration 適用時刻の対応」は DB からは検証不能。
--
--    代替として、**社名が archive/*.sql の INSERT INTO ow_companies 文の本体に
--    実在するか**で裏取りした（UPDATE 等での言及は正規表現で除外）。
--
--      156_foreign_it_companies.sql   64社  ← INSERT がちょうど64行。
--                                            created_at 2026-06-04 06:16:01 の
--                                            クラスタ64社と完全一致
--      142_add_saas_companies.sql      4社
--      165_add_domestic_companies.sql  3社
--      104 / 249 / 250 / 251 / 275    各1社
--
--    確認できなかった8社は NULL のまま残す（推測で埋めない）:
--      株式会社Opinio / 株式会社エージェント / 株式会社Translead /
--      株式会社タイミー / 株式会社irodas / 株式会社シンカ /
--      株式会社Third Box / 株式会社データプール
--
-- ── ⚠️ normalize_company_name は既に存在した（適用時に判明）──────────────────
-- baseline 由来の同名関数があり、**スカウトの在籍企業ブロックで現役**だった。
--
--   利用元: get_blocked_companies() / has_worked_at_company() / can_send_scout()
--   呼び元: /biz/candidates（can_send_scout）、/api/jobseeker/scout-settings
--   用途  : ow_experiences.company_text（自由入力）と ow_companies.name の突合
--
-- 旧ルールは「法人格(㈱㈲含む)を **g フラグで位置を問わず**除去 + 空白除去 + 小文字」
-- だけで、全角半角・中黒・ハイフン・句読点・英語法人格に未対応だった。
--
-- **同じ問い（この2つは同じ会社か）に2つの答えを持たせない**ため、
-- 別名の関数を足さず CREATE OR REPLACE で1本に統合する。
--
-- ⚠️ 置き換えによる挙動差は適用前に実測済み（2026-08-12）:
--      企業名の正規化結果が変わる            … 85社中 **12社**（すべて中黒「・」の除去のみ）
--      自由入力(company_text)の結果が変わる  … **0件**
--      在籍企業ブロックの突合                … 旧 0組 → 新 0組（**変化なし**）
--      正規化後の企業名重複                  … 旧 0組 → 新 0組（**変化なし**）
--    差分の向きは「より多く一致する」側なので、在籍企業へスカウトを送らない
--    という目的に対しては安全側。
-- ⚠️ **ただし副作用の向きも記録しておく。** 「より多く一致する」ということは、
--    誤一致した場合に**実際には在籍していない企業からのスカウトもブロックされうる**。
--    今回は実測で突合 0組 → 0組 なので実害はないが、この向きを選んだのは意図的。
--    将来「特定の企業からスカウトが届かない」と言われたら、まずここを疑うこと
--    （get_blocked_companies(候補者のauth_id) を実行して block_reason='experience' の
--     行に心当たりのない企業が出ていないか見る）。
--
-- ⚠️ 旧ルールが対応していた ㈱ / ㈲ は新ルールにも入れた（後退させない）。
-- ⚠️ 旧ルールの g フラグ（位置を問わない除去）はやめ、**前株・後株に限定**した。
--    「日本合同会社設立支援センター」のように法人格が名前の一部である場合に
--    削ってしまうため。実データ85社では位置による差は 0件だった。
-- ⚠️ 事後チェックで「突合の結果集合が1組も変わらないこと」を EXCEPT で実測する。

-- ── 置き換え前に確認した依存（2026-08-12 実測・すべて0件）────────────────────
-- ⚠️ CREATE OR REPLACE で挙動が変わる関数なので、**値をキャッシュ／固定する側**を
--    先に洗った。これらは SQL 関数からの呼び出しと違い実行時に再評価されないため、
--    関数だけ差し替えると中身が古いルールのまま静かにずれ、検知できない。
--
--      式インデックス（pg_index.indexprs）      … 0件（public に式インデックス自体が0本）
--      生成列・既定値（pg_attrdef）             … 0件（public の生成列は1つだけで無関係）
--      マテリアライズドビュー                    … 0件（public にマテビュー自体が0本）
--      CHECK 制約                                … 0件（public の CHECK 122本すべて無関係）
--      pg_depend の被参照                        … 0件
--
--    ⚠️ 検索クエリが壊れていないことは陽性対照で確認済み
--       （同じ書き方で gen_random_uuid を既定値から130件検出できた）。

-- ── 記録：範囲外だが関連する事実 ──────────────────────────────────────────
-- ⚠️ `CompanyAdminDndOverlay.tsx:91` が /admin 配下なのに
--    `@/lib/supabase/client`（ブラウザ）で ow_companies を UPDATE している。
--    CLAUDE.md「/admin 配下ではブラウザ側クライアントを使わない」に反するが、
--    **ow_companies が運営ポリシー(auth_is_admin)を持つ唯一のテーブルだから
--    たまたま動いている**だけ。別タスクで是正する。
--    sort_order しか触らないので本migrationの REVOKE では壊れない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
CREATE TEMP TABLE _baseline ON COMMIT DROP AS
SELECT
  count(*)                                            AS rows_total,
  count(*) FILTER (WHERE source IS NULL)              AS src_null,
  count(*) FILTER (WHERE source = 'manual')           AS src_manual,
  count(*) FILTER (WHERE source = 'admin_seed')       AS src_admin_seed,
  count(*) FILTER (WHERE is_published)                AS published,
  count(slug)                                         AS slug_filled,
  -- ⚠️ 他の列が動いていないことの照合用。name/created_at/公開状態/slug を固定
  md5(string_agg(
        id::text || '|' || name || '|' || created_at::text || '|' ||
        is_published::text || '|' || coalesce(slug,''), E'\n' ORDER BY id)) AS fingerprint
FROM public.ow_companies;

-- ⚠️ **スカウトの在籍企業ブロックが変わらないことの担保。**
--    normalize_company_name は get_blocked_companies / has_worked_at_company /
--    can_send_scout が「自由入力の会社名 ↔ 企業マスタ」の突合キーに使っている
--    （/biz/candidates と /api/jobseeker/scout-settings から実際に呼ばれている）。
--    関数を差し替えるので、**突合の結果集合が1組も変わらないこと**を実測で担保する。
CREATE TEMP TABLE _match_before ON COMMIT DROP AS
SELECT e.id AS experience_id, c.id AS company_id
  FROM public.ow_experiences e
  JOIN public.ow_companies c
    ON public.normalize_company_name(e.company_text) = public.normalize_company_name(c.name)
 WHERE e.company_id IS NULL AND e.company_text IS NOT NULL;

DO $$
DECLARE b record; v int;
BEGIN
  SELECT * INTO b FROM _baseline;
  IF b.rows_total     <> 85 THEN RAISE EXCEPTION 'ow_companies が % 行（想定85）。中止', b.rows_total; END IF;
  IF b.src_null       <> 77 THEN RAISE EXCEPTION 'source NULL が %（想定77）。中止', b.src_null; END IF;
  IF b.src_manual     <> 7  THEN RAISE EXCEPTION 'source manual が %（想定7）。中止', b.src_manual; END IF;
  IF b.src_admin_seed <> 1  THEN RAISE EXCEPTION 'source admin_seed が %（想定1）。中止', b.src_admin_seed; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_companies'
                AND column_name IN ('normalized_name','canonical_company_id')) THEN
    RAISE EXCEPTION '追加しようとした列が既にある。中止';
  END IF;
  -- ⚠️ normalize_company_name は**既に存在する**（baseline 由来）。置き換える。
  --    シグネチャが想定どおりであることを確認してから CREATE OR REPLACE する。
  SELECT count(*) INTO v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='normalize_company_name'
     AND pg_get_function_identity_arguments(p.oid)='p_name text'
     AND pg_get_function_result(p.oid)='text';
  IF v <> 1 THEN
    RAISE EXCEPTION 'normalize_company_name(p_name text) RETURNS text が % 件（想定1）。中止', v;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='find_companies_by_normalized_name') THEN
    RAISE EXCEPTION 'find_companies_by_normalized_name が既にある。中止';
  END IF;

  RAISE NOTICE '適用前: % 行 / source(null %, manual %, admin_seed %) / fingerprint %',
    b.rows_total, b.src_null, b.src_manual, b.src_admin_seed, b.fingerprint;
END $$;

-- ═══ ① 正規化ルール（唯一の定義）═══════════════════════════════════════════
--
-- ⚠️ **このプロジェクトで企業名を正規化する規則はここ1本だけ。**
--    TS 側は正規化値を自分で作らず、⑦ の RPC を呼ぶ。2箇所に書かない。
--
-- 除去・変換するもの
--   ・全角英数 → 半角、大文字 → 小文字
--   ・空白（半角/全角）、中黒（・ ･）、ハイフン類（- ‐ ‑ ‒ – — ― − －）
--   ・句読点（. , ． ，）… "Co., Ltd." を "coltd" にするために必要
--     ⚠️ ハイフンはブラケットの**末尾**に置く。PostgreSQL の ARE は
--        ブラケット内でも \ を特殊扱いするため、\- と書くと意図どおりに動かない。
--   ・法人格（前株・後株の両方）と英語の法人格語尾
--
-- ⚠️ **長音符「ー」(U+30FC) は除去しない。** 「サーバー」「データ」等が壊れる。
--    除去するのはハイフン類と中黒だけ。
--
-- ⚠️ **"Japan" は除去しない。** 指示に無い規則を足すと
--    「Box Japan株式会社」と「株式会社Box」（別会社かもしれない）が
--    勝手に一致してしまう。過検出はレビューキューを膨らませる。
--
-- ⚠️ 英語語尾は kk / gk を**入れていない**。2文字は誤爆しやすく、
--    指示にも明示されていないため。必要になったらここに足す。
CREATE OR REPLACE FUNCTION public.normalize_company_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $fn$
  SELECT nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(translate(p_name,
              'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９',
              'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')),
            '[[:space:]　・･.,．，‐‑‒–—―−－-]', '', 'g'),
          '^(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)', ''),
        '(株式会社|有限会社|合同会社|合資会社|合名会社|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)$', ''),
      '(incorporated|corporation|company|coltd|inc|corp|ltd|llc)\.?$', ''),
    '')
$fn$;

COMMENT ON FUNCTION public.normalize_company_name(text) IS
  '企業名の正規化キー。**この規則の定義はここ1本だけ。** TS 側は find_companies_by_normalized_name() を呼ぶこと。'
  ' ⚠️ ow_companies.normalized_name はこの関数で埋めた派生値なので、'
  ' **このルールを変更したら normalized_name の再バックフィルが必須。**'
  ' ⚠️ スカウトの在籍企業ブロック（has_worked_at_company / can_send_scout / get_blocked_companies）も'
  ' この関数に依存している。変更するとスカウトの届く範囲が変わる。'
  ' ⚠️ 長音符「ー」と "Japan" は除去しない（前者は語が壊れる、後者は別会社を一致させる）。';

-- 呼び出し元: ③のトリガー（authenticated の UPDATE でも発火する）と ⑦の RPC。
-- ⚠️ authenticated が ow_companies を UPDATE するとトリガー経由でこれを呼ぶので
--    EXECUTE が要る。純粋な文字列関数なので anon にも渡して構わない。
GRANT EXECUTE ON FUNCTION public.normalize_company_name(text) TO anon, authenticated, service_role;

-- ═══ ② 列の追加 ═══════════════════════════════════════════════════════════
ALTER TABLE public.ow_companies
  ADD COLUMN normalized_name      text,
  ADD COLUMN canonical_company_id uuid;

ALTER TABLE public.ow_companies
  ADD CONSTRAINT ow_companies_canonical_fkey
    FOREIGN KEY (canonical_company_id) REFERENCES public.ow_companies(id) ON DELETE SET NULL;

-- ⚠️ 自分自身を統合先に指す事故を止める。
ALTER TABLE public.ow_companies
  ADD CONSTRAINT ow_companies_canonical_not_self
    CHECK (canonical_company_id IS NULL OR canonical_company_id <> id);

COMMENT ON COLUMN public.ow_companies.normalized_name IS
  '重複検出用に正規化した企業名。**UNIQUE は張らない**（同名の別会社が実在するため）。'
  ' ⚠️ アプリから書かない。BEFORE INSERT OR UPDATE トリガーが name から必ず再計算する。'
  ' authenticated からは UPDATE を REVOKE 済み。';
COMMENT ON COLUMN public.ow_companies.canonical_company_id IS
  '重複と判断したときの統合先。**印であって参照の付け替えはしない**'
  '（ow_companies を参照する FK は40列あり、うち12本が UNIQUE を持つため）。'
  ' ⚠️ **解決は深さ1しか辿らない前提。** A→B→C の連鎖は CHECK で防げないので、'
  ' 統合先には必ず canonical_company_id が NULL の行を指すこと。'
  ' ⚠️ 運営の判断結果。authenticated からは UPDATE を REVOKE 済みで、service_role でのみ設定する。';

CREATE INDEX ow_companies_normalized_name_idx
  ON public.ow_companies (normalized_name) WHERE normalized_name IS NOT NULL;
CREATE INDEX ow_companies_canonical_idx
  ON public.ow_companies (canonical_company_id) WHERE canonical_company_id IS NOT NULL;

-- ═══ ③ トリガー ═══════════════════════════════════════════════════════════
--
-- ⚠️ **`OF name` を付けない。** name が SET に含まれない UPDATE では発火せず、
--    誰かが normalized_name を直接書いたときに name とずれたまま残る余地がある。
--    毎回再計算しても IMMUTABLE 関数・85行なのでコストは無視できる。
--    「ずれ得ない」ことを構造で保証する。
--
-- ⚠️ SECURITY DEFINER にしている。authenticated の UPDATE でも確実に走らせるため
--    （トリガー関数の EXECUTE 判定はバージョン差があり、依存したくない）。
--    テーブルを一切読まないので昇格の危険は無い。
CREATE FUNCTION public.ow_companies_set_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $trg$
BEGIN
  NEW.normalized_name := public.normalize_company_name(NEW.name);
  RETURN NEW;
END
$trg$;

CREATE TRIGGER trg_ow_companies_normalized_name
  BEFORE INSERT OR UPDATE ON public.ow_companies
  FOR EACH ROW EXECUTE FUNCTION public.ow_companies_set_normalized_name();

-- ═══ ④ normalized_name のバックフィル ═════════════════════════════════════
-- ⚠️ **これは「追加のみ」の例外。** normalized_name だけを対象にする。
--    トリガーが既にあるので、この UPDATE でも同じ関数が走って同じ値になる。
UPDATE public.ow_companies
   SET normalized_name = public.normalize_company_name(name);

-- ═══ ⑤ source のバックフィル（69社のみ・id で明示列挙）═══════════════════
--
-- ⚠️ CLAUDE.md「全社一括の UPDATE を禁止する。対象を id または name で明示列挙する」
--    に従い、69件を id で列挙する。条件式で絞らない。
-- ⚠️ source が既に入っている8社（manual 7 / admin_seed 1）は対象外。
-- ⚠️ archive で実在を確認できなかった8社は **NULL のまま**。推測で埋めない。
UPDATE public.ow_companies
   SET source = 'migration'
 WHERE source IS NULL
   AND id IN (
    '6c218a59-a951-44ee-9003-163956376554'::uuid,  -- Asana Japan株式会社
    'c7353772-0c07-4f0d-8d20-294215125303'::uuid,  -- Box Japan株式会社
    '87bcae88-2779-4bf7-b461-b3c8661b2764'::uuid,  -- CrowdStrike株式会社
    'ae15610d-477a-410d-b74a-54ab3e351add'::uuid,  -- Databricks Japan株式会社
    'a5ffac90-70aa-4242-b867-6d9334317851'::uuid,  -- Datadog Japan株式会社
    'da8cfab5-f5c2-4648-b866-895be46a1494'::uuid,  -- DocuSign Japan株式会社
    '1f73df31-8e55-4e70-a928-afe1150d72d0'::uuid,  -- Dropbox Japan株式会社
    'aaaaaaaa-0001-0001-0001-000000000007'::uuid,  -- HubSpot Japan株式会社
    'e7e9b0be-20c2-4434-afea-7a27c89332e2'::uuid,  -- Indeed Japan株式会社
    '0ece9af4-96cb-443c-b8a8-0f358c8e3a64'::uuid,  -- Meta日本法人
    '565b0f13-252d-44d0-8b90-e00acacf4b75'::uuid,  -- MongoDB Japan合同会社
    'bf24736f-fa65-4c5a-9764-98c96ace3b07'::uuid,  -- Notion Labs Japan合同会社
    'daa558e5-054f-4475-ab00-3817170759ce'::uuid,  -- OpenAI Japan合同会社
    'bcea5e4e-94ee-4019-8ce3-237a7edf79a7'::uuid,  -- SAPジャパン株式会社
    '8b9f84b0-b4be-4191-8322-07c6a2e5e91a'::uuid,  -- Sansan株式会社
    '4df6e844-74d6-4f50-98f9-08468a12f1dc'::uuid,  -- ServiceNow Japan合同会社
    'cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16'::uuid,  -- Slack Japan株式会社
    'cb70da1c-4b3b-429b-a06b-cdc2c50172f8'::uuid,  -- Snowflake Japan株式会社
    '88defb4b-b18c-437b-8b7d-d41a43232af4'::uuid,  -- Twilio Japan合同会社
    'fb7397eb-a9c7-4ce3-964a-d7a72159847f'::uuid,  -- Ubie株式会社
    'd6650b18-5ef2-40c9-9938-2adbad70fe2b'::uuid,  -- Zendesk株式会社
    '6396920c-70d3-47d2-9f4e-67bc2efe262f'::uuid,  -- アカマイ・テクノロジーズ合同会社
    'dcd2c652-4335-4031-b4d2-a4f22c98182b'::uuid,  -- アップルジャパン合同会社
    'fc1f7cb7-9530-4d6a-85cf-15196a4b155e'::uuid,  -- アトラシアン株式会社
    'eccd3dfb-decd-4277-a3a4-df489d3b3e5e'::uuid,  -- アドビ株式会社
    '08e4aff6-a12c-4963-ad43-960ac9e39967'::uuid,  -- アプティオ株式会社
    'a9de1561-eb91-4ebf-842d-f6d39865b7ef'::uuid,  -- アマゾン ウェブ サービス ジャパン合同会社
    '3efd857e-315c-4650-9727-1e5aa1245753'::uuid,  -- アリスタネットワークス合同会社
    'f32e6905-f25f-4c01-b64f-c5695fd45a1d'::uuid,  -- アンソロピックジャパン合同会社
    'ec97fde1-6f22-4ab5-89ee-9cea0b258f2a'::uuid,  -- インテル株式会社
    'e3eafa66-02ce-4060-a5fe-57e4317c8e7c'::uuid,  -- ウォークミー株式会社
    '943620b5-0fa2-48b4-a072-d47f900ba9f0'::uuid,  -- ウーバー・ジャパン株式会社
    'b8aa0e3d-828c-4bbe-b588-88450aab5739'::uuid,  -- エヌシーノ合同会社
    '829a1ea9-d577-4404-9ba7-e301680523a8'::uuid,  -- エヌビディア合同会社
    '1e541353-c177-40a9-968a-af3af14e1194'::uuid,  -- エラスティック株式会社
    'f8ebbe74-b647-46ea-869f-b126d1c4f316'::uuid,  -- オクタ・ジャパン株式会社
    'a1a7036b-a5c4-4328-b5db-96ac1d5e29df'::uuid,  -- キリバ株式会社
    '94edfbe5-0496-4c1d-865c-d2d448232135'::uuid,  -- クアルコムジャパン合同会社
    '0a216ebb-c1fa-4d19-b066-f45e45c3ba2e'::uuid,  -- クラウドフレア・ジャパン株式会社
    '1413b97e-ef19-4e40-87ae-e31ac8996bdd'::uuid,  -- クリックハウス株式会社
    '1027a327-18c0-4191-b27b-a28bf5781126'::uuid,  -- クーパ・ソフトウェア株式会社
    '7d186c45-ce23-4d96-8eae-cd6e7c00faee'::uuid,  -- グーグル合同会社
    '4fecbf31-498c-40b0-a04e-3a6cb978433f'::uuid,  -- ゲインサイト・ジャパン株式会社
    '91523b3b-15e4-4f6b-8c9b-a90b67552b9e'::uuid,  -- コンカー株式会社
    'e459ac79-5dad-499d-bb65-b758d4281123'::uuid,  -- コング・ジャパン株式会社
    '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'::uuid,  -- コンフルエント合同会社
    '1241f8a5-b645-4aa2-9fa1-bbfc573f1774'::uuid,  -- ザクトリー株式会社
    '27988ac1-fd93-445d-a9fd-6dad74c92686'::uuid,  -- シスコシステムズ合同会社
    'dd76b17d-e3c1-44a9-b747-4ecde10b8cec'::uuid,  -- ゼットスケーラー株式会社
    'f4acddc0-c746-4537-9edf-6f3c1f2c90b3'::uuid,  -- デル・テクノロジーズ株式会社
    '99132c64-ff07-4945-aeb6-7e21e6c256c9'::uuid,  -- ノービフォー株式会社
    'be74d989-db8f-4be1-882c-40cf94e07fe2'::uuid,  -- パランティア・テクノロジーズ
    'f4a6aa23-3775-4548-981b-156e416ef6f6'::uuid,  -- パロアルトネットワークス株式会社
    '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'::uuid,  -- フォーティネット株式会社
    '53ea9a54-feef-413b-8a7c-e31e4def2e11'::uuid,  -- ブラックライン株式会社
    '478a9ede-ea0f-48c1-859c-d47f84d35b6b'::uuid,  -- ブレイズ株式会社
    '7baafcb1-d929-46c1-97be-b0fb580b480b'::uuid,  -- ページャーデューティー株式会社
    'e4d317d3-48b9-4718-ae3e-8d27147d05f5'::uuid,  -- マルケト株式会社
    '355ce5c6-0412-4512-8864-1d477c97c917'::uuid,  -- ミラクル株式会社
    'f201ed17-a9e2-4859-85aa-474578b2870d'::uuid,  -- レノボ・ジャパン合同会社
    '7dac3c6e-bc5f-4550-9170-4338ea809be2'::uuid,  -- ヴイエムウェア株式会社
    '9ef65fa1-e04b-4098-a7b1-4ee3d535a23a'::uuid,  -- 日本IBM株式会社
    '1f8010f2-ba3f-4f7a-b7f4-d5b60400e638'::uuid,  -- 日本オラクル株式会社
    '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6'::uuid,  -- 日本ヒューレット・パッカード合同会社
    '40dca29e-aa4b-4654-aada-8e29763f8521'::uuid,  -- 日本マイクロソフト株式会社
    '09d67e54-0381-45c8-b698-568e1fc47033'::uuid,  -- 株式会社PKSHA Technology
    '81aa95dc-2304-4faa-9c4a-f2f5454e8e11'::uuid,  -- 株式会社SmartHR
    '8dc04d46-3430-45de-91f8-e37c8880b8a5'::uuid,  -- 株式会社ワークデイ
    'c32027b9-cfbd-4a70-bf4c-464e42790db4'::uuid  -- 株式会社日本HP
);

-- ═══ ⑥ 列単位 REVOKE ═══════════════════════════════════════════════════════
--
-- ⚠️ ow_companies の GRANT は**テーブルレベル**（anon:SELECT / authenticated:SELECT+IUD）。
--    放っておくと新列も authenticated から書けてしまう。
--      normalized_name      … アプリが書く必要が無い（トリガーが計算する）
--      canonical_company_id … 運営の判断結果。企業や求職者が書き換える値ではない
--
-- ⚠️ SELECT は残す。canonical は ID ポインタなので実害が無い。
-- ⚠️ 既存の UPDATE 経路10箇所を洗い済み。すべて明示的な列リストで、
--    この2列を SET するものは1つも無い（transformFormToDb も42列のホワイトリスト）。
--    したがって 403 で落ちる経路は無い。
--
-- ⚠️⚠️ **`REVOKE UPDATE (列) FROM authenticated` だけでは効かない。**
--    PostgreSQL では、**テーブルレベルの UPDATE を持つロールに対する
--    列単位の REVOKE は no-op** になる（テーブルレベルが全列を含意するため）。
--    2026-08-12 に実際に踏み、事後チェック⑨で検知して1度ロールバックした。
--
--    正しい手順は「テーブルレベルを落として、除きたい列以外を付け直す」。
--    列は information_schema から動的に組み立てる（手で列挙すると取りこぼす）。
--
-- ⚠️ **副作用: これ以降 ow_companies に列を足すと、authenticated からは
--    書けない状態で生まれる。** 明示的に GRANT UPDATE (新列) が必要になる。
--    「書いていない＝権限が無い」に倒れるので方向としては正しいが、
--    次に列を足す人が 403 を踏むので、ここに書き残しておく。
REVOKE UPDATE ON TABLE public.ow_companies FROM authenticated;

DO $$
DECLARE v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_companies'
     AND column_name NOT IN ('normalized_name','canonical_company_id');
  IF v_cols IS NULL THEN RAISE EXCEPTION '付け直す列が取れない。ロールバック'; END IF;
  EXECUTE format('GRANT UPDATE (%s) ON TABLE public.ow_companies TO authenticated', v_cols);
END $$;

-- ═══ ⑦ 照合 RPC ═══════════════════════════════════════════════════════════
--
-- ⚠️ TS 側は**生の社名を渡すだけ**。正規化値を受け取ってから .eq() で引くと
--    往復が2回になり、規則がアプリ側にも書かれる余地が残る。
--    照合そのものを1本にして、呼ぶ単位を「照合」にする。
--
-- ⚠️ SECURITY INVOKER。呼び出し元の権限で ow_companies を読む。
--    重複検出は非公開企業も見る必要があるので、admin クライアント（service_role）から呼ぶ。
CREATE FUNCTION public.find_companies_by_normalized_name(p_name text)
RETURNS TABLE (
  id uuid, name text, slug text,
  is_published boolean, is_approved boolean,
  source text, canonical_company_id uuid, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT c.id, c.name, c.slug, c.is_published, c.is_approved,
         c.source, c.canonical_company_id, c.created_at
    FROM public.ow_companies c
   WHERE c.normalized_name IS NOT NULL
     AND c.normalized_name = public.normalize_company_name(p_name)
   ORDER BY c.created_at
$fn$;

COMMENT ON FUNCTION public.find_companies_by_normalized_name(text) IS
  '生の企業名を渡すと、正規化して一致する既存企業を返す。重複検出用。'
  ' ⚠️ 一致しても作成を止めないこと（同名の別会社が実在する）。レビュー対象の判定に使う。';

-- ⚠️ service_role のみ。重複検出は非公開企業も見るため、admin クライアントから呼ぶ。
--    session クライアントから呼ぶ必要が出たらそのとき足す（今は渡さない）。
GRANT EXECUTE ON FUNCTION public.find_companies_by_normalized_name(text) TO service_role;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  b record; v int; v_txt text; v_fp text;
BEGIN
  SELECT * INTO b FROM _baseline;

  -- ① 行数が不変
  SELECT count(*) INTO v FROM public.ow_companies;
  IF v <> b.rows_total THEN RAISE EXCEPTION '行数が %（適用前 %）。ロールバック', v, b.rows_total; END IF;

  -- ② ⚠️ 他の列が1つも動いていないこと
  SELECT md5(string_agg(
           id::text || '|' || name || '|' || created_at::text || '|' ||
           is_published::text || '|' || coalesce(slug,''), E'\n' ORDER BY id))
    INTO v_fp FROM public.ow_companies;
  IF v_fp IS DISTINCT FROM b.fingerprint THEN
    RAISE EXCEPTION 'name/created_at/is_published/slug のいずれかが変化した。ロールバック';
  END IF;

  -- ③ normalized_name が全行埋まった
  SELECT count(*) INTO v FROM public.ow_companies WHERE normalized_name IS NULL;
  IF v <> 0 THEN RAISE EXCEPTION 'normalized_name が NULL の行が % 件。ロールバック', v; END IF;

  -- ④ source の内訳（69 / 8 / 7 / 1）
  SELECT count(*) INTO v FROM public.ow_companies WHERE source='migration';
  IF v <> 69 THEN RAISE EXCEPTION 'source=migration が %（想定69）。ロールバック', v; END IF;
  SELECT count(*) INTO v FROM public.ow_companies WHERE source IS NULL;
  IF v <> 8  THEN RAISE EXCEPTION 'source NULL が %（想定8）。ロールバック', v; END IF;
  SELECT count(*) INTO v FROM public.ow_companies WHERE source='manual';
  IF v <> b.src_manual THEN RAISE EXCEPTION 'source=manual が %（適用前 %）。ロールバック', v, b.src_manual; END IF;
  SELECT count(*) INTO v FROM public.ow_companies WHERE source='admin_seed';
  IF v <> b.src_admin_seed THEN RAISE EXCEPTION 'source=admin_seed が %（適用前 %）。ロールバック', v, b.src_admin_seed; END IF;

  -- ⑤ canonical は誰にも設定していない
  SELECT count(*) INTO v FROM public.ow_companies WHERE canonical_company_id IS NOT NULL;
  IF v <> 0 THEN RAISE EXCEPTION 'canonical_company_id が % 件入っている（想定0）。ロールバック', v; END IF;

  -- ⑥ 正規化関数の挙動（全角・大文字・前株後株・空白・中黒・ハイフン・長音符）
  IF public.normalize_company_name('株式会社Ｏｐｉｎｉｏ')       <> 'opinio'   THEN RAISE EXCEPTION '正規化NG: 全角＋前株'; END IF;
  IF public.normalize_company_name('OPINIO 株式会社')            <> 'opinio'   THEN RAISE EXCEPTION '正規化NG: 後株＋空白'; END IF;
  IF public.normalize_company_name('（株）オピニオ')             <> 'オピニオ' THEN RAISE EXCEPTION '正規化NG: （株）'; END IF;
  IF public.normalize_company_name('Opinio Inc.')                <> 'opinio'   THEN RAISE EXCEPTION '正規化NG: Inc.'; END IF;
  IF public.normalize_company_name('Opinio Co., Ltd.')           <> 'opinio'   THEN RAISE EXCEPTION '正規化NG: Co.,Ltd.'; END IF;
  IF public.normalize_company_name('オピニオ・テック')           <> 'オピニオテック' THEN RAISE EXCEPTION '正規化NG: 中黒'; END IF;
  IF public.normalize_company_name('オピニオ-テック')            <> 'オピニオテック' THEN RAISE EXCEPTION '正規化NG: ハイフン'; END IF;
  -- ⚠️ 長音符は残る。ここが壊れると「サーバー」等が別語になる
  IF public.normalize_company_name('株式会社サーバー')           <> 'サーバー' THEN RAISE EXCEPTION '正規化NG: 長音符を消してしまった'; END IF;
  -- ⚠️ Japan は残る（別会社を一致させないため）
  IF public.normalize_company_name('Box Japan株式会社')          <> 'boxjapan' THEN RAISE EXCEPTION '正規化NG: Japan を消してしまった'; END IF;
  IF public.normalize_company_name('株式会社')                   IS NOT NULL   THEN RAISE EXCEPTION '正規化NG: 空文字を NULL にしていない'; END IF;

  -- ⑦ トリガーが全 UPDATE で発火する（OF name になっていない）
  SELECT count(*) INTO v FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname='ow_companies' AND t.tgname='trg_ow_companies_normalized_name' AND NOT t.tgisinternal;
  IF v <> 1 THEN RAISE EXCEPTION 'トリガーが % 本（想定1）。ロールバック', v; END IF;
  SELECT pg_get_triggerdef(t.oid) INTO v_txt FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname='ow_companies' AND t.tgname='trg_ow_companies_normalized_name';
  IF v_txt ILIKE '%UPDATE OF%' THEN RAISE EXCEPTION 'トリガーが UPDATE OF になっている。ロールバック'; END IF;

  -- ⑧ 制約と index
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.ow_companies'::regclass
                  AND conname='ow_companies_canonical_not_self') THEN
    RAISE EXCEPTION '自己参照禁止の CHECK が無い。ロールバック'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.ow_companies'::regclass
                  AND conname='ow_companies_canonical_fkey') THEN
    RAISE EXCEPTION 'canonical の FK が無い。ロールバック'; END IF;
  SELECT count(*) INTO v FROM pg_indexes WHERE schemaname='public'
   AND indexname IN ('ow_companies_normalized_name_idx','ow_companies_canonical_idx');
  IF v <> 2 THEN RAISE EXCEPTION 'index が % 本（想定2）。ロールバック', v; END IF;

  -- ⑨ 権限：2列は authenticated から書けない / 読めるのは維持 / 他列の UPDATE は無傷
  IF has_column_privilege('authenticated','public.ow_companies','normalized_name','UPDATE')
     OR has_column_privilege('authenticated','public.ow_companies','canonical_company_id','UPDATE') THEN
    RAISE EXCEPTION '2列の UPDATE が authenticated に残っている。ロールバック'; END IF;
  IF NOT has_column_privilege('authenticated','public.ow_companies','normalized_name','SELECT')
     OR NOT has_column_privilege('anon','public.ow_companies','canonical_company_id','SELECT') THEN
    RAISE EXCEPTION 'SELECT まで剥がしている。ロールバック'; END IF;
  -- ⚠️ 既存10経路が使う列の UPDATE が生きていること
  -- ⚠️ 個別に列挙せず**全列**を舐める。取りこぼすと既存経路が 403 で落ちる。
  SELECT count(*) INTO v FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_companies'
     AND column_name NOT IN ('normalized_name','canonical_company_id')
     AND NOT has_column_privilege('authenticated','public.ow_companies',column_name,'UPDATE');
  IF v <> 0 THEN
    SELECT string_agg(column_name, ', ') INTO v_txt FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_companies'
       AND column_name NOT IN ('normalized_name','canonical_company_id')
       AND NOT has_column_privilege('authenticated','public.ow_companies',column_name,'UPDATE');
    RAISE EXCEPTION '% 列の UPDATE を巻き添えにした（%）。ロールバック', v, v_txt;
  END IF;
  -- authenticated の SELECT / INSERT / DELETE はテーブルレベルのまま無傷
  IF NOT has_table_privilege('authenticated','public.ow_companies','SELECT')
     OR NOT has_table_privilege('authenticated','public.ow_companies','INSERT')
     OR NOT has_table_privilege('authenticated','public.ow_companies','DELETE') THEN
    RAISE EXCEPTION 'authenticated の SELECT/INSERT/DELETE を巻き添えにした。ロールバック'; END IF;
  -- service_role は無傷
  IF NOT has_column_privilege('service_role','public.ow_companies','canonical_company_id','UPDATE')
     OR NOT has_column_privilege('service_role','public.ow_companies','normalized_name','UPDATE') THEN
    RAISE EXCEPTION 'service_role が2列を書けない。ロールバック'; END IF;

  -- ⑩ ⚠️ スカウトの在籍企業ブロックの突合が1組も変わっていないこと
  SELECT count(*) INTO v FROM (
    (SELECT experience_id, company_id FROM _match_before
     EXCEPT
     SELECT e.id, c.id FROM public.ow_experiences e JOIN public.ow_companies c
       ON public.normalize_company_name(e.company_text) = public.normalize_company_name(c.name)
      WHERE e.company_id IS NULL AND e.company_text IS NOT NULL)
    UNION ALL
    (SELECT e.id, c.id FROM public.ow_experiences e JOIN public.ow_companies c
       ON public.normalize_company_name(e.company_text) = public.normalize_company_name(c.name)
      WHERE e.company_id IS NULL AND e.company_text IS NOT NULL
     EXCEPT
     SELECT experience_id, company_id FROM _match_before)
  ) d;
  IF v <> 0 THEN
    RAISE EXCEPTION '在籍企業ブロックの突合が % 組変化した（スカウトの挙動が変わる）。ロールバック', v;
  END IF;

  -- ⑪ 旧ルールが対応していた ㈱ / ㈲ を後退させていないこと
  IF public.normalize_company_name('㈱オピニオ')   <> 'オピニオ' THEN RAISE EXCEPTION '正規化NG: ㈱'; END IF;
  IF public.normalize_company_name('オピニオ㈲')   <> 'オピニオ' THEN RAISE EXCEPTION '正規化NG: ㈲'; END IF;

  -- ⑫ 正規化後の重複（現時点では0組のはず）
  SELECT count(*) INTO v FROM (
    SELECT normalized_name FROM public.ow_companies
     WHERE normalized_name IS NOT NULL GROUP BY normalized_name HAVING count(*) > 1) t;
  IF v <> 0 THEN RAISE NOTICE '⚠️ 正規化後に重複が % 組ある。レビュー対象', v; END IF;

  RAISE NOTICE '完了: 85行 無変更（fingerprint 一致）/ 在籍企業ブロックの突合 無変化 / normalized_name 全行 / source(migration 69, null 8, manual %, admin_seed %) / 重複 % 組',
    b.src_manual, b.src_admin_seed, v;
END $$;

COMMIT;
