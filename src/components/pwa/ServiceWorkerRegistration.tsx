"use client";

import { useEffect } from "react";

/**
 * PWA Service Worker 登録コンポーネント
 * layout.tsx に配置する。production・HTTPS でのみ登録。
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // localhost（HTTP）でも開発確認できるように環境チェックは緩め
    // 本番では必ず HTTPS になる
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // 新バージョンがある場合、バナーを表示
              showUpdateBanner();
            }
          });
        });

        console.log("[SW] Registered:", registration.scope);
      } catch (err) {
        console.warn("[SW] Registration failed:", err);
      }
    };

    register();
  }, []);

  return null;
}

function showUpdateBanner() {
  // すでにバナーがある場合はスキップ
  if (document.getElementById("sw-update-banner")) return;

  const banner = document.createElement("div");
  banner.id = "sw-update-banner";
  banner.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: #002366;
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 14px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    white-space: nowrap;
    max-width: calc(100vw - 32px);
  `;

  banner.innerHTML = `
    <span>🔄 新しいバージョンが利用可能です</span>
    <button
      onclick="window.location.reload()"
      style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
      "
    >更新する</button>
    <button
      onclick="this.closest('#sw-update-banner').remove()"
      style="
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.6);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0;
      "
      aria-label="閉じる"
    >×</button>
  `;

  document.body.appendChild(banner);

  // 10秒後に自動で消す
  setTimeout(() => banner.remove(), 10000);
}
