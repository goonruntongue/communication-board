// app/api/push/send/route.ts
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// env名ゆれ対策（あなたのVercel画面に SUPABASE_URL があるため）
function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}
function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export async function POST(req: Request) {
  try {
    // 任意メッセージ（未指定ならデフォルト）
    const body = await req.json().catch(() => ({}));
    const title = body?.title ?? "更新があります";
    const message = body?.message ?? "アプリを開いて確認してください";
    const url = body?.url ?? "/topics";

    // VAPID（※VAPID_SUBJECT は mailto:付き推奨）
    webpush.setVapidDetails(
      getEnv("VAPID_SUBJECT"),
      getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
      getEnv("VAPID_PRIVATE_KEY"),
    );

    const supabaseUrl = getSupabaseUrl();
    const serviceRole = getServiceRoleKey();
    if (!supabaseUrl)
      throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
    if (!serviceRole) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // あなたのテーブル構造に合わせて取得
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (error) throw error;

    const rows = (data ?? []) as PushSubRow[];

    const payload = JSON.stringify({ title, message, url });

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const subscription = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        };

        try {
          await webpush.sendNotification(subscription as any, payload);
          return { ok: true, id: row.id };
        } catch (e: any) {
          const status = e?.statusCode;
          // 410/404 は購読が死んでる可能性が高い → 削除
          if (status === 410 || status === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", row.id);
          }
          return { ok: false, id: row.id, status, msg: e?.message };
        }
      }),
    );

    const ok = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).ok,
    ).length;

    return Response.json({
      ok,
      total: rows.length,
      results,
    });
  } catch (e: any) {
    console.error(e);
    // ブラウザで原因が見えるように「文字列」で返す（JSONパース失敗を避ける）
    return new Response(e?.message ?? "error", { status: 500 });
  }
}
