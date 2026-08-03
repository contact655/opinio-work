/**
 * 人物帯（ヒーロー直下「その転職を、すでにした人」）の表示データ。
 *
 * この枠の価値は「企業の現役社員」ではなく「同じ境遇から先に移った人」なので、
 * 現職ではなく 起点 → 現在 を主役にする。中間は「（他N社を経て）」と畳む。
 *
 * ── 持ち方の方針 ────────────────────────────────────────────────
 * 表示文字列は ow_experiences から機械生成できないため、ここで手で持つ。
 *   - 山崎さんの起点「求人広告代理店」は会社名ではなく業種の記述
 *   - 生藤さんの起点はDB上「富士フイルムビジネスイノベーションジャパン株式会社」で
 *     帯に出すには長く、当時の社名「富士ゼロックス」で見せる必要がある
 *   - 「モルガン証券」「CTC」「KOSKA」なども通称で、マスタ名と一致しない
 *
 * ただし手書きだけにすると本人の同意設定をすり抜けるため、
 * DB にアカウントがある人（DB_BAND_LABELS 側）は
 *   - 中間社数を ow_experiences の distinct 会社数から算出する
 *   - 起点と現職の visibility_company が 'real' でなければ帯に出さない
 * という検証を page.tsx 側で実行時に行う。
 */

/** 帯カード1枚分の表示データ */
export type LPBandMember = {
  id: string;
  name: string;
  photoUrl: string | null;
  /** 起点の会社（業種の記述のこともある） */
  fromCompany: string;
  /** 現在の会社 */
  toCompany: string;
  /** 起点と現在を除いた中間の会社数。0 なら「（他N社を経て）」を出さない */
  viaCount: number;
  /** 話せるテーマ */
  quote: string | null;
};

/**
 * DB にアカウントがある人の帯表示ラベル。キーは ow_users.id。
 * 中間社数と公開可否は DB から算出・検証するのでここには持たない。
 *
 * ここに載っていても、ow_experiences の起点・現職が visibility_company='real' で
 * なければ page.tsx 側の検証で自動的に帯から外れる。
 */
export const DB_BAND_LABELS: Record<string, { fromCompany: string; toCompany: string }> = {
  // 木村 雅樹: みずほ証券 → 伊藤忠テクノソリューションズ（中間は セールスフォース・ジャパン 1社）
  "b51fc35e-776a-425e-876f-dcb2005c4389": { fromCompany: "みずほ証券", toCompany: "CTC" },
  // 生藤 弘樹: 富士フイルムビジネスイノベーションジャパン → セールスフォース・ジャパン
  //   起点は当時の社名「富士ゼロックス」で見せる（2021年に富士フイルムビジネスイノベーションへ改称）。
  //   行き先は FV カードの brand_name と揃えて「Salesforce」。正式名称だとカード幅251pxに
  //   収まらず、この1枚だけ経路が2行になって他の3枚（KOSKA / Sansan / CTC）と体裁が揃わない。
  //   中間はフライル1社。2026-08-03 に本人確認のうえ masked → real へ変更済み。
  "0c99e403-7540-4cf9-8bb1-67571af4f2b6": {
    fromCompany: "富士ゼロックス",
    toCompany: "Salesforce",
  },
};

/**
 * ow_users にアカウントが無い表示専用メンバー。
 * 掲載同意は運営がDB外で管理している前提のため、値をそのまま表示する。
 * （ow_users に登録しない理由は resolveOrLinkOwUser の注記を参照）
 */
export const LP_GUEST_BAND: LPBandMember[] = [
  {
    id: "guest-kanazawa",
    name: "金澤 啓太郎",
    photoUrl: "/images/people/kanazawa.png",
    fromCompany: "モルガン証券",
    toCompany: "KOSKA",
    viaCount: 1,
    quote: "製造業向けSaaSの法人営業",
  },
  {
    id: "guest-yamazaki",
    name: "山崎 華奈",
    photoUrl: "/images/people/yamazaki.png",
    fromCompany: "求人広告代理店",
    toCompany: "Sansan",
    viaCount: 0,
    quote: "営業DXの大企業向けの法人営業",
  },
];
