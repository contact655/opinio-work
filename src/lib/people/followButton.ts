/**
 * ★/people のユーザーカードのフォローボタン（2026-11-03 / 柴さんの指示）。文言と状態の1か所。
 *   OPINIO は「つながり申請」ではなく X のような「フォロー」。人型のアイコンだけだと申請と見分けがつかないので文字を出す。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️ フォロー中を押すと確認なしで外す。押したらすぐ切り替え、保存に失敗したら元に戻して FOLLOW_SAVE_ERROR を出す。
 */
export const FOLLOW_LABEL = "フォローする";
export const FOLLOWING_LABEL = "フォロー中";
export const FOLLOW_SAVE_ERROR = "保存できませんでした。もう一度お試しください。";

export type FollowCardView = {
  label: string;
  /** outline = 枠線（フォロー前）／ muted = グレー（フォロー中） */
  tone: "outline" | "muted";
  /** 押すと送る HTTP メソッド */
  method: "POST" | "DELETE";
  /** 読み上げとマウスを重ねたときの文字 */
  title: string;
};

export function followCardView(followed: boolean, followsMe = false): FollowCardView {
  if (followed) {
    return {
      label: FOLLOWING_LABEL,
      tone: "muted",
      method: "DELETE",
      title: followsMe ? "お互いにフォローしています。押すとフォローを外します" : "フォロー中です。押すとフォローを外します",
    };
  }
  return {
    label: FOLLOW_LABEL,
    tone: "outline",
    method: "POST",
    title: followsMe ? "あなたをフォローしています。押すとフォローします" : "押すとフォローします",
  };
}

/** ★フォローボタンを出すか。自分自身と未ログインには出さない */
export function showFollowOnCard(myUserId: string | null, cardUserId: string): boolean {
  return myUserId !== null && myUserId !== cardUserId;
}
