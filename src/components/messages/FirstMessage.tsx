"use client";

import { askTagLines, type MessageFormat, type MessageTopic } from "@/lib/constants/messageTopics";

/**
 * ★1通ごとの「聞きたいこと」の札（2026-10-22 / 柴さんの了承）。吹き出しの本文の上に出す。
 *   1行目「聞きたいこと：海光電業の事業・プロダクト」／2行目「メッセージで」。札が無い1通はふつうのメッセージ。
 *
 * ⚠️★2026-11-05 から、新しく送る相談はキャリア相談（kind = consult・components/messages/Consult.tsx）。
 *    この札は、それより前に送られた1通（ask_topic を持つ行）を読むためだけに残してある。
 *    書く画面（FirstMessageComposer・AskPicker）と /api/dm/topics は 2026-11-05 に外した。
 */
export function AskTag({ topic, format, companyName }: { topic: MessageTopic; format: MessageFormat | null; companyName: string | null }) {
  const l = askTagLines(topic, format, companyName);
  return (
    <span data-state="ask-tag" style={{ display: "block", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid var(--line)" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--royal)", lineHeight: 1.6 }}>{l.topic}</span>
      {l.format && <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6 }}>{l.format}</span>}
    </span>
  );
}
