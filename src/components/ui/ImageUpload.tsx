"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  currentUrl?: string | null;
  bucket?: string;
  folder: string;
  onUpload: (url: string) => void;
  shape?: "square" | "circle";
  size?: number;
  label?: string;
};

export function ImageUpload({
  currentUrl,
  bucket = "ow-uploads",
  folder,
  onUpload,
  shape = "square",
  size = 80,
  label = "画像をアップロード",
}: Props) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      setPreview(data.publicUrl);
      onUpload(data.publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
      alert("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const borderRadius = shape === "circle" ? "50%" : "8px";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <label style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
        <div style={{
          width: size,
          height: size,
          borderRadius,
          border: "2px dashed #d0d0d0",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf7",
          position: "relative",
        }}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="preview"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div style={{
              fontSize: 11,
              color: "#aaa",
              textAlign: "center",
              padding: 8,
              lineHeight: 1.5,
            }}>
              {uploading ? "アップロード中..." : "+ 画像"}
            </div>
          )}
          {uploading && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#555",
            }}>
              uploading...
            </div>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </label>
      <span style={{ fontSize: 11, color: "#888" }}>{label}</span>
    </div>
  );
}
