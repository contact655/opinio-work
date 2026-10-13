"use client";

import { useState } from "react";
import { neutralAvatarStyle, personAvatarStyle } from "@/lib/avatarColor";
import { avatarThumbUrl } from "@/lib/avatarThumb";

/**
 * ★人の丸い写真（2026-10-12）。写真があれば縮めた版、無いか読み込めなければ頭文字の丸（色は全員同じ）。
 * ⚠️ 画像が壊れた表示を出さない（onError で頭文字に切り替える）。
 * ⚠️ 写真の有無で並べ替え・絞り込みをしない（表示だけ）。
 */
export function PersonAvatar({ name, url, size, fontSize, colorByName = false }: {
  name: string | null; url: string | null | undefined; size: number; fontSize?: number;
  /** ★頭文字の丸を名前から決まった色で塗る（2026-10-13。**候補者を探すだけ**。lib/avatarColor.ts の personAvatarStyle） */
  colorByName?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : avatarThumbUrl(url, size);
  const initial = (name ?? "").trim().charAt(0) || "?";
  const fs = fontSize ?? Math.round(size * 0.4);
  if (!src) return <div aria-hidden="true" data-avatar="initial" style={colorByName && name ? personAvatarStyle(name, size, fs) : neutralAvatarStyle(size, fs)}>{initial}</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden="true" data-avatar="photo" width={size} height={size} loading="lazy" decoding="async"
      onError={() => setBroken(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: "var(--bg-tint)", display: "block" }} />
  );
}
