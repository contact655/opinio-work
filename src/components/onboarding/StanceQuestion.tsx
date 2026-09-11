"use client";

import { CAREER_STANCES } from "@/lib/constants/careerPreferences";

/**
 * 「転職について」の1問。**入口は2つ、実装はこの1つ。**
 *
 * ── なぜ入口が2つあるのか（2026-09-11）────────────────────────────────────
 * ⚠️★**「重複だから片方を消そう」と判断しないこと。** 状況が違う2つの場面で、
 *    同じ問いを出しているだけ。**二重定義ではない。**
 *
 *   ① **登録の途中**（`/onboarding` の2／3）……これから登録する人
 *   ② **`/onboarding/stance`**（独立した1枚）……**過去に登録を終えたのに
 *      `career_stance` が空の人**。`OnboardingGuard` の条件②と
 *      `postAuth` がここへ送る
 *
 * ②が拾うのは「オンボーディング完了済み ＋ stance が空」という組み合わせだけで、
 * ①を入れた後は**新しく生まれない**（`onboarding_completed` は登録の最後に立ち、
 * その手前で必ずこの問いを通るため）。
 * 実測（2026-09-11 / 本番・実ユーザー10人）: ②の対象は **1人**。
 *
 * ⚠️ したがって `OnboardingGuard` と `postAuth` は**変更していない。**
 *    ②は今も `/onboarding/stance` を指している。**消すと1人が永久に聞かれなくなる。**
 *
 * ── この部品が持つもの ─────────────────────────────────────────────────
 * **問いの文・「何が決まるか」の説明・4つの選択肢。** ここが割れると、
 * 同じことを2通りで説明することになる。
 *
 * ⚠️★**スキップを置かない。** 未設定を無くすための問いなので、
 *    「あとで」を作った瞬間に存在意義が消える。
 * ⚠️★**選ぶ前に「何が決まるのか」を書く。** 書かずに選ばせると、
 *    企業に開示される設定を本人が知らないまま決めることになる。
 * ⚠️ 「スカウト」という語を本文に出さない（`/mypage` の意思表示カードと同じ方針）。
 *    送る側の意図は受け手には判断できないので、軸を**「相手が誰か」**にしている。
 */
export function StanceQuestion({
  value,
  onChange,
  headingTag = "div",
  disabled = false,
}: {
  value: string | null;
  onChange: (v: string) => void;
  /** `/onboarding/stance` は画面の主見出しなので `h1`。登録の途中では節の見出し。 */
  headingTag?: "h1" | "div";
  disabled?: boolean;
}) {
  const Heading = headingTag;
  const headingStyle = headingTag === "h1"
    ? { fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }
    : { fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" };

  return (
    <>
      <Heading style={headingStyle}>転職について、いまの気持ちに近いものは？</Heading>

      {/* ⚠️ 何が決まるのかを**選ぶ前に**書く。消さないこと。 */}
      <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
        この答えで、<strong style={{ color: "var(--ink)" }}>企業の採用担当から声をかけられるかどうか</strong>が決まります。
        あとから何度でも変えられます。
        <br />
        いま在籍している会社と、職歴に書いた会社からは、答えにかかわらず届きません。
      </p>

      {/* ⚠️★**並びを変えないこと。** 4つ目「今はいない」が
             「答えない自由」にあたる（連絡を受けない、という答え）。
             ⚠️ 選ぶまで先へ進めない作りなので、**この選択肢が最後にあることが要る。**
                上から読んで最後にたどり着く位置に置く。 */}
      <div role="radiogroup" aria-label="転職について" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CAREER_STANCES.map((o) => {
          const on = value === o.value;
          return (
            <label
              key={o.value}
              className="tap-min-h"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                cursor: disabled ? "default" : "pointer",
                padding: "12px 14px", borderRadius: 12,
                border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`,
                background: on ? "var(--royal-50)" : "#fff",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <input
                type="radio"
                name="career-stance"
                value={o.value}
                checked={on}
                disabled={disabled}
                onChange={() => onChange(o.value)}
              />
              <span style={{ fontSize: 14, fontWeight: on ? 700 : 500, color: "var(--ink)" }}>
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
}
