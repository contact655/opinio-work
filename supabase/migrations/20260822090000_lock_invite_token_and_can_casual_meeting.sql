-- フェーズ1: 「面談OK」まわりの露出を塞ぐ（2026-08-22）
--
-- ① ow_company_members.invite_token が anon / authenticated から平文で読めていた
-- ② ow_users.can_casual_meeting を本人が PostgREST から直接 true にできていた
--
-- ⚠️★どちらも「列の GRANT を revoke する」だけでは効かない。
--    **両方ともテーブルレベルで配られている**ため、列を revoke しても
--    テーブルレベルの権限が残って has_column_privilege は true のままになる。
--    最初にそれで書いて、下のアサートに弾かれた（適用は失敗しロールバックされた）。
--    → **テーブルレベルを落として、残す列だけを列単位で配り直す**（ow_users の
--      SELECT や ow_companies の UPDATE と同じ形）。
--
-- ⚠️★この形にすると「**新しく足した列は権限が無い状態で生まれる**」。
--    以降 ow_company_members に列を足したら `grant select (列名)`、
--    ow_users に列を足したら `grant update (列名)` を同じ migration に書くこと。
--    ow_companies が既にこの状態で、CLAUDE.md にも同じ注意が書いてある。
--    **運用コストが増える変更なので、ここは意識して選んでいる。**

-- ── ① invite_token ──────────────────────────────────────────────────────────
--
-- 実測（2026-08-22 / 本番 PostgREST を直接叩いた結果。適用前）:
--   GET /rest/v1/ow_company_members?select=id,invite_token
--     anon          → 200・4行・トークン平文
--     authenticated → 200・4行・トークン平文（★他人の行）
--     企業管理者     → 200・4行・トークン平文（★他社の行）
--
-- RLS の public_members_read が PUBLIC ロール向け（is_public AND display_consent）で、
-- 4行が全ロールに開いている。**RLS は行単位なので列だけを隠すことは書けない。**
-- （CLAUDE.md「『誰にも読ませない』は GRANT で、『誰に読ませるか』は RLS で書く」）
--
-- ⚠️ 剥がして安全なことは確認済み。invite_token を SELECT している実行経路は
--    api/mypage/ambassador-invite の GET/POST と api/biz/ambassador/invite の3箇所で、
--    **いずれも createAdminClient（service_role）**。service_role は列単位 GRANT の
--    対象外なので影響を受けない。
--    api/biz/ambassador/self-register だけがセッションクライアントで
--    ow_company_members を UPDATE するが、触るのは display_consent、WHERE は id で、
--    どちらも権限を残す列なので通る。
--
-- ⚠️ ow_company_members を参照している RLS ポリシーは他テーブルに0件（実測）。
--    巻き添えは無い。
--
-- ⚠️ INSERT / UPDATE / DELETE は**触らない**。読めないトークンを書き換えても意味が無く、
--    書き込み経路は service_role か企業管理者のポリシー配下にある。
--    ここを広げるなら別 migration にする（戻すときの単位が違う）。
--
-- ⚠️ `invited_by`（auth.users.id）が anon から読める状態は**今回そのままにしている**。
--    同じ種類の露出だが invite_token とは危険度が違い、まとめて直すと
--    戻すときの単位が混ざる。別途判断する。

revoke select on public.ow_company_members from anon;
revoke select on public.ow_company_members from authenticated;

-- invite_token 以外の11列を配り直す（元の見え方をそのまま維持する）
grant select (
  id, company_id, user_id, display_consent, consent_at, is_public,
  role_title, created_at, updated_at, invited_at, invited_by
) on public.ow_company_members to anon;

grant select (
  id, company_id, user_id, display_consent, consent_at, is_public,
  role_title, created_at, updated_at, invited_at, invited_by
) on public.ow_company_members to authenticated;

