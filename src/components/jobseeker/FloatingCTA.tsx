"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export function FloatingCTA({ href, label, subLabel }: { href: string; label: string; subLabel?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="md:hidden" style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      padding: "12px 16px 20px",
      background: "rgba(255,255,255,0.97)",
      backdropFilter: "blur(8px)",
      borderTop: "1px solid var(--line)",
      zIndex: 100,
      transform: visible ? "translateY(0)" : "translateY(100%)",
      transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    }}>
      <Link href={href} style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, width: "100%",
        padding: "14px 20px",
        background: "linear-gradient(135deg, var(--royal), #1a3a8f)",
        color: "#fff", borderRadius: 12, textDecoration: "none",
        fontSize: 15, fontWeight: 700,
        boxShadow: "0 4px 16px rgba(0,35,102,0.35)",
      }}>
        {label}
      </Link>
      {subLabel && (
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--ink-mute)", marginTop: 7, margin: "7px 0 0" }}>{subLabel}</p>
      )}
    </div>
  );
}
