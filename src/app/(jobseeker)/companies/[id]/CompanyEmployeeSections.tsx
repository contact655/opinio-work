"use client";

/*
 * 企業詳細の「社員セクション」一式。**閲覧者によって出し分ける部分**なので
 * page.tsx から切り出してクライアント側に置いた（2026-08-09）。
 *
 * ⚠️ page.tsx がこれらをサーバーで描画していたため `auth.getUser()` が必要になり、
 *    ルートが動的化して `export const revalidate = 60` が効かなかった。
 *    ここへ追い出すことでページ本体を閲覧者非依存にし、ISR に載せる。
 *
 * ⚠️ **絞り込みはサーバー（/api/jobseeker/companies/[id]/employees）で行う。**
 *    ここには既に絞られたものだけが渡る。全件を受け取ってここで絞る形にしないこと。
 */

import type React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { SecTitle } from "./SecTitle";
import { EmployeeAvatarImg } from "./CompanyDetailClient";
import { resolveAvatarColor } from "@/lib/jobCategoryColors";
import type { CompanyEmployee, CompanyEmployeeCategoryItem } from "@/lib/supabase/queries";

type AmbassadorInfo = { memberId: string };

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

// 生年から現在の年齢を計算
function calcAge(birthYear: number | null): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

// 現役社員・OB/OG 共通の統一カードレイアウト
function EmployeeCardInner({
  employee,
  age,
  badge,
  subInfo,
}: {
  employee: CompanyEmployee;
  age: number | null;
  badge?: React.ReactNode;
  subInfo?: React.ReactNode;
}) {
  const avatarColor = resolveAvatarColor(employee.roleParentId, employee.roleCategoryId);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
      {/* アバター */}
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: avatarColor.bg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 18,
        color: avatarColor.text, overflow: "hidden",
        border: "2px solid var(--line)", position: "relative",
      }}>
        {employee.avatarUrl ? (
          <EmployeeAvatarImg src={employee.avatarUrl} alt={employee.name}
            fallbackBg={avatarColor.bg} fallbackText={employee.avatarInitial ?? employee.name.charAt(0)}
            fallbackColor={avatarColor.text} fontSize={18} />
        ) : (employee.avatarInitial ?? employee.name.charAt(0))}
      </div>

      {/* テキスト */}
      <div style={{ minWidth: 0, flex: 1 }}>
        {/* 1行目: 名前 + 年齢 + バッジ */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
            {employee.name}
          </span>
          {age !== null && (
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
              {age}歳
            </span>
          )}
          {badge}
        </div>
        {/* 2行目: 職種のみ（部署階層は表示しない） */}
        {employee.roleTitle && (
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {employee.roleTitle}
          </p>
        )}
        {/* 追加情報（在籍期間など） */}
        {subInfo}
      </div>
    </div>
  );
}

function EmployeeCard({
  employee,
  ambassadorInfo,
  companyId,
}: {
  employee: CompanyEmployee;
  showEndedAt?: boolean;
  ambassadorInfo?: { memberId: string } | null;
  companyId?: string;
}) {
  const isAmbassador = !!ambassadorInfo;
  const age = calcAge(employee.birthYear);

  const badge = isAmbassador ? (
    <span style={{
      fontSize: 12, fontWeight: 700,
      padding: "2px 7px", borderRadius: 100,
      background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
      color: "#92400E", border: "1px solid #FCD34D",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>💬 面談OK</span>
  ) : undefined;

  if (isAmbassador && companyId) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", gap: 10,
        padding: "12px 14px",
        background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12,
      }}>
        <a href={`/u/${employee.userId}`} target="_blank" className="employee-card-link"
          style={{ display: "flex", textDecoration: "none" }}>
          <EmployeeCardInner employee={employee} age={age} badge={badge} />
        </a>
        <Link
          href={`/companies/${companyId}/casual-meeting?member_id=${ambassadorInfo.memberId}`}
          style={{
            display: "block", textAlign: "center",
            padding: "8px 16px",
            background: "linear-gradient(135deg, #F59E0B, #F97316)",
            color: "#fff", borderRadius: 8,
            fontSize: 12, fontWeight: 700, textDecoration: "none",
          }}
        >
          {employee.name.split(/[\s　]/)[0]}さんに話を聞く →
        </Link>
      </div>
    );
  }

  return (
    <a href={`/u/${employee.userId}`} target="_blank" className="employee-card-link"
      style={{
        display: "flex", alignItems: "center",
        padding: "12px 14px",
        background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 12,
        textDecoration: "none",
      }}
    >
      <EmployeeCardInner employee={employee} age={age} badge={badge} />
    </a>
  );
}

