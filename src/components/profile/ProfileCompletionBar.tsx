"use client";

export type CompletionInput = {
  hasName: boolean;
  hasAboutMe: boolean;
  hasLocation: boolean;
  hasBirthDate: boolean;
  hasAvatar: boolean;
  experienceCount: number;
  educationCount: number;
  skillCount: number;
  hasPreferences: boolean; // job_type OR work_style OR timing
  certOrAchievementCount: number;
  socialOrContentCount: number;
};

type ScoreItem = {
  key: keyof CompletionInput | string;
  label: string;
  done: boolean;
  weight: number;
  hint: string;
  tab: string; // profile/edit tab or mypage anchor
};

function buildItems(d: CompletionInput): ScoreItem[] {
  return [
    { key: "avatar",   label: "プロフィール画像",       done: d.hasAvatar,                      weight: 10, hint: "写真を追加する",              tab: "#basic" },
    { key: "name",     label: "名前",                  done: d.hasName,                        weight: 8,  hint: "名前を入力する",              tab: "#basic" },
    { key: "aboutMe",  label: "自己紹介",              done: d.hasAboutMe,                     weight: 8,  hint: "自己紹介を書く",              tab: "#basic" },
    { key: "location", label: "所在地",                done: d.hasLocation,                    weight: 4,  hint: "所在地を設定する",            tab: "#basic" },
    { key: "birth",    label: "生年月日",              done: d.hasBirthDate,                   weight: 4,  hint: "生年月日を入力する",          tab: "#basic" },
    { key: "career",   label: "職歴",                  done: d.experienceCount >= 1,            weight: 20, hint: "職歴を追加する",              tab: "#career" },
    { key: "edu",      label: "学歴",                  done: d.educationCount >= 1,             weight: 10, hint: "学歴を追加する",              tab: "#career" },
    { key: "skills",   label: `スキル（3件以上）`,     done: d.skillCount >= 3,                weight: 15, hint: `スキルをあと${Math.max(0, 3 - d.skillCount)}件追加する`, tab: "#skills" },
    { key: "prefs",    label: "希望条件",              done: d.hasPreferences,                  weight: 15, hint: "希望職種・勤務スタイルを入力する", tab: "#preferences" },
    { key: "certs",    label: "資格・実績",            done: d.certOrAchievementCount >= 1,    weight: 3,  hint: "資格や実績を追加する",        tab: "#certs_achievements" },
    { key: "social",   label: "SNS・発信",             done: d.socialOrContentCount >= 1,      weight: 3,  hint: "SNSリンクや発信コンテンツを追加する", tab: "#socials_content" },
  ];
}

export function calcCompletion(d: CompletionInput): { score: number; items: ScoreItem[] } {
  const items = buildItems(d);
  const score = items.reduce((acc, it) => acc + (it.done ? it.weight : 0), 0);
  return { score, items };
}

function nextAction(items: ScoreItem[]): ScoreItem | null {
  // Priority order: weight desc, then first not done
  const undone = items.filter((it) => !it.done);
  if (!undone.length) return null;
  return undone.sort((a, b) => b.weight - a.weight)[0];
}

export function ProfileCompletionBar({
  data,
  onTabChange,
  mode = "edit",
}: {
  data: CompletionInput;
  onTabChange?: (tab: string) => void;
  mode?: "edit" | "mypage";
}) {
  const { score, items } = calcCompletion(data);
  const next = nextAction(items);

  const color =
    score >= 80 ? "var(--success)" :
    score >= 50 ? "var(--royal)" :
    "var(--warm)";

  return (
    <div style={{
      background: "var(--bg-tint)",
      border: "1px solid var(--line-soft)",
      borderRadius: 12,
      padding: "14px 18px",
      marginBottom: mode === "edit" ? 16 : 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          プロフィール完成度
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "Inter, sans-serif" }}>
          {score}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, borderRadius: 9999,
        background: "var(--line)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 9999,
          width: `${score}%`,
          background: score >= 80
            ? "linear-gradient(90deg, var(--success), #34d399)"
            : score >= 50
            ? "linear-gradient(90deg, var(--royal), #3B5FD9)"
            : "linear-gradient(90deg, var(--warm), #f59e0b)",
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Next action hint */}
      {next && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>次: </span>
          {onTabChange ? (
            <button
              onClick={() => onTabChange(next.tab.replace("#", ""))}
              style={{
                fontSize: 12, fontWeight: 600, color: "var(--royal)",
                background: "none", border: "none", padding: 0, cursor: "pointer",
                textDecoration: "underline", textUnderlineOffset: 2,
              }}
            >
              {next.hint} →
            </button>
          ) : (
            <a
              href={`/profile/edit${next.tab}`}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              {next.hint} →
            </a>
          )}
        </div>
      )}

      {score >= 100 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
          ✓ プロフィールが完成しています！
        </div>
      )}
    </div>
  );
}
