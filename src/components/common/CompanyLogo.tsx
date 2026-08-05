"use client";

import { useState, useEffect } from "react";
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
// SSR-safe パターン: 初期レンダリングは常にグラデーション。
// useEffect でロゴ URL の読み込みを試み、成功したときだけ画像を表示。
// これにより broken image アイコンが絶対に表示されない。
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
  // null = まだ試行中 or 失敗, string = 読み込み成功した URL
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function tryLoad(src: string): Promise<boolean> {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        // 5秒でタイムアウト（Clearbit の長いタイムアウトを防ぐ）
        const timer = setTimeout(() => resolve(false), 5000);
        img.onload = () => { clearTimeout(timer); resolve(true); };
        img.onerror = () => { clearTimeout(timer); resolve(false); };
        img.src = src;
      });
    }

    async function resolve() {
      // 1. logo_url を試す（死んでいると分かっている配信元は null に潰れる。
      //    判定は lib/utils/companyLogo の usableLogoUrl 1箇所に集約している）
      const direct = usableLogoUrl(logoUrl);
      if (direct) {
        const ok = await tryLoad(direct);
        if (cancelled) return;
        if (ok) { setResolvedSrc(direct); return; }
      }

      // 2. companyUrl または logoUrl (Clearbit) からドメインを取得して Google favicon
      const domain = extractDomain(companyUrl) ?? extractDomain(logoUrl);
      if (domain) {
        const favUrl = googleFaviconUrl(domain);
        const ok = await tryLoad(favUrl);
        if (cancelled) return;
        if (ok) { setResolvedSrc(favUrl); return; }
      }

      // 3. すべて失敗 → グラデーション（resolvedSrc = null のまま）
    }

    setResolvedSrc(null);
    resolve();
    return () => { cancelled = true; };
  }, [logoUrl, companyUrl]);

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
        fontFamily: "Inter, 'Noto Sans JP', sans-serif",
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
