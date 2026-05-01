"use client";

import { useState, useTransition } from "react";
import { fetchOgp } from "@/lib/og/fetchOgp";
import { inferTypeFromUrl, type ContentType } from "@/lib/og/inferType";
import { createAdminPost } from "./_actions/createAdminPost";
import { updateAdminPost } from "./_actions/updateAdminPost";
import { deleteAdminPost } from "./_actions/deleteAdminPost";
import { Plus, Edit2, Trash2, Loader2, AlertCircle, ExternalLink, X, Filter } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────���──

type Company = { id: string; name: string };

type Post = {
  id: string;
  company_id: string;
  url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  source_name: string | null;
  published_at: string | null;
  type: string;
  created_by_role: string;
  created_at: string;
  ow_companies: { id: string; name: string } | null;
};

type Props = {
  companies: Company[];
  initialPosts: Post[];
};

// ─── Type label / color ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<ContentType, string> = {
  article: "記事",
  video:   "動画",
  audio:   "音声",
  social:  "SNS",
  event:   "イベント",
  other:   "その他",
};

// ─── Helpers ─────────────────────────────────────────────────────────���───────

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ja-JP", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso.split("T")[0];
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PostsAdminClient({ companies, initialPosts }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [filterCompanyId, setFilterCompanyId] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // フォーム state
  const [formCompanyId, setFormCompanyId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [type, setType] = useState<ContentType>("article");

  // OGP 取得状態
  const [ogpFetching, setOgpFetching] = useState(false);
  const [ogpMessage, setOgpMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  // 保存状態
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState("");

  // ─── フィルタ済み一覧 ──

  const filteredPosts = filterCompanyId === "all"
    ? posts
    : posts.filter((p) => p.company_id === filterCompanyId);

  // ─── Form helpers ──

  const resetForm = () => {
    setUrl(""); setTitle(""); setDescription(""); setThumbnailUrl("");
    setSourceName(""); setPublishedAt(""); setType("article");
    setOgpMessage(null); setFormError("");
    setEditingId(null);
    // 新規追加時の企業 ID はフィルタの選択企業をデフォルトに
    setFormCompanyId(filterCompanyId !== "all" ? filterCompanyId : (companies[0]?.id ?? ""));
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
  };

  // ─── OGP 取得 ──

  const handleFetchOgp = async () => {
    if (!url.trim()) return;
    setOgpFetching(true);
    setOgpMessage(null);

    const result = await fetchOgp(url.trim());

    if (result.success) {
      setTitle(result.title);
      setDescription(result.description ?? "");
      setThumbnailUrl(result.thumbnailUrl ?? "");
      setSourceName(result.siteName ?? "");
      setPublishedAt(result.publishedAt ? result.publishedAt.split("T")[0] : "");
      setType(inferTypeFromUrl(url));
      setUrl(result.url);
      setOgpMessage({ kind: "success", text: "OGP 情報を取得しました。必要に応じて編集してください。" });
    } else {
      setType(inferTypeFromUrl(url));
      setOgpMessage({
        kind: "error",
        text:
          result.errorCode === "NO_TITLE"
            ? "タイトルが取得できませんでした。手動で入力してください。"
            : result.errorCode === "TIMEOUT"
            ? "タイムアウトしました。手動で入力してください。"
            : `OGP の取得に失敗しました (${result.errorCode})。手動で入力してください。`,
      });
    }
    setOgpFetching(false);
  };

  // ─── 保存 ──

  const handleSave = () => {
    if (!formCompanyId) { setFormError("企業を選択してください"); return; }
    if (!url.trim())    { setFormError("URL を入力してください"); return; }
    if (!title.trim())  { setFormError("タイトルを入力してください"); return; }
    setFormError("");

    const data = {
      url: url.trim(),
      title: title.trim(),
      description: description.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      source_name: sourceName.trim() || null,
      published_at: publishedAt || null,
      type,
    };

    startTransition(async () => {
      if (editingId) {
        const result = await updateAdminPost(editingId, data);
        if (result.success) {
          setPosts((prev) => prev.map((p) =>
            p.id === editingId ? result.data as unknown as Post : p
          ));
          closeForm();
        } else {
          setFormError(result.error);
        }
      } else {
        const result = await createAdminPost({ company_id: formCompanyId, ...data });
        if (result.success) {
          setPosts((prev) => [result.data as unknown as Post, ...prev]);
          closeForm();
        } else {
          setFormError(result.error);
        }
      }
    });
  };

  // ─── 編集 ──

  const handleEdit = (post: Post) => {
    setEditingId(post.id);
    setFormCompanyId(post.company_id);
    setUrl(post.url);
    setTitle(post.title);
    setDescription(post.description ?? "");
    setThumbnailUrl(post.thumbnail_url ?? "");
    setSourceName(post.source_name ?? "");
    setPublishedAt(post.published_at ? post.published_at.split("T")[0] : "");
    setType(post.type as ContentType);
    setOgpMessage(null);
    setFormError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── 削除 ──

  const handleDelete = (id: string) => {
    if (!confirm("この発信リンクを削除しますか？")) return;
    startTransition(async () => {
      const result = await deleteAdminPost(id);
      if (result.success) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(result.error);
      }
    });
  };

  // ─── Render ──

  return (
    <div className="p-8">
      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">発信管理</h1>
          <p className="text-sm text-gray-500">
            各企業の外部発信コンテンツを Opinio 編集部として登録・管理します。
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors flex-shrink-0"
          >
            <Plus size={15} strokeWidth={2.5} />
            新規追加
          </button>
        )}
      </div>

      {/* ── 新規追加 / 編集フォーム ── */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-800">
              {editingId ? "発信リンクを編集" : "新しい発信リンクを追加"}
            </h2>
            <button
              onClick={closeForm}
              className="flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {/* 企業選択 (編集時はロック) */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                企業 <span className="text-red-500">*</span>
              </label>
              <select
                value={formCompanyId}
                onChange={(e) => setFormCompanyId(e.target.value)}
                disabled={!!editingId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:border-primary disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">— 企業を選択 —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!!editingId && (
                <p className="mt-1 text-xs text-gray-400">編集時は企業を変更できません</p>
              )}
            </div>

            {/* URL + OGP 取得 */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                URL <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleFetchOgp(); } }}
                  placeholder="https://note.com/your-company/n/..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-primary font-mono"
                />
                <button
                  onClick={handleFetchOgp}
                  disabled={ogpFetching || !url.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  {ogpFetching ? (
                    <><Loader2 size={13} strokeWidth={2} className="animate-spin" />取得中</>
                  ) : (
                    "OGP 取得"
                  )}
                </button>
              </div>
              {ogpMessage && (
                <div className={`flex items-start gap-1.5 mt-2 px-3 py-2 rounded-lg text-xs ${
                  ogpMessage.kind === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}>
                  <AlertCircle size={12} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
                  {ogpMessage.text}
                </div>
              )}
            </div>

            {/* タイトル */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="記事・動画のタイトル"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>

            {/* 出典名 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">出典・媒体名</label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="note / PR TIMES / YouTube ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>

            {/* 公開日 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">公開日</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-primary font-mono"
              />
            </div>

            {/* 種別 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">種別</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ContentType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:border-primary"
              >
                {(Object.entries(TYPE_LABELS) as [ContentType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* サムネ URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">サムネイル URL</label>
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/thumb.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-primary font-mono"
              />
            </div>

            {/* 説明 */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">説明</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="コンテンツの簡単な説明（OGP から自動取得）"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-primary resize-y"
              />
            </div>

            {/* サムネプレビュー */}
            {thumbnailUrl && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-400 mb-1.5">サムネイルプレビュー</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl}
                  alt="thumbnail preview"
                  className="max-w-[280px] h-[140px] object-cover rounded-lg"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>

          {/* エラー */}
          {formError && (
            <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {formError}
            </div>
          )}

          {/* アクション */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-[10px] font-bold">編集部</span>
              created_by_role: &quot;editor&quot; として保存されます
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={closeForm}
                disabled={isPending}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !formCompanyId || !url.trim() || !title.trim()}
                className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? (
                  <><Loader2 size={13} strokeWidth={2} className="animate-spin" />保存中</>
                ) : (
                  editingId ? "更新する" : "保存する"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── フィルタ ── */}
      <div className="flex items-center gap-3 mb-4">
        <Filter size={14} strokeWidth={2} className="text-gray-400 flex-shrink-0" />
        <select
          value={filterCompanyId}
          onChange={(e) => setFilterCompanyId(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-primary max-w-xs"
        >
          <option value="all">全企業 ({posts.length} 件)</option>
          {companies.map((c) => {
            const count = posts.filter((p) => p.company_id === c.id).length;
            return count > 0 ? (
              <option key={c.id} value={c.id}>{c.name} ({count})</option>
            ) : null;
          })}
        </select>
        {filterCompanyId !== "all" && (
          <button
            onClick={() => setFilterCompanyId("all")}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            クリア
          </button>
        )}
      </div>

      {/* ── 一覧 ── */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm">
            {filterCompanyId === "all"
              ? "発信リンクはまだ登録されていません"
              : "この企業の発信リンクはまだ登録されていません"}
          </p>
          <button
            onClick={openNewForm}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            最初の発信を登録
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* 件数ヘッダー */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium font-mono">
              {filteredPosts.length} 件
            </span>
          </div>

          {/* テーブル */}
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">企業</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">コンテンツ</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">種別</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">登録者</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">公開日</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map((post) => (
                <AdminPostRow
                  key={post.id}
                  post={post}
                  isPending={isPending}
                  onEdit={() => handleEdit(post)}
                  onDelete={() => handleDelete(post.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── AdminPostRow ─────────────────────────────────────────────────────────────

function AdminPostRow({
  post, isPending, onEdit, onDelete,
}: {
  post: Post;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const companyName = post.ow_companies?.name ?? "—";
  const typeLabel = TYPE_LABELS[post.type as ContentType] ?? post.type;
  const isEditor = post.created_by_role === "editor";

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`border-b border-gray-50 transition-colors ${hovered ? "bg-gray-50" : "bg-white"}`}
    >
      {/* 企業名 */}
      <td className="px-4 py-3 text-sm font-medium text-gray-700 whitespace-nowrap max-w-[160px] truncate">
        {companyName}
      </td>

      {/* コンテンツ: サムネ + タイトル */}
      <td className="px-4 py-3 max-w-[320px]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-8 rounded flex-shrink-0 bg-gray-100 overflow-hidden">
            {post.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors truncate block max-w-[240px]"
            >
              {post.title}
            </a>
            {post.source_name && (
              <p className="text-xs text-gray-400 mt-0.5">{post.source_name}</p>
            )}
          </div>
        </div>
      </td>

      {/* 種別バッジ */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
          post.type === "article" ? "bg-blue-50 text-blue-700" :
          post.type === "video"   ? "bg-red-50 text-red-600" :
          post.type === "audio"   ? "bg-purple-50 text-purple-700" :
          post.type === "social"  ? "bg-green-50 text-green-700" :
          post.type === "event"   ? "bg-yellow-50 text-yellow-700" :
          "bg-gray-100 text-gray-500"
        }`}>
          {typeLabel}
        </span>
      </td>

      {/* 登録者バッジ */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
          isEditor
            ? "bg-purple-100 text-purple-700"
            : "bg-gray-100 text-gray-500"
        }`}>
          {isEditor ? "編集部" : "企業"}
        </span>
      </td>

      {/* 公開日 */}
      <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">
        {formatDate(post.published_at) || "—"}
      </td>

      {/* 操作 */}
      <td className="px-4 py-3">
        <div className={`flex items-center justify-end gap-1 transition-opacity ${hovered ? "opacity-100" : "opacity-0"}`}>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
            title="外部リンクを開く"
          >
            <ExternalLink size={13} strokeWidth={2} />
          </a>
          <button
            onClick={onEdit}
            disabled={isPending}
            className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-gray-100 hover:text-primary transition-colors disabled:opacity-50"
            title="編集"
          >
            <Edit2 size={13} strokeWidth={2} />
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
            title="削除"
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}
