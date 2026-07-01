import { Suspense } from "react";
import ApplyClient from "./ApplyClient";

export default function CareerConsultationApplyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <ApplyClient />
    </Suspense>
  );
}
