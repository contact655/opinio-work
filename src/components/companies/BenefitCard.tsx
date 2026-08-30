"use client";

import React, { useState, useId } from "react";
import { InfoCard } from "@/app/(jobseeker)/companies/[id]/InfoCard";
import type { ChipVariant } from "@/lib/utils/chipVariant";
import type { Benefit } from "@/lib/companies/benefits";

/**
 * 福利厚生の1枚。`detail` があるときだけ開けるようにする（2026-08-31）。
 *
 * ── なぜホバーだけにしないか ────────────────────────────────────────────────
 * ⚠️★**スマホにホバーは無い。** ホバーだけにすると、**詳細がスマホの人に
 *    一度も届かない。** それは「入力させたのに表示しない」と同じ形で、
 *    実際に `main_products` の `製品名（説明）` で起きている
 *    （説明が描画側で捨てられ、画面に一度も出ていなかった / CLAUDE.md 2026-08-12）。
 *
 * → **PC はホバーでも開き、どの端末でもタップ/クリックで開く。** 両方入れる。
 *
 * ⚠️ ホバーで開いたものは離れたら閉じるが、**クリックで開いたものは離れても閉じない**
 *    （読んでいる途中で消えないため）。もう一度押すと閉じる。
 *
 * ── 位置 ────────────────────────────────────────────────────────────────────
 * ⚠️ `left: 0; right: 0` にしてカードと同じ幅にしている。
 *    **横にはみ出す余地を作らない**ため（右端の列で画面外に出るのを防ぐ）。
 *    文章は折り返して縦に伸びる。
 *
 * ⚠️ `detail` が無いカードは**押せない**（`<div>` のまま）。押せそうに見せて
 *    何も出ないのが一番よくない。
 */
export function BenefitCard({
  benefit, icon, variant,
}: {
  benefit: Benefit;
  icon: React.ReactNode;
  variant?: ChipVariant;
}) {
  const [pinned, setPinned] = useState(false);   // クリックで開いた
  const [hovered, setHovered] = useState(false); // ホバーで開いた
  const id = useId();

  /* ⚠️ 詳細が無いときは従来どおり。**ここを分岐しないと、詳細の無い
        カード（大半）まで押せるように見える。** */
  if (!benefit.detail) {
    return <InfoCard icon={icon} label={benefit.name} variant={variant} />;
  }

  const open = pinned || hovered;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ⚠️ `.btn-fixed-size` は付けない。カードは 36px より高いので
             `globals.css` の `min-height: 36px` に当たらない（CLAUDE.md）。 */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${benefit.name} の詳細を${open ? "閉じる" : "見る"}`}
        onClick={() => setPinned((v) => !v)}
        style={{
          display: "block", width: "100%", textAlign: "left",
          background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit",
        }}
      >
        {/* ⚠️★印は `sublabel` として**カードの中に置く**（2026-08-31）。
               絶対配置で右上に重ねたら、**3枚とも文字に被った**（実測）。
               カードは 160px 幅で、ラベルが2〜3行に折り返すので**空いている隅が無い**。
               ⚠️ 絶対配置に戻さないこと。 */}
        <InfoCard
          icon={icon}
          label={benefit.name}
          sublabel={open ? "閉じる" : "詳細を見る"}
          variant={variant}
        />
      </button>

      {open && (
        <div
          id={id}
          role="tooltip"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
            background: "var(--ink)", color: "#fff",
            borderRadius: 10, padding: "10px 12px",
            fontSize: 12, lineHeight: 1.7,
            boxShadow: "0 6px 24px rgba(15,23,42,0.22)",
          }}
        >
          {benefit.detail}
        </div>
      )}
    </div>
  );
}
