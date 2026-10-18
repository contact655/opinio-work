"use client";

/*
 * 企業詳細の「社員セクション」一式。**閲覧者によって出し分ける部分**なので
 * page.tsx から切り出してクライアント側に置いた（2026-08-09）。
 *
 * ⚠️ page.tsx がこれらをサーバーで描画していたため `auth.getUser()` が必要になり、
 *    ルートが動的化して `export const revalidate = 60`（当時の宣言値。2026-09-08 に **300** へ）が効かなかった。
 *    ここへ追い出すことでページ本体を閲覧者非依存にし、ISR に載せる。
 *
 * ⚠️ **絞り込みはサーバー（/api/jobseeker/companies/[id]/employees）で行う。**
 *    ここには既に絞られたものだけが渡る。全件を受け取ってここで絞る形にしないこと。
 */

import type React from "react";
import { createContext, useContext } from "react";
import { DMButton } from "@/components/profile/DMButton";
import { useCompanyEmployees } from "@/lib/companies/useCompanyEmployees";
import { SecTitle } from "./SecTitle";
import { EmployeeAvatarImg } from "./CompanyDetailClient";
import { AVATAR_COLOR } from "@/lib/avatarColor";
import type { CompanyEmployee } from "@/lib/supabase/queries";

/*
 * ⚠️ 2026-08-13 に「社員の声」セクション（EmployeeVoicesSection）を削除した。復活させないこと。
 *
 *    出していたのは `ow_users.catchphrase` — **本人のプロフィール見出し（経歴の一行要約）**で、
 *    企業について語ったコメントではない。それを引用符アイコン付きのカードに入れていたため、
 *    「社員が会社について語った声」に読める形になっていた。意味の書き換えにあたる。
 *
 *    加えて `catchphrase` には**編集 UI がアプリ内に1つも無い**。値が入っているのは
 *    26人中3人だけで、全員 migration（archive/248〜251）による手投入。出ていたのも
 *    87社中3社（kaikou-dengyou / ctc / hp）だけで、いずれも直下の「現役社員」に
 *    同じ人が並ぶため二重に見えていた。
 *
 *    本物の社員コメントを載せるなら、`catchphrase` を流用せず専用の列を作ること。
 *    `catchphrase` 自体は残してある（/jobs/[id] と /schools/[id] が名前の下の
 *    肩書き行として使っており、そちらは用法として正しい）。
 */


// ─── Employee Sections ────────────────────────────────────────────────────────

/* ★年齢は出さない（2026-08-20）。
   ⚠️ 一覧（現役社員・OB/OG のカード）に年齢を出さないと決めた。
      **`CompanyEmployee` の型からも `birthYear` を落としてある**ので、
      ここで年齢を出そうとしても書けない。コメントで「出すな」と書く方式は
      過去に守られていないため、型で落としている。
   ⚠️ 年齢を出してよいのは**詳細ページ（`/u/[id]`）だけ**。
      その1箇所は `lib/age.ts` の `getUserAge()` を通す。
      ここにあった `calcAge` は年を引くだけで、誕生日前の人を1歳上に出していた。 */

/* ── ★現役社員・OB/OG は「1つの枠の中に区切り線で並べるリスト」（2026-10-03 / 柴さんの指示）────
   それまでは現役（灰色の塗り・矢印なし）と OB/OG（白・枠・矢印・maxWidth 380）でカードの形が違い、
   OB/OG は横幅の約7割で止まっていた。1人1箱で約90px あった。
   行の形はどちらも同じ:  顔 ／ 名前＋バッジ ／ 職種（2行まで）／ 補足1行 ／ 右端に矢印
   ⚠️★**表示する項目は変えていない**（B案）。現役社員の在籍期間は**出さない**
      （入社年月を企業ページで新しく公開することになるため。取得もしていない）。
   ⚠️ 見た目の指定は globals.css の `.person-list` / `.person-row*`。インラインに戻さないこと。
   ⚠️ 行全体が /u/[id] へのリンク（新しいタブ）。これは変更前と同じ。 */
