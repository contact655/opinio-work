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
        /* ★企業の管理画面のスマホでは下のタブバー（--biz-tabbar-h）のぶん上げる。それ以外の画面では変数が無いので 0 */
        bottom: "calc(32px + var(--biz-tabbar-h, 0px))",
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
