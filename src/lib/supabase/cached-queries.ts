/**
 * Next.js unstable_cache wrappers for Supabase queries.
 * These cache results at the server level for `revalidate` seconds,
 * reducing Supabase round-trips for repeated page loads.
 */
import { unstable_cache } from "next/cache";
import {
  getCompanyById,
  getCompanyPhotos,
  getCompanyRecruiters,
  getArticlesByCompany,
  getCompaniesForList,
  getJobById,
  getMentors,
  getMentorById,
  getArticles,
  getArticleBySlug,
} from "./queries";

const TTL = 300; // 5 minutes

export const getCachedCompanyById = (id: string) =>
  unstable_cache(
    () => getCompanyById(id),
    [`company-${id}`],
    { revalidate: TTL, tags: [`company-${id}`] }
  )();

export const getCachedCompanyPhotos = (companyId: string) =>
  unstable_cache(
    () => getCompanyPhotos(companyId),
    [`company-photos-${companyId}`],
    { revalidate: TTL, tags: [`company-${companyId}`] }
  )();

export const getCachedCompanyRecruiters = (companyId: string) =>
  unstable_cache(
    () => getCompanyRecruiters(companyId),
    [`company-recruiters-${companyId}`],
    { revalidate: TTL, tags: [`company-${companyId}`] }
  )();

export const getCachedArticlesByCompany = (companyId: string) =>
  unstable_cache(
    () => getArticlesByCompany(companyId),
    [`company-articles-${companyId}`],
    { revalidate: TTL, tags: [`company-${companyId}`] }
  )();

export const getCachedCompanies = () =>
  unstable_cache(
    () => getCompaniesForList(),
    ["companies-list"],
    { revalidate: TTL, tags: ["companies"] }
  )();

export const getCachedJobById = (id: string) =>
  unstable_cache(
    () => getJobById(id),
    [`job-${id}`],
    { revalidate: TTL, tags: [`job-${id}`] }
  )();

export const getCachedMentors = () =>
  unstable_cache(
    () => getMentors(),
    ["mentors-list"],
    { revalidate: TTL, tags: ["mentors"] }
  )();

export const getCachedMentorById = (id: string) =>
  unstable_cache(
    () => getMentorById(id),
    [`mentor-${id}`],
    { revalidate: TTL, tags: [`mentor-${id}`] }
  )();

export const getCachedArticles = () =>
  unstable_cache(
    () => getArticles(),
    ["articles-list"],
    { revalidate: TTL, tags: ["articles"] }
  )();

export const getCachedArticleBySlug = (slug: string) =>
  unstable_cache(
    () => getArticleBySlug(slug),
    [`article-${slug}`],
    { revalidate: TTL, tags: [`article-${slug}`] }
  )();
