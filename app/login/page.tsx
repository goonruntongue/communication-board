"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // UI上は「ID」だが、内部はSupabaseのEmail/Password認証を使うためメール形式に変換する
    const email = `${id.trim()}@local.test`;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    setLoading(false);

    if (error) {
      setError(error.message); // まずは原因が分かるように生エラーを表示
      return;
    }

    router.push("/topics");
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

        <form
          onSubmit={onSubmit}
          style={{ marginTop: 40 }}
          className="login-form"
        >
          <label style={{ display: "block", fontSize: 22, marginBottom: 8 }}>
            ID
          </label>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
            placeholder="emailかID名"
            style={{
              width: "100%",
              height: 44,
              borderRadius: 8,
              border: "1px solid #ddd",
              padding: "0 12px",
              fontSize: 16,
            }}
          />

          <label
            style={{ display: "block", fontSize: 22, margin: "22px 0 8px" }}
          >
            Pass
          </label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            placeholder="パスワード"
            style={{
              width: "100%",
              height: 44,
              borderRadius: 8,
              border: "1px solid #ddd",
              padding: "0 12px",
              fontSize: 16,
            }}
          />

          {error && (
            <p style={{ color: "crimson", marginTop: 12, lineHeight: 1.4 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 26,
              width: 120,
              height: 40,
              borderRadius: 999,
              border: "none",
              background: "#bcb6ff",
              cursor: "pointer",
              display: "block",
              marginInline: "auto",
              opacity: loading ? 0.6 : 1,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {loading ? "..." : "login"}
          </button>
        </form>
      </div>
    </main>
  );
}
