"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type ImageUploadProps = {
  currentUrl: string | null;
  onUpload: (url: string) => void;
  folder: string; // e.g. "logos", "profiles"
  label?: string;
  hint?: string;
  shape?: "square" | "circle";
};

export default function ImageUpload({
  currentUrl,
  onUpload,
  folder,
  label = "画像をアップロード",
  hint,
  shape = "square",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("ファイルサイズは5MB以内にしてください");
      return;
    }

    setError("");
    setUploading(true);

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("ログインが必要です");
        setUploading(false);
        return;
      }

      const ext = file.name.split(".").pop() || "png";
      const filePath = `${user.id}/${folder}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ow-uploads")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("ow-uploads")
        .getPublicUrl(filePath);

      onUpload(urlData.publicUrl);
    } catch {
      setError("アップロードに失敗しました");
    }

    setUploading(false);
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium mb-2">{label}</label>
      )}

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div
          className={`flex-shrink-0 border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden ${
            shape === "circle"
              ? "w-20 h-20 rounded-full"
              : "w-24 h-24 rounded-lg"
          }`}
        >
          {preview ? (
            <img
              src={preview}
              alt="プレビュー"
              className="w-full h-full object-cover"
            />
          ) : (
            <svg
              className="w-8 h-8 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>

        {/* Upload button */}
        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                アップロード中...
              </span>
            ) : (
              "ファイルを選択"
            )}
          </button>
          {hint && (
            <p className="mt-1 text-xs text-gray-400">{hint}</p>
          )}
          {error && (
            <p className="mt-1 text-xs text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
