/* ★サーバー専用（admin クライアントを使う dmTopics を読む） */
import "server-only";
import { dmTopicContext, isTopicOffered, pickAskCompany } from "@/lib/conversations/dmTopics";
import { DEFAULT_MESSAGE_FORMAT, MESSAGE_TOPICS, isMessageFormat } from "@/lib/constants/messageTopics";

export type AskColumns = { ask_topic: string | null; ask_format: string | null; ask_company_id: string | null };
export const NO_ASK: AskColumns = { ask_topic: null, ask_format: null, ask_company_id: null };

/**
 * ★1通に付ける「聞きたいこと」を確かめて、メッセージの列にする（2026-10-22）。
 *   最初の1通（messageRequest.ts）と、2通目以降（/api/dm/message）が同じ関数を通る。条件を書き写さないこと。
 *   - テーマは、この相手に選べるもの（書く画面と同じ dmTopicContext）だけ
 *   - 会社のテーマなら会社を記録する（企業ページから来た会社 → なければ相手のいまの勤務先）
 *   - 形を省いたら「メッセージで」
 * ⚠️ topic が空なら札なし（ふつうのメッセージ）。不正な値は 400 で返す（黙って捨てない）
 */
export async function resolveAsk(params: { recipientId: string; topic?: string | null; format?: string | null; aboutCompanyId?: string | null; askCompanyId?: string | null }):
  Promise<{ ok: true; cols: AskColumns; aboutCompanyId: string | null } | { ok: false; status: number; error: string }> {
  if (!params.topic) return { ok: true, cols: NO_ASK, aboutCompanyId: null };
  if (params.format && !isMessageFormat(params.format)) return { ok: false, status: 400, error: "話を聞く形を選び直してください" };
  const ctx = await dmTopicContext(params.recipientId, params.aboutCompanyId ?? null);
  if (!ctx) return { ok: false, status: 500, error: "送信に失敗しました。時間をおいて、もう一度お試しください" };
  if (!isTopicOffered(ctx.sections, params.topic)) return { ok: false, status: 400, error: "聞きたいことを選び直してください" };
  const topic = params.topic;
  const isCompanyTopic = MESSAGE_TOPICS.some((t) => t.value === topic && t.group === "company");
  return {
    ok: true,
    aboutCompanyId: isCompanyTopic ? ctx.aboutCompanyId : null,
    cols: {
      ask_topic: topic,
      ask_format: isMessageFormat(params.format) ? params.format : DEFAULT_MESSAGE_FORMAT,
      ask_company_id: isCompanyTopic ? pickAskCompany(ctx, params.askCompanyId) : null,
    },
  };
}
