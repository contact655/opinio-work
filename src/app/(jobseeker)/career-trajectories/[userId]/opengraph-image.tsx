import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const alt = "OPINIO キャリア軌跡";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Step = {
  salary_man: number | null;
  visibility_salary: boolean;
  display_order: number;
};

async function loadFontBuffers(text: string): Promise<ArrayBuffer[]> {
  try {
    const uniqueChars = Array.from(new Set(text)).join("");
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(uniqueChars)}`;
    const css = await fetch(cssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }).then((r) => r.text());
    const fontUrls = Array.from(
      css.matchAll(/url\(([^)]+)\) format\('woff2'\)/g)
    ).map((m) => m[1]);
    if (fontUrls.length === 0) return [];
    return await Promise.all(fontUrls.map((u) => fetch(u).then((r) => r.arrayBuffer())));
  } catch {
    return [];
  }
}

export default async function OGImage({
  params,
}: {
  params: { userId: string };
}) {
  const { userId } = params;
  const adminSupabase = createAdminClient();

  const [profileRes, stepsRes, allProfilesRes] = await Promise.all([
    adminSupabase
      .from("ow_career_profiles")
      .select("headline, years_of_experience, birth_year, verified")
      .eq("user_id", userId)
      .eq("is_published", true)
      .maybeSingle(),
    adminSupabase.rpc("get_public_career_steps", { p_user_id: userId }),
    adminSupabase
      .from("ow_career_profiles")
      .select("user_id")
      .eq("is_published", true)
      .order("created_at", { ascending: true })
      .order("user_id", { ascending: true }),
  ]);

  const profile = profileRes.data;

  // 連番
  const allProfiles = (allProfilesRes.data ?? []) as { user_id: string }[];
  const serialIdx = allProfiles.findIndex((p) => p.user_id === userId);
  const serialNum = serialIdx >= 0 ? String(serialIdx + 1).padStart(3, "0") : "000";

  // 年収カーブ（古→新）
  const steps = (stepsRes.data ?? []) as Step[];
  const salaryCurve = steps
    .filter((s) => s.visibility_salary && s.salary_man != null)
    .sort((a, b) => b.display_order - a.display_order)
    .map((s) => s.salary_man as number);

  const headline = profile?.headline ?? "キャリア軌跡";
  const age = profile?.birth_year
    ? new Date().getFullYear() - profile.birth_year
    : null;
  const yearsExp = profile?.years_of_experience ?? null;
  const verified = (profile as { verified?: boolean } | null)?.verified ?? false;

  // フォント（文字サブセット取得）
  const textToLoad =
    headline +
    "キャリア軌跡OPINIO年収万歳社会人歴社経験取材済み詳しく読む→";
  const fontBuffers = await loadFontBuffers(textToLoad);
  const fonts = fontBuffers.map((data) => ({
    name: "NotoSansJP",
    data,
    weight: 700 as const,
  }));

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background:
            "linear-gradient(135deg, #001233 0%, #002366 60%, #0f3280 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "52px 72px",
          fontFamily: fonts.length > 0 ? "NotoSansJP, sans-serif" : "sans-serif",
        }}
      >
        {/* トップ行: ブランド + 連番 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 48,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#F39C12",
                letterSpacing: "0.14em",
              }}
            >
              OPINIO
            </div>
            <div
              style={{
                width: 1,
                height: 14,
                background: "rgba(255,255,255,0.2)",
              }}
            />
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.45)",
                letterSpacing: "0.08em",
              }}
            >
              キャリア軌跡
            </div>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "rgba(255,255,255,0.28)",
              letterSpacing: "0.1em",
            }}
          >
            #{serialNum}
          </div>
        </div>

        {/* メインコンテンツ */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* ヘッドライン */}
          <div
            style={{
              fontSize: headline.length > 28 ? 36 : 42,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.55,
              marginBottom: 36,
            }}
          >
            {headline}
          </div>

          {/* スタッツ行 */}
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {age != null && (
              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 22px",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                }}
              >
                <span
                  style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}
                >
                  {age}
                </span>
                <span
                  style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}
                >
                  歳
                </span>
              </div>
            )}
            {yearsExp != null && (
              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 22px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{ fontSize: 14, color: "rgba(255,255,255,0.55)" }}
                >
                  社会人歴
                </span>
                <span
                  style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}
                >
                  {yearsExp}
                </span>
                <span
                  style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}
                >
                  年
                </span>
              </div>
            )}
            {salaryCurve.length >= 2 && (
              <div
                style={{
                  background: "rgba(243,156,18,0.15)",
                  border: "1.5px solid rgba(243,156,18,0.4)",
                  borderRadius: 10,
                  padding: "10px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}
                >
                  年収
                </span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#F39C12",
                  }}
                >
                  {salaryCurve[0]}万 → {salaryCurve[salaryCurve.length - 1]}万
                </span>
              </div>
            )}
            {verified && (
              <div
                style={{
                  background: "rgba(255,255,255,0.9)",
                  borderRadius: 7,
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ fontSize: 11, fontWeight: 700, color: "#001233" }}
                >
                  OPINIO編集部 取材済み
                </span>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}
          >
            opinio.jp/career-trajectories
          </div>
          <div
            style={{
              background:
                "linear-gradient(135deg, #F59E0B 0%, #f97316 100%)",
              borderRadius: 7,
              padding: "9px 22px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}
            >
              詳しく読む →
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
