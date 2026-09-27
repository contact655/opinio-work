"use client";

import { useState } from "react";
import { Variant } from "../Variant";
import { CompanyCreateDialog } from "@/components/companies/CompanyCreateDialog";
import type { CompanyLookupResult } from "@/components/companies/useCompanyLookup";

/**
 * ダイアログを開いたままにして、縦の長さを測れるようにするだけの器。
 *
 * ⚠️★**閉じられるようにしない。** 閉じると測れない。
 *    「やめる」と「登録」は押された事実だけを出す（実際には何もしない）。
 */
export function CompanyCreateHarness() {
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((v) => [...v, `${new Date().toLocaleTimeString("ja-JP")} ${s}`]);

  return (
    <>
      <Variant
        label="初期表示（社名を打った直後）"
        note="★ここの高さを測る。18件の縦リストに戻っていたら、この枠が画面2枚ぶんに伸びる"
      >
        <CompanyCreateDialog
          initialName="株式会社サンプル商事"
          onCancel={() => push("onCancel（実画面ではピッカーへ戻る）")}
          onCreated={(c: CompanyLookupResult) => push(`onCreated: ${c.name}`)}
        />
      </Variant>

      <Variant
        label="社名が空"
        note="「この内容で登録する」が押せないこと（業種も未選択なので二重に押せない）"
      >
        <CompanyCreateDialog
          initialName=""
          onCancel={() => push("onCancel")}
          onCreated={(c: CompanyLookupResult) => push(`onCreated: ${c.name}`)}
        />
      </Variant>

      <Variant
        label="長い社名"
        note="入力欄からあふれないこと。375px でも横スクロールが出ないこと"
      >
        <CompanyCreateDialog
          initialName="富士フイルムビジネスイノベーションジャパン株式会社"
          onCancel={() => push("onCancel")}
          onCreated={(c: CompanyLookupResult) => push(`onCreated: ${c.name}`)}
        />
      </Variant>

      {log.length > 0 && (
        <pre style={{
          marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#F8FAFC",
          border: "1px solid var(--line)", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap",
        }}>{log.join("\n")}</pre>
      )}
    </>
  );
}
