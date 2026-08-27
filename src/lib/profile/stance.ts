import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone } from "@/lib/supabase/mutate";

/**
 * 「意思表示を最後に答えた日」（`ow_profiles.stance_updated_at`）を打ち直す。
 *
 * ── なぜ関数にしたか（2026-08-26 / フェーズ2）───────────────────────────────
 * この列を打つ経路が**2つ**ある。
 *   ① 「転職について」    … `PUT /api/jobseeker/career-preferences`（列と同じ表なので直接書く）
 *   ② 「話を聞かれてもよい」… `/api/mypage/ambassador-*`（**別の表**を書くルート）
 * ②はこの関数を通す。ルートごとに `new Date()` と `eq` を書き写すと、
 * 「どの操作で更新されるか」がルートを全部読まないと分からなくなる。
 *
 * ⚠️ **かつては③「企業から声をかけられる」（`PUT /api/jobseeker/scout-settings`）が
 *    あったが、2026-08-28 に設定ごと削除した**（意思表示のスイッチを2つに戻さない、
 *    という判断）。`scout_enabled` の列は残っているが読む側も書く側もいない。
 *    ⚠️ **経路を足したらこの一覧を直すこと。** 実際に消したときに直し漏れた。
 *
 * ⚠️★**`user_id` は auth 空間**（`auth.users.id`）。`ow_users.id` を渡さないこと。
 *    型はどちらも uuid なので取り違えても tsc も lint も通り、**静かに0行更新になる**。
 *    引数名を `authUserId` にしてあるのはそのため（CLAUDE.md「引数名でどちらの空間か示す」）。
 *
 * ⚠️ **0行でも正常**（`mutateAllowNone`）。`ow_profiles` の行が無い人がいる
 *    （2026-08-26 実測: 実ユーザー17人中2人。2026-08-04 の trigger 追加より前の登録）。
 *    ここで行を作らない——作ると「答えていないのに行がある」状態を増やすだけで、
 *    `scout_enabled` の既定値（true）まで一緒に付いてくる。
 *
 * ⚠️ **失敗しても呼び出し元の処理は止めない。** これは記録であって、
 *    本体（掲載する / 止める）が成功したのに 500 を返すほうが害が大きい。
 *    ただし**握りつぶさない**。`mutateAllowNone` が error をログに出す。
 */
export async function touchStanceUpdatedAt(authUserId: string, label: string): Promise<void> {
  const admin = createAdminClient();
  await mutateAllowNone(
    admin
      .from("ow_profiles")
      .update({ stance_updated_at: new Date().toISOString() })
      .eq("user_id", authUserId),
    label,
  );
}
