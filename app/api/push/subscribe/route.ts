// app/api/push/subscribe/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function POST(req: Request) {
  try {
    // ✅ 1) 先にJSONを読む（これが最優先）
    const sub = await req.json();

    // ✅ 2) user_short_id を取り出す
    const user_short_id = (sub?.user_short_id ?? sub?.userShortId ?? "")
      .toString()
      .trim();

    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 },
      );
    }

    // ✅ 3) upsert（endpoint重複なら更新）
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        endpoint,
        p256dh,
        auth,
        user_short_id: user_short_id || null,
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
