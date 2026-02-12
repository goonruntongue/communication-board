import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST() {
  const { data } = await supabase.from("push_subscriptions").select("*");

  if (!data) return Response.json({ ok: false });

  const payload = JSON.stringify({
    title: "新しいトピックがあります",
    body: "Topics が更新されました",
  });

  await Promise.all(
    data.map((sub: any) => webpush.sendNotification(sub.subscription, payload)),
  );

  return Response.json({ ok: true });
}
