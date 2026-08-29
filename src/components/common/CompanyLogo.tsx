"use client";

import { useState } from "react";
import { getLogoLetter, usableLogoUrl } from "@/lib/utils/companyLogo";

// ─── Size tokens ──────────────────────────────────────────────────────────────
type SizeToken = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<SizeToken, { px: number; radius: number }> = {
  xs: { px: 24, radius: 5  },
  sm: { px: 36, radius: 7  },
  md: { px: 48, radius: 10 },
  lg: { px: 64, radius: 14 },
  xl: { px: 96, radius: 14 },
};

const DEFAULT_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function resolveGradient(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_GRADIENT;
  if (raw.includes("gradient")) return raw;
  const rgb = hexToRgb(raw);
  if (rgb) {
    const dark = `rgb(${Math.max(0, rgb[0] - 40)},${Math.max(0, rgb[1] - 40)},${Math.max(0, rgb[2] - 40)})`;
    return `linear-gradient(135deg, ${dark}, ${raw})`;
  }
  return raw;
}

// Google favicon API — 信頼性が高く無料
function googleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
}

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  // すでに logo.clearbit.com URL の場合はドメインを抽出
  if (url.startsWith("https://logo.clearbit.com/")) {
    return url.replace("https://logo.clearbit.com/", "").split("?")[0];
  }
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface CompanyLogoProps {
  /** DB の ow_companies.name — getLogoLetter のフォールバック計算に必須 */
  name: string;
  /** DB の ow_companies.logo_url */
  logoUrl?: string | null;
  /** DB の ow_companies.logo_letter */
  logoLetter?: string | null;
  /** DB の ow_companies.logo_gradient — フォールバック時の背景 */
  logoGradient?: string | null;
  /** DB の ow_companies.url — Google favicon 取得に使用 */
  companyUrl?: string | null;
  /**
   * サイズ指定
   * - トークン: "xs"(24px) | "sm"(36px) | "md"(48px) | "lg"(64px) | "xl"(96px)
   * - 数値 px: 後方互換（borderRadius は自動計算）
   */
  size?: SizeToken | number;
  /** 角丸 px（数値 size 指定時のみ有効。トークン時は自動） */
  borderRadius?: number;
  style?: React.CSSProperties;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
/*
 * 表示するURLは**描画時に確定する**。読み込めるかを事前に試さない。
 *
 * ── なぜ事前に試さないか（2026-08-09）──────────────────────────────────────
 * 以前は useEffect の中で `new Image()` を作って読み込みを試し、成功した URL だけを
 * `<img>` に渡していた（broken image アイコンを絶対に出さないため）。
 * これには画面に見えないコストがあった。
 *
 *   ⚠️ `new Image()` は **`loading="lazy"` が効かない。**
 *      画面外のロゴも含めて、hydration 直後に**全件が一斉に取得を始める**。
 *      `/companies` の実測で www.google.com へ **40〜65本**が同時に飛び、
 *      1本あたり最大 804ms（初回・キャッシュ無し）かかっていた。
 *   ⚠️ 取得は結局2回ぶん走る。試行の `new Image()` と、その後の `<img>`
 *      （2回目はキャッシュに当たるが、リクエスト数の見え方は変わらない）。
 *
 * 事前試行をやめ、`<img loading="lazy">` を直接描くと、
 * **画面外のロゴはスクロールされるまで取得されない。**
 * 失敗したときは onError でグラデーションに落とすので、
 * broken image が出ないという元の性質は保たれる。
 *
 * ⚠️ `logo_url` は 85社すべてが「NULL(9) か死んだ logo.clearbit.com(76)」で、
 *    **使える値が1件も無い**（2026-08-09 実測）。実際に表示されているのは
 *    どの企業も Google favicon。だから事前試行は判定として機能しておらず、
 *    「必ず2番目に落ちる」ことを確かめるためだけに往復を1本使っていた。
 *    ⚠️ ここは `logo_url` に本物が入れば自動的にそちらが優先される形のままにしてある。
 */
export function CompanyLogo({
  name,
  logoUrl,
  logoLetter,
  logoGradient,
  companyUrl,
  size = "md",
  borderRadius,
  style,
  className,
}: CompanyLogoProps) {
  /* 1. 生きている logo_url があればそれ。死んだ配信元は usableLogoUrl が null に潰す
     2. 無ければ companyUrl / logoUrl からドメインを取り出して Google favicon
     3. どちらも取れなければ null → グラデーション + 頭文字 */
  const src =
    usableLogoUrl(logoUrl) ??
    (() => {
      const domain = extractDomain(companyUrl) ?? extractDomain(logoUrl);
      return domain ? googleFaviconUrl(domain) : null;
    })();

  // 読み込みに失敗した URL。onError で入れて、グラデーションに落とす
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = src && src !== failedSrc ? src : null;

  // サイズ解決
  let px: number;
  let radius: number;
  if (typeof size === "string") {
    const tok = SIZE_MAP[size] ?? SIZE_MAP.md;
    px = tok.px;
    radius = borderRadius ?? tok.radius;
  } else {
    px = size;
    radius = borderRadius ?? Math.round(px * 0.2);
  }

  const letter = getLogoLetter(logoLetter, name);
  const gradient = resolveGradient(logoGradient);
  const fontSize = Math.round(px * 0.38);

  const containerStyle: React.CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    borderRadius: radius,
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...style,
  };

  if (resolvedSrc) {
    return (
      <div
        style={{ ...containerStyle, background: "#f8fafc", border: "1px solid var(--line)" }}
        className={className}
        suppressHydrationWarning
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedSrc}
          alt=""
          /* ⚠️ lazy が効くのは `<img>` に直接書いたときだけ。
                `new Image()` で先に試すと画面外でも即座に取得が始まる */
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(resolvedSrc)}
          /*
            ⚠️ **16px 以下は「取得できなかった」と同じ扱いにする。**

            Google の favicon API は、対象ドメインにアイコンが無くても
            **16×16 の汎用アイコン（地球儀）を 200 で返す**。画像としては
            読み込みに成功するので `onError` が発火せず、そのまま 94px 等に
            引き伸ばされて「白い四角」に見える状態になっていた
            （2026-08-12 に伊藤忠テクノソリューションズで実測）。

            これは特定企業の問題ではなく、**favicon を持たないドメイン全般**で起きる。
            ユーザーが作る企業が増えるほど頻度が上がるので、個別対応にしない。

            ⚠️ 本物だが 16px しかない favicon も巻き込む（実測で公開76社中1社:
               シスコシステムズ）。16px を 94px に引き伸ばすくらいなら
               頭文字のほうが読めるので、意図的にそちらへ倒している。
            ⚠️ 判定は naturalWidth。CSS 上の表示サイズではなく**画像の実寸**を見る。
          */
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalWidth <= 16) setFailedSrc(resolvedSrc);
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: Math.round(px * 0.1),
            boxSizing: "border-box",
            display: "block",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...containerStyle,
        background: gradient,
        color: "#fff",
        /* ⚠️ 生の "Inter" / 'Noto Sans JP' を書かない（2026-08-29）。
              next/font が読み込むのは Inter と Noto Serif JP だけで、
              **'Noto Sans JP' は読み込んでいない**ので指定しても効かない。
              和文は `--font-noto`（OS標準の和文ゴシック）に任せる。 */
        fontFamily: "var(--font-inter), var(--font-noto)",
        fontWeight: 700,
        fontSize,
        letterSpacing: "-0.02em",
        userSelect: "none",
      }}
      className={className}
      aria-label={`${name} ロゴ`}
    >
      {letter}
    </div>
  );
}
