import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";

export default function JobseekerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <JobseekerHeader />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <JobseekerFooter />
    </div>
  );
}
