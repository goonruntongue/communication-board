import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Nodeで固定

function sanitizeFilename(original: string) {
  // 拡張子は最後の . から取得（無い場合もある）
  const dot = original.lastIndexOf(".");
  const ext = dot >= 0 ? original.slice(dot + 1).toLowerCase() : "";
  const base = dot >= 0 ? original.slice(0, dot) : original;

  // 日本語などは _ に寄せる（multipartの filename で事故りにくくする）
  const safeBase =
    base
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "file";

  const safeExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 10); // 念のため短く

  // ここでは「サクラへ送るときの名前」なので短めでOK
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

export async function POST(req: Request) {
  try {
    const uploadUrl = process.env.SAKURA_UPLOAD_URL;
    const token = process.env.SAKURA_UPLOAD_TOKEN;

    if (!uploadUrl || !token) {
      return NextResponse.json(
        { ok: false, error: "Server env missing (SAKURA_UPLOAD_URL / TOKEN)" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No file" },
        { status: 400 }
      );
    }

    // ===== ここがポイント =====
    // サクラへ転送する filename を安全名にする（日本語filenameで事故る環境対策）
    const safeName = sanitizeFilename(file.name);

    // Fileをそのままappendしても良いが、環境差を減らすためBlobに作り直す
    const buf = Buffer.from(await file.arrayBuffer());
    const blob = new Blob([buf], {
      type: file.type || "application/octet-stream",
    });

    // サクラへ転送（multipart/form-data）
    const forward = new FormData();
    forward.append("file", blob, safeName);

    // 元のファイル名も一緒に送っておく（必要ならPHP側で使える）
    forward.append("orig_name", file.name);

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Upload-Token": token,
        // Content-Type は FormData が自動で boundary を付けるので手で付けない
      },
      body: forward,
      cache: "no-store",
    });

    const text = await res.text();

    // JSONとして解釈できないときは、ステータス等も返してデバッグしやすくする
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Sakura returned non-JSON",
          status: res.status,
          statusText: res.statusText,
          raw: text,
        },
        { status: 502 }
      );
    }

    if (!res.ok || !json?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sakura upload failed",
          status: res.status,
          detail: json,
        },
        { status: 502 }
      );
    }

    // json: { ok:true, stored_name, url, file_name, size ... }
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
