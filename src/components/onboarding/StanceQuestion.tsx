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
 * ⚠️★**「何が決まるのか」の一文は 2026-09-30 に削除した**（柴さんの指示。長いため）。
 *    ⚠️ 書き戻すなら、すぐ上の「あとから変更できます。」と重複しない形にすること
 *       （元の文は「あとから何度でも変えられます」で、同じことを2回言っていた）。
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

      {/* ★★「この答えで、企業の採用担当から声をかけられるかどうかが決まります。
             あとから何度でも変えられます。」は 2026-09-30 に削除した（柴さんの指示）。
          ⚠️ 「あとから何度でも変えられます」は、**すぐ上の「あとから変更できます。」と
             同じことを2回言っていた**（登録の途中で読む人にとっては2文続き）。
          ⚠️★**残った1文は自己完結するように書き換えた。** 元は「答えにかかわらず
             **届きません**」で、何が届かないのかを前の文が受けていた。前を消すと
             主語が宙に浮くので「声がかかることはありません」に変えてある。
             **「届きません」に戻さないこと。**
          ⚠️★**2026-09-30 に「いま在籍している会社と、職歴に書いた会社から」→
             「これまで在籍した会社から」に短くした**（柴さんの指示）。事実としては正しい
             ——`can_send_scout()` の条件2・2b は `ow_experiences` の行を見るだけで
             **`is_current` を見ていない**ので、現職も過去も同じくブロックされる。
             ⚠️ ただし**根拠は「職歴に書いてあること」**で、在籍の事実ではない。
                職歴に入れていない会社は**ブロックされない。** `/mypage` の意思表示カード
                （`IntentCard`）も同日に同じ文へ揃えた。**片方だけ戻さないこと。**
          ⚠️★**これで「何が決まるか」を選ぶ前に伝える文は、この画面から無くなった。**
             `/auth/page.tsx` の注記が「登録者が意思表示の意味を知る唯一の確実な経路」と
             書いているのはこの文のことで、いま残るのは**利用規約 第8条だけ**。
             ⚠️ 同じ説明は `IntentCard`（/mypage の意思表示カード）に**まだある**。
                あちらは別の画面なので今回は触っていない。 */}
      {/* ★2026-10-09 に書き直した。スカウトは廃止したので「声がかかる」は実態と合わない。
             `IntentCard` と同じ事実（候補者検索に出ない会社）を、自己完結する1文で書く。
             ⚠️★「グループ会社」は `can_send_scout()` が同じ親会社の会社を除くようになってから
                書いた（20261009040000）。**関数より先に文言だけ戻さないこと。** */}
      <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
        どの答えでも、これまで在籍した会社とそのグループ会社の候補者検索には表示されません。
      </p>

      {/* ⚠️★**並びを変えないこと。** 4つ目「今はいない」が
             「答えない自由」にあたる（連絡を受けない、という答え）。
             ⚠️ 選ぶまで先へ進めない作りなので、**この選択肢が最後にあることが要る。**
                上から読んで最後にたどり着く位置に置く。 */}
      <div role="radiogroup" aria-label="転職意欲" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
