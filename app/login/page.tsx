"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchShortId } from "@/lib/shortId";

export default function LoginPage() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Googleから戻ってきた時／ログイン済みの時は、登録済みアカウントか確認して /topics へ
  useEffect(() => {
    let active = true;

    // Google側でキャンセル・拒否された場合のエラー
    const params = new URLSearchParams(
      window.location.hash.replace(/^#/, "") || window.location.search,
    );
    const oauthError = params.get("error_description");

    const check = async (email: string | null | undefined) => {
      if (!email) {
        if (!active) return;
        if (oauthError) setError(oauthError);
        setLoading(false);
        return;
      }

      const shortId = await fetchShortId(email);
      if (!active) return;

      if (!shortId) {
        await supabase.auth.signOut();
        if (!active) return;
        setError("このGoogleアカウントでは利用できません。");
        setLoading(false);
        return;
      }

      router.replace("/topics");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        // コールバック内でSupabaseを直接awaitするとデッドロックするため遅延させる
        setTimeout(() => check(session?.user?.email), 0);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const onGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  return (
    <main
      className="login-page-main"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "start center",
        paddingTop: 40,
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div style={{ width: 360 }}>
        <div
          style={{
            background: "#333",
            color: "#fff",
            padding: 14,
            borderRadius: 10,
            textAlign: "center",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          <span style={{ color: "#d9ff3f" }}>Communication</span> Board
        </div>

        <div style={{ marginTop: 40 }} className="login-form">
          {error && (
            <p style={{ color: "crimson", marginBottom: 12, lineHeight: 1.4 }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={loading}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              display: "block",
              opacity: loading ? 0.6 : 1,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {loading ? "..." : "Googleでログイン"}
          </button>
        </div>
      </div>
    </main>
  );
}
