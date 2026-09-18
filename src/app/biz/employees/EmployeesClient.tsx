"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TalkableBadge } from "@/components/profile/view/TalkableBadge";
import type { BizEmployee } from "./page";

type Props = {
  current: BizEmployee[];
  alumni: BizEmployee[];
  /** 企業ページから非表示にしている経歴。**それぞれのタブの中に混ぜて出す** */
  hiddenExperienceIds: string[];
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
  onHide,
  isPending,
}: {
  emp: BizEmployee;
  onHide: (experienceId: string) => void;
  isPending: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px",
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 10,
    }}>
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

      {/* 非表示ボタン */}
      <div style={{ flexShrink: 0, marginLeft: 8 }}>
        {confirming ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>企業ページから非表示にしますか？</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => { onHide(emp.experienceId); setConfirming(false); }}
              style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px",
                background: "var(--error)", color: "#fff",
                border: "none", borderRadius: 6, cursor: "pointer",
              }}
            >
              {isPending ? "処理中..." : "非表示にする"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                fontSize: 11, padding: "4px 10px",
                background: "none", color: "var(--ink-soft)",
                border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
              }}
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              fontSize: 11, fontWeight: 600, padding: "5px 10px",
              background: "none", color: "var(--ink-mute)",
              border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            非表示
          </button>
        )}
      </div>
    </div>
  );
}

function HiddenCard({
  emp,
  onUnhide,
  isPending,
}: {
  emp: BizEmployee;
  onUnhide: (experienceId: string) => void;
  isPending: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px",
      background: "var(--bg-tint)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      opacity: 0.75,
    }}>
      <AvatarCircle name={emp.name} avatarUrl={emp.avatarUrl} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}>
            {emp.name ?? "名前未設定"}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
            color: "var(--warm-ink)", background: "#FEF3C7", border: "1px solid #FDE68A",
            borderRadius: 4, padding: "1px 6px", fontFamily: "var(--font-inter), var(--font-noto)",
          }}>
            非表示中
          </span>
        </div>
        <RoleLine roleName={emp.roleName} roleTitle={emp.roleTitle} />
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={() => onUnhide(emp.experienceId)}
        style={{
          fontSize: 11, fontWeight: 600, padding: "5px 12px",
          background: "#fff", color: "var(--success-ink)",
          border: "1px solid #A7F3D0", borderRadius: 6, cursor: "pointer",
          whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        {isPending ? "処理中..." : "表示に戻す"}
      </button>
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

export function EmployeesClient({ current, alumni, hiddenExperienceIds, companyName }: Props) {
  const [tab, setTab] = useState<Tab>("current");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const hiddenIds = new Set(hiddenExperienceIds);

  const handleHide = (experienceId: string) => {
    startTransition(async () => {
      await fetch("/api/biz/hidden-experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId }),
      });
      router.refresh();
    });
  };

  const handleUnhide = (experienceId: string) => {
    startTransition(async () => {
      await fetch(`/api/biz/hidden-experiences?experience_id=${experienceId}`, {
        method: "DELETE",
      });
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
          <strong style={{ color: "var(--ink)" }}>企業側から追加することはできません。</strong>
        </p>
      </div>

      {/* タブ（★2つだけ） */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--line)", marginBottom: 20 }}>
        {[
          { key: "current" as const, label: "現役社員", count: current.length },
          { key: "alumni" as const, label: "OB・OG社員", count: alumni.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
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
              <HiddenCard
                key={emp.experienceId}
                emp={emp}
                onUnhide={handleUnhide}
                isPending={isPending}
              />
            ) : (
              <EmployeeCard
                key={emp.experienceId}
                emp={emp}
                onHide={handleHide}
                isPending={isPending}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}
