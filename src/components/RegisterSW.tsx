"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function RegisterSW() {
  const [ready, setReady] = useState(false);
  const [shortId, setShortId] = useState<string>("");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("SW registered");
        setReady(true);
      })
      .catch(console.error);
  }, []);
  useEffect(() => {
    (async () => {
      try {
        // ここはあなたのプロジェクトのsupabaseClientを使う想定
        // すでに他ページで使っているなら同じ import を追加してください
        const { supabase } = await import("@/lib/supabaseClient");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const sid = user?.email?.split("@")[0] ?? "";
        setShortId(sid);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // ✅ ここが「ユーザー操作で呼ぶ」購読関数
  async function subscribePush() {
    if (!shortId) {
      console.warn("shortId is empty. wait for auth user.");
      return;
    }

    if (!ready) return;
    if (!("PushManager" in window)) return;

    const permission = await Notification.requestPermission();
    console.log("permission:", permission);
    if (permission !== "granted") return;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing");
      return;
    }

    const reg = await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...sub.toJSON(),
        user_short_id: shortId || null, // snake_case
        userShortId: shortId || null, // camelCaseも保険
      }),
    });

    if (!res.ok) {
      console.error("subscribe API failed:", await res.text());
      return;
    }

    console.log("Push subscribed & saved");
  }

  // ✅ デバッグ用にwindowへ生やしておく（次ステップでボタンにします）
  useEffect(() => {
    (window as any).__subscribePush = subscribePush;
  }, [ready, shortId]);

  return null;
}
