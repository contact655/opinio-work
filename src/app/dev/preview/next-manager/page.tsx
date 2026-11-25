import { devOnly } from "../guard";
import { PreviewHeader, Variant } from "../Variant";
import { HiringManagersRail } from "@/components/nextManager/HiringManagersRail";
import { NextManagerSamples } from "./Samples";

/**
 * Next Manager の見本（2026-11-13）。採用中のバッジ・2人だけのものの一行・面談の記録・候補者管理。
 * ⚠️ DB を読まない。固定データだけ。保存・引き継ぎは押しても送らない（面談の記録は見本の印で止める）。
 */
export default function NextManagerPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="Next Manager">
        実データでは採用中のマネージャーもマッチングもまだ0件なので、出る側はここで見ます。
        候補者管理は「全件（管理者）」「自分の分だけ」「読み込み失敗」「0件」の4通りです。
      </PreviewHeader>
      <NextManagerSamples />
      {/* ★ホームの右の列「採用中のマネージャー」（2026-11-25。「相談にのれる人」の箱の置き換え） */}
      <Variant label="ホームの右の列「採用中のマネージャー」（3人・幅300px）。各行は 会社名 ／ 職種。職種が無い人は会社名だけ">
        <div style={{ width: 300, maxWidth: "100%" }}>
          <HiringManagersRail items={[
            { userId: "00000000-0000-0000-0000-000000000001", name: "山田 太郎", avatarUrl: null, companyName: "Salesforce", roleName: "アカウントエグゼクティブ" },
            { userId: "00000000-0000-0000-0000-000000000002", name: "佐藤 花子", avatarUrl: null, companyName: "株式会社とても長い会社名のサンプルホールディングスジャパン", roleName: "カスタマーサクセス" },
            { userId: "00000000-0000-0000-0000-000000000003", name: "鈴木 一郎", avatarUrl: null, companyName: "COIN（旧：コインタックス株式会社）", roleName: null },
          ]} />
        </div>
      </Variant>
      <Variant label="0人（何も出ない）">
        <div style={{ width: 300, maxWidth: "100%" }}><HiringManagersRail items={[]} /></div>
      </Variant>
    </div>
  );
}
