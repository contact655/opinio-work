-- 横断検索（/search）のログ
--
-- ★なぜ要るか
--   解釈レイヤー（lib/search/interpretQuery.ts）は「当たり外れがある前提」の仕組みで、
--   いまはルールベース、いずれ LLM に差し替える。**外したことを後から確認できないと直せない。**
--   とくに `unresolved`（語彙に無くて条件にできなかった語）が、
--   次に何を語彙へ足すべきかの唯一の入力になる。
--
--   2026-08-26 の調査時点で、検索を記録しているテーブルもアプリ側の計測も**存在しなかった**
--   （`ow_contact_logs` は企業→候補者のアクション記録で無関係。posthog / gtag も src に0件）。
--
-- ★権限は ow_transitions と同じ方針
--   RLS は有効にするが**ポリシーは1本も作らない**。anon にも authenticated にも GRANT しない。
--   書き込みはサーバー側の admin クライアント（service_role）だけ。
--   ⚠️ anon に INSERT を開けない。開けると誰でも書き込めるテーブルになる。
--   ⚠️ 読むのも admin だけ。`query` には利用者が打った文字列がそのまま入り、
--      個人名などが含まれうる（「◯◯社の△△さん」）。**保持期間は別途決めること。**

create table if not exists public.ow_search_logs (
  id           uuid primary key default gen_random_uuid(),

  -- 利用者が打った文字列（正規化前）。⚠️ 個人情報が入りうる
  query        text not null,

  -- 解釈した主対象。⚠️ UI / API / DB の3つを揃える方針に従い CHECK を張る。
  --    値を足すときは lib/search/interpretQuery.ts の SearchKind と
  --    lib/search/searchLog.ts の SEARCH_KINDS も同時に直すこと。
  primary_kind text not null,

  -- 解決済みの条件（Condition[] をそのまま）。role_id / domain_id / company_id が入る
  conditions   jsonb,

  -- ★語彙に無くて条件にできなかった語。ここが辞書拡充の入力になる
  unresolved   text[],

  -- 主対象の総件数（表示件数ではない）
  result_count integer,

  -- ⚠️ **ow_users.id 空間**（auth.users.id ではない）。
  --    未ログインでも検索できるので **NULL 可**。NOT NULL にすると
  --    いちばん見たい層（LP のヒーロー検索から来る未ログイン）が丸ごと落ちる。
  user_id      uuid references public.ow_users(id) on delete set null,

  created_at   timestamptz not null default now(),

  constraint ow_search_logs_primary_kind_check
    check (primary_kind in ('company', 'job', 'person'))
);

comment on table public.ow_search_logs is
  '/search の検索ログ。RLS 有効・ポリシー無し・GRANT 無しで、admin クライアントからのみ読み書きする。query には利用者の入力がそのまま入るため個人情報を含みうる。';
comment on column public.ow_search_logs.user_id is
  'ow_users.id 空間（auth.users.id ではない）。未ログインの検索を記録するため NULL 可。';
comment on column public.ow_search_logs.unresolved is
  '語彙に解決できなかった語。次に何を語彙へ足すかの判断材料。';

-- 読むのは「最近の検索」なので降順で引ける形にしておく
create index if not exists ow_search_logs_created_at_idx
  on public.ow_search_logs (created_at desc);

alter table public.ow_search_logs enable row level security;

-- ⚠️ ポリシーは意図して1本も作らない。誰にも開いていないので書くべきものが無い。
-- ⚠️ GRANT も書かない。既定では anon にも authenticated にも権限が付かない
--    （新しいテーブルには GRANT を必ず書く、の例外。ここは「誰にも読ませない」が要件）。
revoke all on public.ow_search_logs from anon, authenticated;
