"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
/* ⚠️ 選択肢は1箇所から。ここに47件を直書きすると API の CHECK とずれる
      （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。 */
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";

/*
  勤務形態のチップ。**value は共有定数から取る**（ここに直書きすると DB の CHECK とずれる。
  2026-08-07 に JobEditForm が日本語ラベルを送って保存が落ちた前例がある）。
  ラベルだけ入口用に短くし、並びは「出社 → フルリモート」にしている。
*/
const REMOTE_SHORT_LABEL: Record<string, string> = {
  on_site: "出社",
  hybrid: "ハイブリッド",
  full_remote: "フルリモート",
};
const REMOTE_CHIPS = REMOTE_WORK_STATUSES
  .map((o) => ({ value: o.value as string, label: REMOTE_SHORT_LABEL[o.value] ?? o.label }))
  .reverse();

type CompanyResult = {
  id: string;
  name: string;
  brand_name: string | null;
  industry: string | null;
  phase: string | null;
};

/* これまでの職歴（任意・複数）。
   ⚠️ 現職と同じく **会社・職種・開始年月の3点が揃った行だけ** を保存する。
      中途半端な行を作らない（2026-08-10 の方針をそのまま適用する）。 */
type PastJob = {
  key: number;
  company: CompanyResult | null;
  companyText: string;
  roleId: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
};

/* 学歴（任意・複数）。
   ⚠️ API が必須にしているのは `school` だけ。卒業年月は任意なので必須にしない
      （思い出せない人をここで止めない）。 */
type EducationRow = {
  key: number;
  school: string;
  faculty: string;
  gradYear: string;
  gradMonth: string;
};

const emptyPastJob = (key: number): PastJob => ({
  key, company: null, companyText: "", roleId: "",
  startYear: "", startMonth: "", endYear: "", endMonth: "",
});
const emptyEducation = (key: number): EducationRow => ({
  key, school: "", faculty: "", gradYear: "", gradMonth: "",
});

/** 保存できる過去の職歴か（現職と同じ3点）。 */
const pastJobReady = (j: PastJob) =>
  (!!j.company || j.companyText.trim().length > 0) && !!j.roleId && !!j.startYear && !!j.startMonth;

/**
 * POST して、落ちたら `failures` に積む。
 * ⚠️ 握り潰さない。`console.error` と画面表示の両方に出す
 *    （CLAUDE.md「エラーと失敗を握りつぶさない原則」）。
 */
async function postJson(
  url: string,
  body: Record<string, unknown>,
  label: string,
  failures: string[],
) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error(`[onboarding] ${label}の保存に失敗`, res.status, j);
      failures.push(label);
    }
  } catch (err) {
    console.error(`[onboarding] ${label}の保存に失敗`, err);
    failures.push(label);
  }
}

// ─── Inner component (needs useSearchParams → wrapped in Suspense) ────────────

export type OnboardingRole = { id: string; name: string };

/** 入社年の選択肢。⚠️ ビルド時ではなく描画時に現在年を取る */
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 51 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

const selectStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: "10px 12px",
  border: "1px solid var(--line)", borderRadius: 10,
  fontSize: 14, fontFamily: "inherit", background: "#fff", color: "var(--ink)",
};

