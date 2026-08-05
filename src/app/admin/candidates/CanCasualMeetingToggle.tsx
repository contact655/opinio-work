"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { toggleCanCasualMeeting } from "./actions";

/**
 * 面談可（ow_users.can_casual_meeting）の切り替え。
 *
 * この値が true の人だけが /u/[id] のカジュアル面談CTAと /people の判定に出る。
 * ⚠️ ブラウザの anon クライアントから ow_users を直接 UPDATE すると RLS に弾かれるので、
 *    必ず Server Action を経由すること。
 */
export function CanCasualMeetingToggle({
  userId,
  initialValue,
}: {
  userId: string;
  initialValue: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const res = await toggleCanCasualMeeting(userId, next);
      // ⚠️ 失敗したら必ず戻す
      if (!res.ok) {
        setValue(!next);
        console.error("can_casual_meeting update failed:", res.error);
      }
    });
  }

  return <Toggle checked={value} onToggle={toggle} pending={isPending} label="面談可" onColor="#D97706" />;
}
