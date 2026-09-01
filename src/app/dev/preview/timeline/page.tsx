import MergedTimeline from "@/components/profile/MergedTimeline";
import { Variant, PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { EditableTimeline } from "./EditableTimeline";
import {
  CAREERS_1, CAREERS_SAME_COMPANY, CAREERS_BOOMERANG, CAREERS_PARALLEL,
  CAREERS_GAP, CAREERS_CUSTOM, CAREERS_RICH, CAREERS_8, EDUCATIONS_2,
} from "../fixtures";

/**
 * 職歴タイムラインのプレビュー（2026-08-31）。
 *
 * ⚠️ 実データは **職歴のある実ユーザー4人 / 経歴24件**（2026-08-30 実測）。
 *    同社グループ・出戻り・並行職・長期ブランクを**まとめて持つ人がいない。**
 *
 * ⚠️★**呼び方が画面ごとに違う。** ここでは実ページと同じ形を両方並べる。
 *    ・`/u/[id]`   … `collapseAfter={4}`。編集アフォーダンスは**渡さない**
 *    ・`/mypage`  … `careerActions` を渡す（鉛筆・ゴミ箱・役割追加）
 *    ⚠️ `careerActions` を渡さなければ **DOM は1バイトも変わらない**。
 *
 * ⚠️★**このページはサーバーコンポーネントのまま**にしてある。他の8ページと同じく
 *    自分で `devOnly()` を呼ぶため（本番での遮断を親の layout 頼みにしない）。
 *    `careerActions` は**関数**で境界を越えられないので、その1変種だけを
 *    `EditableTimeline`（`"use client"`）に切り出してある。
 */
export default function TimelinePreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="職歴タイムライン">
        <code>/u/[id]</code> と <code>/mypage</code> が共有する <code>MergedTimeline</code> です。
        職歴の行は <strong>2経路</strong>あります（単独の <code>career</code> と、
        同社で連続する <code>career-same-company</code>）。
      </PreviewHeader>

      <Variant label="1件（在籍中）" note="最小形。グループ化も年マーカーの複数行も起きない">
        <MergedTimeline careers={CAREERS_1} educations={[]} />
      </Variant>

      <Variant
        label="同社で連続2件"
        note="⚠️★career-same-company にまとまるはず。会社名は1回だけ、役割が2行"
      >
        <MergedTimeline careers={CAREERS_SAME_COMPANY} educations={[]} />
      </Variant>

      <Variant
        label="出戻り（同じ会社だが連続しない）"
        note="⚠️★別グループになるのが正しい。1つにまとめると在籍期間が嘘になる"
      >
        <MergedTimeline careers={CAREERS_BOOMERANG} educations={[]} />
      </Variant>

      <Variant
        label="並行職（開始月が同じ2件）"
        note="⚠️★箱にまとめないこと（career-group は 2026-08-26 に廃止）。言葉で示すのが現仕様"
      >
        <MergedTimeline careers={CAREERS_PARALLEL} educations={[]} />
      </Variant>

      <Variant label="長期ブランク（2020〜2023 が空き）" note="⚠️ 年マーカーが飛ぶときの見え方。空白を埋めないこと">
        <MergedTimeline careers={CAREERS_GAP} educations={[]} />
      </Variant>

      <Variant
        label="自由入力の会社（company_id が null）"
        note="⚠️ ロゴが無く企業ページへのリンクも張られない。「非公開」の行も混ぜてある"
      >
        <MergedTimeline careers={CAREERS_CUSTOM} educations={[]} />
      </Variant>

      <Variant
        label="項目が埋まっている（部署・勤務地・勤務形態・入社理由・説明）"
        note="⚠️ remote_work_status は生値。「hybrid」がそのまま出ていないこと"
      >
        <MergedTimeline careers={CAREERS_RICH} educations={[]} isAuthenticated />
      </Variant>

      <Variant label="職歴8件 ＋ 学歴2件（collapseAfter なし）" note="⚠️ 全件出る。年マーカーが新しい順に並ぶか（古い順に並んでいた前例がある）">
        <MergedTimeline careers={CAREERS_8} educations={EDUCATIONS_2} />
      </Variant>

      <Variant
        label="職歴8件（collapseAfter=4 ／ /u/[id] と同じ）"
        note="⚠️★実ページと同じ呼び方。5件目から折りたたまれるか"
      >
        <MergedTimeline careers={CAREERS_8} educations={[]} collapseAfter={4} />
      </Variant>

      <Variant
        label="編集アフォーダンスあり（/mypage と同じ）"
        note="⚠️★行は career と career-same-company の2経路。どちらにも鉛筆・ゴミ箱が出ること"
      >
        <EditableTimeline careers={CAREERS_BOOMERANG} />
      </Variant>
    </div>
  );
}
