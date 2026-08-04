"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CompanyPhoto } from "@/lib/supabase/queries";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// ─── Shared constants ──────────────────────────────────────────────────────────

/** すべての写真カードを同じサイズで表示
 *  幅は CSS calc で「コンテナ幅 ÷ 3」 → デフォルト3枚表示 */
const CARD_H = 280; // px — 全カード共通の高さ（固定）
const GAP = 12;     // px — カード間隔
// カード幅は CSS class .ps-card で管理（calc 使用）

// カテゴリ表示ラベル（biz側と統一）
const CATEGORY_LABEL: Record<string, string> = {
  workspace: "オフィス",
  meeting:   "働く様子",
  welfare:   "休憩・食事スペース",
  event:     "チーム・イベント",
};

// ─── Caption overlay ───────────────────────────────────────────────────────────

function CaptionOverlay({ text, category }: { text?: string; category?: string }) {
  const catLabel = category ? (CATEGORY_LABEL[category] ?? null) : null;
  if (!text && !catLabel) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "28px 10px 10px",
        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {catLabel && (
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: "rgba(255,255,255,0.65)",
        }}>
          {catLabel}
        </span>
      )}
      {text && (
        <span style={{
          color: "#fff", fontSize: "var(--text-xs)", fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {text}
        </span>
      )}
    </div>
  );
}

// ─── User chip ─────────────────────────────────────────────────────────────────

