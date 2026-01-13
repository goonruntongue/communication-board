import { NextRequest, NextResponse } from "next/server";

// サクラ側 download.php のURL（あなたの環境に合わせて固定）
const SAKURA_DOWNLOAD =
  "https://promiseasync.sakura.ne.jp/communication-board/endpoint/download.php";

// サクラ側が要求するトークン（upload.php / download.php と合わせる）
const UPLOAD_TOKEN = process.env.SAKURA_UPLOAD_TOKEN || "CHANGE_ME";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    const fileName = url.searchParams.get("filename") || "download";

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "missing name" },
        { status: 400 }
      );
    }

    // サクラへ（サーバー間通信なのでCORS関係なし）
    const sakuraUrl = `${SAKURA_DOWNLOAD}?name=${encodeURIComponent(name)}`;

    const res = await fetch(sakuraUrl, {
      headers: {
        "X-Upload-Token": UPLOAD_TOKEN,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: "sakura download failed", detail: text },
        { status: 500 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();

    // 日本語ファイル名も落とせるように Content-Disposition をRFC対応で付与
    const encoded = encodeURIComponent(fileName);

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          res.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "download api error",
        detail: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