/* ★社員の行の「メッセージ」（2026-10-17）。閲覧者（ログイン中）の id を渡す。null なら出さない（未ログイン・取得前） */
const ViewerIdContext = createContext<string | null>(null);
/* ★この企業ページの会社（2026-10-18）。メッセージの「会社のこと」のテーマをこの会社にする（OB・OG なら「〈社名〉にいた頃のこと」） */
const PageCompanyIdContext = createContext<string | null>(null);

function PersonRow({
  employee,
  badge,
  title,
  sub,
}: {
  employee: CompanyEmployee;
  badge?: React.ReactNode;
  /** 2行目（職種など）。2行まで出して省略 */
  title?: string | null;
  /** 3行目（補足）。1行で省略 */
  sub?: string | null;
}) {
  const avatarColor = AVATAR_COLOR;
  const viewerId = useContext(ViewerIdContext);
  const pageCompanyId = useContext(PageCompanyIdContext);
  return (
    <div className="person-row">
      <a href={`/u/${employee.userId}`} target="_blank" className="person-row-main">
        <span className="person-row-avatar" style={{ background: avatarColor.bg, color: avatarColor.text }}>
          {employee.avatarUrl ? (
            <EmployeeAvatarImg src={employee.avatarUrl} alt={employee.name}
              fallbackBg={avatarColor.bg} fallbackText={employee.avatarInitial ?? employee.name.charAt(0)}
              fallbackColor={avatarColor.text} fontSize={16} />
          ) : (employee.avatarInitial ?? employee.name.charAt(0))}
        </span>
        <span className="person-row-text">
          <span className="person-row-head">
            <span className="person-row-name">{employee.name}</span>
            {badge}
          </span>
          {title && <span className="person-row-title" title={title}>{title}</span>}
          {sub && <span className="person-row-sub" title={sub}>{sub}</span>}
        </span>
        <svg className="person-row-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </a>
      {/* ★メッセージ（2026-10-17）。⚠️ 「話を聞ける」「面談OK」とは書かない（撤去した意味づけ）。ただの個人どうしのメッセージ */}
      {viewerId && viewerId !== employee.userId && (
        <span className="person-row-dm"><DMButton targetUserId={employee.userId} targetName={employee.name} variant="icon" aboutCompanyId={pageCompanyId} /></span>
      )}
    </div>
  );
}

/* ★「面談OK」バッジと「◯◯さんに話を聞く」は 2026-10-16 に撤去した（面談OKの撤去 / 柴さんの判断）。
   現役社員・OB/OG の行（職歴から作る事実）は残す。 */
function EmployeeCard({ employee }: { employee: CompanyEmployee; showEndedAt?: boolean }) {
  return <PersonRow employee={employee} title={employee.roleTitle} />;
}

// person-card-grid: 全人物カードセクション共通（現役社員/OBOG）
const EMPLOYEE_GRID_CSS = `
  /* 人物カードのグリッドは 1fr ではなく minmax(0, 1fr) を使う（2026-08-08）。
     grid item は既定が min-width: auto なので、1fr だと中身の min-content まで
     トラックが膨らむ。375px で 285px の枠に 380px のカードが出ていた
     （役職名「CTC / 金融営業本部 営業第1部 / 法人営業（アカウント営業）」が原因）。
     ⚠️ ここはテンプレートリテラルの中。コメントにバッククォートを書かないこと。 */
  .person-card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  @media (max-width: 767px) {
    .person-card-grid { grid-template-columns: minmax(0, 1fr); }
  }
  /* ⚠️ .employee-grid / .alumni-grid は 2026-10-03 に廃止した（区切り線のリストへ）。
     リストの見た目は globals.css の .person-list / .person-row*。 */
`;


/* ⚠️★**`export` を外さないこと**（2026-09-12）。`/dev/preview/company-employees` が
      この関数を直接描画している。**職種でグループ分けする側は本番に該当企業が無く、
      そこでしか見られない**（CLAUDE.md「データが薄い画面は /dev/preview で見る」）。 */
