// app/api/push/send/route.ts
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  subscription: any; // JSON
};

type Body =
  | {
      // 任意送信（今まで通り）
      title?: string;
      message?: string;
      url?: string;

      // 追加：イベント指定
      event?: "topic_created" | "comment_created";

      // topic_created 用
      topicId?: string;
      topicTitle?: string;
      createdBy?: string;

      // comment_created 用
      commentId?: string;
      commentBody?: string;
      commentedBy?: string;
    }
  | any;

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function buildPayload(body: Body) {
  // ① event が来たらそれ優先でメッセージを生成
  if (body?.event === "topic_created") {
    const topicTitle = body?.topicTitle ?? "新しいトピック";
    const createdBy = body?.createdBy ? `（${body.createdBy}）` : "";
    const url = body?.topicId ? `/topics/${body.topicId}` : "/topics";

    return {
      title: "新しいトピックが作成されました",
      message: `${topicTitle}${createdBy}`,
      url,
    };
  }

  if (body?.event === "comment_created") {
    const topicTitle = body?.topicTitle ?? "トピック";
    const commentedBy = body?.commentedBy ? `（${body.commentedBy}）` : "";
    const url = body?.topicId ? `/topics/${body.topicId}` : "/topics";

    return {
      title: "新しい更新があります",
      message: `${topicTitle} にコメントが追加されました${commentedBy}`,
      url,
    };
  }

  // ② それ以外は従来通り：任意 title/message/url
  return {
    title: body?.title ?? "更新があります",
    message: body?.message ?? "アプリを開いて確認してください",
    url: body?.url ?? "/topics",
  };
}

export async function POST(req: Request) {
  try {
    const body: Body = await req.json().catch(() => ({}));
    const { title, message, url } = buildPayload(body);

    // VAPID設定
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

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription");

    if (error) throw error;

    const subs = (data ?? []) as PushSubscriptionRow[];
    if (subs.length === 0) {
      return Response.json({ ok: 0, total: 0, skipped: true });
    }

    const payload = JSON.stringify({ title, message, url });

    // 送信（死んだ購読は掃除）
    const results = await Promise.allSettled(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, payload);
          return { ok: true, id: row.id };
        } catch (e: any) {
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

    const failed = subs.length - ok;

    return Response.json({ ok, failed, total: subs.length });
  } catch (e: any) {
    console.error(e);
    return new Response(e?.message ?? "error", { status: 500 });
  }
}