function OnboardingInner({ roles }: { roles: OnboardingRole[] }) {
  const router = useRouter();

  /* 会社の検索・候補・ドロップダウンの状態は `CompanyPicker` の中にある。
     ここが持つのは「何が選ばれたか」だけ。 */
  const [query, setQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  /* 経歴として保存するために必要な3点のうち、会社以外の2つ。
     ⚠️ `ow_experiences` は company / role_category_id / started_at が必須。
        2026-08-10 まではここで会社名だけ聞いて**捨てていた**。 */
  const [roleId, setRoleId] = useState<string>("");
  const [startedYear, setStartedYear] = useState<string>("");
  const [startedMonth, setStartedMonth] = useState<string>("");
  /* 勤務地・勤務形態（どちらも任意）。
     ⚠️ **後から追記してもらうのが最も難しいデータなので、入口で聞く。**
        「フルリモートと書いてある会社に、実際にリモートで働いている人がいるか」を
        検証するための材料で、あとから思い出して埋めてもらえる性質のものではない。
     ⚠️ 任意のまま。空でも先に進める（入口の摩擦を増やさない）。 */
  const [prefecture, setPrefecture] = useState<string>("");
  const [remoteWorkStatus, setRemoteWorkStatus] = useState<string>("");
  /*
    ⚠️ 「会社名は伏せる」チェックはここに置かない（2026-08-14 に削除）。

       伏せた経歴は企業ページにも検索にも出ないので、置いた分だけ選ばれ、
       この画面で集めたデータがそのまま使えなくなる。
       LinkedIn / Wantedly にも社名を伏せる設定は無く、実名が前提になっている。

       公開範囲を変えたい人は `/profile/edit?tab=career` の経歴ごとの
       「会社名の公開設定」でいつでも変えられる（`CareerHistoryEditor` の
       `visibilityCompany` / `visibilityCompanyProfile`）。
       **列も編集UIも消していない。** 入口では既定の `real` で保存するだけ。
  */
  /* これまでの職歴・学歴（どちらも任意・既定は0件）。
     ⚠️ 既定で行を1つ出さない。出すと「埋めなければいけない」に見えて入口が重くなる。 */
  const [pastJobs, setPastJobs] = useState<PastJob[]>([]);
  const [educations, setEducations] = useState<EducationRow[]>([]);
  const rowKeyRef = useRef(1);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auth guard + 完了済みチェック
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login?next=" + encodeURIComponent("/onboarding"));
        return;
      }
      // すでにオンボーディング完了済みなら /companies へ
      const { data: profile } = await supabase
        .from("ow_profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.onboarding_completed) {
        router.replace("/companies");
        return;
      }
    });
  }, [router]);

  /* 会社（マスタ or 自由入力）・職種・入社年月が揃って初めて保存できる。
     ⚠️ 任意入力のままにする。埋めなければ従来どおり onboarding_completed だけ記録する。 */
  const hasCompany = !!selectedCompany || query.trim().length > 0;
  const canSaveExperience = hasCompany && !!roleId && !!startedYear && !!startedMonth;

  const finish = async () => {
    setSaving(true);
    setSaveError(null);
    /* ⚠️ 失敗を握り潰さない。どれが落ちたかを画面にも出す（best-effort だが黙らない）。 */
    const failures: string[] = [];
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // ow_profiles に onboarding_completed を記録
      const { data: existing } = await supabase
        .from("ow_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ow_profiles")
          .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      } else {
        await supabase.from("ow_profiles").insert({ user_id: user.id, onboarding_completed: true });
      }

      /* 経歴を1件作る。**ここが登録の入口**。
         ⚠️ 2026-08-10 まで、会社名を入力させておきながら保存していなかった
            （role_category_id が必須で解決できなかったため）。職種と入社年月を
            聞くようにして解消した。
         ⚠️ 3点が揃っていないときは何もしない。中途半端な行を作らない。
         ⚠️ 失敗してもオンボーディング自体は完了させる（best-effort）。
            ただし握り潰さず、画面にも出してログにも残す。 */
      if (canSaveExperience) {
        await postJson("/api/jobseeker/experiences", {
          // ⚠️ company_id / company_text は **XOR**。両方送ると 400
          ...(selectedCompany
            ? { company_id: selectedCompany.id }
            : { company_text: query.trim() }),
          role_category_id: roleId,
          started_at: `${startedYear}-${startedMonth}`,
          is_current: true,
          /* ⚠️ 空のときはキーごと送らない。API は不正値を 400 で弾くので、
                "" を送ると登録の入口が落ちる。 */
          ...(prefecture ? { prefecture } : {}),
          ...(remoteWorkStatus ? { remote_work_status: remoteWorkStatus } : {}),
          /* ⚠️ 既定は実名。伏せる選択肢は入口から外した（上のコメント参照）。 */
          visibility_company: "real",
          visibility_company_profile: "real",
        }, "経歴", failures);
      }

      /* これまでの職歴。
         ⚠️ 3点が揃った行だけ送る。`pastJobReady` は現職と同じ条件。
         ⚠️ **直列で送る**。experiences の POST は毎回 ow_users を引き直すので、
            並列にしても速くならないうえ、失敗した行の特定が難しくなる。 */
      for (const j of pastJobs) {
        if (!pastJobReady(j)) continue;
        await postJson("/api/jobseeker/experiences", {
          ...(j.company ? { company_id: j.company.id } : { company_text: j.companyText.trim() }),
          role_category_id: j.roleId,
          started_at: `${j.startYear}-${j.startMonth}`,
          /* ⚠️ 終了年月は任意。片方だけ選ばれているときは送らない
                （`YYYY-` のような値を作ると 400 になる）。 */
          ...(j.endYear && j.endMonth ? { ended_at: `${j.endYear}-${j.endMonth}` } : {}),
          is_current: false,
          visibility_company: "real",
          visibility_company_profile: "real",
        }, "職歴", failures);
      }

      /* 学歴。⚠️ 必須は学校名だけ（API 側も同じ）。 */
      for (const e of educations) {
        if (!e.school.trim()) continue;
        await postJson("/api/jobseeker/educations", {
          school: e.school.trim(),
          ...(e.faculty.trim() ? { faculty: e.faculty.trim() } : {}),
          ...(e.gradYear && e.gradMonth ? { graduated_at: `${e.gradYear}-${e.gradMonth}` } : {}),
        }, "学歴", failures);
      }

      if (failures.length > 0) {
        setSaveError(
          `${Array.from(new Set(failures)).join("・")}の保存に失敗しました。プロフィール編集からあとで登録できます。`
        );
      }

      // candidate ロールを付与
      await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "candidate" }),
      }).catch(() => {});
    }

    setSaving(false);
    setDone(true);
  };

  // ── 完了画面 ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={pageWrap}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <LogoMark />
          <div style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 20, padding: "40px 36px", boxShadow: "var(--shadow-md)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--success), #34D399)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 6px 20px rgba(5,150,105,0.3)",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h2 style={{
              fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 700,
              color: "var(--ink)", marginBottom: 10, textAlign: "center",
            }}>
              ようこそ、OPINIO へ！
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.85, marginBottom: 24, textAlign: "center" }}>
              登録が完了しました。<br />まず何から始めますか？
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="/companies" style={{
                display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
                background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                color: "#fff", borderRadius: 12, textDecoration: "none",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>掲載中の企業を見てみる</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>IT/SaaS企業の内側情報を確認する</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", opacity: 0.7, flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
              <a href="/profile/edit" style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                background: "var(--bg-tint)", border: "1px solid var(--line)",
                color: "var(--ink-soft)", borderRadius: 12, textDecoration: "none",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--royal)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: "var(--ink)" }}>プロフィールを設定する</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>職歴・学歴をあとから追加できます</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>

            {/* 採用担当者・企業の方向け導線 */}
            <a
              href={query.trim() ? `/biz/auth?company=${encodeURIComponent(query.trim())}` : "/biz/auth"}
              style={{
                marginTop: 12,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "13px 16px",
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 10, textDecoration: "none",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
                <span style={{ fontSize: 14, color: "var(--royal)", fontWeight: 700 }}>採用担当者・企業の方はこちら</span>
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── 現職会社入力画面 ──────────────────────────────────────────────────────
  return (
    <div style={pageWrap}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <LogoMark />

        {/* 入力カード */}
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 20, padding: "32px 28px", marginBottom: 16,
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>

          <h2 style={{
            fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700,
            color: "var(--ink)", marginBottom: 6, lineHeight: 1.45,
          }}>
            現在お勤めの会社を教えてください
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 24, lineHeight: 1.7 }}>
            {/*
              ⚠️ ここに「在籍中の企業の情報は、あなたには非表示になります。」という
                 一文があったが削除した（2026-08-13）。主語と目的語が入れ替わっていて
                 意味を成さないうえ、「勤務先には見られない」と読めてしまい、
                 下の「その企業のページに『現役社員』として表示されます」と正面から矛盾していた。
                 どこに出るかの説明は、実際に表示先が決まる下のブロックに一本化する。
            */}
            任意入力です。あとから変更できます。
          </p>

          {/* 会社の検索・選択。
              ⚠️ 実装は `CompanyPicker` の1つだけにする。これまでの職歴の行も同じ部品を使う。
                 ここに inline で書き直すと、片方だけ直る形の不具合が生まれる。 */}
          <CompanyPicker
            text={query}
            selected={selectedCompany}
            disabled={saving}
            autoFocus
            placeholder="例：セールスフォース、Salesforce、株式会社〇〇"
            onTextChange={(v) => { setQuery(v); setSelectedCompany(null); }}
            onSelect={(c) => { setSelectedCompany(c); setQuery(c.name); }}
            onClear={() => { setSelectedCompany(null); setQuery(""); }}
            onEnter={() => { if (!saving) finish(); }}
          />

          {/* ── 職種・入社年月 ────────────────────────────────────────────────
              ⚠️ 会社が決まってから出す。最初から3つ並べると入口が重くなる。
              ⚠️ ここまで埋めて初めて経歴として保存できる（3点が必須）。 */}
          {hasCompany && (
            <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                職種
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
                いちばん近いものを1つ選んでください。あとから詳しく設定できます。
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                {roles.map((r) => {
                  const active = roleId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoleId(active ? "" : r.id)}
                      style={{
                        padding: "7px 13px", borderRadius: 100,
                        border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
                        background: active ? "var(--royal-50)" : "#fff",
                        color: active ? "var(--royal)" : "var(--ink-soft)",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
                入社年月
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={startedYear}
                  onChange={(e) => setStartedYear(e.target.value)}
                  style={selectStyle}
                  aria-label="入社年"
                >
                  <option value="">年</option>
                  {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                </select>
                <select
                  value={startedMonth}
                  onChange={(e) => setStartedMonth(e.target.value)}
                  style={selectStyle}
                  aria-label="入社月"
                >
                  <option value="">月</option>
                  {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                </select>
              </div>

              {/*
                勤務地・勤務形態（どちらも任意・2026-08-13 追加）
                ⚠️ **後から追記してもらうのが最も難しいデータなので、入口で聞く。**
                   「フルリモートと書いてある会社に、実際にリモートで働いている人がいるか」の
                   検証材料。編集画面に追いやると、実際には誰も戻ってこない。
                ⚠️ 任意。**空でも先に進める**（編集フォーム側の必須ゲートも同日に外した）。
                ⚠️ どちらも1タップで終わる形にしている。項目を増やしすぎない。
              */}
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 20, marginBottom: 10 }}>
                勤務地（任意）
              </div>
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                style={{ ...selectStyle, width: "100%" }}
                aria-label="勤務地（都道府県）"
              >
                <option value="">都道府県</option>
                {/* ⚠️ よく選ばれる4件を先頭に出す。47件を北から南に並べると
                       東京都は13番目・大阪府は27番目で、毎回スクロールが要る。
                    ⚠️ 二重に出さないため下は `OTHER_PREFECTURES`（43件）。 */}
                <optgroup label="よく選ばれる">
                  {COMMON_PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </optgroup>
                <optgroup label="すべての都道府県">
                  {OTHER_PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </optgroup>
              </select>

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 16, marginBottom: 10 }}>
                勤務形態（任意）
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {REMOTE_CHIPS.map((o) => {
                  const active = remoteWorkStatus === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setRemoteWorkStatus(active ? "" : o.value)}
                      style={{
                        padding: "7px 13px", borderRadius: 100,
                        border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
                        background: active ? "var(--royal-50)" : "#fff",
                        color: active ? "var(--royal)" : "var(--ink-soft)",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>

              {/* ⚠️ どこに出るかを、保存する前に明記する。
                     チェックボックスは外したが、**この説明は外さない**。
                     出る場所を知らせないまま保存するのは同意を取ったことにならない。 */}
              <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 18, lineHeight: 1.8 }}>
                この経歴は、その企業のページに「現役社員」として表示されます。
                <br />
                表示されるのは <strong style={{ color: "var(--ink-soft)" }}>OPINIO にログインしている人</strong> だけです。
                公開範囲はプロフィール編集からいつでも変更できます。
              </p>
            </div>
          )}

          {/* ── これまでの職歴（任意・複数）────────────────────────────────
              ⚠️ 既定では「＋ 職歴を追加」だけを出す。行を最初から出すと、
                 現職しか無い人にも「埋めるべき欄」に見えて入口が重くなる。
              ⚠️ 保存条件は現職と同じ3点（`pastJobReady`）。揃わない行は送らない。 */}
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>これまでの職歴</div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>任意</span>
            </div>
            {/* ⚠️ 1行に収まる長さにする。「あとからプロフィール編集でも追加できます」を
                   足していたが、カード上部の「任意入力です。あとから変更できます。」と
                   同じことを言っており、2行目に「ます。」だけが落ちていた。 */}
            <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 12, lineHeight: 1.7 }}>
              過去に在籍した会社を追加できます。
            </p>

            {pastJobs.map((j, idx) => {
              const ready = pastJobReady(j);
              const touched = !!j.company || !!j.companyText.trim() || !!j.roleId || !!j.startYear || !!j.startMonth;
              return (
                <div key={j.key} style={rowCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>職歴 {idx + 1}</div>
                    <button
                      type="button"
                      onClick={() => setPastJobs((prev) => prev.filter((p) => p.key !== j.key))}
                      aria-label={`職歴 ${idx + 1} を削除`}
                      className="btn-fixed-size"
                      style={removeBtnStyle}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  <CompanyPicker
                    text={j.companyText}
                    selected={j.company}
                    disabled={saving}
                    placeholder="会社名"
                    onTextChange={(v) => setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, companyText: v, company: null } : p))}
                    onSelect={(c) => setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, company: c, companyText: c.name } : p))}
                    onClear={() => setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, company: null, companyText: "" } : p))}
                  />

                  <select
                    value={j.roleId}
                    onChange={(e) => setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, roleId: e.target.value } : p))}
                    style={{ ...selectStyle, width: "100%", marginTop: 8 }}
                    aria-label={`職歴 ${idx + 1} の職種`}
                  >
                    <option value="">職種</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>

                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                    <select
                      value={j.startYear}
                      onChange={(e) => setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, startYear: e.target.value } : p))}
                      style={selectStyle}
                      aria-label={`職歴 ${idx + 1} の入社年`}
                    >
                      <option value="">入社年</option>
                      {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                    </select>
                    <select
                      value={j.startMonth}
                      onChange={(e) => setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, startMonth: e.target.value } : p))}
                      style={selectStyle}
                      aria-label={`職歴 ${idx + 1} の入社月`}
                    >
                      <option value="">月</option>
                      {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                    <select
                      value={j.endYear}
                      onChange={(e) => setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, endYear: e.target.value } : p))}
                      style={selectStyle}
                      aria-label={`職歴 ${idx + 1} の退職年`}
                    >
                      <option value="">退職年（任意）</option>
                      {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                    </select>
                    <select
                      value={j.endMonth}
                      onChange={(e) => setPastJobs((prev) => prev.map((p) => p.key === j.key ? { ...p, endMonth: e.target.value } : p))}
                      style={selectStyle}
                      aria-label={`職歴 ${idx + 1} の退職月`}
                    >
                      <option value="">月</option>
                      {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                    </select>
                  </div>

                  {/* ⚠️ 揃っていない行は保存されない。黙って捨てない。 */}
                  {touched && !ready && (
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginTop: 10, lineHeight: 1.7 }}>
                      会社名・職種・入社年月がそろうと保存されます。
                    </p>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setPastJobs((prev) => [...prev, emptyPastJob(rowKeyRef.current++)])}
              style={addBtnStyle}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> 職歴を追加
            </button>
          </div>

          {/* ── 学歴（任意・複数）────────────────────────────────────────── */}
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>学歴</div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>任意</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 12, lineHeight: 1.7 }}>
              学校名だけでも保存できます。
            </p>

            {educations.map((e, idx) => (
              <div key={e.key} style={rowCardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>学歴 {idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => setEducations((prev) => prev.filter((p) => p.key !== e.key))}
                    aria-label={`学歴 ${idx + 1} を削除`}
                    className="btn-fixed-size"
                    style={removeBtnStyle}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={e.school}
                  onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, school: ev.target.value } : p))}
                  placeholder="学校名"
                  disabled={saving}
                  maxLength={100}
                  style={textInputStyle}
                  aria-label={`学歴 ${idx + 1} の学校名`}
                />
                <input
                  type="text"
                  value={e.faculty}
                  onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, faculty: ev.target.value } : p))}
                  placeholder="学部・学科（任意）"
                  disabled={saving}
                  maxLength={100}
                  style={{ ...textInputStyle, marginTop: 8 }}
                  aria-label={`学歴 ${idx + 1} の学部・学科`}
                />
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                  <select
                    value={e.gradYear}
                    onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, gradYear: ev.target.value } : p))}
                    style={selectStyle}
                    aria-label={`学歴 ${idx + 1} の卒業年`}
                  >
                    <option value="">卒業年（任意）</option>
                    {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
                  </select>
                  <select
                    value={e.gradMonth}
                    onChange={(ev) => setEducations((prev) => prev.map((p) => p.key === e.key ? { ...p, gradMonth: ev.target.value } : p))}
                    style={selectStyle}
                    aria-label={`学歴 ${idx + 1} の卒業月`}
                  >
                    <option value="">月</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{Number(m)}月</option>)}
                  </select>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setEducations((prev) => [...prev, emptyEducation(rowKeyRef.current++)])}
              style={addBtnStyle}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> 学歴を追加
            </button>
          </div>

          {/* ⚠️ 会社だけ埋めて職種・年月が空だと**保存されない**。
                 黙って捨てると、いま直したのと同じ「入力させたのに保存しない」に戻る。 */}
          {hasCompany && !canSaveExperience && (
            <p style={{ fontSize: 12, fontWeight: 600, color: "#92400E", background: "var(--warm-soft)",
                        border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px", marginTop: 16, lineHeight: 1.7 }}>
              職種と入社年月を選ぶと、経歴として保存されます。
              このまま進めると会社名は保存されません（あとからプロフィール編集で登録できます）。
            </p>
          )}

          {saveError && (
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 14 }}>{saveError}</p>
          )}

          <button
            type="button"
            onClick={finish}
            disabled={saving}
            style={{
              marginTop: 20, width: "100%", padding: "13px 20px",
              background: query.trim() || selectedCompany
                ? "linear-gradient(135deg, var(--royal), #3B5FD9)"
                : "var(--line)",
              color: (query.trim() || selectedCompany) ? "#fff" : "var(--ink-mute)",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: saving ? "wait" : "pointer", fontFamily: "inherit", transition: "all 0.2s",
            }}
          >
            {saving ? "登録中..." : "登録して始める →"}
          </button>
        </div>

        {/* スキップ */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={finish}
            disabled={saving}
            style={{
              fontSize: 13, color: "var(--ink-soft)", background: "none",
              border: "1px solid var(--line)", borderRadius: 8,
              cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
              padding: "9px 20px", display: "flex", alignItems: "center", gap: 5,
            }}
          >
            後で設定する
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles & sub-components ──────────────────────────────────────────

const textInputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  border: "1px solid var(--line)", borderRadius: 10,
  fontSize: 14, color: "var(--ink)", fontFamily: "inherit",
  outline: "none", boxSizing: "border-box", background: "#fff",
};

const rowCardStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 12,
  padding: "14px 14px 16px", marginBottom: 10, background: "var(--bg-tint)",
};

const addBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 16px", borderRadius: 10,
  border: "1px dashed var(--line)", background: "#fff",
  color: "var(--royal)", fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
  whiteSpace: "nowrap",
};

/* ⚠️ `.btn-fixed-size` を付けて `globals.css` の `min-height: 36px` を外す。
      付けないと 26×26 のつもりが 26×36 の縦長になる
      （.claude/rules/ui-debugging.md「min-height は height に勝つ」）。 */
const removeBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
  background: "none", border: "none", cursor: "pointer",
  color: "var(--ink-mute)", padding: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};

/**
 * 会社名の検索・選択。**現職の欄と「これまでの職歴」の各行が同じ部品を使う。**
 *
 * ⚠️ 候補・検索中・ドロップダウンの状態はこの中に閉じる。呼び出し側が持つのは
 *    「入力された文字列」と「選ばれた企業」だけ。
 * ⚠️ 見つからないときの説明文もここに置く。呼び出し側に書くと、
 *    行ごとに文言が割れる（CLAUDE.md「実装が3箇所に割れていた」の再発）。
 */
function CompanyPicker({
  text, selected, disabled, placeholder, autoFocus,
  onTextChange, onSelect, onClear, onEnter,
}: {
  text: string;
  selected: CompanyResult | null;
  disabled?: boolean;
  placeholder: string;
  autoFocus?: boolean;
  onTextChange: (v: string) => void;
  onSelect: (c: CompanyResult) => void;
  onClear: () => void;
  onEnter?: () => void;
}) {
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 100);
  }, [autoFocus]);

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // デバウンス検索
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length === 0) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/onboarding/companies/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setShowDropdown(true);
        }
      } finally {
        setSearching(false);
      }
    }, 280);
  }, []);

  const showFreeTextOption = text.trim().length >= 1 && !selected && results.length < 8;
  const exactMatch = results.some(
    (r) => r.name === text.trim() || (r.brand_name ?? "") === text.trim()
  );

  return (
    <>
      <div style={{ position: "relative" }}>
        {selected ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 14px",
            border: "2px solid var(--royal)",
            borderRadius: 10, background: "var(--royal-50)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.name}
              </div>
              {selected.industry && (
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>{selected.industry}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setResults([]);
                onClear();
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="btn-fixed-size"
              style={removeBtnStyle}
              aria-label="選択を解除"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => { onTextChange(e.target.value); search(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowDropdown(false);
                if (e.key === "Enter" && !showDropdown) onEnter?.();
              }}
              placeholder={placeholder}
              disabled={disabled}
              style={{
                ...textInputStyle,
                padding: "13px 40px 13px 16px",
                background: disabled ? "var(--bg-tint)" : "#fff",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--royal)";
                if (results.length > 0 || text.trim()) setShowDropdown(true);
              }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
              autoComplete="off"
            />
            {/* 検索アイコン / スピナー */}
            <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              {searching ? (
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--royal-100)", borderTopColor: "var(--royal)", animation: "spin 0.7s linear infinite" }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              )}
            </div>
          </div>
        )}

        {/* ドロップダウン */}
        {showDropdown && (results.length > 0 || showFreeTextOption) && (
          <div
            ref={dropdownRef}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100,
              overflow: "hidden",
            }}
          >
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(c); setShowDropdown(false); }}
                style={{
                  width: "100%", textAlign: "left", background: "none", border: "none",
                  padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--royal-50)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                  fontSize: 12, fontWeight: 700,
                }}>
                  {c.name.replace(/^株式会社|合同会社|有限会社/, "").trim().charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                  {(c.industry || c.phase) && (
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                      {[c.industry, c.phase].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            ))}

            {/* 自由入力のまま進むオプション（マスタに完全一致が無い場合） */}
            {showFreeTextOption && !exactMatch && text.trim().length > 0 && (
              <>
                {results.length > 0 && <div style={{ height: 1, background: "var(--line)", margin: "0 12px" }} />}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setShowDropdown(false); }}
                  style={{
                    width: "100%", textAlign: "left", background: "none", border: "none",
                    padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "var(--bg-tint)", border: "1px dashed var(--line)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  {/* ⚠️ 「登録」と書かない。企業マスタには何も作らず、
                         ow_experiences.company_text に名前が入るだけ（2026-08-13）。
                      ⚠️ 「企業として保存します」も書かない（2026-08-14）。
                         ow_companies に行は作られないので、企業ページも検索候補も増えない。
                         作られると読める文言は、この画面で実際に誤解された。 */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      「{text.trim()}」をこの名前のまま入力する
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>
                      あなたの経歴にこの社名で保存します
                    </div>
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {selected && (
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--success)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          OPINIOに掲載中の企業と連携します
        </p>
      )}
      {/*
        ⚠️ ここを「候補が見つかりません」に戻さないこと（2026-08-13 変更）。
           「見つかりません」は検索の失敗＝自分のミスとして読まれ、
           入力し直しか離脱を誘う。IT/SaaS 以外の企業では普通に起きる。
           **まず「このまま進めて大丈夫」と言い切ること。**

        ⚠️ 「掲載」を持ち出さないこと（2026-08-14 変更）。
           ここは本人の職歴を書く欄で、OPINIO に企業ページがあるかどうかは
           運営側の事情。入力する人には関係が無く、説明が増えるだけ迷う。

        ⚠️ 「紐づきません」のような実装語も使わない。何を失うのかが伝わらない。
      */}
      {!selected && text.trim() && !searching && results.length === 0 && (
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 8, lineHeight: 1.8 }}>
          <strong style={{ color: "var(--ink-soft)" }}>このまま進めて大丈夫です。</strong>
          入力した社名がそのまま経歴に残ります。
          <br />
          あとからプロフィール編集で選び直せます。
        </p>
      )}
    </>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "var(--bg-tint)",
};

function LogoMark() {
  return (
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "var(--royal)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--royal)" }}>
          OPINIO
        </span>
      </a>
    </div>
  );
}

// ─── Page export (Suspense boundary for useSearchParams) ─────────────────────

export default function OnboardingPage({ roles }: { roles: OnboardingRole[] }) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-tint)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--royal-100)", borderTopColor: "var(--royal)", animation: "spin 0.8s linear infinite" }} />
      </div>
    }>
      <OnboardingInner roles={roles} />
    </Suspense>
  );
}
