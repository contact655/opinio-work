import { STORIES } from "./mockData";
import { CareerChangesClient } from "./CareerChangesClient";

export const metadata = {
  title: "転職ストーリー | OPINIO",
  description: "IT/SaaS業界への転職ストーリー。リクルート→Salesforce、コンサル→スタートアップなど、実際のキャリアチェンジをプロのアドバイザーが解説。",
};

export default function CareerChangesPage() {
  return <CareerChangesClient stories={STORIES} />;
}
