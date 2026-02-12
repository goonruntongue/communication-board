"use client";

import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (!window.isSecureContext) {
      console.warn("Push通知にはHTTPS（またはlocalhost）が必要です");
      return;
    }

    const run = async () => {
      try {
        // 1) SW登録（すでに登録済みなら同じregistrationが返ります）
        const reg = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered:", reg.scope);

        // 2) VAPID公開鍵チェック
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing");
          return;
        }

        // 3) 通知権限（denied なら何もしない）
        //    ※いきなり許可ダイアログを出したくない場合は、ここを“ボタン押下時”に移すのがUX的に良いです
        if (Notification.permission === "denied") {
          console.log("Notification permission is denied");
          return;
        }
        if (Notification.permission !== "granted") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            console.log("Notification permission not granted");
            return;
          }
        }

        // 4) 既存購読があれば再利用（重複防止）
        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));

        // 5) サーバに購読情報を保存
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`subscribe API failed: ${res.status} ${text}`);
        }

        console.log("Push subscribed & saved");
      } catch (e) {
        console.error("RegisterSW error:", e);
      }
    };

    run();
  }, []);

  return null;
}
