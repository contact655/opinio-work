"use client";

import React, { useState } from "react";
import { BenefitsEditor } from "@/components/business/BenefitsEditor";
import { BenefitsList } from "@/components/companies/BenefitsList";
import { serializeBenefits, normalizeBenefits, type Benefit } from "@/lib/companies/benefits";

/**
 * 入力 → 保存形 → 表示 の往復を1画面で見る（2026-08-31）。
 *
 * ⚠️★**これを作った理由。** `/biz/company` は認証の内側で、
 *    CLAUDE.md「認証の内側にあるページは、実際にログインして踏むまで
 *    壊れていても分からない」に当たる。ブラウザへのセッション注入が
 *    使えなかったので、**部品と데이터の往復だけでも画面で確かめられる**ようにした。
 *
 * ⚠️ **これは `/biz/company` の完全な代わりにはならない。**
 *    ページ側の配線（`items={form.benefitsTags}` /
 *    `onChange={(items) => update("benefitsTags", items)}`）は
 *    型では通っているが、**画面で押した検証はまだ**。
 *    ⚠️ CLAUDE.md には「入力が親に届いているか」を毎回見ろとあり、
 *       2026-08-17 に URL 欄と OGP 取得の2箇所が漏れて
 *       「URL を打っても保存が押せなかった」前例がある。**いつか踏むこと。**
 */
export function EditorRoundTrip() {
  const [items, setItems] = useState<Benefit[]>([
    { name: "書籍・学習費用補助", detail: "年間65万円（学習機関の指定あり）" },
    { name: "フルフレックス制度" },
  ]);

  /* ⚠️ 実際に保存される形。`/biz` の PATCH が通すのと同じ関数を通す */
  const saved = serializeBenefits(items);
  /* ⚠️ DB から読み戻したときの形。求職者側が通すのと同じ関数 */
  const shown = normalizeBenefits(saved);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8 }}>
          ① 企業が入力する（/biz/company と同じ部品）
        </div>
        <BenefitsEditor items={items} onChange={setItems} />
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8 }}>
          ② 実際に DB へ保存される形（serializeBenefits の出力）
        </div>
        {/* ⚠️ ここが「入力させたのに保存しない」を見つける場所。
               入力した詳細がこの JSON に出ていなければ、保存されていない。 */}
        <pre style={{
          margin: 0, padding: "12px 14px", borderRadius: 8, overflowX: "auto",
          background: "var(--ink)", color: "#fff", fontSize: 12, lineHeight: 1.7,
          fontFamily: "var(--font-inter), var(--font-noto)",
        }}>{JSON.stringify(saved, null, 2)}</pre>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8 }}>
          ③ 求職者側の見え方（読み戻して表示）
        </div>
        {shown ? <BenefitsList benefits={shown} /> : (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>
            （0件。セクションごと出ないのが正しい）
          </p>
        )}
      </div>
    </div>
  );
}
