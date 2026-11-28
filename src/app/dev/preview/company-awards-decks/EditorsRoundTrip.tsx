"use client";

import { useState } from "react";
import { AwardsEditor, DecksEditor } from "@/components/companies/AwardsDecksEditors";
import { parseAwards, type AwardInput } from "@/lib/companies/awards";
import { parseDecks, type DeckInput } from "@/lib/companies/companyDecks";

/** /biz/company と同じ入力欄 → 保存側の検証（parseAwards / parseDecks）の結果を並べる */
export function EditorsRoundTrip() {
  const [awards, setAwards] = useState<AwardInput[]>([{ name: "くるみん認定", issuer: "厚生労働省", year: "2024", url: "" }]);
  const [decks, setDecks] = useState<DeckInput[]>([{ title: "会社紹介資料 2026年版", url: "https://speakerdeck.com/example/deck" }]);
  const pre = { maxWidth: "100%", margin: "10px 0 0", padding: "10px 12px", borderRadius: 8, background: "var(--ink)", color: "#fff", fontSize: 12, overflowX: "auto" as const };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 }}>
      <div>
        <AwardsEditor idPrefix="pv-awards" value={awards} onChange={setAwards} />
        <pre data-state="pv-awards-result" style={pre}>{JSON.stringify(parseAwards(awards), null, 2)}</pre>
      </div>
      <div>
        <DecksEditor idPrefix="pv-decks" value={decks} onChange={setDecks} />
        <pre data-state="pv-decks-result" style={pre}>{JSON.stringify(parseDecks(decks), null, 2)}</pre>
      </div>
    </div>
  );
}