-- ── ② can_casual_meeting ────────────────────────────────────────────────────
--
-- 設計上は運営専用（列コメントに「人事または管理者が個別に設定」）だが、
-- ow_users_own_update が USING (auth_id = auth.uid()) のみ・WITH CHECK 無しで、
-- authenticated にテーブルレベル UPDATE が配られていた。
--
-- 実測（2026-08-22 / is_test アカウント contact+01 で実行し、値を戻した）:
--   PATCH /rest/v1/ow_users?auth_id=eq.<自分>  {"can_casual_meeting":true}
--     Prefer: return=minimal → 204、false → true に変わった（★書けてしまう）
--   ⚠️ Prefer: return=representation では 403 になる。**これは UPDATE の失敗ではなく、
--      全列を返そうとして列単位 SELECT の GRANT に弾かれているだけ**。
--      ここで止めると「書けない」と誤判定する（実際に一度誤判定した）。
--
-- ⚠️ ow_users_own_update ポリシー自体には触らない。触ると name / about_me など
--    本人が編集してよい他の列まで巻き添えになる。
--
-- ⚠️ 運営トグル（admin/candidates/actions.ts の toggleCanCasualMeeting）は
--    createAdminClient で書いているので影響を受けない（確認済み）。
--
-- ⚠️ SELECT は残す。/people の「面談可」バッジと /u/[id] の面談CTAが読む。
--    「読めるが書けない」列にする。
--
-- ⚠️ テーブルレベルを落として配り直す以上、**再付与する列は「意図して配った」列**になる。
--    そこで、本人が書く必要が無く、書けると危険な4列も**最初から配らない**。
--    （後から revoke すると GRANT の migration が2本になり、同じ判断をもう一度することになる）
--
--    | 列 | 配らない理由 |
--    |---|---|
--    | `auth_id`   | ★他人の auth_id に付け替えられる＝なりすましが成立しうる |
--    | `is_test`   | ★自分を集計・除外フィルタから外せる |
--    | `is_system` | 同上。本人が触る意味が無い |
--    | `email`     | ★本人がメールアドレスを書き換えられる（後述） |
--
--    ⚠️ 4列とも**セッションクライアントからの UPDATE 経路が0件**であることを確認済み:
--       `auth_id` / `email` を書くのは lib/auth/linkOwUser.ts（74 は UPDATE・104 は INSERT）で
--       **どちらも createAdminClient**。`is_test` / `is_system` は src 全体で UPDATE が無い。
--    ⚠️ **INSERT には触っていない。** linkOwUser.ts:101 の新規作成（auth_id / email を入れる）を
--       壊さないため、UPDATE だけを対象にする。下のアサートで INSERT が残ることを固定している。
--
-- ⚠️ `email` を落とせる根拠（2026-08-22 調査）:
--    本人向けのメールアドレス変更機能が**存在しない**。
--    `supabase.auth.updateUser()` の呼び出しは2箇所だけで、
--    `auth/update-password/page.tsx:46`（password）と `biz/auth/page.tsx:209`
--    （user_metadata の pending_company）。**どちらも email を変えていない。**
--    `/auth/confirm` も `email_change` を `ALLOWED_TYPES` から意図的に除外している。
--    `ow_users.email` を書くのは linkOwUser.ts:104 の **INSERT 1箇所のみ**。
--
--    ⚠️ **将来メールアドレス変更機能を作るときに戻す必要がありうる。**
--       GoTrue と `ow_users.email` を同期する経路をセッションクライアントで書くなら、
--       ここに `email` を戻すこと。あわせて `/auth/confirm` の `email_change` 対応
--       （1通目は 200 だがセッションが無い）が要る。
--
-- ⚠️ 配った28列のうち**13列はアプリが書いていない**（過剰付与）が、**今回は触らない**。
--    id / created_at / welcome_sent_at / auth_linked_at / catchphrase / username /
--    statistics_opt_out / is_mentor / is_active_mentor / mentor_themes /
--    mentor_registered_at / can_talk_to_candidates / can_talk_to_hr
--    編集UIが後から付く可能性があり、ここで落とすと「保存できない」に化ける。
--    ⚠️ can_talk_to_* は死列、is_mentor / is_active_mentor / mentor_* は DROP 済みの
--       ow_mentors の名残。**GRANT の棚卸しをする別タスクの対象**（CLAUDE.md にメモ）。

revoke update on public.ow_users from authenticated;

-- can_casual_meeting / auth_id / is_test / is_system / email を除く28列
grant update (
  id, name, avatar_color, cover_color, about_me, location,
  social_links, is_mentor, mentor_registered_at, mentor_themes, is_active_mentor,
  visibility, created_at, updated_at, future_aspirations, birth_date,
  cover_photo_url, avatar_url, is_open_to_work, catchphrase, profile_setup_at,
  can_talk_to_candidates, can_talk_to_hr, statistics_opt_out,
  username, auth_linked_at, headline, welcome_sent_at
) on public.ow_users to authenticated;

