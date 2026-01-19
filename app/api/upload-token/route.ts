import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // サーバ専用キー
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

    // ① SupabaseにJWTを検証させる = ログイン中ユーザー確認
    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(jwt);

    if (userErr || !userData?.user) {
      return NextResponse.json(
        { ok: false, error: "Invalid session" },
        { status: 401 },
      );
    }

    const user = userData.user;

    // ② 短命トークンを発行（5分有効）
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // ③ Supabaseテーブルに保存
    const { error: insertErr } = await supabaseAdmin
      .from("upload_tokens")
      .insert({
        token,
        user_id: user.id,
        expires_at: expiresAt,
      });

    if (insertErr) {
      return NextResponse.json(
        { ok: false, error: insertErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      token,
      expires_at: expiresAt,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown error" },
      { status: 500 },
    );
  }
}
