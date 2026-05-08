"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  onDone: () => void;
  variant?: "default" | "error";
};

export default function Toast({ message, onDone, variant = "default" }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const bg = variant === "error" ? "var(--error)" : "var(--ink)";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        background: bg,
        color: "#fff",
        padding: "12px 22px",
        borderRadius: 100,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 2000,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        whiteSpace: "nowrap",
      }}
    >
      {message}
    </div>
  );
}
