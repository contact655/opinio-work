"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  bucketName: string;
  currentUrl: string | null;
  onUpload: (url: string) => void;
  shape: "circle" | "rectangle";
  placeholder?: string;
  width?: number;
  height?: number;
  maxSizeMB?: number;
}

export default function ImageUpload({
  bucketName,
  currentUrl,
  onUpload,
  shape,
  placeholder = "?",
  width = 80,
  height = 80,
  maxSizeMB = 5,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const isCircle = shape === "circle";

  const handleFile = async (file: File) => {
    if (!file) return;

    // Validate type
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("JPEG / PNG / WebP のみ対応しています");
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`ファイルサイズは${maxSizeMB}MB以内にしてください`);
      return;
    }

    setError("");
    setUploading(true);

    try {
      // Preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      // Upload
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const filePath = `${user?.id ?? "public"}/${Date.now()}.${file.name.split(".").pop()}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(filePath);

      onUpload(publicUrl);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          width: isCircle ? width : "100%",
          height: isCircle ? height : 200,
          borderRadius: isCircle ? "50%" : 12,
          border: `2px dashed ${uploading ? "#059669" : "#d1d5db"}`,
          overflow: "hidden",
          cursor: uploading ? "wait" : "pointer",
          position: "relative",
          background: preview ? "transparent" : "#f9fafb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 0.2s",
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              fontSize: isCircle ? 24 : 14,
              color: "#9ca3af",
              fontWeight: 600,
              textAlign: "center",
              padding: 8,
            }}
          >
            {uploading ? "..." : placeholder}
          </span>
        )}

        {/* Hover overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.2s",
            borderRadius: isCircle ? "50%" : 12,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.opacity = "1")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.opacity = "0")
          }
        >
          <span
            style={{ color: "white", fontSize: 13, fontWeight: 600 }}
          >
            {uploading ? "アップロード中..." : "写真を変更"}
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {error && (
        <p
          style={{
            fontSize: 12,
            color: "#dc2626",
            marginTop: 6,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
