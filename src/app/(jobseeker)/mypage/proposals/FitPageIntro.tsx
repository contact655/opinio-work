import { PROPOSAL_RESPONSE_DAYS } from "@/lib/constants/proposalResponses";
import { FIT_PAGE_LEAD, FIT_PAGE_TITLE, UNCHECKED_NOTE } from "./fitPageText";
import { Phrases } from "./FitCardParts";

/**
 * ★「あなたに合う会社」の見出しと冒頭（2026-10-15）。
 *
 * 冒頭は1文だけ（2026-10-15 に2文→1文。「担当者未登録」の説明は「詳しく」へ移した）。以前の「おすすめ」の詳しい説明（誰が行っているか・何が届くか・応募ではないこと・30日で終了）は
 * 「詳しく」の折りたたみに**文言を変えずに**入れた（柴さんの指示）。
 * ⚠️★中立の明示（人材紹介会社は関わっていない）と、何が・いつ・どこまで渡るかの告知は**消さないこと**。
 *    折りたたんだだけで、ページから外したわけではない。
 */
export default function FitPageIntro() {
  return (
    <header style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{FIT_PAGE_TITLE}</h1>
      <p data-state="fit-lead" style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink)", margin: "0 0 6px" }}>
        <Phrases text={FIT_PAGE_LEAD} />
      </p>
      <details style={{ fontSize: 12, color: "var(--ink-soft)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--royal)", padding: "4px 0" }}>詳しく</summary>
        <div style={{ marginTop: 8 }}>
          {/* ⚠️「担当者未登録」の説明は 2026-10-27 に外した（その会社が OPINIO にいないことが分かるため / 柴さんの決定） */}
          {/* ★「気をつけて見てほしいこと」が無いことの意味（2026-10-15）。カードでは確かめられなかったことを注意点として出さないので、
                 ここで1回だけ書く。⚠️ 消すと「注意点が無い＝問題が無い」と読まれる */}
          <p data-state="fit-unknown-note" style={{ fontSize: 12, lineHeight: 1.8, color: "var(--ink-soft)", margin: "0 0 8px" }}>
            {UNCHECKED_NOTE}
          </p>
          {/* ★★中立の明示。消さないこと（2026-10-15 に折りたたみへ移した。文言は変えていない） */}
          <p
            style={{
              fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)",
              background: "#F5F7FD", border: "1px solid #DCE3F5",
              borderRadius: 8, padding: "10px 12px", margin: "0 0 8px",
            }}
          >
            このおすすめは <strong>OPINIO が行っています。人材紹介会社は関わっていません。</strong><br />
            根拠にしているのは、OPINIO に登録された職歴と、在籍している方がご自身で答えた内容だけです。
          </p>
          {/* ★★何が・いつ・どこまで渡るかを書く（2026-10-11 に「求職者が先に答える」形へ書き直した）。
                 ⚠️★「提案のことは企業に伝わらない」は**提案について**の話。候補者検索に出ているかは別。消さないこと */}
          <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0 }}>
            <strong>このおすすめはあなたにだけ届いています。</strong>
            あなたが「話を聞いてみたい」と答えるまで、このおすすめのことは企業に伝わりません（企業の候補者検索に表示されるかどうかは、これとは別に「転職の状況」の「転職意欲」で決まります）。
            答えると、企業にあなたの公開プロフィール（お名前・顔写真・見出し・職歴など）と、書いた場合はひとことが届きます。
            応募にはなりません。「今回は見送る」を選んでも、企業には伝わりません。
            おすすめは届いてから{PROPOSAL_RESPONSE_DAYS}日で終了します。
          </p>
        </div>
      </details>
    </header>
  );
}
