-- ============================================================================
-- normalize_company_name に「かな畳み」を足す
--   ひらがな → カタカナ ／ 半角カナ → 全角カナ
--   ★長音「ー」は落とさない（理由は下と関数の COMMENT）
--
-- 作業前ダンプ: .dumps/（このコミットの直前に取得）
-- 調査: docs/phase0-company-name-normalization-20260905.md
-- ============================================================================
--
-- ⚠️★**この関数は重複検出専用ではない。** `can_send_scout` と
--    `get_blocked_companies`（＝**スカウトのブロック判定**）も使っている:
--      normalize_company_name(e.company_text) = normalize_company_name(c.name)
--    「自由入力の社名でも在籍企業を一致させる」条件。
--
-- ⚠️ **緩める方向は fail-safe。** 一致が増える＝**より多くブロックする**ので、
--    勧誘してはいけない相手に送ってしまう向きには倒れない。
--    **逆に厳しくする変更は危険**（ブロックが漏れる）。今回は緩める側だけ。
--
-- ── 何を足すか ────────────────────────────────────────────────────────────
--   ① ひらがな → カタカナ（U+3041..U+3096 → U+30A1..U+30F6）
--   ② 半角カナ → 全角カナ（★濁点・半濁点は2文字なので**先に**畳む）
--
-- ── ★長音「ー」を落とさない理由（消さないこと）────────────────────────────
-- 「打ち忘れ」を掲載25社ぶん救えるが、落とすと **コーポ＝コポ／カード＝カド／
-- ミラー＝ミラ** が同じ値になる。実データ100社では衝突0だが、それは母数が
-- 100しかないからで、**企業が増えるほど確実に衝突する方向の変換**。
--
-- ★倒れ方が非対称なのが決め手:
--   ・重複して作られたものは**運営が後から統合できる**
--   ・別会社を同一視した誤りは**利用者の職歴に残る**
-- しかも「もしかしてこれ？」は**止めない**設計なので、過剰一致は
-- 「押してしまう」形の事故になる。**残す側に倒す。**
-- 打ち忘れを救いたいなら、**確定させない候補提示（ILIKE / 別名）で拾う。**

BEGIN;

-- ── 0. 事前チェック（変更しないものが変わっていないこと）──────────────────
DO $$
DECLARE v_md5 text;
BEGIN
  SELECT md5(pg_get_functiondef(oid)) INTO v_md5 FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname='can_send_scout';
  IF v_md5 <> 'aad4c3a11cdecb48d465d5030780605a' THEN
    RAISE EXCEPTION 'can_send_scout が想定と違う（% ）。ブロック判定の前提が変わっているので中止', v_md5;
  END IF;
  SELECT md5(pg_get_functiondef(oid)) INTO v_md5 FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname='get_blocked_companies';
  IF v_md5 <> '2774541aa75374cdb69a3c97027d18c6' THEN
    RAISE EXCEPTION 'get_blocked_companies が想定と違う（% ）。中止', v_md5;
  END IF;
END $$;

-- ★変更前のブロック結果を控える（後で「減っていないこと」を確かめる）
--   ⚠️ 戻り値の列は `company_id / company_name / block_reason`。**`id` ではない**
--      （最初 `b.id` と書いて 42703 で落ちた。トランザクションごと巻き戻っている）。
CREATE TEMP TABLE _blocked_before ON COMMIT DROP AS
SELECT u.auth_id AS auth_user_id, b.company_id
  FROM public.ow_users u
  CROSS JOIN LATERAL public.get_blocked_companies(u.auth_id) b
 WHERE u.auth_id IS NOT NULL;

-- ★can_send_scout の判定も控える（変わる組み合わせを全部列挙するため）
--   ⚠️ 引数は (p_company_id, p_candidate_id)。candidate は **auth 空間**。
CREATE TEMP TABLE _scout_before ON COMMIT DROP AS
SELECT u.auth_id AS auth_user_id, c.id AS company_id,
       public.can_send_scout(c.id, u.auth_id) AS allowed
  FROM public.ow_users u CROSS JOIN public.ow_companies c
 WHERE u.auth_id IS NOT NULL;

-- ★変更前の正規化値も控える
CREATE TEMP TABLE _norm_before ON COMMIT DROP AS
SELECT id, name, normalized_name FROM public.ow_companies;

