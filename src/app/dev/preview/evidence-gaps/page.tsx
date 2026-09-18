import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import EvidenceGapsClient from "@/app/admin/evidence-gaps/EvidenceGapsClient";
import type { EvidenceGapsResult } from "@/lib/admin/evidenceGaps";

/**
 * 「根拠の棚卸し」（`/admin/evidence-gaps`）の見え方。2026-09-18 追加。
 *
 * ── ★なぜ要るか ────────────────────────────────────────────────────────────
 * **運営権限が無いと実画面を開けない。** 実装した本人が見られないので、
 * 固定データで各状態を並べておく。
 * ⚠️ 実データでは「根拠が2本立っている企業」が**0社**なので、
 *    立っている行の見え方は本番では当分描かれない。
 *
 * ── 何を見るか ──────────────────────────────────────────────────────────────
 * ⚠️ 「あと何が足りないか」が**1行で読める**こと。数字だけ見て考えさせない。
 * ⚠️ 在籍/出身が**分かれて**出ていること（声をかける相手が変わる）。
 * ⚠️ 最終ログインに「設問を見ていない」が出ること —— これが今回の要点。
 * ⚠️ 取得失敗のときに「0社」と書かないこと。
 */

const T = { path: 3, motive: 3, talkable: 1, proposal: 2 };

const co = (
  companyName: string,
  pathCurrent: number, pathAlumni: number,
  motiveCurrent: number, motiveAlumni: number,
  talkable: number, openJobs: number,
) => {
  const standing =
    (pathCurrent + pathAlumni >= T.path ? 1 : 0) +
    (motiveCurrent + motiveAlumni >= T.motive ? 1 : 0) +
    (talkable >= T.talkable ? 1 : 0);
  const needs: string[] = [];
  if (pathCurrent + pathAlumni < T.path) needs.push(`経路があと${T.path - pathCurrent - pathAlumni}件`);
  if (motiveCurrent + motiveAlumni < T.motive) needs.push(`決め手があと${T.motive - motiveCurrent - motiveAlumni}件`);
  if (talkable < T.talkable) needs.push(`話せる人があと${T.talkable - talkable}名`);
  const short = T.proposal - standing;
  return {
    companyId: companyName, companyName,
    pathCurrent, pathAlumni, motiveCurrent, motiveAlumni, talkable, openJobs, standing,
    gapLine: standing < T.proposal && needs.length
      ? `${needs.slice(0, short).join("と")}そろえば、根拠が${T.proposal}本立ちます`
      : null,
  };
};

const person = (
  name: string, email: string, experiences: number,
  lastSignInAt: string | null, companies: string[],
) => ({ userId: name, name, email, experiences, lastSignInAt, companies });

function mk(
  companies: EvidenceGapsResult["companies"],
  unanswered: EvidenceGapsResult["unanswered"],
): EvidenceGapsResult {
  return { companies, unanswered, computedAt: "2026-09-18T12:00:00.000Z", targets: T };
}

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="根拠の棚卸し（/admin/evidence-gaps）">
        <p>
          ②⑨は<strong>根拠が {T.proposal} 本そろった組み合わせだけ</strong>を出す。
          この画面は「あと何をすれば立つか」を企業ごとに出す。
        </p>
        <p>
          ★<strong>経路と決め手は在籍者でなくても積み上がる</strong>（出身者の職歴でも増える）。
          「話せる人」だけが在籍中を要る。列が分かれていることを見ること。
        </p>
      </PreviewHeader>

      <Variant
        label="実データに近い状態（根拠が立っている企業が0社）"
        note="★2026-09-18 の実測に近い形。あと何が足りないかが1行で読めること"
      >
        <EvidenceGapsClient
          data={mk(
            [
              co("伊藤忠テクノソリューションズ", 0, 1, 0, 0, 1, 0),
              co("日本ヒューレット・パッカード", 0, 0, 0, 0, 1, 0),
              co("セールスフォース・ジャパン", 0, 1, 0, 1, 0, 2),
              co("Ubie", 0, 0, 0, 0, 0, 0),
            ],
            [
              person("木村雅樹", "k.***@gmail.com", 4, "2026-06-25", ["セールスフォース・ジャパン", "伊藤忠テクノソリューションズ"]),
              person("大塚悠貴", "g***@icloud.com", 3, "2026-08-07", []),
              person("長谷川陽希", "h.***@gmail.com", 3, "2026-09-07", ["日本ヒューレット・パッカード"]),
              person("福永陽貴", "3***@gmail.com", 1, "2026-08-22", []),
            ],
          )}
        />
      </Variant>

      <Variant
        label="根拠が立っている企業がある"
        note="★立った行が緑になり、「根拠がN本立っています」に変わること"
      >
        <EvidenceGapsClient
          data={mk(
            [
              co("セールスフォース・ジャパン", 2, 3, 3, 2, 4, 2), // 3本とも達成
              co("Ubie", 1, 2, 1, 2, 0, 1),                      // 経路と決め手で2本
              co("SmartHR", 0, 1, 3, 0, 0, 0),                   // 決め手だけ → あと1本
            ],
            [person("回答していない人", "x***@example.com", 2, "2026-09-17", ["Ubie"])],
          )}
        />
      </Variant>

      <Variant
        label="未回答者が0名"
        note="「該当なし」とだけ出る。企業表は残る"
      >
        <EvidenceGapsClient data={mk([co("Ubie", 1, 0, 0, 0, 0, 0)], [])} />
      </Variant>

      <Variant
        label="★取得に失敗した"
        note="★「0社」と書かないこと。件数と読み間違えると、材料が無いのかシステムが壊れたのか区別できない"
      >
        <EvidenceGapsClient data={null} />
      </Variant>
    </div>
  );
}
