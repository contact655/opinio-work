"use client";

import { useState, useCallback } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import ApproveSchoolRequestModal from "@/components/admin/ApproveSchoolRequestModal";

export type SchoolRequest = {
  id: string;
  school_name: string;
  school_name_kana: string | null;
  requested_by_email: string;
  created_at: string;
};

type Props = {
  initialRequests: SchoolRequest[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * SchoolRequestsList — Client Component
 *
 * /admin/school-requests の一覧表示 + 承認/却下アクションを管理する。
 * Server Component (page.tsx) から initialRequests を受け取り、
 * 楽観的 UI 更新(成功時に該当行を一覧から除去)を行う。
 */
export default function SchoolRequestsList({ initialRequests }: Props) {
  const [requests, setRequests] = useState<SchoolRequest[]>(initialRequests);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SchoolRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "default" | "error" } | null>(null);

  // 成功時: 一覧から対象行を除去
  const removeRequest = useCallback((id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── 承認 ──────────────────────────────────────────────────────────────────
  const handleApproveClick = (id: string) => {
    setApprovingId(id);
  };

  const handleApproveSuccess = useCallback(() => {
    if (!approvingId) return;
    removeRequest(approvingId);
    setApprovingId(null);
    setToast({ message: "承認しました", variant: "default" });
  }, [approvingId, removeRequest]);

  const handleApproveClose = () => {
    setApprovingId(null);
  };

  // ── 却下 ──────────────────────────────────────────────────────────────────
  const handleRejectClick = (req: SchoolRequest) => {
    setRejectTarget(req);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    setRejecting(true);

    try {
      const res = await fetch(
        `/api/admin/school-requests/${rejectTarget.id}/reject`,
        { method: "POST" }
      );

      if (res.ok) {
        removeRequest(rejectTarget.id);
        setToast({ message: "却下しました", variant: "default" });
      } else {
        const body = await res.json().catch(() => ({}));
        setToast({
          message: (body as { error?: string }).error ?? "却下に失敗しました",
          variant: "error",
        });
      }
    } catch {
      setToast({ message: "ネットワークエラーが発生しました", variant: "error" });
    } finally {
      setRejecting(false);
      setRejectTarget(null);
    }
  };

  const handleRejectCancel = () => {
    if (!rejecting) setRejectTarget(null);
  };

  // ── モーダル表示用の request オブジェクトを取得 ───────────────────────────
  const approvingRequest = approvingId
    ? requests.find((r) => r.id === approvingId) ?? null
    : null;

  // ── 空状態 ────────────────────────────────────────────────────────────────
  if (requests.length === 0) {
    return (
      <>
        <div className="bg-white rounded-card border border-card-border p-12 text-center">
          <p className="text-gray-400 text-sm">現在 pending のリクエストはありません</p>
        </div>
        {toast && (
          <Toast
            message={toast.message}
            variant={toast.variant}
            onDone={() => setToast(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* 件数バッジ */}
      <span className="inline-flex px-3 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-4">
        pending {requests.length} 件
      </span>

      {/* リスト */}
      <div className="bg-white rounded-card border border-card-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">学校名</th>
              <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">ふりがな</th>
              <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">送信者</th>
              <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">送信日時</th>
              <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req, idx) => (
              <tr
                key={req.id}
                className={idx < requests.length - 1 ? "border-b border-gray-50" : ""}
              >
                <td className="px-5 py-3.5 font-medium text-gray-800">
                  {req.school_name}
                </td>
                <td className="px-5 py-3.5 text-gray-500">
                  {req.school_name_kana ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-gray-500">
                  {req.requested_by_email}
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs">
                  {formatDate(req.created_at)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveClick(req.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md text-white"
                      style={{ background: "var(--royal)" }}
                    >
                      承認
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectClick(req)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border"
                      style={{
                        color: "var(--error)",
                        borderColor: "var(--error)",
                        background: "transparent",
                      }}
                    >
                      却下
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 承認モーダル */}
      {approvingRequest && (
        <ApproveSchoolRequestModal
          request={approvingRequest}
          onClose={handleApproveClose}
          onSuccess={handleApproveSuccess}
        />
      )}

      {/* 却下確認ダイアログ */}
      <ConfirmDialog
        isOpen={rejectTarget !== null}
        title="リクエストを却下しますか？"
        message={`「${rejectTarget?.school_name ?? ""}」の学校追加リクエストを却下します。この操作は取り消せません。`}
        confirmLabel="却下する"
        confirmVariant="danger"
        isSubmitting={rejecting}
        onConfirm={handleRejectConfirm}
        onCancel={handleRejectCancel}
      />

      {/* トースト通知 */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