function UserChip({ user }: { user: { id: string; name: string } }) {
  return (
    <Link
      href={`/u/${user.id}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: 8,
        right: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 8px 4px 4px",
        borderRadius: 20,
        background: "rgba(0,0,0,0.62)",
        backdropFilter: "blur(6px)",
        color: "#fff",
        textDecoration: "none",
        zIndex: 2,
        maxWidth: "80%",
      }}
    >
      {/* Mini avatar */}
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        background: "rgba(255,255,255,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, color: "#fff",
      }}>
        {user.name[0]?.toUpperCase() ?? "?"}
      </div>
      <span style={{
        fontSize: 12, fontWeight: 600, letterSpacing: "0.01em",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {user.name}
      </span>
    </Link>
  );
}

// ─── Full-screen lightbox ──────────────────────────────────────────────────────

function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: CompanyPhoto[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(photos.length - 1, i + 1));
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, photos.length]);

  const photo = photos[idx];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,0.15)", border: "none",
          borderRadius: "50%", width: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#fff",
        }}
      >
        <X size={20} />
      </button>

      {/* Counter */}
      <div
        style={{
          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.6)", fontSize: "var(--text-sm)", fontFamily: "Inter, sans-serif",
        }}
      >
        {idx + 1} / {photos.length}
      </div>

      {/* Image */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", maxWidth: "90vw", maxHeight: "85vh", width: "100%", height: "100%" }}
      >
        <Image
          src={photo.image_url}
          alt={photo.caption ?? ""}
          fill
          sizes="90vw"
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Caption */}
      {photo.caption && (
        <div
          style={{
            position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)", color: "#fff",
            fontSize: 13, padding: "6px 16px", borderRadius: 100,
            backdropFilter: "blur(8px)", whiteSpace: "nowrap",
          }}
        >
          {photo.caption}
        </div>
      )}

      {/* Prev */}
      {idx > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIdx(idx - 1); }}
          style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
            width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff",
          }}
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Next */}
      {idx < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIdx(idx + 1); }}
          style={{
            position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
            width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff",
          }}
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
}

// ─── Horizontal photo strip ────────────────────────────────────────────────────
// 全写真を同じサイズ（CARD_W × CARD_H）の横スクロール列で表示

function PhotoStrip({
  photos,
  onOpen,
}: {
  photos: CompanyPhoto[];
  onOpen: (i: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows]);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    // 実際のカード幅をDOMから読んで正確なスクロール量を計算
    const firstCard = el.firstElementChild as HTMLElement | null;
    const amount = firstCard ? firstCard.offsetWidth + GAP : CARD_H * 1.5 + GAP;
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  }

  const arrowStyle = (visible: boolean, side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 10,           // overflow:hidden 内なので正の値
    zIndex: 3,
    width: 36, height: 36,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.95)",
    border: "1px solid var(--line)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.16)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity 0.18s",
    padding: 0,
  });

  return (
    <>
      <style>{`
        /* カード幅: コンテナの 1/3 → デフォルトで3枚表示 */
        .ps-card {
          width: calc((100% - ${GAP * 2}px) / 3);
          min-width: 160px; /* モバイル最小幅 */
          flex-shrink: 0;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .ps-card:hover { transform: scale(1.025); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
        .ps-strip::-webkit-scrollbar { display: none; }
        /* 右端フェード — スクロール可能を示すヒント */
        .ps-outer::after {
          content: "";
          position: absolute;
          top: 0; right: 0; bottom: 0;
          width: 80px;
          background: linear-gradient(to left, rgba(255,255,255,0.95) 0%, transparent 100%);
          pointer-events: none;
          transition: opacity 0.2s;
          z-index: 2;
        }
        .ps-outer.scrolled-end::after { opacity: 0; }
      `}</style>

      {/* 外側ラッパー：右フェードのための position:relative + overflow:hidden */}
      <div
        className={`ps-outer${!canRight ? " scrolled-end" : ""}`}
        style={{ position: "relative", overflow: "hidden", borderRadius: 12, marginBottom: "var(--space-2)" }}
      >
        {/* 左矢印 */}
        <button
          type="button"
          style={arrowStyle(canLeft, "left")}
          onClick={() => scroll("left")}
          aria-label="前の写真へ"
        >
          <ChevronLeft size={16} color="var(--ink)" />
        </button>

        {/* スクロール本体 */}
        <div
          ref={scrollRef}
          className="ps-strip"
          onScroll={updateArrows}
          style={{
            display: "flex",
            gap: GAP,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
          }}
        >
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="ps-card"
              onClick={() => onOpen(i)}
              style={{
                height: CARD_H,        // 高さは固定（幅はCSS classで制御）
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
                cursor: "pointer",
                scrollSnapAlign: "start",
                background: "var(--bg-tint)",
              }}
            >
              <Image
                src={photo.image_url}
                alt={photo.caption ?? "オフィス写真"}
                fill
                sizes="320px"
                style={{ objectFit: "cover" }}
              />
              <CaptionOverlay text={photo.caption ?? undefined} category={photo.category ?? undefined} />
              {photo.tagged_user && <UserChip user={photo.tagged_user} />}
            </div>
          ))}
        </div>

        {/* 右矢印 */}
        <button
          type="button"
          style={arrowStyle(canRight, "right")}
          onClick={() => scroll("right")}
          aria-label="次の写真へ"
        >
          <ChevronRight size={16} color="var(--ink)" />
        </button>
      </div>

      {/* 枚数インジケーター */}
      <div
        style={{
          textAlign: "right",
          fontSize: "var(--text-xs)",
          color: "var(--ink-mute)",
          fontFamily: "Inter, sans-serif",
          marginTop: 6,
          marginBottom: "var(--space-4)",
        }}
      >
        {photos.length}枚の写真
      </div>
    </>
  );
}

// ─── Category tabs ─────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  { value: "all",       label: "すべて" },
  { value: "workspace", label: "オフィス" },
  { value: "meeting",   label: "働く様子" },
  { value: "welfare",   label: "休憩・食事" },
  { value: "event",     label: "チーム" },
] as const;

// ─── Main export ───────────────────────────────────────────────────────────────

// ─── Sample photos (shown when no real photos exist) ──────────────────────────

const SAMPLE_PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&fit=crop&crop=entropy",
    label: "オフィス",
  },
  {
    url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&fit=crop&crop=entropy",
    label: "働く様子",
  },
  {
    url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&fit=crop&crop=entropy",
    label: "チームミーティング",
  },
  {
    url: "https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=800&fit=crop&crop=entropy",
    label: "オープンスペース",
  },
];

function SamplePhotoGrid() {
  return (
    <div style={{ marginTop: 4, marginBottom: "var(--space-4)" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr",
        gridTemplateRows: "160px 160px",
        gap: 6,
        borderRadius: 14,
        overflow: "hidden",
      }}>
        {/* Large left photo */}
        <div style={{ gridRow: "1 / 3", position: "relative", overflow: "hidden" }}>
          <Image
            src={SAMPLE_PHOTOS[0].url}
            alt="オフィス写真サンプル"
            fill
            sizes="400px"
            style={{ objectFit: "cover" }}
          />
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
            color: "#fff", fontSize: 12, fontWeight: 700,
            padding: "3px 8px", borderRadius: 100, letterSpacing: "0.05em",
          }}>
            サンプル写真
          </div>
        </div>
        {/* Right 3 cells */}
        {SAMPLE_PHOTOS.slice(1).map((p, i) => (
          <div key={i} style={{ position: "relative", overflow: "hidden" }}>
            <Image
              src={p.url}
              alt={`${p.label}サンプル`}
              fill
              sizes="200px"
              style={{ objectFit: "cover" }}
            />
          </div>
        ))}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", textAlign: "right" }}>
        ※ 実際の写真は準備中です。上記はイメージ画像です。
      </p>
    </div>
  );
}

export function PhotoCarousel({ photos }: { photos: CompanyPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  if (photos.length === 0) {
    return <SamplePhotoGrid />;
  }

  // Compute available categories (only show tabs with at least 1 photo)
  const categoryCounts = photos.reduce<Record<string, number>>((acc, p) => {
    const cat = p.category ?? "workspace";
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  const availableTabs = ALL_CATEGORIES.filter(
    (tab) => tab.value === "all" || (categoryCounts[tab.value] ?? 0) > 0
  );

  const filteredPhotos =
    activeCategory === "all"
      ? photos
      : photos.filter((p) => (p.category ?? "workspace") === activeCategory);

  // Correct lightbox index: from filtered photos back to full photos array
  function openLightbox(filteredIdx: number) {
    const photo = filteredPhotos[filteredIdx];
    const fullIdx = photos.indexOf(photo);
    setLightboxIndex(fullIdx >= 0 ? fullIdx : filteredIdx);
  }

  return (
    <>
      {/* Category tabs — show only when more than one category exists */}
      {availableTabs.length > 2 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          {availableTabs.map((tab) => {
            const active = activeCategory === tab.value;
            const count = tab.value === "all" ? photos.length : (categoryCounts[tab.value] ?? 0);
            return (
              <button
                type="button"
                key={tab.value}
                onClick={() => setActiveCategory(tab.value)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "5px 13px", borderRadius: 999, fontSize: 12.5,
                  border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
                  background: active ? "var(--royal)" : "#fff",
                  color: active ? "#fff" : "var(--ink-soft)",
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "background 0.12s, border-color 0.12s, color 0.12s",
                  fontFamily: "inherit",
                }}
              >
                {tab.label}
                <span style={{
                  fontSize: 12, fontFamily: "Inter, sans-serif",
                  background: active ? "rgba(255,255,255,0.25)" : "var(--royal-50)",
                  color: active ? "#fff" : "var(--royal)",
                  borderRadius: 99, padding: "1px 5px", fontWeight: 700,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <PhotoStrip photos={filteredPhotos} onOpen={openLightbox} />

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
