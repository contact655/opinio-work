/**
 * アップロード前に画像を縮める（ブラウザ側）。
 *
 * ── なぜ要るか（2026-08-28）────────────────────────────────────────────────
 * 圧縮・リサイズがコード上に1つも無く、スマホで撮った写真がそのまま公開プロフィールに
 * 載っていた。**実測（2026-08-28 / 本番）**:
 *
 * | | 実ファイル | 表示サイズ |
 * |---|---|---|
 * | アバター | **2,431 KB**（PNG） | **120×120**（モバイル 88×88） |
 * | カバー   | **1,397 KB**（JPEG） | 高さ **200px**（モバイル 140px） |
 *
 * バケットの `file_size_limit = 5 MiB` では弾かれないので、**5MB 以内なら巨大なまま通る。**
 *
 * ── ★方針: 失敗しても絶対に止めない（fail-open）────────────────────────────
 * 縮小はあくまで最適化で、**アップロードそのものより優先されない。**
 * `createImageBitmap` が扱えない形式（iPhone の HEIC など）や、canvas が使えない
 * 環境では**元のファイルをそのまま返す**。
 * ⚠️ ここで throw すると「写真を変えられない」に化ける。**投げないこと。**
 *
 * ── ★縮めたことは呼び出し側が画面に出す ────────────────────────────────────
 * 戻り値の `resized` が true のときは、利用者に伝えること。
 * **黙って落とさない**（CLAUDE.md「エラーと失敗を握りつぶさない原則」）。
 *
 * ── ★出力は WebP ───────────────────────────────────────────────────────────
 * 透過を保てるため。JPEG に寄せると、透過 PNG のアバターの背景が黒く塗り潰される。
 * ⚠️ **アニメーション GIF は縮めない**（1コマ目だけの静止画に化けるため、素通しする）。
 */

/**
 * 長辺の上限。⚠️ **数字の根拠は実測**（2026-08-28）。勘で動かさないこと。
 *
 * | | 表示サイズ | 2x DPI に必要 | 採用 |
 * |---|---|---|---|
 * | アバター | **120×120**（モバイル 88） | 240 | **512**（余裕を持たせた） |
 * | カバー | 高さ **200px** × カード幅 **1020px**（`maxWidth: 1060` − padding 20×2） | 2040 | **1920** |
 *
 * ⚠️ カバーは 2x をわずかに下回るが、**高さ 200px の帯に `object-fit: cover` で
 *    切り抜かれる**ので差が出ない。ここを上げるとファイルが一気に太る。
 */
export const MAX_EDGE = {
  avatar: 512,
  cover: 1920,
} as const;

/** これ以下なら触らない。⚠️ 小さい画像を再エンコードして**太らせない**ため */
const SKIP_UNDER_BYTES = 300 * 1024;

/**
 * 縮めても品質が破綻しない範囲。
 *
 * 実測（2026-08-28 / 実ブラウザ・3000×2000 のノイズ画像＝**圧縮しにくい最悪値**）:
 *
 * | | 前 | 後 |
 * |---|---|---|
 * | アバター（長辺512） | 5,682KB | **65KB**（512×341） |
 * | カバー（長辺1920） | 5,682KB | 1,315KB（1920×1280） |
 * | 透過PNG 1200×1200 | 496KB | **77KB**（512×512・**透過は保たれた**） |
 * | 200×200 の小さい画像 | 11KB | **素通し**（再エンコードしない） |
 *
 * ⚠️ カバーの 1,315KB は**ノイズ画像だから**。実写ならこの数分の1になる。
 *    「効いていない」と読み違えないこと。
 */
const QUALITY = 0.82;

export type ResizeResult = {
  /** アップロードするファイル。縮めなかったときは**元のファイルそのもの** */
  file: File;
  /** 縮めたか。⚠️ true のときは画面に出すこと */
  resized: boolean;
  /** 元のバイト数（画面に出す用） */
  beforeBytes: number;
  /** 後のバイト数 */
  afterBytes: number;
};

/**
 * 長辺が `maxEdge` を超えていたら縮めて WebP にする。
 *
 * ⚠️ **例外を投げない。** 何が起きても最低限「元のファイル」を返す。
 */
export async function resizeImageForUpload(
  file: File,
  maxEdge: number,
): Promise<ResizeResult> {
  const passthrough: ResizeResult = {
    file, resized: false, beforeBytes: file.size, afterBytes: file.size,
  };

  /* ⚠️ アニメーション GIF は素通し。縮めると1コマ目だけの静止画になる */
  if (file.type === "image/gif") return passthrough;
  /* 小さいものは触らない。再エンコードで太ることがある */
  if (file.size <= SKIP_UNDER_BYTES) return passthrough;

  try {
    if (typeof createImageBitmap !== "function") return passthrough;
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    if (!width || !height) { bitmap.close?.(); return passthrough; }

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    /* ⚠️ 既に十分小さいなら**再エンコードしない。** 画質を落とすだけで得が無い */
    if (scale >= 1) { bitmap.close?.(); return passthrough; }

    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return passthrough; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    /* ⚠️ WebP を吐けない環境では null が返る。そのときは素通し */
    if (!blob || blob.size === 0) return passthrough;
    /* ⚠️ **太ったら使わない。** 元より大きくなる画像は実在する（極端に平坦な PNG など） */
    if (blob.size >= file.size) return passthrough;

    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return {
      file: new File([blob], `${base}.webp`, { type: "image/webp" }),
      resized: true,
      beforeBytes: file.size,
      afterBytes: blob.size,
    };
  } catch (e) {
    /* ⚠️ HEIC など createImageBitmap が投げる形式がある。**握りつぶさずログは出す**が、
          アップロードは止めない（縮小は最適化であって前提条件ではない）。 */
    console.warn("[image] リサイズできなかったので元のファイルを使う:", e);
    return passthrough;
  }
}

/** 「2.4MB → 61KB」のような表示用の文字列。 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}
