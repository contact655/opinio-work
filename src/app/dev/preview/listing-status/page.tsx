import { devOnly } from "../guard";
import { Variant } from "../Variant";
import { ListingStatusPanel } from "@/app/(jobseeker)/companies/[id]/CompanyEmployeeSections";

/**
 * 掲載設定バナー（`/companies/[id]` で**本人にだけ**出る）の3状態（2026-09-02）。
 *
 * ⚠️ 実データで出せるのは「ログインした方にのみ掲載中です」だけ
 *    （実ユーザーは全員 `ow_users.visibility = 'login_only'`）。
 *    残り2状態は**このページでしか見られない。**
 *
 * ⚠️ ボタンのコントラスト（12.5px なので基準 4.5）:
 *      掲載中      … 文字 `--success-ink` on `--success-soft` = **5.21**
 *      ログイン限定 … 白文字 on `--warm-ink`                  = **5.02**
 *      非掲載      … 白文字 on `--ink-mute`                   = **7.58**
 *    直す前は 3.58 / **2.15** / 7.58 だった。
 *
 * ⚠️ 色の役割（緑＝掲載中 / 橙＝ログイン限定 / 灰＝非掲載）は**変えていない。濃さだけ。**
 *    ドットと枠は明るい方（`tone`）のまま。
 */
export default function ListingStatusPreview() {
  devOnly();
  const rows = [
    { listing: "public" as const,     label: "掲載中（public）",
      note: "ボタンは枠線のみ。文字 --success-ink on --success-soft = 5.21（直す前 3.58）" },
    { listing: "login_only" as const, label: "ログイン限定（login_only）",
      note: "★直す前が一番悪かった。白文字 on --warm = 2.15（大きい文字の基準3.0にも届かない）→ 5.02" },
    { listing: "hidden" as const,     label: "非掲載（hidden）",
      note: "元から 7.58。変えていない" },
  ];
  return (
    <div>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
        掲載設定バナー（本人にだけ出る）
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9 }}>
        実データで出せるのは<strong style={{ color: "var(--ink)" }}>ログイン限定</strong>だけです
        （実ユーザーは全員 <code>login_only</code>）。残り2状態はここでしか見られません。
      </p>
      {rows.map((r) => (
        <Variant key={r.listing} label={r.label} note={r.note}>
          <ListingStatusPanel
            relation={{ kind: "affiliated", listing: r.listing, experienceCount: 1 }}
            companyName="株式会社セールスフォース・ジャパン"
          />
        </Variant>
      ))}
    </div>
  );
}
