"use client";

import { useTransition } from "react";
import { toggleAmbassador } from "./actions";

export function AmbassadorToggle({
  adminId,
  isAmbassador,
}: {
  adminId: string;
  isAmbassador: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(() => {
      toggleAmbassador(adminId, !isAmbassador);
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={isAmbassador ? "「話せる人」から外す" : "「話せる人」に追加"}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        background: isAmbassador ? "#002366" : "#E2E8F0",
        cursor: isPending ? "wait" : "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: isAmbassador ? 22 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}
