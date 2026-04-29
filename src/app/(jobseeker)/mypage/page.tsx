import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MypageClient from "./MypageClient";
import type {
  Bookmark,
  CasualMeeting,
  CasualMeetingStatus,
  MentorReservation,
  MentorReservationStatus,
} from "@/app/mypage/mockMypageData";

export const metadata = { title: "マイページ — Opinio" };

export default async function MypagePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/mypage");
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, cover_color, about_me, age_range, location, social_links, is_mentor")
    .eq("auth_id", user.id)
    .maybeSingle();

  // Fetch company bookmarks (target_type='company' only; articles/mentors are mock for now)
  let companyBookmarks: Bookmark[] = [];
  if (owUser) {
    const { data: bmarks } = await supabase
      .from("ow_bookmarks")
      .select("id, target_id")
      .eq("user_id", owUser.id)
      .eq("target_type", "company")
      .order("created_at", { ascending: false });

    if (bmarks && bmarks.length > 0) {
      const companyIds = bmarks.map((b) => b.target_id as string);
      const { data: companies } = await supabase
        .from("ow_companies")
        .select("id, name, industry, employee_count, phase")
        .in("id", companyIds);

      if (companies) {
        // Preserve bookmark order (most recently bookmarked first)
        const companyMap = new Map(companies.map((c) => [c.id, c]));
        companyBookmarks = bmarks
          .map((b): Bookmark | null => {
            const c = companyMap.get(b.target_id as string);
            if (!c) return null;
            const meta = [
              c.industry,
              c.employee_count ? `${c.employee_count}名` : null,
            ]
              .filter(Boolean)
              .join(" / ");
            return {
              id: b.id as string,
              type: "company",
              title: c.name as string,
              meta,
              badge_label: (c.industry as string) ?? "企業",
              href: `/companies/${c.id}`,
            };
          })
          .filter((b): b is Bookmark => b !== null);
      }
    }
  }

  // Fetch casual meetings with company logo info
  let casualMeetings: CasualMeeting[] = [];
  if (owUser) {
    const { data: meetings } = await supabase
      .from("ow_casual_meetings")
      .select("id, company_id, job_id, status, created_at")
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: false });

    if (meetings && meetings.length > 0) {
      const companyIdSet = new Set(meetings.map((m) => m.company_id as string));
      const companyIds = Array.from(companyIdSet);
      const { data: companies } = await supabase
        .from("ow_companies")
        .select("id, name, logo_gradient, logo_letter")
        .in("id", companyIds);

      const jobIds = meetings
        .filter((m) => m.job_id)
        .map((m) => m.job_id as string);
      const jobMap = new Map<string, string>();
      if (jobIds.length > 0) {
        const { data: jobs } = await supabase
          .from("ow_jobs")
          .select("id, title")
          .in("id", jobIds);
        for (const j of jobs ?? []) {
          jobMap.set(j.id as string, j.title as string);
        }
      }

      const companyMap = new Map((companies ?? []).map((c) => [c.id as string, c]));
      const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

      casualMeetings = meetings.map((m): CasualMeeting => {
        const c = companyMap.get(m.company_id as string);
        const appliedAt = new Date(m.created_at as string)
          .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
          .replace(/\//g, ".");
        return {
          id: m.id as string,
          company_id: m.company_id as string,
          company_name: (c?.name as string) ?? "—",
          company_initial: (c?.logo_letter as string) ?? (c?.name as string)?.charAt(0) ?? "?",
          company_gradient: (c?.logo_gradient as string) ?? FALLBACK_GRADIENT,
          job_title: m.job_id
            ? (jobMap.get(m.job_id as string) ?? "カジュアル面談")
            : "カジュアル面談",
          applied_at: appliedAt,
          status: (m.status as CasualMeetingStatus) ?? "pending",
        };
      });
    }
  }

  // Fetch mentor reservations with mentor profile JOIN
  let mentorReservations: MentorReservation[] = [];
  if (owUser) {
    const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";
    const { data: reservations } = await supabase
      .from("ow_mentor_reservations")
      .select("id, mentor_id, themes, created_at, scheduled_at, status")
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: false });

    if (reservations && reservations.length > 0) {
      const mentorIds = Array.from(new Set(reservations.map((r) => r.mentor_id as string).filter(Boolean)));
      const mentorMap = new Map<string, { name: string; avatar_initial: string | null; avatar_color: string | null; current_role: string | null }>();
      if (mentorIds.length > 0) {
        const { data: mentors } = await supabase
          .from("ow_mentors")
          .select("id, name, avatar_initial, avatar_color, current_role")
          .in("id", mentorIds);
        for (const m of mentors ?? []) {
          mentorMap.set(m.id as string, m as { name: string; avatar_initial: string | null; avatar_color: string | null; current_role: string | null });
        }
      }

      mentorReservations = reservations.map((r): MentorReservation => {
        const m = mentorMap.get(r.mentor_id as string);
        const appliedAt = new Date(r.created_at as string)
          .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
          .replace(/\//g, ".");
        const hex = m?.avatar_color as string | null;
        const gradient = hex
          ? `linear-gradient(135deg, ${hex}99, ${hex})`
          : FALLBACK_GRADIENT;
        return {
          id: r.id as string,
          mentor_id: (r.mentor_id as string) ?? "",
          mentor_name: (m?.name as string) ?? "—",
          mentor_initial: (m?.avatar_initial as string) ?? (m?.name as string)?.charAt(0) ?? "?",
          mentor_gradient: gradient,
          mentor_role: (m?.current_role as string) ?? "",
          themes: (r.themes as string[]) ?? [],
          applied_at: appliedAt,
          scheduled_at: r.scheduled_at
            ? new Date(r.scheduled_at as string).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".")
            : undefined,
          status: (r.status as MentorReservationStatus) ?? "pending_review",
        };
      });
    }
  }

  return <MypageClient owUser={owUser} companyBookmarks={companyBookmarks} casualMeetings={casualMeetings} mentorReservations={mentorReservations} />;
}
