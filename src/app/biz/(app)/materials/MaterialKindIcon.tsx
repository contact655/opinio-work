import { MATERIAL_LINK_KIND_LABELS, materialLinkKind, type MaterialLinkKind } from "@/lib/companyMaterials/links";
import { MATERIAL_FILE_TYPES } from "@/lib/constants/companyMaterials";

/**
 * ★資料の種類のアイコンと種類名（2026-10-12）。リンクは URL の形（＋ドライブの mimeType）、ファイルは MIME で決める。
 * ⚠️ 色は使わない（ui-conventions「色の役割」。種類ごとの色分けをしない）。形と文字で見分ける。
 */
type Kind = MaterialLinkKind | "pdf" | "word" | "ppt" | "text";

export function materialKindOf(doc: { sourceType: string; sourceUrl: string | null; mimeType: string | null }): { kind: Kind; label: string } {
  if (doc.sourceType === "url" && doc.sourceUrl) {
    const k = materialLinkKind(doc.sourceUrl, doc.mimeType);
    return { kind: k, label: MATERIAL_LINK_KIND_LABELS[k] };
  }
  const m = doc.mimeType ?? "";
  if (m === "application/pdf") return { kind: "pdf", label: "PDF" };
  if (m.includes("wordprocessingml")) return { kind: "word", label: "Word" };
  if (m.includes("presentationml")) return { kind: "ppt", label: "PowerPoint" };
  const md = MATERIAL_FILE_TYPES.md.storedMime;
  return { kind: "text", label: m === md ? "Markdown" : "テキスト" };
}

const PATHS: Record<Kind, React.ReactNode> = {
  gdrive: <path d="M8 3h8l6 10-4 7H6l-4-7zM8 3l6 10M16 3l-6 10M2 13h20" />,
  gdoc: <><path d="M6 2h9l5 5v15H6z" /><path d="M9 12h8M9 16h8M9 8h4" /></>,
  gslides: <><path d="M6 2h9l5 5v15H6z" /><rect x="8.5" y="10" width="9" height="7" rx="1" /></>,
  gsheets: <><path d="M6 2h9l5 5v15H6z" /><path d="M8.5 10h9v8h-9zM8.5 14h9M13 10v8" /></>,
  gforms: <><path d="M6 2h9l5 5v15H6z" /><path d="M9 11h1M12 11h5M9 15h1M12 15h5" /></>,
  notion: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 17V7l8 10V7" /></>,
  youtube: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" /></>,
  other: <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />,
  pdf: <><path d="M6 2h9l5 5v15H6z" /><path d="M9 13h6M9 17h4" /></>,
  word: <><path d="M6 2h9l5 5v15H6z" /><path d="M8.5 11l1.5 6 2-4 2 4 1.5-6" /></>,
  ppt: <><path d="M6 2h9l5 5v15H6z" /><path d="M10 17v-6h2.5a1.8 1.8 0 0 1 0 3.6H10" /></>,
  text: <><path d="M6 2h9l5 5v15H6z" /><path d="M9 11h8M9 14h8M9 17h5" /></>,
};

export function MaterialKindIcon({ kind, label }: { kind: Kind; label: string }) {
  return (
    <span title={label} aria-hidden data-kind={kind} style={{
      width: 30, height: 30, borderRadius: 8, background: "var(--bg-tint)", border: "1px solid var(--line)",
      display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", flexShrink: 0,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[kind]}
      </svg>
    </span>
  );
}
