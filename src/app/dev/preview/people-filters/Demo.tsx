"use client";

import { useState } from "react";
import { PeopleFilterDrawer, type PeopleFilterValues } from "@/components/people/PeopleFilterDrawer";

const REL = [{ value: "following", label: "フォロー中" }, { value: "followers", label: "フォロワー" }];
const ROLES = ["営業", "カスタマーサクセス", "マーケティング", "エンジニア", "プロダクトマネージャー", "デザイナー", "人事", "経営・事業企画"].map((l, i) => ({ value: `r${i}`, label: l }));
const AGES = ["20代", "30代", "40代", "50代", "60代", "70代"].map((l, i) => ({ value: `a${i}`, label: l }));
const PREV = {
  options: {
    roles: [{ slug: "sales", name: "営業" }, { slug: "cs", name: "カスタマーサクセス" }],
    industries: [{ slug: "it", name: "IT・インターネット" }, { slug: "hr", name: "人材" }],
    companies: [{ slug: "salesforce", name: "Salesforce" }, { slug: "smarthr", name: "SmartHR" }],
  },
  selfStart: { role: { slug: "sales", name: "営業" }, industry: { slug: "it", name: "IT・インターネット" }, company: null },
};
const EMPTY: PeopleFilterValues = { rel: "", roles: [], ages: [], foreign: false, consult: false, prev: { role: null, industry: null, company: null } };

/** 見本用。条件は画面の中だけで持つ（URL にも DB にも書かない） */
export function PeopleFilterDemo() {
  const [open, setOpen] = useState(true);
  const [v, setV] = useState<PeopleFilterValues>({ ...EMPTY, rel: "following", roles: ["r0"], prev: { role: null, industry: null, company: "salesforce" } });
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)} style={{ padding: "8px 14px", borderRadius: 999, border: "1.5px solid var(--royal)", color: "var(--royal)", background: "#fff", fontWeight: 600 }}>
        すべてのフィルター
      </button>
      <pre style={{ fontSize: 12 }}>{JSON.stringify(v)}</pre>
      <PeopleFilterDrawer open={open} onClose={() => setOpen(false)} values={v} relOptions={REL} roleOptions={ROLES} ageOptions={AGES}
        showConsult prevCareer={PREV} onApply={setV} onReset={() => setV(EMPTY)} />
    </div>
  );
}