export function CurrentEmployeesSection({
  employees,
  hiddenCount = 0,
  totalCount,
}: {
  employees: CompanyEmployee[];
  hiddenCount?: number;
  totalCount?: number;
}) {
  // ⑨ 0名でも empty state を表示するため早期 return を削除

  /* ── ★★グループは**本人が登録した職種から作る**（2026-09-12 / 柴さんの指示）────
     ⚠️★**企業ごとの設定テーブル（`ow_company_employee_categories`）を読むのをやめた。**
        理由は2つ。
          ① **89社中1社しか行が無く、その1社はこの表を使う画面を持っていない。**
             ＝ ほぼ全社で「素のグリッド」にしかならず、機能が存在しないのと同じだった。
          ② **設定するUIがアプリに無い**（API は `/api/biz/company/employee-categories` に
             あるが、呼んでいる画面が0件）。企業が自分で直せない設定に表示を依存させない。
        ⚠️ 表・API・`getCompanyEmployeeCategories` は**残してある**（消していない）。
           使い始めるなら、先に企業側の設定UIを作ること。

     ⚠️★**親は `roleParentId`、子は `roleCategoryId`。** 本人が大分類のまま登録した人は
        子を持たないので、親の直下（見出し無し）に並べる。
        ＝ CLAUDE.md「`role_category_id` には親カテゴリの UUID をそのまま入れてよい」に対応する。
     ⚠️ 職種が無い人は「その他」。**落とさないこと**（載っている人が消える）。 */
  type RoleGroup = {
    key: string;
    name: string;
    /** 親そのものを職種にしている人（子見出しを付けない） */
    direct: CompanyEmployee[];
    children: { key: string; name: string; emps: CompanyEmployee[] }[];
    total: number;
  };
  const OTHER_KEY = "__other__";
  const groupMap = new Map<string, RoleGroup>();
  for (const emp of employees) {
    const key = emp.roleParentId ?? emp.roleCategoryId ?? OTHER_KEY;
    const name = emp.roleParentName ?? emp.roleCategoryName ?? "その他";
    let g = groupMap.get(key);
    if (!g) {
      g = { key, name, direct: [], children: [], total: 0 };
      groupMap.set(key, g);
    }
    g.total += 1;
    if (emp.roleParentId && emp.roleCategoryId) {
      const ck = emp.roleCategoryId;
      let c = g.children.find((x) => x.key === ck);
      if (!c) {
        c = { key: ck, name: emp.roleCategoryName ?? "その他", emps: [] };
        g.children.push(c);
      }
      c.emps.push(emp);
    } else {
      g.direct.push(emp);
    }
  }
  /* 並びは**人数の多い順**。⚠️ `display_order` はここに来ていないので使えない
     （API が返すのは職種の id と名前だけ）。同数は名前順で安定させる。
     ⚠️「その他」は必ず最後。 */
  const byCountThenName = <T extends { name: string }>(n: (t: T) => number) =>
    (a: T, b: T) => n(b) - n(a) || a.name.localeCompare(b.name, "ja");
  const groups = Array.from(groupMap.values())
    .sort((a, b) => (a.key === OTHER_KEY ? 1 : 0) - (b.key === OTHER_KEY ? 1 : 0)
      || byCountThenName<RoleGroup>((g) => g.total)(a, b));
  for (const g of groups) g.children.sort(byCountThenName<{ name: string; emps: CompanyEmployee[] }>((c) => c.emps.length));

  /* ★★小さい会社では分けない（2026-09-12）。
     ⚠️★3名を3グループに割ると「1名ずつ」が並ぶだけで、**分けないほうが読みやすい。**
        実測（2026-09-12 / 本番）: 現役社員が3名の企業が1社、1名の企業が4社。
        いま分割が効く企業は存在しない。**人が増えたら自動で切り替わる。**
     ⚠️ しきい値を下げるなら、実データで「1名だけのグループ」が何割になるかを見てから。 */
  const GROUP_MIN_EMPLOYEES = 5;
  const useGroups = employees.length >= GROUP_MIN_EMPLOYEES && groups.length >= 2;

  const SECTION_ICON = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  return (
    <>
    <style>{EMPLOYEE_GRID_CSS}</style>
    <section
      id="current-employees"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) var(--cd-pad-x, 32px) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle icon={SECTION_ICON}>
          現役社員
          <span
            style={{
              fontFamily: "var(--font-inter), var(--font-noto)",
              fontSize: "var(--text-sm)",
              fontWeight: 400,
              color: "var(--ink-mute)",
              marginLeft: "var(--space-2)",
            }}
          >
            ({totalCount ?? employees.length}名)
          </span>
        </SecTitle>

      </div>
      {/* ⚠️ 余白は globals.css の .person-section-body（767px 以下だけ左右を詰める） */}
      <div className="person-section-body">
      {/* ── ★職種の構成バー（3名以上 ＋ 職種が2種類以上）──────────────────────
             ⚠️★**分割表示（`useGroups`）より条件をゆるくしてある。** 3名でも
                「どんな職種の人が載っているか」は一目で分かるほうがよく、
                バーは1行なので場所を取らない。**分割と同じしきい値にしないこと。**
             ⚠️ ラベルは親職種。親が無い人は子、どちらも無ければ「その他」。 */}
      {employees.length >= 3 && groups.length >= 2 && (() => {
        const catCounts = new Map<string, number>();
        for (const emp of employees) {
          const label = emp.roleParentName ?? emp.roleCategoryName ?? "その他";
          catCounts.set(label, (catCounts.get(label) ?? 0) + 1);
        }
        const entries = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]);
        const total = employees.length;
        const COLORS = ["var(--royal)", "#3B5FD9", "#7C3AED", "var(--success)", "#F59E0B", "#DC2626", "#6b7280"];
        return (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", height: 8, borderRadius: 100, overflow: "hidden", marginBottom: "var(--space-2)", gap: 2 }}>
              {entries.map(([name, count], i) => (
                <div
                  key={name}
                  title={`${name}: ${count}名 (${Math.round((count / total) * 100)}%)`}
                  style={{
                    flex: `${count} 0 0`,
                    background: COLORS[i % COLORS.length],
                    borderRadius: 100,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 16px" }}>
              {entries.map(([name, count], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "var(--ink-soft)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0, display: "inline-block" }} />
                  {name}
                  <span style={{ fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{count}</span>名
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {employees.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px 24px",
          color: "var(--ink-mute)",
        }}>
          {hiddenCount > 0 ? (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>
                ログインすると{hiddenCount}名のプロフィールが見られます
              </div>
              <a href="/auth" style={{ display: "inline-block", marginTop: 12, padding: "8px 22px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                ログイン / 会員登録 →
              </a>
            </>
          ) : (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📸</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>
                現在登録されている社員情報はありません
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                現役社員・OB/OGがプロフィールを登録すると<br />ここに表示されます
              </div>
            </>
          )}
        </div>
      ) : !useGroups ? (
        // 小さい会社・職種が1種類 → 素のグリッド
        <div className="person-list">
          {employees.map((emp) => (
            <EmployeeCard key={emp.userId} employee={emp} />
          ))}
        </div>
      ) : (
        // ★職種ごとに分けて表示（本人が登録した職種から導出）
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {groups.map((group) => (
            <div key={group.key}>
              {/* 親職種の見出し */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginBottom: "var(--space-3)",
                  paddingBottom: "var(--space-2)",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)" }}>
                  {group.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-inter), var(--font-noto)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 400,
                    color: "var(--ink-mute)",
                  }}
                >
                  {group.total}名
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {/* ⚠️★大分類のまま登録した人は**子見出しを付けずに**親の直下へ。
                       「営業 > 営業」のような見出しを作らない。 */}
                {group.direct.length > 0 && (
                  <div className="person-list">
                    {group.direct.map((emp) => (
                      <EmployeeCard key={emp.userId} employee={emp} />
                    ))}
                  </div>
                )}

                {group.children.map((cat) => (
                  <div key={cat.key}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 5,
                        marginBottom: "var(--space-2)",
                      }}
                    >
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-soft)" }}>
                        {cat.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-inter), var(--font-noto)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 400,
                          color: "var(--ink-mute)",
                        }}
                      >
                        {cat.emps.length}名
                      </span>
                    </div>
                    <div className="person-list">
                      {cat.emps.map((emp) => (
                        <EmployeeCard key={emp.userId} employee={emp} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ⚠️ 「在籍・職種はご本人の登録内容です。OPINIO は在籍確認を行っていません。」は 2026-10-01 に削除した。
             面談OK（本人の申告で企業ページに出る仕組み）は 2026-10-16 に撤去した */}
      </div>
    </section>
    </>
  );
}

// ─── AlumniCard ──────────────────────────────────────────────────────────────

function AlumniCard({ employee }: { employee: CompanyEmployee }) {

  /** **この会社での**在籍期間（その経歴の開始〜終了の月数）。今の会社の期間ではない */
  function calcTenure(startedAt: string | null, endedAt: string | null): string | null {
    if (!startedAt || !endedAt) return null;
    const [sy, sm] = startedAt.split("-").map(Number);
    const [ey, em] = endedAt.split("-").map(Number);
    const months = (ey - sy) * 12 + (em - sm);
    if (months <= 0) return null;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${rem}ヶ月`;
    if (rem === 0) return `${years}年`;
    return `${years}年${rem}ヶ月`;
  }

  const tenure = calcTenure(employee.startedAt, employee.endedAt);

  /* ⚠️ 「💬 DM可」バッジは 2026-08-08 に削除した。条件なしで全員に出ており、情報量が無かった。
     ★「在籍」を付けた（2026-10-03）。「2年」だけだと、この会社の期間か今の会社の期間か分からなかった。 */
  const badge = tenure ? (
    <span className="person-row-badge person-row-badge--tenure">在籍{tenure}</span>
  ) : null;

  /* ★今の会社と職種は**1行にまとめて「現在：」を付ける**（2026-10-03）。
     ⚠️ 値そのものは変えていない（会社名は brand_name ?? name、職種は自己申告の役職名）。
     ⚠️ 在籍時の部署・役職（roleTitle）は**出さない**（変更前と同じ）。 */
  const currentDisplayName = employee.currentCompanyBrandName ?? employee.currentCompanyName;
  const current = [currentDisplayName, employee.currentRoleTitle].filter(Boolean).join("・");

  return (
    <PersonRow
      employee={employee}
      badge={badge}
      title={current ? `現在：${current}` : null}
    />
  );
}

// ─── 掲載設定 CTA ────────────────────────────────────────────────────────────
// 「この企業ページに自分を掲載するか」を、在籍者・経験者本人にだけ提示する。
// 既存の公開設定 UI（/profile/edit）は掲載先を「キャリア軌跡ページ」としか
// 説明していなかったため、企業ページに載ることを本人が認識できていない。
// ここでは掲載先を明示したうえで、現在の状態と変更導線を出す。

export type ViewerListing = "public" | "login_only" | "hidden";

export type ViewerRelation =
  | { kind: "anonymous" }
  | { kind: "unrelated" }
  | { kind: "affiliated"; listing: ViewerListing; experienceCount: number };

/* ⚠️ `export` してある理由は `/dev/preview/listing-status` から使うため（2026-09-02）。
      3状態（掲載中 / ログイン限定 / 非掲載）のうち、実データで出せるのは1つだけ。
      CLAUDE.md「カードが出る側を一度も描画しないまま本番へ出した」を繰り返さない。 */
export function ListingStatusPanel({
  relation,
  companyName,
}: {
  relation: ViewerRelation;
  companyName: string;
}) {
  // 在籍者・経験者以外には出さない。求職者向けの獲得導線は別途（段階0〜2の設計）。
  if (relation.kind !== "affiliated") return null;

  /* ★`toneInk` を足した（2026-09-02）。**ボタンだけ**に使う濃い色。
        ⚠️ `tone`（明るい方）は**ドットと枠のまま**にする。色の役割
           （緑＝掲載中 / 橙＝ログイン限定 / 灰＝非掲載）は**変えていない。濃さだけ。**
        ⚠️ 直す前のボタンは 12.5px（基準 4.5）で:
             掲載中      … 文字 `--success` on `--success-soft` = **3.58** ❌
             ログイン限定 … 白文字 on `--warm`                   = **2.15** ❌（大きい文字の基準3.0にも届かない）
             非掲載      … 白文字 on `--ink-mute` = 7.58 ✅（据え置き）
        ⚠️★これは 2026-08-31〜09-01 に直した「**文字色**としての `--warm` / `--success`」
           とは**別の系統**（塗りの上に白文字を置いている側）。あの移行では触っていない。
        ⚠️ `--success-ink` / `--warm-ink` は本来「明るい背景に載せる文字」の色。
           ここで**塗り**に使うのは、白文字で 5.48 / 5.02 になることを実測したうえでの個別判断。
           **名前だけを理由に他所へ広げないこと。** */
  const COPY: Record<ViewerListing, {
    tone: string;
    toneSoft: string;
    /** ボタン専用の濃い色。文字にも塗りにも使う */
    toneInk: string;
    label: string;
    body: string;
    action: string;
  }> = {
    public: {
      tone: "var(--success)",
      toneSoft: "var(--success-soft)",
      toneInk: "var(--success-ink)",   // 文字色として --success-soft の上で 5.21
      label: "このページに掲載中です",
      body: `あなたの職歴は ${companyName} のページに掲載され、ログインしていない方にも表示されています。`,
      action: "掲載設定を変更する",
    },
    login_only: {
      tone: "var(--warm)",
      toneSoft: "var(--warm-soft)",
      toneInk: "var(--warm-ink)",      // 塗りとして白文字で 5.02
      label: "ログインした方にのみ掲載中です",
      body: `あなたの職歴は ${companyName} のページに掲載されていますが、ログインしていない方には表示されていません。全体に公開すると、この会社に興味を持った方から見つけてもらえます。`,
      action: "掲載設定を変更する",
    },
    hidden: {
      tone: "var(--ink-mute)",
      toneSoft: "var(--bg-tint)",
      toneInk: "var(--ink-mute)",      // 元から白文字で 7.58。変えない
      label: "このページには掲載されていません",
      body: `あなたには ${companyName} での職歴が登録されていますが、このページには掲載されていません。掲載すると、この会社を調べている方があなたを見つけられるようになります。`,
      action: "掲載する",
    },
  };

  const c = COPY[relation.listing];

  return (
    <section
      style={{
        background: c.toneSoft,
        border: `1px solid ${c.tone}`,
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: c.tone, flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          {c.label}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 12, fontWeight: 500.5, lineHeight: 1.8, color: "var(--ink-soft)" }}>
        {c.body}
      </p>

      <a
        href="/mypage"
        style={{
          alignSelf: "flex-start",
          padding: "8px 18px",
          borderRadius: 100,
          background: relation.listing === "public" ? "transparent" : c.toneInk,
          /* ⚠️ 枠は `tone`（明るい方）のまま。ここは面積が小さく、
                文字と背景のコントラストには関与しない。 */
          border: `1px solid ${c.tone}`,
          color: relation.listing === "public" ? c.toneInk : "#fff",
          fontSize: 12.5,
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        {c.action} →
      </a>
    </section>
  );
}

export function AlumniSection({ alumni, hiddenCount = 0, totalCount }: { alumni: CompanyEmployee[]; hiddenCount?: number; totalCount?: number }) {
  return (
    <section
      id="alumni"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) var(--cd-pad-x, 32px) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        >
          OB・OG社員
          <span
            style={{
              fontFamily: "var(--font-inter), var(--font-noto)",
              fontSize: "var(--text-sm)",
              fontWeight: 400,
              color: "var(--ink-mute)",
              marginLeft: "var(--space-2)",
            }}
          >
            ({totalCount ?? alumni.length}名)
          </span>
        </SecTitle>
      </div>
      {/* ⚠️ 余白は globals.css の .person-section-body（767px 以下だけ左右を詰める） */}
      <div className="person-section-body">
      {alumni.length > 0 ? (
        <>
          <div className="person-list">
            {alumni.map((emp) => (
              <AlumniCard key={emp.userId} employee={emp} />
            ))}
          </div>
        </>
      ) : (
        <div style={{
          textAlign: "center", padding: "24px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)",
        }}>
          {hiddenCount > 0 ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 4 }}>🔐</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4 }}>
                ログインすると{hiddenCount}名のプロフィールが見られます
              </div>
              <a href="/auth" style={{ display: "inline-block", marginTop: 8, padding: "7px 20px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                ログイン / 会員登録 →
              </a>
            </>
          ) : (
            <>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "var(--royal-50)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", lineHeight: 1.7 }}>
                OB・OG情報は順次更新されます
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </section>
  );
}

// ── Embedded job card (clickable link, no accordion) ──────────────────────────

// ─── 取得つきラッパー ─────────────────────────────────────────────────────────

/* ⚠️ `export` してある理由は `lib/companies/useCompanyEmployees.ts` が使うため（2026-09-07）。
      取得をあちらに寄せたので、**この型がこのファイルの外から見える必要がある。** */
export type EmployeesResponse = {
  authenticated: boolean;
  current: CompanyEmployee[];
  alumni: CompanyEmployee[];
  hiddenCurrentCount: number;
  hiddenAlumniCount: number;
  totalCurrentCount: number;
  totalAlumniCount: number;
  relation: ViewerRelation;
  /** 閲覧者自身の ow_users.id（ログイン中のみ。2026-10-17） */
  viewerUserId?: string | null;
};

/**
 * 社員セクションをまとめて描画する。データは自分で取りに行く。
 *
 * ⚠️ 取得前は**何も描かない**（プレースホルダも出さない）。
 *    未ログインには元から0件で「社員セクションが無い」のが正しい表示なので、
 *    空の箱を先に出すと、その人には最後まで空箱が残る。
 */
export function CompanyEmployeeSections({
  companyId,
}: {
  companyId: string;
}) {
  /* ⚠️★**素の `fetch` に戻さないこと**（2026-09-07）。企業IDごとに1本へ束ねるのは
        `useCompanyEmployees` の役目。失敗時のログもあちらが出す。 */
  const data = useCompanyEmployees(companyId);

  if (!data) return null;

  const showAlumni = data.alumni.length > 0 || data.hiddenAlumniCount > 0;
  /* ⚠️★`data.relation.kind === "affiliated"` は 2026-09-12 に外した。
        あれは掲載設定パネル（`ListingStatusPanel`）を「社員が0名でも出す」ための条件で、
        パネルを外した今そのまま残すと、**在籍者本人にだけ「現役社員 0名」の空カード**が出る。 */
  const showAny =
    data.current.length > 0 ||
    data.alumni.length > 0 ||
    data.hiddenCurrentCount > 0 ||
    data.hiddenAlumniCount > 0;
  if (!showAny) return null;

  return (
    <ViewerIdContext.Provider value={data.viewerUserId ?? null}>
    <PageCompanyIdContext.Provider value={companyId}>
      {/* ⚠️★掲載設定パネル（`ListingStatusPanel`）は 2026-09-12 に企業詳細から外した（柴さんの指示）。
             **部品と型は消していない** ——`/dev/preview/listing-status` が3状態を描くのに使う。
             戻すときはここに1行足すだけでよい。 */}
      <CurrentEmployeesSection
        employees={data.current}
        hiddenCount={data.hiddenCurrentCount}
        totalCount={data.totalCurrentCount}
      />
      {showAlumni && (
        <AlumniSection
          alumni={data.alumni}
          hiddenCount={data.hiddenAlumniCount}
          totalCount={data.totalAlumniCount}
        />
      )}
    </PageCompanyIdContext.Provider>
    </ViewerIdContext.Provider>
  );
}
