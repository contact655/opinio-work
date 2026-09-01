"use client";

import React, { useState, useId } from "react";
import { InfoCard } from "@/app/(jobseeker)/companies/[id]/InfoCard";
import type { ChipVariant } from "@/lib/utils/chipVariant";

/**
 * 補足（note）を**畳んで**持つカード。ホバー／タップで開く。
 *
 * ── なぜ畳むか（2026-09-02 / 柴さん）──────────────────────────────
 * ツールの note は「レビューは2名承認」「本番・検証とも」のような**背景説明**で、
 * 応募するかどうかの判断材料ではない。それを常時2行目に出していたため、
 * ⚠️ **note を持つカードだけ背が高くなり、行の中で 82 / 61 / 52px と凸凹していた**
 *    （実測 2026-09-02）。畳めば全カードが1行になり、高さも揃う。
 *
 * ⚠️★**福利厚生（`BenefitCard`）と同じにしないこと。** あちらの括弧内は
 *    「月1万円まで」「週2出社」のような**判断に効く値**で、実測で59%が持っている。
 *    畳むとスマホの人に届かなくなるので、あちらは**常時表示のまま**にしてある。
 *    **性質が違うので扱いが違う。揃えようとしないこと。**
 *
 * ── なぜホバーだけにしないか ────────────────────────────────
 * ⚠️★**スマホにホバーは無い。** ホバーだけにすると note がスマホの人に一度も届かない。
 *    → **PC はホバーでも開き、どの端末でもタップ/クリックで開く。**
 * ⚠️ ホバーで開いたものは離れたら閉じるが、**クリックで開いたものは離れても閉じない**
 *    （読んでいる途中で消えないため）。もう一度押すと閉じる。
 *
 * ⚠️ `note` が無いカードは**押せない**（`<div>` のまま）。
 *    押せそうに見せて何も出ないのが一番よくない。
 *
 * ⚠️ ふきだしは `left: 0; right: 0` でカードと同じ幅。**横にはみ出す余地を作らない**
 *    （右端の列で画面外に出るのを防ぐ）。文章は折り返して縦に伸びる。
 */
export function HoverNoteCard({
  label, note, icon, variant,
}: {
  label: string;
  /** 無ければ畳む対象が無いので、ただのカードになる */
  note?: string | null;
  icon: React.ReactNode;
  variant?: ChipVariant;
}) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const id = useId();

  if (!note) {
    return <InfoCard icon={icon} label={label} variant={variant} />;
  }

  const open = pinned || hovered;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label} の補足を${open ? "閉じる" : "見る"}`}
        onClick={() => setPinned((v) => !v)}
        style={{
          display: "block", width: "100%", textAlign: "left",
          background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit",
        }}
      >
        {/* ⚠️ 押せることが分かるように、名前のあとに小さな印を付ける。
               印が無いと**ホバーできることに気づけない**（スマホでは特に）。
               ⚠️ 絶対配置で隅に重ねないこと。`BenefitCard` で試して文字に被った。 */}
        <InfoCard icon={icon} label={`${label} ⓘ`} variant={variant} />
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
          {note}
        </div>
      )}
    </div>
  );
}