-- ── 1. 関数を差し替える ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_company_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
SET search_path TO 'pg_catalog'
AS $function$
  WITH s0(v) AS (SELECT p_name),
  /* ── ② 半角カナ → 全角カナ ─────────────────────────────────────────
        ⚠️★濁点・半濁点は **2文字**（ｶ + ﾞ）なので、単独カナの translate より
           **先に**1文字へ畳む。順序を入れ替えると「カ゛」のような
           中途半端な列が残り、全角の「ガ」と一致しなくなる。 */
  d1(v) AS (SELECT replace(replace(replace(replace(replace(v,
              'ｶﾞ','ガ'),'ｷﾞ','ギ'),'ｸﾞ','グ'),'ｹﾞ','ゲ'),'ｺﾞ','ゴ') FROM s0),
  d2(v) AS (SELECT replace(replace(replace(replace(replace(v,
              'ｻﾞ','ザ'),'ｼﾞ','ジ'),'ｽﾞ','ズ'),'ｾﾞ','ゼ'),'ｿﾞ','ゾ') FROM d1),
  d3(v) AS (SELECT replace(replace(replace(replace(replace(v,
              'ﾀﾞ','ダ'),'ﾁﾞ','ヂ'),'ﾂﾞ','ヅ'),'ﾃﾞ','デ'),'ﾄﾞ','ド') FROM d2),
  d4(v) AS (SELECT replace(replace(replace(replace(replace(v,
              'ﾊﾞ','バ'),'ﾋﾞ','ビ'),'ﾌﾞ','ブ'),'ﾍﾞ','ベ'),'ﾎﾞ','ボ') FROM d3),
  d5(v) AS (SELECT replace(replace(replace(replace(replace(v,
              'ﾊﾟ','パ'),'ﾋﾟ','ピ'),'ﾌﾟ','プ'),'ﾍﾟ','ペ'),'ﾎﾟ','ポ') FROM d4),
  d6(v) AS (SELECT replace(v, 'ｳﾞ', 'ヴ') FROM d5),
  hw(v) AS (SELECT translate(v,
              'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
              'ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン') FROM d6),
  /* ── ① ひらがな → カタカナ（U+3041..U+3096 → U+30A1..U+30F6）──────────
        ⚠️ 打ち間違いではなく**入力方式の差**（変換し忘れ）なので、
           音が同じものしか一致しない。過剰一致は起きない。 */
  kk(v) AS (SELECT translate(v,
              'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ',
              'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ') FROM hw)
  /* ── ここから下は 2026-09-05 以前と同じ ─────────────────────────────
        ⚠️★除去する記号の集合に **「ー」(U+30FC) を足さないこと。**
           集合にあるのはハイフン・ダッシュ類（‐‑‒–—―−－-）だけ。
           理由は関数の COMMENT を読むこと。 */
  SELECT nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(translate(kk.v,
              'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９',
              'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')),
            '[[:space:]　・･.,．，‐‑‒–—―−－-]', '', 'g'),
          '^(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)', ''),
        '(株式会社|有限会社|合同会社|合資会社|合名会社|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)$', ''),
      '(incorporated|corporation|company|coltd|inc|corp|ltd|llc)\.?$', ''),
    '')
  FROM kk
$function$;

COMMENT ON FUNCTION public.normalize_company_name(text) IS
  '企業名の照合用に正規化する。全角英数→半角／小文字化／空白と記号の除去／法人格の除去（和英）'
  'に加えて、2026-09-05 から **ひらがな→カタカナ** と **半角カナ→全角カナ** を畳む。'
  '⚠★**長音「ー」は落とさない。足さないこと。** 落とすと「打ち忘れ」を救える代わりに'
  'コーポ＝コポ／カード＝カド／ミラー＝ミラ が同じ値になる。倒れ方が非対称で、'
  '重複は運営が後から統合できるのに対し、別会社を同一視した誤りは利用者の職歴に残る。'
  'しかも「もしかしてこれ？」は止めない設計なので、過剰一致は「押してしまう」形の事故になる。'
  '打ち忘れを救うなら、確定させない候補提示（ILIKE / 別名）側で拾うこと。'
  '⚠★**別名や辞書を持ち込まないこと**（Salesforce⇔セールスフォースは規則が一意に定まらない）。'
  '別名の照合は find_companies_by_normalized_name が brand_name / name_en / search_aliases で行う。'
  '⚠★この関数は重複検出専用ではない。can_send_scout / get_blocked_companies'
  '（スカウトのブロック判定）も使っている。緩める方向は fail-safe（より多くブロックする）だが、'
  '**厳しくする変更はブロックが漏れる**。';

