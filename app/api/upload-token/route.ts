import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase Admin client（ログインユーザー確認用）
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    // Authorization: Bearer <supabase access_token>
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!jwt) {
      return NextResponse.json(
        { ok: false, error: "Missing Authorization token" },
        { status: 401 },
      );
    }

    // Supabaseでログインユーザー確認
    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(jwt);

    if (userErr || !userData?.user) {
      return NextResponse.json(
        { ok: false, error: "Invalid session" },
        { status: 401 },
      );
    }

    // ✅ 環境変数に設定した固定トークンを返す
    const fixedToken = process.env.SAKURA_UPLOAD_TOKEN;

    if (!fixedToken) {
      return NextResponse.json(
        { ok: false, error: "SAKURA_UPLOAD_TOKEN not set" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      token: fixedToken,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown error" },
      { status: 500 },
    );
  }
}
