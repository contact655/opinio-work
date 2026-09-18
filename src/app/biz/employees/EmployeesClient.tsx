"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TalkableBadge } from "@/components/profile/view/TalkableBadge";
import { MEMBER_REPORT_REASONS, MEMBER_REPORT_NOTE_MAX, type MemberReportReason } from "@/lib/constants/memberReports";
import type { BizEmployee } from "./page";

type Props = {
  current: BizEmployee[];
  alumni: BizEmployee[];
  /** 運営が企業ページから外した経歴。**それぞれのタブの中に混ぜて出す** */
  hiddenExperienceIds: string[];
  /** 運営に報告済み（未対応）の経歴。ボタンを「報告済み」にする */
  reportedExperienceIds: string[];
  companyName: string;
};

/* ⚠️★**タブは2つだけ**（2026-09-18）。「非表示中」と「管理アカウント」を消した。
      ・管理アカウント … `/biz/members`（チーム管理）と同じ人たちで、
        **見るだけの一覧が二重**だった。
        経歴を持つ管理者には現役社員カードに「管理者」バッジを出す形に替えた。
      ・非表示中 … 件数が常に0で、タブだけが常設されていた。非表示の行は
        それぞれのタブの中に「非表示中」として出す（解除もそこから）。
   ⚠️ タブを足すときは、**その件数が普段0にならないか**を先に実データで見ること。 */
type Tab = "current" | "alumni";

function formatPeriod(startedAt: string, endedAt: string | null, isCurrent: boolean): string {
  const start = startedAt.slice(0, 7).replace("-", ".");
  if (isCurrent) return `${start} 〜 現在`;
  const end = endedAt ? endedAt.slice(0, 7).replace("-", ".") : "";
  return `${start} 〜 ${end}`;
}

