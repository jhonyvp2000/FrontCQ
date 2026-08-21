import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const adminUserId = formData.get("adminUserId") as string;
    const file = formData.get("file") as File;

    if (!adminUserId || !file) {
      return NextResponse.json(
        { success: false, message: "Falta el archivo o el ID de usuario administrador." },
        { status: 400 }
      );
    }

    // Verify admin user
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, adminUserId),
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Usuario no encontrado." },
        { status: 403 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "El archivo seleccionado debe ser una imagen (.png, .jpg, .webp)." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Clean filename
    const ext = path.extname(file.name) || ".png";
    const cleanBasename = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `infografia_${Date.now()}_${cleanBasename}${ext}`;

    // Target Directories: Workspace and Production
    const workspaceDir = path.join(process.cwd(), "public", "announcements");
    const prodDir = "C:\\sistemas_ogess\\FrontCQ\\public\\announcements";

    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, fileName), buffer);

    try {
      await fs.mkdir(prodDir, { recursive: true });
      await fs.writeFile(path.join(prodDir, fileName), buffer);
    } catch (prodErr) {
      console.warn("No se pudo copiar a la ruta de producción C:\\sistemas_ogess...", prodErr);
    }

    const publicUrl = `/announcements/${fileName}`;
    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: "¡Imagen cargada y guardada exitosamente!",
    });
  } catch (error) {
    console.error("Error en /api/upload-announcement-image:", error);
    return NextResponse.json(
      { success: false, message: "Error al guardar la imagen en el servidor." },
      { status: 500 }
    );
  }
}
