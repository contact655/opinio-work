import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 検証用アカウントの「取り残し」を数える（2026-09-28）。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * **`is_test` を立て忘れた行が、誰にも気づかれずに実ユーザー・実企業として数えられる。**
 * 2026-09-14 / 09-17 / 09-28 に**4回**起きており、最後の3回は
 * 「注意書きを書いた当日に、書いた本人が」踏んでいる。**文章では防げない。**
 *
 * ⚠️★**自動で倒さない。** 実在の利用者・実在の企業を巻き込む。
 *    ここは**数えて見せるだけ**で、倒すのは人が id / email を明示列挙した migration で行う。
 *
 * ⚠️★**条件をここ以外に書かないこと。** `/admin` の要対応タスクと日次 cron が
 *    同じ関数を呼ぶ。割れると「画面は0件なのにメールが来る」（逆も）になる。
 *
 * ── 数え方 ──────────────────────────────────────────────────────────────────
 * ① **`contact+NN@opinio.co.jp`** で `is_test` が立っていないもの
 *    ⚠️ このアドレスは検証用に作る約束（CLAUDE.md「本番で検証用アカウントを作らない」②）。
 *    ⚠️★`hiroki.ikuto.placeholder@opinio.co.jp` は**対象外**。あれは運営が履歴書から
 *       書き起こした実在の人物で、`auth_id` が NULL。`is_test` は意味が違う。
 *       → `auth_id is not null` で自然に外れる。
 *
 * ② **検証用アカウントが作った企業**で `is_test` が立っていないもの
 *    ⚠️★**`source in ('biz_self','user')` を外さないこと。** 外すと
 *       「管理者がたまたま `is_test` なだけの実在企業」（株式会社Opinio・
 *       セールスフォース・ジャパン・株式会社エージェント）を拾う。2026-09-28 に実際に書き間違えた。
 *    ⚠️★**`ow_company_creations` を見る。** 以前は `ow_company_admins` を join していて、
 *       **オンボーディング経由（`source='user'`）を構造上ヒットさせられなかった**。
 *       ⚠️ したがって**2026-09-28 より前に作られた企業は拾えない**（記録が無い）。
 *          それは仕様。過去ぶんは `source in ('biz_self','user')` の一覧を目で見る。
 */
export type TestLeftovers = {
  /** `contact+NN` で `is_test` が立っていない利用者のメール */
  users: string[];
  /** 検証用アカウントが作った企業で `is_test` が立っていないもの */
  companies: { id: string; name: string; createdBy: string | null }[];
  /** ★取得に失敗したか。⚠️ **失敗を0件に倒さない**（壊れているのに正常に見える） */
  failed: boolean;
};

export async function findTestLeftovers(admin: SupabaseClient): Promise<TestLeftovers> {
  const out: TestLeftovers = { users: [], companies: [], failed: false };

  /* ① 取り残しの利用者 */
  const { data: users, error: uErr } = await admin
    .from("ow_users")
    .select("email")
    .like("email", "contact+%@opinio.co.jp")
    .not("is_test", "is", true)
    .not("is_system", "is", true)
    .not("auth_id", "is", null);
  if (uErr) {
    /* ⚠️ 握り潰さない。0件に倒すと「取り残しが無い」と読まれる */
    console.error("[testLeftovers] 利用者の照会に失敗:", uErr.message);
    out.failed = true;
  } else {
    out.users = (users ?? []).map((u) => u.email as string).sort();
  }

  /* ② 取り残しの企業。⚠️ 作成記録（`ow_company_creations`）から辿る */
  const { data: rows, error: cErr } = await admin
    .from("ow_company_creations")
    .select("company_id, ow_companies!company_id(id, name, is_test, source), ow_users!created_by_ow_user_id(email, is_test)");
  if (cErr) {
    console.error("[testLeftovers] 企業の照会に失敗:", cErr.message);
    out.failed = true;
  } else {
    for (const r of rows ?? []) {
      const c = r.ow_companies as unknown as { id: string; name: string; is_test: boolean | null; source: string | null } | null;
      const u = r.ow_users as unknown as { email: string; is_test: boolean | null } | null;
      if (!c || !u) continue;
      if (u.is_test !== true) continue;                        // 作成者が検証用でない
      if (c.is_test === true) continue;                        // 既に倒してある
      if (c.source !== "biz_self" && c.source !== "user") continue;  // ★実在企業を拾わない
      out.companies.push({ id: c.id, name: c.name, createdBy: u.email });
    }
  }
  return out;
}

/** 要対応の件数。⚠️ 取得に失敗したときは **1件**（0にすると壊れているのに要対応が消える） */
export function countTestLeftovers(l: TestLeftovers): number {
  if (l.failed) return 1;
  return l.users.length + l.companies.length;
}