-- ── アサート ────────────────────────────────────────────────────────────────
-- ⚠️ これは catalog を見ているだけで、実際の応答は確かめていない。
--    適用後に anon / 一般 authenticated / 企業管理者 の3者で PostgREST を叩き、
--    invite_token が 403、他の列が 200 のままであることを必ず実測すること。
do $$
begin
  -- 剥がしたもの
  if has_column_privilege('anon','public.ow_company_members','invite_token','SELECT') then
    raise exception 'anon still has SELECT on ow_company_members.invite_token';
  end if;
  if has_column_privilege('authenticated','public.ow_company_members','invite_token','SELECT') then
    raise exception 'authenticated still has SELECT on ow_company_members.invite_token';
  end if;
  if has_column_privilege('authenticated','public.ow_users','can_casual_meeting','UPDATE') then
    raise exception 'authenticated still has UPDATE on ow_users.can_casual_meeting';
  end if;
  if has_column_privilege('authenticated','public.ow_users','auth_id','UPDATE') then
    raise exception 'authenticated still has UPDATE on ow_users.auth_id';
  end if;
  if has_column_privilege('authenticated','public.ow_users','is_test','UPDATE') then
    raise exception 'authenticated still has UPDATE on ow_users.is_test';
  end if;
  if has_column_privilege('authenticated','public.ow_users','is_system','UPDATE') then
    raise exception 'authenticated still has UPDATE on ow_users.is_system';
  end if;
  if has_column_privilege('authenticated','public.ow_users','email','UPDATE') then
    raise exception 'authenticated still has UPDATE on ow_users.email';
  end if;
  -- INSERT は落としていない（linkOwUser.ts:101 の新規作成経路を壊さないため）
  if not has_column_privilege('authenticated','public.ow_users','auth_id','INSERT') then
    raise exception 'authenticated lost INSERT on ow_users.auth_id';
  end if;
  if not has_column_privilege('authenticated','public.ow_users','email','INSERT') then
    raise exception 'authenticated lost INSERT on ow_users.email';
  end if;

  -- 巻き添えにしていないもの（ここが壊れると招待の着地と企業ページが落ちる）
  if not has_column_privilege('anon','public.ow_company_members','id','SELECT') then
    raise exception 'anon lost SELECT on ow_company_members.id';
  end if;
  if not has_column_privilege('anon','public.ow_company_members','user_id','SELECT') then
    raise exception 'anon lost SELECT on ow_company_members.user_id';
  end if;
  if not has_column_privilege('anon','public.ow_company_members','role_title','SELECT') then
    raise exception 'anon lost SELECT on ow_company_members.role_title';
  end if;
  if not has_column_privilege('anon','public.ow_company_members','is_public','SELECT') then
    raise exception 'anon lost SELECT on ow_company_members.is_public';
  end if;
  if not has_column_privilege('anon','public.ow_company_members','display_consent','SELECT') then
    raise exception 'anon lost SELECT on ow_company_members.display_consent';
  end if;
  if not has_column_privilege('authenticated','public.ow_company_members','company_id','SELECT') then
    raise exception 'authenticated lost SELECT on ow_company_members.company_id';
  end if;
  if not has_column_privilege('authenticated','public.ow_company_members','display_consent','UPDATE') then
    raise exception 'authenticated lost UPDATE on ow_company_members.display_consent';
  end if;

  /* ★本人が自分で編集する列が全部残っていること。
     ⚠️ **セッションクライアントから ow_users を UPDATE している経路が書く列を全部並べる。**
        列を1つ落とすと保存が 403 になるのではなく、**その列だけ静かに保存されなくなる**
        （このリポジトリで何度も起きている形）。
        出どころは2経路だけ:
          - api/jobseeker/profile/route.ts:124   … patch の型定義にある12列 + updated_at
          - api/jobseeker/profile-photo/route.ts … avatar_url / cover_photo_url
        ⚠️ この2経路に列を足したら、ここにも足すこと。 */
  declare c text;
  begin
    foreach c in array array[
      'name','headline','avatar_color','cover_color','about_me','birth_date','location',
      'future_aspirations','social_links','visibility','is_open_to_work','profile_setup_at',
      'updated_at','cover_photo_url','avatar_url'
    ] loop
      if not has_column_privilege('authenticated','public.ow_users',c,'UPDATE') then
        raise exception 'authenticated lost UPDATE on ow_users.%', c;
      end if;
    end loop;
  end;

  -- can_casual_meeting は「読める / 書けない」にする（バッジ表示に SELECT が要る）
  if not has_column_privilege('authenticated','public.ow_users','can_casual_meeting','SELECT') then
    raise exception 'authenticated lost SELECT on ow_users.can_casual_meeting';
  end if;
  if not has_column_privilege('anon','public.ow_users','can_casual_meeting','SELECT') then
    raise exception 'anon lost SELECT on ow_users.can_casual_meeting';
  end if;
end $$;
