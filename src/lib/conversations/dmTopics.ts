import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { topicsFor, type MessageTopic, type TopicSection } from "@/lib/constants/messageTopics";

/**
 * ★個人どうしの最初の1通で選べるテーマ（2026-10-17 / docs/messaging-unification-20261017.md 段階1）。
 *   書く画面（GET /api/dm/start）と送信の検証（sendMessageRequest）が**同じ関数**を見る。
 *
 * ⚠️★個人どうしの DM では「採用のこと」を出さない（senderIsRecruiter: false 固定）。
 *    企業担当者が個人として採用の話を送れると、企業からのメッセージの上限（返事待ち10件）が素通りになる。
 *    採用のテーマは段階2（送り主を人にそろえ、採用テーマは企業の枠を使う）で入れる。
 * ⚠️ 相手の現職が会社マスタに紐付けば社名（表示名）を見出しに出す。自由入力なら「いまの会社のこと」。
 * ⚠️★社名を出すのは visibility_company = 'real' の行だけ（/u/[id] で社名が見えるのと同じ条件）。
 *    それ以外は「いまの会社のこと」にする。プロフィールで見えない社名をここから漏らさない。
 * ⚠️ 取得に失敗したら null（呼び出し側は止める。テーマを黙って減らさない）。
 */
export async function dmTopicSections(recipientId: string): Promise<TopicSection[] | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_experiences")
    .select("company_id, company_text, started_at, visibility_company, ow_companies!company_id(name, name_en)")
    .eq("user_id", recipientId)
    .eq("is_current", true)
    .order("started_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[dmTopics] ow_experiences:", error.message);
    return null;
  }
  const rows = (data ?? []) as unknown as { company_id: string | null; company_text: string | null; visibility_company: string | null; ow_companies: { name: string; name_en: string | null } | null }[];
  const linked = rows.find((r) => r.ow_companies?.name && r.visibility_company === "real");
  const currentCompanyName = linked?.ow_companies ? companyDisplayName(linked.ow_companies.name, linked.ow_companies.name_en).displayName : null;
  return topicsFor({
    recipient: { kind: "person", currentCompanyName, hasCurrentCompany: rows.length > 0 },
    senderIsRecruiter: false,
  });
}

/** そのテーマが、この相手に選べるものか */
export function isTopicOffered(sections: TopicSection[], topic: string): topic is MessageTopic {
  return sections.some((s) => s.topics.some((t) => t.value === topic));
}
