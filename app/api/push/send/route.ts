// app/api/push/send/route.ts
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  subscription: any; // JSON
};

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    // 任意メッセージ（未指定ならデフォルト）
    const body = await req.json().catch(() => ({}));
    const title = body?.title ?? "更新があります";
    const message = body?.message ?? "アプリを開いて確認してください";
    const url = body?.url ?? "/topics";

    // VAPID設定（あなたが入れた環境変数を使う）
    webpush.setVapidDetails(
      getEnv("VAPID_SUBJECT"),
      getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
      getEnv("VAPID_PRIVATE_KEY"),
    );

    // サーバ専用キーで購読一覧を取得
    const supabase = createClient(
      getEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // ※ここはあなたの subscribe 側で保存しているテーブル名に合わせてください
    // 例：push_subscriptions で、subscription(JSON)を持っている想定
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription");

    if (error) throw error;

    const subs = (data ?? []) as PushSubscriptionRow[];

    const payload = JSON.stringify({
      title,
      message,
      url,
    });

    // 送信（失敗した購読は削除してクリーンアップ）
    const results = await Promise.allSettled(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, payload);
          return { ok: true, id: row.id };
        } catch (e: any) {
          // 410/404 は購読が死んでる可能性が高い
          const status = e?.statusCode;
          if (status === 410 || status === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", row.id);
          }
          return { ok: false, id: row.id, status };
        }
      }),
    );

    const ok = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).ok,
    ).length;

    return Response.json({ ok, total: subs.length });
  } catch (e: any) {
    console.error(e);
    return new Response(e?.message ?? "error", { status: 500 });
  }
}
