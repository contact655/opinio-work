import { devOnly } from "../guard";
import { Variant } from "../Variant";

/**
 * カジュアル面談CTA の色を決めるための比較（2026-08-31）。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * 現行は **白文字 on `linear-gradient(135deg, #F59E0B, #FB923C)`** で、
 * 明るい側のストップ `#F59E0B` に対して **2.15**。
 * 13〜14px の文字に必要なのは **4.5**（3.0 が使えるのは 24px 以上か 18.66px 以上の太字）。
 * ⚠️★**文字を大きくしても解決しない。** 2.15 は 24px でも 3.0 に届かない。
 *    **色を変えるしかない。**
 *
 * ⚠️ グラデーションは**最も明るいストップ**で判定する（そこが最悪値になるため）。
 *
 * ── 役割は変えない ──────────────────────────────────────────────────────────
 * `.claude/skills/ui-conventions`「色の役割」は**オレンジ＝カジュアル面談のみ**と
 * 定めている。**3案とも橙のまま**で、役割は動かさない。
 *
 * ⚠️ アウトライン（白地＋橙の枠）にする案は入れていない。同じ規約が
 *    「**塗り＝主要な遷移／ゴースト＝その場の展開**」と定めており、
 *    面談CTAを枠線にすると「開くだけのボタン」と同じ見え方になる。
 *
 * ── 判断の材料 ──────────────────────────────────────────────────────────────
 * ⚠️ **既に製品内に濃い橙の前例がある。** 「話を聞けます」バッジ
 *    （`components/profile/view/TalkableBadge.tsx`）は **`#C2410C` on `#FFF7ED` = 4.88** で、
 *    こちらは基準を満たしている。**案B・案C はこのバッジと同じ橙。**
 *    → 揃えると、同じ画面に出る「バッジ」と「ボタン」が同じ橙になる。
 */

const ROWS = [
  {
    key: "現行",
    bad: true,
    bg: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)",
    fg: "#fff",
    shadow: "0 4px 14px rgba(245,158,11,0.35)",
    ratio: "2.15",
    note: "白文字 on #F59E0B（明るい側）。必要 4.5 に対し 2.15。文字を大きくしても届かない",
  },
  {
    key: "案A ── 橙はそのまま、文字を濃くする",
    bg: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)",
    fg: "#431407",
    shadow: "0 4px 14px rgba(245,158,11,0.35)",
    ratio: "6.92",
    note: "いまの明るい橙が1ピクセルも変わらない。⚠️ 濃い文字は「押せる主ボタン」に見えにくい",
  },
  {
    key: "案B ── 橙を濃くして白文字（グラデを保つ）",
    bg: "linear-gradient(135deg, #C2410C 0%, #9A3412 100%)",
    fg: "#fff",
    shadow: "0 4px 14px rgba(194,65,12,0.35)",
    ratio: "5.18",
    note: "白文字のまま。⚠️ 明るい橙より落ち着く。「話を聞けます」バッジの #C2410C と同色",
  },
  {
    key: "案C ── 単色 #C2410C（グラデをやめる）",
    bg: "#C2410C",
    fg: "#fff",
    shadow: "0 4px 14px rgba(194,65,12,0.35)",
    ratio: "5.18",
    note: "バッジと完全に同じ橙。⚠️ 立体感が減るぶん、他の塗りボタンとの差が色だけになる",
  },
] as const;

function Icon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** `/u/[id]` と `/jobs/[id]` の主ボタン（9px 18px・text-sm・アイコンつき） */
function MainCta({ bg, fg, shadow }: { bg: string; fg: string; shadow: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "9px 18px", borderRadius: 8,
      background: bg, color: fg,
      fontSize: "var(--text-sm)", fontWeight: 700,
      boxShadow: shadow, whiteSpace: "nowrap",
    }}>
      <Icon size={13} />
      カジュアル面談
    </span>
  );
}

/** 社員カードの小さいほう（12px・「◯◯さんに話を聞く →」） */
function SmallCta({ bg, fg }: { bg: string; fg: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "7px 12px", borderRadius: 7,
      background: bg, color: fg, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      生藤さんに話を聞く →
    </span>
  );
}

/** モバイルの固定バー（幅いっぱい） */
function StickyCta({ bg, fg }: { bg: string; fg: string }) {
  return (
    <span style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "13px 16px", borderRadius: 10,
      background: bg, color: fg, fontSize: 14, fontWeight: 700,
    }}>
      <Icon size={15} />
      話を聞く（カジュアル面談）
    </span>
  );
}

export default function MeetingCtaPreview() {
  devOnly();
  return (
    <div>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
        カジュアル面談CTA の色
      </h1>
      <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9 }}>
        現行は <strong style={{ color: "var(--ink)" }}>2.15</strong>（必要 4.5）。
        3案とも橙のままで、<strong style={{ color: "var(--ink)" }}>色の役割は変えていません</strong>。
      </p>
      <p style={{ margin: "0 0 24px", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.9 }}>
        比はグラデーションの<strong>最も明るいストップ</strong>で測っています（そこが最悪値）。
        実際の画面と同じ寸法・同じ余白で描いています。
      </p>

      {ROWS.map((r) => (
        <Variant
          key={r.key}
          label={r.key}
          note={`比 ${r.ratio}${"bad" in r && r.bad ? "（不足）" : "（合格）"} ／ ${r.note}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <MainCta bg={r.bg} fg={r.fg} shadow={r.shadow} />
              <SmallCta bg={r.bg} fg={r.fg} />
            </div>
            {/* ⚠️ 背景が変わると印象が変わる。実ページは白と --bg-tint の両方に置かれる */}
            <div style={{ background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 8 }}>--bg-tint の上（企業ページの社員カード周辺）</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <MainCta bg={r.bg} fg={r.fg} shadow={r.shadow} />
                <SmallCta bg={r.bg} fg={r.fg} />
              </div>
            </div>
            <div style={{ maxWidth: 420 }}>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 8 }}>モバイルの固定バー</div>
              <StickyCta bg={r.bg} fg={r.fg} />
            </div>
          </div>
        </Variant>
      ))}

      <div style={{ marginTop: 8, padding: "16px 18px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>参考 ── 同じ画面に出る「話を聞けます」バッジ</div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 700, padding: "4px 11px", borderRadius: 100,
          background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA", whiteSpace: "nowrap",
        }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
          話を聞けます
        </span>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.9 }}>
          こちらは <strong style={{ color: "var(--ink)" }}>#C2410C on #FFF7ED = 4.88</strong> で基準を満たしています。
          案B・案C はこのバッジと<strong style={{ color: "var(--ink)" }}>同じ橙</strong>なので、
          バッジとボタンの色が揃います。
        </p>
      </div>
    </div>
  );
}
