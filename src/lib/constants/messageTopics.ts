/**
 * ★最初の1通で選ぶ「聞きたいテーマ」（2026-10-17 / 設計メモ docs/messaging-unification-20261017.md の段階1）。
 *
 * ★2026-10-17 から本番で使っている（個人どうしの DM の書く画面・API・DB の CHECK `ow_conversations.request_topic`）。
 *    値を足すときは DB の CHECK も同時に広げる（UI・API・DB の3層）。
 * ⚠️ **value は削除も改名もしない。** 末尾に足すだけ（集計の前後比較ができなくなるため）。
 * ⚠️ 出し分けは `topicsFor()` の1か所。画面側で条件を書かない。
 */

export type MessageTopicGroup = "company" | "career" | "hiring" | "join";

export const MESSAGE_TOPICS = [
  /* 相手の会社のこと（相手に現職があるとき／宛先が企業のとき） */
  { value: "company_culture", label: "社風・雰囲気", group: "company" },
  { value: "company_business", label: "事業・プロダクト", group: "company" },
  { value: "company_workstyle", label: "働き方", group: "company" },
  /* その人のキャリアのこと（個人宛てなら常に） */
  { value: "career_foreign", label: "外資系で働くこと", group: "career" },
  { value: "career_manager", label: "管理職・マネジメント", group: "career" },
  { value: "career_role_change", label: "職種を変えること", group: "career" },
  { value: "career_independent", label: "独立・起業", group: "career" },
  { value: "career_other", label: "キャリアの相談（その他）", group: "career" },
  /* 採用のこと（送り主が企業担当者のとき） */
  { value: "hiring_position", label: "ポジションのご紹介", group: "hiring" },
  { value: "hiring_casual", label: "カジュアル面談のお誘い", group: "hiring" },
  /* この会社で働くこと（宛先が企業のとき） */
  { value: "join_interest", label: "この会社で働くことに興味があります", group: "join" },
] as const satisfies readonly { value: string; label: string; group: MessageTopicGroup }[];

export type MessageTopic = (typeof MESSAGE_TOPICS)[number]["value"];

/**
 * ★話を聞く形（2026-10-18 / 柴さんの判断。キャリアの先輩に話を聞く依頼を、最初の1通に乗せる）。
 *   DB は `ow_conversations.request_format` の CHECK（supabase/migrations/20261018070000）。⚠️ 値は削除も改名もしない。末尾に足す
 *   ⚠️ 対面は入れない（知らない人と1対1になるため。最初はオンラインかメッセージだけ）
 *   ⚠️ 日程を決める仕組みは作らない（話がまとまったら、メッセージの中で決めてもらう）
 */
export const MESSAGE_FORMATS = [
  { value: "message", label: "メッセージで" },
  { value: "online_15", label: "オンラインで15分" },
  { value: "online_30", label: "オンラインで30分" },
] as const satisfies readonly { value: string; label: string }[];
export type MessageFormat = (typeof MESSAGE_FORMATS)[number]["value"];
export const DEFAULT_MESSAGE_FORMAT: MessageFormat = "message";
export function isMessageFormat(v: unknown): v is MessageFormat {
  return typeof v === "string" && MESSAGE_FORMATS.some((f) => f.value === v);
}
export function formatLabel(value: MessageFormat): string {
  return MESSAGE_FORMATS.find((f) => f.value === value)?.label ?? "";
}

/** 一言の上限（100字程度）。⚠️ 本番では DB の CHECK でも縛る */
export const FIRST_NOTE_MAX = 100;

export type TopicSection = { group: MessageTopicGroup; title: string; topics: { value: MessageTopic; label: string }[] };

/**
 * 送り主と相手の関係で、出すテーマを決める。
 * - 個人宛て: 相手に現職があれば「〈社名〉のこと」（社名が分からなければ「いまの会社のこと」）＋「キャリアのこと」。
 *   送り主が企業担当者なら「採用のこと」も（いちばん上）。
 * - 企業宛て: 「この会社で働くこと」＋「〈社名〉のこと」。⚠️ 企業宛てにキャリアの相談は出さない（相手は人ではない）
 */
export function topicsFor(input: {
  recipient:
    | { kind: "person"; currentCompanyName: string | null; hasCurrentCompany: boolean }
    | { kind: "company"; companyName: string };
  senderIsRecruiter: boolean;
}): TopicSection[] {
  const of = (g: MessageTopicGroup) => MESSAGE_TOPICS.filter((t) => t.group === g).map(({ value, label }) => ({ value, label }));
  const out: TopicSection[] = [];
  if (input.recipient.kind === "company") {
    out.push({ group: "join", title: "この会社で働くこと", topics: of("join") });
    out.push({ group: "company", title: `${input.recipient.companyName}のこと`, topics: of("company") });
    return out;
  }
  if (input.senderIsRecruiter) out.push({ group: "hiring", title: "採用のこと", topics: of("hiring") });
  if (input.recipient.hasCurrentCompany) {
    out.push({
      group: "company",
      title: input.recipient.currentCompanyName ? `${input.recipient.currentCompanyName}のこと` : "いまの会社のこと",
      topics: of("company"),
    });
  }
  out.push({ group: "career", title: "キャリアのこと", topics: of("career") });
  return out;
}

export function topicLabel(value: MessageTopic): string {
  return MESSAGE_TOPICS.find((t) => t.value === value)?.label ?? "";
}
