"use client";

import { useState } from "react";
import { CareerNudgeBox } from "@/components/feed/CareerPromptBox";
import type { CareerNudge } from "@/lib/home/homeState";

/** 見本用。×で閉じると消え、もう一度出せる（localStorage には書かない） */
export default function CareerNudgeDemo({ nudge }: { nudge: CareerNudge }) {
  const [open, setOpen] = useState(true);
  return open
    ? <CareerNudgeBox nudge={nudge} onClose={() => setOpen(false)} />
    : <button type="button" onClick={() => setOpen(true)} style={{ fontSize: 13 }}>もう一度出す</button>;
}
