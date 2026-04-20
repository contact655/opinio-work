"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  gradientPresets,
  getGradientByJobType,
  normalizeGradientPreset,
} from "@/lib/jobCardStyles";
import { getCompanyLogoUrl } from "@/lib/utils/companyLogo";

/**
 * Wantedly 型 JobCard。
 *
 * 指示書とのスキーマ差分:
 *   - job.job_type        → 既存 job.job_category を使用
 *   - job.company (単数)  → 既存は ow_companies リレーション。本カードは
 *     呼び出し側で整形した「company」オブジェクトを期待する
 */
export type JobCardData = {
  id: string;
  title: string;
  job_category: string | null;
  work_style: string | null;
  salary_min: number | null;
  salary_max: number | null;

  // Wantedly 拡張 (migration 030)
  main_image_url: string | null;
  catch_copy: string | null;
  one_liner: string | null;
  gradient_preset: string | null;

  company: {
    id: string;
    name: string;
    logo_url: string | null;
    url?: string | null;
    website_url?: string | null;
    phase?: string | null;
  };

  member_count?: number;
  is_favorited?: boolean;
};

function SalaryLabel({ min, max }: { min: number | null; max: number | null }) {
  if (!min && !max) return null;
  const text =
    min && max ? `${min}〜${max}万` : min ? `${min}万〜` : `〜${max}万`;
  return (
    <span className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
      {text}
    </span>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "#ef4444" : "none"}
      stroke={filled ? "#ef4444" : "#4b5563"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function JobCard({ job }: { job: JobCardData }) {
  const [isFavorited, setIsFavorited] = useState(job.is_favorited ?? false);

  // 背景: main_image_url > gradient_preset(カラム) > job_category から自動判定
  const normalized = normalizeGradientPreset(job.gradient_preset);
  const gradientKey = normalized ?? getGradientByJobType(job.job_category);
  const gradientClass = gradientPresets[gradientKey];

  // 企業ロゴ
  const companyLogo = getCompanyLogoUrl({
    logo_url: job.company.logo_url,
    website_url: job.company.website_url,
    url: job.company.url,
  });

  // フォールバック: catch_copy が無ければタイトル
  const mainText = job.catch_copy ?? job.title;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorited((v) => !v);
    // TODO: API 連携 (POST /api/jobs/[id]/favorite または既存の ow_job_favorites 経由)
  };

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block rounded-xl border border-gray-200 bg-white overflow-hidden transition hover:border-gray-400 hover:shadow-sm"
    >
      {/* メインビジュアル領域 */}
      <div
        className={`relative h-[140px] ${!job.main_image_url ? gradientClass : ""}`}
      >
        {job.main_image_url && (
          <Image
            src={job.main_image_url}
            alt={mainText}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        )}

        {/* 左上: 現役社員在籍バッジ */}
        {typeof job.member_count === "number" && job.member_count > 0 && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-900 text-[10px] font-medium px-2.5 py-1 rounded-full">
            現役社員 {job.member_count}名在籍
          </div>
        )}

        {/* 右下: お気に入り */}
        <button
          onClick={handleFavoriteClick}
          className="absolute bottom-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition"
          aria-label={isFavorited ? "お気に入りを解除" : "お気に入りに追加"}
          type="button"
        >
          <HeartIcon filled={isFavorited} />
        </button>
      </div>

      {/* コンテンツ領域 */}
      <div className="p-4">
        {/* 企業ロゴ + 企業名 */}
        <div className="flex items-center gap-2 mb-2.5">
          {companyLogo ? (
            // Clearbit/Google Favicon 等の外部URLで next/image の domain 設定を回避するため img
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companyLogo}
              alt={job.company.name}
              className="w-5 h-5 rounded object-contain flex-shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-[9px] font-medium flex-shrink-0 text-gray-600">
              {job.company.name.charAt(0)}
            </div>
          )}
          <span className="text-[11px] text-gray-600 truncate">
            {job.company.name}
            {job.company.phase && (
              <span className="text-gray-400 ml-1">・{job.company.phase}</span>
            )}
          </span>
        </div>

        {/* キャッチコピー(明朝体) */}
        <h3 className="font-serif text-base leading-snug font-medium mb-2 line-clamp-2 group-hover:text-gray-700 transition text-gray-900">
          {mainText}
        </h3>

        {/* 一言要約 */}
        {job.one_liner && (
          <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
            {job.one_liner}
          </p>
        )}

        {/* タグ */}
        <div className="flex gap-1.5 flex-wrap">
          {job.job_category && (
            <span className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              {job.job_category}
            </span>
          )}
          {job.work_style && (
            <span className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              {job.work_style}
            </span>
          )}
          <SalaryLabel min={job.salary_min} max={job.salary_max} />
        </div>
      </div>
    </Link>
  );
}