function calcDuration(startedAt: string, endedAt: string | null, isCurrent: boolean): string {
  const start = new Date(startedAt);
  const end = isCurrent ? new Date() : (endedAt ? new Date(endedAt) : new Date());
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months < 12) return `${months}ヶ月`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}年${m}ヶ月` : `${y}年`;
}

function AvatarCircle({ name, avatarUrl, size = 44 }: { name: string | null; avatarUrl: string | null; size?: number }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  const colors = ["#002366", "#3B5FD9", "#059669", "#7C3AED", "#D97706"];
  const colorIdx = (name ?? "").charCodeAt(0) % colors.length;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? ""}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${colors[colorIdx]}, ${colors[(colorIdx + 1) % colors.length]})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-inter), var(--font-noto)", fontSize: size * 0.38, fontWeight: 700, color: "#fff",
    }}>
      {initial}
    </div>
  );
}

/**
 * 職種の行。★**マスタ名（`ow_roles`）が主で、社内での呼び方は小さく併記する。**
 *
 * ⚠️★**どちらも無ければ行ごと出さない。**「未設定」と書かない
 *    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 * ⚠️ 併記の順序を逆にしないこと。`role_title` は自由入力なので
 *    「AE」「第6営業部」のように**社外の人には読めない値**が入る。
 *    企業の画面では本人の呼び方も要るが、**主にするのはマスタ名**。
 */
function RoleLine({ roleName, roleTitle }: { roleName: string | null; roleTitle: string | null }) {
  if (!roleName && !roleTitle) return null;
  const clamp = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
  return (
    <div style={{ marginBottom: 4, minWidth: 0 }}>
      {roleName && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", ...clamp }}>{roleName}</div>
      )}
      {roleTitle && (
        <div
          style={{ fontSize: 11, color: "var(--ink-mute)", ...clamp }}
          title={roleTitle}
        >
          {roleTitle}
        </div>
      )}
    </div>
  );
}

function EmployeeCard({
  emp,
  onReport,
  isPending,
  reported,
}: {
  emp: BizEmployee;
  onReport: (experienceId: string, reason: MemberReportReason, note: string) => void;
  isPending: boolean;
  /** 既に運営へ報告済み（未対応）か */
  reported: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<MemberReportReason | "">("");
  const [note, setNote] = useState("");

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      padding: "14px 18px",
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {/* プロフィールリンク */}
      <Link href={`/u/${emp.userId}`} target="_blank" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        <AvatarCircle name={emp.name} avatarUrl={emp.avatarUrl} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {emp.name ?? "名前未設定"}
            </span>
            {/* ★管理者バッジ（2026-09-18）。「管理アカウント」タブを消した代わり。
                ⚠️ これは**権限の表示**であって、企業ページに出るかどうかとは無関係。 */}
            {emp.isAdmin && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "var(--royal)",
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                borderRadius: 4, padding: "1px 6px",
              }}>
                管理者
              </span>
            )}
            {/* ★面談OK（2026-09-18）。⚠️ 部品を複製しないこと。色と文言は
                `/people`・企業ページ・`/u/[id]` と同じ1箇所から来ている。 */}
            {emp.isTalkable && <TalkableBadge size="sm" />}
            {emp.isMentor && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "var(--royal)",
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                borderRadius: 4, padding: "1px 6px",
              }}>
                メンター
              </span>
            )}
          </div>
          <RoleLine roleName={emp.roleName} roleTitle={emp.roleTitle} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
              {formatPeriod(emp.startedAt, emp.endedAt, emp.isCurrent)}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: emp.isCurrent ? "var(--success-ink)" : "var(--ink-mute)",
              background: emp.isCurrent ? "var(--success-soft)" : "var(--line-soft)",
              border: `1px solid ${emp.isCurrent ? "#A7F3D0" : "var(--line)"}`,
              borderRadius: 4, padding: "1px 6px", fontFamily: "var(--font-inter), var(--font-noto)",
            }}>
              {calcDuration(emp.startedAt, emp.endedAt, emp.isCurrent)}
            </span>
          </div>
        </div>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0 }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </Link>

      {/* ★報告ボタン（2026-09-18 / B7）。
          ⚠️★**押しても企業ページからは消えない。** 外すのは運営の判断。
             2026-09-18 まではここが「非表示」で、企業が直接消していた。 */}
      {/* ⚠️★`data-state` は**検証で状態を読むためだけ**の属性（2026-09-18）。
             ボタンの文言で状態を判定すると、「対応済みにする」が「対応済み」に
             部分一致して読み違える（実際に踏んだ）。**装飾には使わない。** */}
      <div data-state={reported ? "reported" : "reportable"} style={{ flexShrink: 0, marginLeft: 8 }}>
        {reported ? (
          <span style={{
            fontSize: 11, fontWeight: 600, color: "var(--ink-mute)",
            whiteSpace: "nowrap",
          }}>
            運営に報告済み
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              fontSize: 11, fontWeight: 600, padding: "5px 10px",
              background: "none", color: "var(--ink-mute)",
              border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {open ? "閉じる" : "在籍していない人として報告"}
          </button>
        )}
      </div>
      </div>

      {open && !reported && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-soft)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            運営に報告します。<strong style={{ color: "var(--ink)" }}>この操作で企業ページからすぐに消えるわけではありません。</strong>
            運営が確認のうえ判断します。本人のプロフィールは変わりません。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {MEMBER_REPORT_REASONS.map((r) => (
              <label key={r.value} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--ink)", cursor: "pointer" }}>
                <input
                  type="radio"
                  name={`report-reason-${emp.experienceId}`}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span>
                  {r.label}
                  <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)" }}>{r.desc}</span>
                </span>
              </label>
            ))}
          </div>

          <div>
            <label htmlFor={`report-note-${emp.experienceId}`} style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>
              補足（任意・{MEMBER_REPORT_NOTE_MAX}文字まで）
            </label>
            <textarea
              id={`report-note-${emp.experienceId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MEMBER_REPORT_NOTE_MAX}
              rows={2}
              placeholder="例: 2024年3月に退職しています／同姓同名の別の方のようです"
              style={{
                width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
                border: "1px solid var(--line)", borderRadius: 6, resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              disabled={isPending || reason === ""}
              onClick={() => { if (reason !== "") { onReport(emp.experienceId, reason, note); setOpen(false); } }}
              style={{
                fontSize: 12, fontWeight: 700, padding: "6px 14px",
                background: reason === "" ? "var(--line-soft)" : "var(--royal)",
                color: reason === "" ? "var(--ink-mute)" : "#fff",
                border: "none", borderRadius: 6,
                cursor: reason === "" ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "送信中..." : "報告する"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                fontSize: 12, padding: "6px 12px",
                background: "none", color: "var(--ink-soft)",
                border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 運営が企業ページから外した経歴。
 *
 * ⚠️★**表示は残し、操作だけ外す**（2026-09-18 / B7）。行ごと消すと、報告を出した企業が
 *    **結果を確認できない**（「報告した」と「実際に外れた」は別の状態）。
 * ⚠️★**「表示に戻す」を戻さないこと。** 企業側の書き込み経路は削除済みで、
 *    押しても 404 になる。戻すのは運営の判断。
 */
function HiddenCard({ emp }: { emp: BizEmployee }) {
  return (
    <div data-state="hidden-by-ops" style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px",
      background: "var(--bg-tint)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      opacity: 0.75,
    }}>
      <AvatarCircle name={emp.name} avatarUrl={emp.avatarUrl} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}>
            {emp.name ?? "名前未設定"}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
            color: "var(--warm-ink)", background: "#FEF3C7", border: "1px solid #FDE68A",
            borderRadius: 4, padding: "1px 6px", fontFamily: "var(--font-inter), var(--font-noto)",
          }}>
            非表示中（運営）
          </span>
        </div>
        <RoleLine roleName={emp.roleName} roleTitle={emp.roleTitle} />
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          運営が企業ページから外しています。本人のプロフィールには変わらず表示されます。
          戻すには <Link href="/business/contact" style={{ color: "var(--royal)", fontWeight: 600 }}>お問い合わせ</Link> ください。
        </p>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--bg-tint)",
      border: "1px dashed var(--line)", borderRadius: 12 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
        {label}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.75, margin: 0 }}>
        社員・OBOGがプロフィールにこの企業を登録すると<br />自動的にここに表示されます。
      </p>
    </div>
  );
}

