"use client";

import { useState } from "react";
import { CareerPromptBox } from "@/components/feed/CareerPromptBox";

/** 見本用。×で閉じると消え、もう一度出せる（localStorage には書かない） */
export default function CareerPromptDemo() {
  const [open, setOpen] = useState(true);
  return open
    ? <CareerPromptBox onClose={() => setOpen(false)} />
    : <button type="button" onClick={() => setOpen(true)} style={{ fontSize: 13 }}>もう一度出す</button>;
}
