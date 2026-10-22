import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
/* ★会社名はプロフィールの職歴と同じ日本語名（法人格を落とす）。英語名を優先する companyDisplayName にすると
      「KAIKOU DENGYOのこと」のように、プロフィールの「海光電業」と別の名前に見える（2026-10-22） */
import { stripLegalSuffix } from "@/lib/companies/displayName";
import { topicsFor, type MessageTopic, type TopicCompany, type TopicSection } from "@/lib/constants/messageTopics";

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
export async function dmTopicSections(recipientId: string, aboutCompanyId?: string | null): Promise<TopicSection[] | null> {
  const r = await dmTopicContext(recipientId, aboutCompanyId);
  return r ? r.sections : null;
}

/**
 * ★テーマと、確かめた「どの会社の話か」（2026-10-18 / 企業ページの社員の行から送るとき）。
 *   aboutCompanyId は、相手がその会社の職歴を「会社名を出す」で持っていて、その会社のページが公開されているときだけ採る。
 *   それ以外は黙って null にする（ふつうの DM と同じテーマになる。止めない）。
 * ⚠️ 取得に失敗したら null（呼び出し側は止める）。
 */
export async function dmTopicContext(recipientId: string, aboutCompanyId?: string | null): Promise<{ sections: TopicSection[]; aboutCompanyId: string | null; currentCompanyId: string | null; companies: TopicCompany[] } | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_experiences")
    .select("company_id, company_text, started_at, ended_at, visibility_company, is_current, ow_companies!company_id(name, name_en, is_published, is_test)")
    .eq("user_id", recipientId)
    .order("started_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[dmTopics] ow_experiences:", error.message);
    return null;
  }
  type Row = { company_id: string | null; company_text: string | null; started_at: string | null; ended_at: string | null; visibility_company: string | null; is_current: boolean; ow_companies: { name: string; name_en: string | null; is_published: boolean; is_test: boolean } | null };
  const all = (data ?? []) as unknown as Row[];
  const rows = all.filter((r) => r.is_current);
  const linked = rows.find((r) => r.ow_companies?.name && r.visibility_company === "real");
  const currentCompanyName = linked?.ow_companies ? (stripLegalSuffix(linked.ow_companies.name) || linked.ow_companies.name) : null;

  let about: { name: string; isCurrent: boolean } | null = null;
  let aboutId: string | null = null;
  if (aboutCompanyId) {
    const at = all.filter((r) => r.company_id === aboutCompanyId && r.visibility_company === "real" && r.ow_companies?.is_published && !r.ow_companies.is_test);
    if (at.length > 0 && at[0].ow_companies) {
      about = { name: (stripLegalSuffix(at[0].ow_companies.name) || at[0].ow_companies.name), isCurrent: at.some((r) => r.is_current) };
      aboutId = aboutCompanyId;
    }
  }
  /* ★「会社のこと」で選べる会社（2026-10-23 / 柴さんの指示）。会社名を出している職歴の会社だけ（プロフィールで見える社名と同じ条件）。
        ⚠️ 自由入力の会社は id が無いので並べない。検証用の会社も並べない。いまの勤務先が先、あとは入社が新しい順 */
  const byId = new Map<string, { name: string; isCurrent: boolean; from: string | null; to: string | null; latest: string }>();
  for (const r of all) {
    if (!r.company_id || r.visibility_company !== "real" || !r.ow_companies?.name || r.ow_companies.is_test) continue;
    const cur = byId.get(r.company_id);
    const from = r.started_at ? r.started_at.slice(0, 4) : null;
    const to = r.is_current ? null : (r.ended_at ? r.ended_at.slice(0, 4) : null);
    if (!cur) {
      byId.set(r.company_id, { name: stripLegalSuffix(r.ow_companies.name) || r.ow_companies.name, isCurrent: r.is_current, from, to, latest: r.started_at ?? "" });
    } else {
      cur.isCurrent = cur.isCurrent || r.is_current;
      if (from && (!cur.from || from < cur.from)) cur.from = from;
      if (!r.is_current && to && (!cur.to || to > cur.to)) cur.to = to;
      if ((r.started_at ?? "") > cur.latest) cur.latest = r.started_at ?? "";
    }
  }
  const companies: TopicCompany[] = Array.from(byId.entries())
    .sort((a, b) => Number(b[1].isCurrent) - Number(a[1].isCurrent) || b[1].latest.localeCompare(a[1].latest))
    .map(([id, c]) => ({ id, name: c.name, isCurrent: c.isCurrent,
      period: c.isCurrent ? "いま" : c.from || c.to ? `${c.from ?? ""}〜${c.to ?? ""}` : null }));

  const sections = topicsFor({
    recipient: { kind: "person", currentCompanyName, hasCurrentCompany: rows.length > 0 || companies.length > 0, aboutCompany: about },
    senderIsRecruiter: false,
  });
  /* ★2社以上なら、会社のテーマに選択肢を付け、見出しを「会社のこと」にする */
  if (companies.length >= 2) {
    for (const sec of sections) {
      if (sec.group !== "company") continue;
      sec.title = "会社のこと";
      sec.companies = companies;
      sec.defaultCompanyId = aboutId ?? linked?.company_id ?? companies[0].id;
    }
  } else if (companies.length === 1 && !about && rows.length === 0) {
    /* ★前の会社が1社だけ（いま在籍中の職歴が無い）。「いまの会社のこと」と書かない */
    for (const sec of sections) if (sec.group === "company") sec.title = `${companies[0].name}にいた頃のこと`;
  }
  return {
    sections,
    aboutCompanyId: aboutId,
    /* ★書く画面の「〈社名〉のこと」に出ている会社（2026-10-22。1通ごとの札に会社名を添えるため） */
    currentCompanyId: linked?.company_id ?? null,
    companies,
  };
}

/** そのテーマが、この相手に選べるものか */
export function isTopicOffered(sections: TopicSection[], topic: string): topic is MessageTopic {
  return sections.some((s) => s.topics.some((t) => t.value === topic));
}

/**
 * ★1通に付ける会社を決める（2026-10-23）。送る側が選んだ会社が相手の職歴の会社なら採る。
 *   それ以外は 企業ページから来た会社 → いまの勤務先 → 唯一の会社 の順。⚠️ 会社のテーマのときだけ呼ぶ
 */
export function pickAskCompany(
  ctx: { aboutCompanyId: string | null; currentCompanyId: string | null; companies: TopicCompany[] },
  requested: string | null | undefined,
): string | null {
  if (requested && ctx.companies.some((c) => c.id === requested)) return requested;
  return ctx.aboutCompanyId ?? ctx.currentCompanyId ?? (ctx.companies.length === 1 ? ctx.companies[0].id : null);
}
