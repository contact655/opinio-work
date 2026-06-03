/**
 * メンターアバターのユーティリティ
 * dicebear等の自動生成アバターを検出し、イニシャルアバターにフォールバックする
 */

type AvatarPropsImage = { type: "image"; src: string };
type AvatarPropsInitial = {
  type: "initial";
  char: string;
  bgColor: string;
  textColor: string;
};
export type MentorAvatarProps = AvatarPropsImage | AvatarPropsInitial;

const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "#DBEAFE", text: "#1E40AF" }, // 青
  { bg: "#D1FAE5", text: "#065F46" }, // 緑
  { bg: "#EDE9FE", text: "#5B21B6" }, // 紫
  { bg: "#FEF3C7", text: "#92400E" }, // 黄
  { bg: "#FCE7F3", text: "#9D174D" }, // ピンク
  { bg: "#CFFAFE", text: "#155E75" }, // シアン
];

/**
 * URLが有効な写真URLかどうか判定する
 * null/空文字/dicebear URLは無効とみなす
 */
function isValidPhotoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.trim() === "") return false;
  if (url.includes("dicebear")) return false;
  return true;
}

/**
 * メンター名からアバター表示プロパティを取得する
 *
 * photoUrl が有効（非null・非dicebear）なら画像を返し、
 * それ以外ならイニシャルアバターのプロパティを返す。
 * 実際の顔写真がアップロードされれば自動的に切り替わる。
 */
export function getMentorAvatarProps(
  name: string,
  photoUrl?: string | null
): MentorAvatarProps {
  if (isValidPhotoUrl(photoUrl)) {
    return { type: "image", src: photoUrl! };
  }

  const colorIndex = name.charCodeAt(0) % 6;
  const color = AVATAR_COLORS[colorIndex];

  return {
    type: "initial",
    char: name[0] || "?",
    bgColor: color.bg,
    textColor: color.text,
  };
}
