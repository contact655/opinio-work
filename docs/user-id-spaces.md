# user_id 系の列がどちらの空間か（2026-08-06 作成）

**ポリシーを書く前にこの表を見ること。**

`auth.uid()` が返すのは **auth.users.id**。`ow_users.id` とは別物。
どちらの空間かは**テーブルごとに違う**。同じ「user_id」という名前でも、
`ow_profiles` は auth 空間、`ow_experiences` は ow_users 空間。

## 書き方

| 空間 | ポリシーの書き方 |
|---|---|
| `auth.uid()` 空間 | `user_id = auth.uid()` |
| `ow_users.id` 空間 | `user_id = public.auth_ow_user_id()` |

`auth_ow_user_id()` は 2026-08-06 に追加したヘルパー
（`migrations/20260806220000_fix_policy_uid_space.sql`）。
自前で `ow_users` を JOIN して書かないこと。

⚠️ 会社単位の判定は `public.auth_is_company_admin(company_id)` /
   `public.auth_is_company_member(company_id)` を使う。
   どちらも内部で `ow_users` を経由しており、`auth_is_company_admin` は
   `permission = 'admin'` と `is_active = true` まで見る。

⚠️ `ow_user_roles.user_id` は **auth 空間**。admin 判定は `public.auth_is_admin()` を使う。
   `ow_user_roles` を `ow_users.id` で JOIN すると常に false になる。

## 実際に踏んだ事故（2026-08-06）

- 検証アカウントが admin かどうかを `ow_users.id` で調べて「非admin」と誤判定し、
  漏洩の調査結果を1度誤って報告した
- `ow_company_members` の6本と `ow_career_profiles` の1本が
  空間取り違えで**常に false** になっていた（拒否側なので事故は未発生）

## 一覧（`ow_*` のみ。FK の参照先から機械的に判定）

| テーブル | 列 | 空間 | FK の参照先 |
|---|---|---|---|
| `ow_activities` | `actor_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_applications` | `candidate_id` | `auth.uid()` | `auth.users` |
| `ow_articles` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_bookmarks` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_career_agent_leads` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_career_follows` | `follower_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_career_profiles` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_casual_meetings` | `assignee_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_casual_meetings` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_companies` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_company_admins` | `invited_by_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_company_admins` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_company_external_links` | `created_by_user_id` | `auth.uid()` | `auth.users` |
| `ow_company_follows` | `follower_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_company_join_requests` | `reviewed_by` | `ow_users.id` | `public.ow_users` |
| `ow_company_join_requests` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_company_members` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_company_office_photos` | `tagged_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_company_posts` | `author_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_company_reviews_archive_20260714` | `user_id` | **不明** | `（FKなし）` |
| `ow_contact_logs` | `actor_user_id` | **不明** | `（FKなし）` |
| `ow_contact_logs` | `candidate_user_id` | **不明** | `（FKなし）` |
| `ow_conversation_participants` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_conversations` | `candidate_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_conversations` | `mentor_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_experiences` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_favorites` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_job_applications` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_job_assignees` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_job_favorites` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_job_views` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_match_scores` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_matches` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_meeting_feedbacks` | `user_id` | **不明** | `（FKなし）` |
| `ow_mentor_reservations` | `ambassador_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_mentor_reservations` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_notifications` | `actor_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_notifications` | `recipient_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_placements` | `candidate_id` | `auth.uid()` | `auth.users` |
| `ow_post_comments` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_post_hire_reports` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_post_likes` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_posts` | `ref_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_posts` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_profile_desired_roles` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_profiles` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_salary_reports` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_salary_reports_archive_20260714` | `user_id` | **不明** | `（FKなし）` |
| `ow_saved_companies` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_saved_jobs` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_school_requests` | `requested_by` | `ow_users.id` | `public.ow_users` |
| `ow_scout_blocks` | `candidate_id` | `auth.uid()` | `auth.users` |
| `ow_scouts` | `candidate_id` | `auth.uid()` | `auth.users` |
| `ow_terms_agreements` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_threads` | `candidate_id` | **不明** | `（FKなし）` |
| `ow_user_achievements` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_awards` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_certifications` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_content_links` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_educations` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_media_appearances` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_profiles` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_user_recommendations` | `recommender_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_recommendations` | `target_user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_roles` | `user_id` | `auth.uid()` | `auth.users` |
| `ow_user_skill_tags` | `user_id` | `ow_users.id` | `public.ow_users` |
| `ow_user_socials` | `user_id` | `ow_users.id` | `public.ow_users` |

⚠️ 2026-08-07 に `ow_match_scores.user_id` の空間を確定させた。
   唯一の読み手である cron（weekly-match）が `ow_profiles.user_id`（auth 空間）で
   引いていたため、`auth.users` を参照する FK を張った
   （`migrations/20260807010000_fix_overclosed_policies.sql`）。

⚠️ 2026-08-07 に `ow_profiles.user_id` の取り違えを2件直した。
   **表に載っていても、コードが表どおりに書かれているとは限らない。**
   - `jobs/(list)/JobsClient.tsx:987` … `ow_users.id` で引いており常に0件。
     「あなたの希望職種にマッチ」セクションが一度も表示されていなかった
   - `profile/edit/page.tsx:187` … auth 空間で空振りしたとき `ow_users.id` で
     再試行するフォールバックが書かれていたが、実データ39件すべて auth 空間で
     この経路は必ず0件だった（削除）

⚠️ **不明** は FK が無い列。使う前に実データで確かめること
（`ow_users.id` と `ow_users.auth_id` のどちらに一致するか数える）。
いずれも 2026-08-06 時点でデータ0件か、ポリシーから参照されていない。

⚠️ この表は baseline の FK 定義から機械生成した。
   テーブルや列を足したら更新すること。

