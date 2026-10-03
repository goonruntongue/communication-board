import { supabase } from "@/lib/supabaseClient";

const cache = new Map<string, string>();

// Googleアカウントのメール → 内部ID（katsu / kimi）
// 対応表は Supabase の app_users テーブルにあり、登録の無いメールは null（利用不可）
export async function fetchShortId(
  email: string | null | undefined,
): Promise<string | null> {
  const key = (email ?? "").trim().toLowerCase();
  if (!key) return null;

  const hit = cache.get(key);
  if (hit) return hit;

  const { data, error } = await supabase
    .from("app_users")
    .select("short_id")
    .eq("email", key)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  const shortId = (data?.short_id ?? "").toString().trim();
  if (!shortId) return null;

  cache.set(key, shortId);
  return shortId;
}
