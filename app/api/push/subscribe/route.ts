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
    const sub = await req.json();

    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;

    // ✅ user_short_id は任意（来た時だけ反映させる）
    const incomingShortId = (sub?.user_short_id ?? sub?.userShortId ?? "")
      .toString()
      .trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 },
      );
    }

    // ✅ 「null で上書き」しないため、user_short_id はある時だけ payload に含める
    const payload: any = { endpoint, p256dh, auth };
    if (incomingShortId) payload.user_short_id = incomingShortId;

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" });

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
