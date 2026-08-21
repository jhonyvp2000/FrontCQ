import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const safeFilename = path.basename(filename);

    const prodPath = path.join("C:", "sistemas_ogess", "FrontCQ", "public", "announcements", safeFilename);
    const workspacePath = path.join(process.cwd(), "public", "announcements", safeFilename);

    let fileBuffer: Buffer | null = null;

    try {
      fileBuffer = await fs.readFile(prodPath);
    } catch {
      try {
        fileBuffer = await fs.readFile(workspacePath);
      } catch {
        fileBuffer = null;
      }
    }

    if (!fileBuffer) {
      return new NextResponse("File Not Found", { status: 404 });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    let contentType = "image/png";
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (ext === ".gif") contentType = "image/gif";

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error al servir imagen de anuncio:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