export function EmployeesClient({ current, alumni, hiddenExperienceIds, reportedExperienceIds, companyName }: Props) {
  const [tab, setTab] = useState<Tab>("current");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const hiddenIds = new Set(hiddenExperienceIds);
  /* ⚠️ 送信直後は `router.refresh()` を待たずにボタンを「報告済み」にしたいので、
        サーバーから来た集合にローカルぶんを足して持つ。 */
  const [justReported, setJustReported] = useState<string[]>([]);
  const reportedIds = new Set([...reportedExperienceIds, ...justReported]);

  const handleReport = (experienceId: string, reason: MemberReportReason, note: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/biz/member-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId, reason, note }),
      });
      /* ⚠️★**`res.ok` を見てから「報告済み」にすること。** 見ないと、失敗しても
            画面だけが成功したように見える（2026-09-18 に規約同意で同じ形を直した）。 */
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "報告を記録できませんでした。時間をおいて試してください。");
        return;
      }
      setJustReported((prev) => [...prev, experienceId]);
      router.refresh();
    });
  };

  const list = tab === "current" ? current : alumni;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 32px 80px" }}>

      {/* ページヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
          社員管理
        </h1>
        {/* ⚠️★「管理アカウント」「非表示」の説明は 2026-09-18 に外した。
               タブが無くなったので、指していた先が画面に無い文になる。 */}
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          {companyName}の企業ページに出ている人の一覧です。<br />
          本人がプロフィールの経歴でこの企業を選ぶと自動で反映されます。
          <strong style={{ color: "var(--ink)" }}>企業側から追加・削除することはできません。</strong>
          在籍していない人が出ている場合は、その行から運営に報告してください。
        </p>
      </div>

      {error && (
        <div role="alert" style={{
          marginBottom: 16, padding: "10px 14px", background: "var(--error-soft, #FEF2F2)",
          border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "var(--error, #B91C1C)",
        }}>
          {error}
        </div>
      )}

      {/* タブ（★2つだけ） */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--line)", marginBottom: 20 }}>
        {[
          { key: "current" as const, label: "現役社員", count: current.length },
          { key: "alumni" as const, label: "OB・OG社員", count: alumni.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            data-tab={key}
            data-state={tab === key ? "active" : "inactive"}
            onClick={() => setTab(key)}
            style={{
              padding: "10px 20px", background: "none", border: "none",
              borderBottom: `2px solid ${tab === key ? "var(--royal)" : "transparent"}`,
              marginBottom: -2,
              fontSize: 13, fontWeight: tab === key ? 700 : 500,
              color: tab === key ? "var(--royal)" : "var(--ink-mute)",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {label}
            {count > 0 && (
              <span style={{
                fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 11, fontWeight: 700,
                padding: "1px 6px", borderRadius: 10,
                background: tab === key ? "var(--royal-50)" : "var(--line-soft)",
                color: tab === key ? "var(--royal)" : "var(--ink-mute)",
              }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* リスト */}
      {list.length === 0 ? (
        <EmptyState
          label={tab === "current" ? "現役社員の登録がありません" : "OB・OG社員の登録がありません"}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((emp) => (
            hiddenIds.has(emp.experienceId) ? (
              <HiddenCard key={emp.experienceId} emp={emp} />
            ) : (
              <EmployeeCard
                key={emp.experienceId}
                emp={emp}
                onReport={handleReport}
                isPending={isPending}
                reported={reportedIds.has(emp.experienceId)}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}
