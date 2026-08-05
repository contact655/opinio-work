"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { toggleAmbassador } from "./actions";

/**
 * 「話せる人」（ow_company_admins.is_ambassador）の切り替え。
 * 見た目は共通の Toggle。ロールバックはここで持つ。
 */
export function AmbassadorToggle({
  adminId,
  isAmbassador,
}: {
  adminId: string;
  isAmbassador: boolean;
}) {
  const [value, setValue] = useState(isAmbassador);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (isPending) return;
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const res = await toggleAmbassador(adminId, next);
      // ⚠️ 失敗したら必ず戻す。握り潰すと DB と画面がずれる
      if (res && res.ok === false) {
        setValue(!next);
        console.error("is_ambassador update failed:", res.error);
      }
    });
  }

  return <Toggle checked={value} onToggle={handleToggle} pending={isPending} label="話せる人" />;
}
