"use client";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

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

export default function PushEnableButton() {
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const enable = async () => {
    setMsg("");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMsg("この端末/ブラウザはPushに対応していません");
      return;
    }

    try {
      setBusy(true);

      // ✅ iOS/PWA対策：ユーザー操作(ボタン押下)の中で許可を取る
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") {
        setMsg("通知が許可されませんでした（設定をご確認ください）");
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setMsg("NEXT_PUBLIC_VAPID_PUBLIC_KEY が見つかりません");
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
      // ✅ ログインユーザーの shortId を取る（Null上書き事故を防ぐ）
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

      if (sessionErr) {
        setMsg("ログイン情報取得に失敗しました。再ログインしてください");
        return;
      }

      const email = sessionData.session?.user?.email ?? "";
      if (!email) {
        setMsg("ログイン状態ではありません（再ログインしてください）");
        return;
      }

      const shortId = email.split("@")[0] ?? "";
      if (!shortId) {
        setMsg("shortId を作れませんでした");
        return;
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sub.toJSON(),
          user_short_id: shortId || null,
          userShortId: shortId || null,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `subscribe failed: ${res.status}`);
      }

      setMsg("✅ 通知を有効化しました");
    } catch (e: any) {
      setMsg("❌ 失敗: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#fff" }}>
        通知許可:{" "}
        <b>
          {permission === "unsupported"
            ? "未対応"
            : permission === "granted"
              ? "許可済み"
              : permission === "denied"
                ? "拒否"
                : "未選択"}
        </b>
      </div>

      <button
        type="button"
        onClick={enable}
        disabled={busy}
        style={{
          height: 34,
          padding: "0 12px",
          borderRadius: 10,
          border: "1px solid #bbb",
          background: "#111",
          color: "#fff",
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.6 : 1,
          fontSize: 13,
        }}
      >
        {busy
          ? "処理中..."
          : permission === "granted"
            ? "通知を再登録"
            : "通知を有効化"}
      </button>

      {msg && (
        <div style={{ fontSize: 12, color: "#ffe94d", lineHeight: 1.4 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
