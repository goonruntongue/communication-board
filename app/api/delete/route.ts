import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const deleteUrl = process.env.SAKURA_DELETE_URL; // 例: https://promiseasync.../endpoint/delete.php
    const token = process.env.SAKURA_UPLOAD_TOKEN;

    if (!deleteUrl || !token) {
      return NextResponse.json(
        { ok: false, error: "Server env missing (SAKURA_DELETE_URL / TOKEN)" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const stored_name = body?.stored_name;

    if (!stored_name) {
      return NextResponse.json(
        { ok: false, error: "No stored_name" },
        { status: 400 }
      );
    }

    const res = await fetch(deleteUrl, {
      method: "POST",
      headers: {
        "X-Upload-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stored_name }),
      cache: "no-store",
    });

    const text = await res.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "non-json response",
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
          error: "Sakura delete failed",
          status: res.status,
          detail: json,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