-- ── 2. 既存100社の normalized_name を再計算 ────────────────────────────────
--   ⚠️ トリガー（BEFORE INSERT OR UPDATE）が name から必ず計算するので、
--      name を自分自身で更新すれば再計算される。
--   ⚠️★`updated_at` を触るトリガーは無いので、**/companies の「新着順」は動かない**
--      （実測で確認済み。ow_companies のトリガーは2本だけ）。
UPDATE public.ow_companies SET name = name;

-- ── 3. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_changed int; v_dup int; v_lost int; v_total int;
BEGIN
  -- ★値が変わるのは2社のはず（合同会社やめるラボ・みずほ証券株式会社）
  SELECT count(*) INTO v_changed
    FROM public.ow_companies c JOIN _norm_before b ON b.id = c.id
   WHERE c.normalized_name IS DISTINCT FROM b.normalized_name;
  IF v_changed <> 2 THEN
    RAISE EXCEPTION '正規化値が変わったのが 2 社でない（% 社）。想定と違うので中止', v_changed;
  END IF;

  -- ★衝突（同じ正規化値が2社以上）が生まれていないこと
  SELECT count(*) INTO v_dup FROM (
    SELECT normalized_name FROM public.ow_companies
     WHERE normalized_name IS NOT NULL
     GROUP BY normalized_name HAVING count(*) > 1) s;
  IF v_dup <> 0 THEN
    RAISE EXCEPTION '正規化値が衝突した組が % 組できた。中止', v_dup;
  END IF;

  -- ★冪等: もう一度計算しても値が変わらないこと
  SELECT count(*) INTO v_changed FROM public.ow_companies
   WHERE normalized_name IS DISTINCT FROM public.normalize_company_name(name);
  IF v_changed <> 0 THEN RAISE EXCEPTION '再計算で % 社ずれる（冪等でない）', v_changed; END IF;

  -- ★★スカウトのブロックが**減っていないこと**（増えるのは fail-safe 側なので可）
  SELECT count(*) INTO v_lost FROM _blocked_before b
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ow_users u
       CROSS JOIN LATERAL public.get_blocked_companies(u.auth_id) g
      WHERE u.auth_id = b.auth_user_id AND g.company_id = b.company_id);
  IF v_lost > 0 THEN
    RAISE EXCEPTION 'ブロック対象が % 件**減った**。勧誘してはいけない相手に送れてしまう。中止', v_lost;
  END IF;

  -- ★can_send_scout の判定が変わった組み合わせを**全部**出す。
  --   ⚠️ true → false（より止める）は fail-safe なので通す。
  --      **false → true（止まらなくなる）が1件でもあれば中止する。**
  DECLARE r record; v_flip int := 0; v_open int := 0;
  BEGIN
    FOR r IN
      SELECT b.auth_user_id, b.company_id, b.allowed AS before_allowed,
             public.can_send_scout(b.company_id, b.auth_user_id) AS after_allowed
        FROM _scout_before b
       WHERE b.allowed IS DISTINCT FROM public.can_send_scout(b.company_id, b.auth_user_id)
    LOOP
      v_flip := v_flip + 1;
      IF r.after_allowed THEN v_open := v_open + 1; END IF;
      RAISE NOTICE '判定が変わった: user=% company=% % → %',
        r.auth_user_id, r.company_id, r.before_allowed, r.after_allowed;
    END LOOP;
    IF v_open > 0 THEN
      RAISE EXCEPTION 'can_send_scout が % 件 false→true になった（止まらなくなる側）。中止', v_open;
    END IF;

    SELECT count(*) INTO v_total FROM _blocked_before;
    RAISE NOTICE '事後チェック OK: 値が変わった 2 社 / 衝突 0 組 / 冪等 / ブロック % 件が維持 / can_send_scout の変化 % 件（false→true は 0）',
      v_total, v_flip;
  END;
END $$;

COMMIT;