// person-card-grid: 全人物カードセクション共通（面談OK/現役社員/OBOG）
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
  .employee-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  @media (max-width: 1023px) {
    .employee-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 767px) {
    .employee-grid { grid-template-columns: minmax(0, 1fr); }
  }
  .alumni-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  @media (max-width: 1023px) {
    .alumni-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 767px) {
    .alumni-grid { grid-template-columns: minmax(0, 1fr); }
  }
`;


function CurrentEmployeesSection({
  employees,
  hiddenCount = 0,
  totalCount,
  categories,
  ambassadorMap,
  companyId,
}: {
  employees: CompanyEmployee[];
  hiddenCount?: number;
  totalCount?: number;
  categories: CompanyEmployeeCategoryItem[];
  ambassadorMap: Map<string, { memberId: string }>;
  companyId: string;
}) {
  // ⑨ 0名でも empty state を表示するため早期 return を削除

  // ── カテゴリ別社員マップ (roleId → employees) ──────────────────────────────
  const empsByCategory = new Map<string, CompanyEmployee[]>();
  for (const emp of employees) {
    if (!emp.roleCategoryId) continue;
    // 既存: 子UUID（または子なし親UUID）→ 社員
    if (!empsByCategory.has(emp.roleCategoryId)) empsByCategory.set(emp.roleCategoryId, []);
    empsByCategory.get(emp.roleCategoryId)!.push(emp);
    // 追加: 親UUID → 社員（親カテゴリ登録時の集約用）
    if (emp.roleParentId) {
      if (!empsByCategory.has(emp.roleParentId)) empsByCategory.set(emp.roleParentId, []);
      empsByCategory.get(emp.roleParentId)!.push(emp);
    }
  }

  // ── 親グループ化 (display_order 順を保持) ─────────────────────────────────
  type Group = {
    groupKey: string;
    parentName: string;
    isParentDirect: boolean; // parent_id が null = 親直カテゴリ
    children: CompanyEmployeeCategoryItem[];
  };
  const groups: Group[] = [];
  const groupMap = new Map<string, Group>();
  for (const cat of categories) {
    const groupKey = cat.parentId ?? cat.roleId ?? cat.id;
    if (!groupMap.has(groupKey)) {
      const g: Group = {
        groupKey,
        parentName: cat.parentId ? (cat.parentName ?? cat.roleName) : cat.roleName,
        isParentDirect: !cat.parentId,
        children: [],
      };
      groups.push(g);
      groupMap.set(groupKey, g);
    }
    groupMap.get(groupKey)!.children.push(cat);
  }

  // カテゴリ未割り当て社員 (roleCategoryId が null の場合)
  const uncategorized = employees.filter((e) => !e.roleCategoryId);

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
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle icon={SECTION_ICON}>
          現役社員
          <span
            style={{
              fontFamily: "Inter, sans-serif",
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
      <div style={{ padding: "var(--space-6)" }}>
      {/* ── Role composition bar (3名以上 + カテゴリあり) ───────────────────── */}
      {employees.length >= 3 && categories.length > 0 && (() => {
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
                  <span style={{ fontWeight: 700, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{count}</span>名
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
      ) : categories.length === 0 ? (
        // カテゴリ設定なし → レスポンシブ列
        <div className="employee-grid">
          {employees.map((emp) => (
            <EmployeeCard key={emp.userId} employee={emp} ambassadorInfo={ambassadorMap.get(emp.userId) ?? null} companyId={companyId} />
          ))}
        </div>
      ) : (
        // カテゴリ設定あり → 階層表示
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {groups.map((group) => {
            const totalInGroup = group.children.reduce(
              (sum, cat) => sum + (empsByCategory.get(cat.roleId ?? "")?.length ?? 0),
              0
            );
            if (totalInGroup === 0) return null; // 0 名カテゴリは非表示

            return (
              <div key={group.groupKey}>
                {/* 親カテゴリ見出し */}
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
                    {group.parentName}
                  </span>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "var(--text-xs)",
                      fontWeight: 400,
                      color: "var(--ink-mute)",
                    }}
                  >
                    {totalInGroup}名
                  </span>
                </div>

                {group.isParentDirect ? (
                  // 親直: 子見出しなしでグリッドを直接表示
                  <div className="employee-grid">
                    {(empsByCategory.get(group.children[0].roleId ?? "") ?? []).map((emp) => (
                      <EmployeeCard key={emp.userId} employee={emp} ambassadorInfo={ambassadorMap.get(emp.userId) ?? null} companyId={companyId} />
                    ))}
                  </div>
                ) : (
                  // 子カテゴリあり: 子見出し + グリッド
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {group.children.map((cat) => {
                      const empsInCat = empsByCategory.get(cat.roleId ?? "") ?? [];
                      if (empsInCat.length === 0) return null;
                      return (
                        <div key={cat.roleId ?? cat.id}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 5,
                              marginBottom: "var(--space-2)",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                fontWeight: 600,
                                color: "var(--ink-soft)",
                              }}
                            >
                              {cat.roleName}
                            </span>
                            <span
                              style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: "var(--text-xs)",
                                fontWeight: 400,
                                color: "var(--ink-mute)",
                              }}
                            >
                              {empsInCat.length}名
                            </span>
                          </div>
                          <div className="employee-grid">
                            {empsInCat.map((emp) => (
                              <EmployeeCard key={emp.userId} employee={emp} ambassadorInfo={ambassadorMap.get(emp.userId) ?? null} companyId={companyId} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* カテゴリ未割り当て社員 */}
          {uncategorized.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: "var(--space-3)",
                  paddingBottom: "var(--space-2)",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                その他
              </div>
              <div className="employee-grid">
                {uncategorized.map((emp) => (
                  <EmployeeCard key={emp.userId} employee={emp} ambassadorInfo={ambassadorMap.get(emp.userId) ?? null} companyId={companyId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </section>
    </>
  );
}

// ─── AlumniCard ──────────────────────────────────────────────────────────────

function AlumniCard({ employee }: { employee: CompanyEmployee }) {
  const age = calcAge(employee.birthYear);

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

  /* ⚠️ 「💬 DM可」バッジは 2026-08-08 に削除した。
        条件なしで全員に出ており、情報量が無かった（誰に出しても同じ）。 */
  const badge = tenure ? (
    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", background: "var(--royal-50)", padding: "1px 6px", borderRadius: 100, flexShrink: 0 }}>
      {tenure}
    </span>
  ) : null;

  const currentDisplayName = employee.currentCompanyBrandName ?? employee.currentCompanyName;
  /* 2行目に現在の会社名、3行目に職種を分けて出す（2026-08-08）。
     それまで「CTC / 金融営業本部 営業第1部 / 法人営業（アカウント営業）」のように
     1行に詰めており、狭い画面で会社名まで省略記号に飲まれていた。
     ⚠️ 値そのものは変えていない（会社名は brand_name ?? name、職種は自己申告の役職名）。
     ⚠️ 省略記号を効かせるには minWidth: 0 が要る（親は flex item）。 */
  const line = {
    margin: "2px 0 0", fontSize: 12, fontWeight: 500,
    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  } as const;
  const subInfo = (currentDisplayName || employee.currentRoleTitle) ? (
    <>
      {currentDisplayName && (
        <p title={currentDisplayName} style={{ ...line, color: "var(--ink-mute)" }}>
          {currentDisplayName}
        </p>
      )}
      {employee.currentRoleTitle && (
        <p title={employee.currentRoleTitle} style={{ ...line, color: "var(--ink-mute)" }}>
          {employee.currentRoleTitle}
        </p>
      )}
    </>
  ) : undefined;

  // AlumniCard は roleTitle（在籍時の部署階層）を非表示にするため空の employee を渡す
  const alumniEmployee = { ...employee, roleTitle: null };

  return (
    <a href={`/u/${employee.userId}`} target="_blank" className="employee-card-link"
      style={{
        display: "flex", alignItems: "center", gap: 0,
        padding: "12px 14px",
        background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
        textDecoration: "none",
        maxWidth: 380,
      }}
    >
      <EmployeeCardInner employee={alumniEmployee} age={age} badge={badge} subInfo={subInfo} />
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0, marginLeft: 6 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </a>
  );
}

// ─── 掲載設定 CTA ────────────────────────────────────────────────────────────
// 「この企業ページに自分を掲載するか」を、在籍者・経験者本人にだけ提示する。
// 既存の公開設定 UI（/profile/edit）は掲載先を「キャリア軌跡ページ」としか
// 説明していなかったため、企業ページに載ることを本人が認識できていない。
// ここでは掲載先を明示したうえで、現在の状態と変更導線を出す。

type ViewerListing = "public" | "login_only" | "hidden";

type ViewerRelation =
  | { kind: "anonymous" }
  | { kind: "unrelated" }
  | { kind: "affiliated"; listing: ViewerListing; experienceCount: number };

function ListingStatusPanel({
  relation,
  companyName,
}: {
  relation: ViewerRelation;
  companyName: string;
}) {
  // 在籍者・経験者以外には出さない。求職者向けの獲得導線は別途（段階0〜2の設計）。
  if (relation.kind !== "affiliated") return null;

  const COPY: Record<ViewerListing, {
    tone: string;
    toneSoft: string;
    label: string;
    body: string;
    action: string;
  }> = {
    public: {
      tone: "var(--success)",
      toneSoft: "var(--success-soft)",
      label: "このページに掲載中です",
      body: `あなたの職歴は ${companyName} のページに掲載され、ログインしていない方にも表示されています。`,
      action: "掲載設定を変更する",
    },
    login_only: {
      tone: "var(--warm)",
      toneSoft: "var(--warm-soft)",
      label: "ログインした方にのみ掲載中です",
      body: `あなたの職歴は ${companyName} のページに掲載されていますが、ログインしていない方には表示されていません。全体に公開すると、この会社に興味を持った方から見つけてもらえます。`,
      action: "掲載設定を変更する",
    },
    hidden: {
      tone: "var(--ink-mute)",
      toneSoft: "var(--bg-tint)",
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
          background: relation.listing === "public" ? "transparent" : c.tone,
          border: `1px solid ${c.tone}`,
          color: relation.listing === "public" ? c.tone : "#fff",
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

function AlumniSection({ alumni, hiddenCount = 0, totalCount }: { alumni: CompanyEmployee[]; hiddenCount?: number; totalCount?: number }) {
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
        padding: "var(--space-6) 32px var(--space-4)",
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
              fontFamily: "Inter, sans-serif",
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
      <div style={{ padding: "var(--space-6)" }}>
      {alumni.length > 0 ? (
        <>
          <div className="employee-grid">
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

type EmployeesResponse = {
  authenticated: boolean;
  current: CompanyEmployee[];
  alumni: CompanyEmployee[];
  hiddenCurrentCount: number;
  hiddenAlumniCount: number;
  totalCurrentCount: number;
  totalAlumniCount: number;
  relation: ViewerRelation;
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
  categories,
  ambassadorMap,
  companyName,
}: {
  companyId: string;
  categories: CompanyEmployeeCategoryItem[];
  ambassadorMap: Map<string, AmbassadorInfo>;
  companyName: string;
}) {
  const [data, setData] = useState<EmployeesResponse | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/jobseeker/companies/${companyId}/employees`)
      .then((r) => (r.ok ? r.json() : null))
      /* ⚠️ 失敗しても throw しない。社員一覧は付加情報で、
            出なくてもページ本体は成立する。 */
      .catch(() => null)
      .then((d: EmployeesResponse | null) => {
        if (alive) setData(d);
      });
    return () => {
      alive = false;
    };
  }, [companyId]);

  if (!data) return null;

  const showAlumni = data.alumni.length > 0 || data.hiddenAlumniCount > 0;
  const showAny =
    data.current.length > 0 ||
    data.alumni.length > 0 ||
    data.hiddenCurrentCount > 0 ||
    data.hiddenAlumniCount > 0 ||
    data.relation.kind === "affiliated";
  if (!showAny) return null;

  return (
    <>
      <ListingStatusPanel relation={data.relation} companyName={companyName} />
      <CurrentEmployeesSection
        employees={data.current}
        hiddenCount={data.hiddenCurrentCount}
        totalCount={data.totalCurrentCount}
        categories={categories}
        ambassadorMap={ambassadorMap}
        companyId={companyId}
      />
      {showAlumni && (
        <AlumniSection
          alumni={data.alumni}
          hiddenCount={data.hiddenAlumniCount}
          totalCount={data.totalAlumniCount}
        />
      )}
    </>
  );
}
