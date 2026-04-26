"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Upload states
  const [headerUploading, setHeaderUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [recruiterUploading, setRecruiterUploading] = useState(false);

  const supabase = createClient();

  const loadCompany = useCallback(async () => {
    const { data } = await supabase
      .from("ow_companies")
      .select("*")
      .eq("id", id)
      .single();
    setCompany(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  // ─── Upload handler ─────────────────────────────────
  async function uploadImage(
    file: File,
    type: "header" | "logo" | "recruiter"
  ) {
    const setter = type === "header" ? setHeaderUploading : type === "logo" ? setLogoUploading : setRecruiterUploading;
    setter(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const folder = type === "header" ? "companies/headers" : type === "logo" ? "companies/logos" : "companies/recruiters";
      const path = `${folder}/${id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ow-uploads")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        alert(`アップロードエラー: ${uploadError.message}`);
        setter(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("ow-uploads")
        .getPublicUrl(path);

      const column = type === "header" ? "header_image_url" : type === "logo" ? "logo_url" : "recruiter_avatar_url";
      const { error: updateError } = await supabase
        .from("ow_companies")
        .update({ [column]: urlData.publicUrl })
        .eq("id", id);

      if (updateError) {
        alert(`保存エラー: ${updateError.message}`);
        setter(false);
        return;
      }

      setCompany((prev: any) => ({
        ...prev,
        [column]: urlData.publicUrl,
      }));
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setter(false);
    }
  }

  // ─── Remove image ────────────────────────────────────
  async function removeImage(type: "header" | "logo" | "recruiter") {
    const column = type === "header" ? "header_image_url" : type === "logo" ? "logo_url" : "recruiter_avatar_url";
    setSaving(true);
    await supabase
      .from("ow_companies")
      .update({ [column]: null })
      .eq("id", id);
    setCompany((prev: any) => ({ ...prev, [column]: null }));
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-8">
        <p className="text-gray-500">企業が見つかりません</p>
        <Link href="/admin/companies" className="text-blue-600 text-sm mt-2 inline-block">← 一覧に戻る</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Back link */}
      <Link
        href="/admin/companies"
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← 企業一覧に戻る
      </Link>

      <h1 className="text-2xl font-bold mb-1">{company.name}</h1>
      <p className="text-sm text-gray-500 mb-8">
        {[company.industry, company.location, company.phase].filter(Boolean).join(" · ")}
      </p>

      {/* ─── ヘッダー画像 ─── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-3">ヘッダー画像</h2>

        {/* Preview */}
        {company.header_image_url ? (
          <div className="mb-3">
            <div
              style={{
                width: "100%",
                height: 160,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={company.header_image_url}
                alt="ヘッダー画像"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <button
              onClick={() => removeImage("header")}
              disabled={saving}
              className="mt-2 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              画像を削除
            </button>
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              height: 160,
              borderRadius: 8,
              border: "2px dashed #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <span className="text-sm text-gray-400">画像未設定</span>
          </div>
        )}

        {/* Upload */}
        <label
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors"
          style={{
            background: headerUploading ? "#f3f4f6" : "#f9fafb",
            border: "1px solid #e5e7eb",
            color: headerUploading ? "#9ca3af" : "#374151",
          }}
        >
          {headerUploading ? "アップロード中..." : "ファイルを選択"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={headerUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file, "header");
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-gray-400 ml-2">推奨: 1200×400px / JPG・PNG</span>
      </section>

      {/* ─── ロゴ画像 ─── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-3">ロゴ画像</h2>

        {/* Preview */}
        <div className="flex items-end gap-4 mb-3">
          {company.logo_url ? (
            <div>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={company.logo_url}
                  alt="ロゴ"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <button
                onClick={() => removeImage("logo")}
                disabled={saving}
                className="mt-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                削除
              </button>
            </div>
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                border: "2px dashed #d1d5db",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="text-xs text-gray-400">未設定</span>
            </div>
          )}
        </div>

        <label
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors"
          style={{
            background: logoUploading ? "#f3f4f6" : "#f9fafb",
            border: "1px solid #e5e7eb",
            color: logoUploading ? "#9ca3af" : "#374151",
          }}
        >
          {logoUploading ? "アップロード中..." : "ファイルを選択"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={logoUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file, "logo");
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-gray-400 ml-2">推奨: 256×256px / PNG（透過可）</span>
      </section>

      {/* ─── 採用担当者写真 ─── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-3">採用担当者写真</h2>

        <div className="flex items-end gap-4 mb-3">
          {company.recruiter_avatar_url ? (
            <div>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={company.recruiter_avatar_url}
                  alt="採用担当者"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <button
                onClick={() => removeImage("recruiter")}
                disabled={saving}
                className="mt-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                削除
              </button>
            </div>
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                border: "2px dashed #d1d5db",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="text-xs text-gray-400">未設定</span>
            </div>
          )}
        </div>

        <label
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors"
          style={{
            background: recruiterUploading ? "#f3f4f6" : "#f9fafb",
            border: "1px solid #e5e7eb",
            color: recruiterUploading ? "#9ca3af" : "#374151",
          }}
        >
          {recruiterUploading ? "アップロード中..." : "ファイルを選択"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={recruiterUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file, "recruiter");
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-gray-400 ml-2">推奨: 256×256px / JPG・PNG</span>
      </section>

      {/* ─── 企業ページリンク ─── */}
      <div className="border-t pt-6">
        <Link
          href={`/companies/${id}`}
          className="text-sm text-blue-600 hover:underline"
          target="_blank"
        >
          企業詳細ページを確認する →
        </Link>
      </div>
    </div>
  );
}
